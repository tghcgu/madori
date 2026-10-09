// 家具ごと・デザインごとに「2Dの記号」と「3Dを真上から見た図」を並べた見比べ画像を作る。
// 2Dと3Dは真上から見て必ず同じ形にする決まりなので、家具やデザインを変えたら、これでずれがないか目で確かめる。
// 使い方: npm run compare            … すべての家具とデザイン
//         npm run compare -- rock,pond … 種類（FURNITURE_DEFS のキー）をカンマ区切りで指定すると、その種類だけ
// 画像は .codex/compare/compare-01.png … に出る（.codex は git に入れない作業用の場所）
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const only = process.argv[2] ? process.argv[2].split(',') : null;
const output = '.codex/compare';
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'compare-probe',
  transform(code, id) {
    if (!id.split(String.fromCharCode(92)).join('/').endsWith('/src/main.ts')) return;
    return `${code}
window.__compare = (only) => {
  const cell = 240, rows = [];
  const glCanvas = document.createElement('canvas');
  glCanvas.width = cell * 2; glCanvas.height = cell * 2;
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(cell * 2, cell * 2, false);
  for (const [kind, def] of Object.entries(FURNITURE_DEFS)) {
    if (only && !only.includes(kind)) continue;
    const labels = ['標準', ...(FURNITURE_VARIANTS[kind] ?? [])];
    labels.forEach((label, symbol) => {
      const scale = Math.min((cell - 24) / def.w, (cell - 24) / def.h) * 2;
      const plan = document.createElement('canvas');
      plan.width = cell * 2; plan.height = cell * 2;
      const target = plan.getContext('2d');
      target.fillStyle = '#fff'; target.fillRect(0, 0, plan.width, plan.height);
      const saved = ctx; ctx = target;
      ctx.setTransform(scale, 0, 0, scale, cell, cell);
      ctx.lineWidth = 2.4 / scale; ctx.strokeStyle = INK; ctx.fillStyle = furnitureSymbolFill(kind);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      drawFurnitureSymbol(kind, def.w, def.h, symbol);
      ctx = saved;
      // 3D: 真上から平行投影。画面の上が奥（2Dの上）になるようにする
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);
      const model = buildFurnitureModel({ kind, w: def.w, h: def.h, symbol });
      scene.add(model);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9290, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-2, 6, -3); scene.add(sun);
      const halfW = cell / scale, halfH = cell / scale;
      const camera = new THREE.OrthographicCamera(-halfW / 100, halfW / 100, halfH / 100, -halfH / 100, 0.01, 100);
      camera.position.set(0, 40, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      const top = glCanvas.toDataURL();
      scene.traverse(o => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach(m => m.dispose()); });
      rows.push({ name: def.label + (symbol ? '（' + label + '）' : ''), plan: plan.toDataURL(), top });
    });
  }
  renderer.dispose();
  return rows;
};`;
  },
}] });
await server.listen();
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => Boolean(window.__compare));
  const rows = await page.evaluate(only => window.__compare(only), only);
  const sheet = await browser.newPage({ viewport: { width: 1500, height: 800 } });
  await sheet.setContent('<style>body{margin:0;font:13px system-ui;background:#fff;display:grid;grid-template-columns:repeat(3,500px)}figure{margin:0;padding:6px;border:1px solid #ddd}figcaption{font-weight:600;padding:2px 4px}div{display:flex;gap:4px}img{width:240px;height:240px;border:1px solid #eee}</style>');
  await sheet.evaluate(rows => {
    for (const row of rows) {
      const figure = document.createElement('figure'), caption = document.createElement('figcaption'), pair = document.createElement('div');
      caption.textContent = row.name;
      for (const url of [row.plan, row.top]) { const img = document.createElement('img'); img.src = url; pair.append(img); }
      figure.append(caption, pair); document.body.append(figure);
    }
  }, rows);
  await sheet.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  const height = await sheet.evaluate(() => document.body.scrollHeight);
  const perPage = 4 * 282;
  for (let part = 0; part * perPage < height; part += 1) {
    await sheet.setViewportSize({ width: 1500, height: Math.min(perPage, height - part * perPage) });
    await sheet.evaluate(y => scrollTo(0, y), part * perPage);
    await sheet.screenshot({ path: `${output}/compare-${String(part + 1).padStart(2, '0')}.png` });
  }
  console.log(`pairs: ${rows.length}, pages: ${Math.ceil(height / perPage)}`);
} finally {
  await browser.close();
  await server.close();
}
