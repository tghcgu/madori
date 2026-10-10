import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const viewKey = 'madori-quick-3d-view-state';
const initialCamera = { position: [3, 1.7, 4.8], target: [3, 1.625, 4.05] };
const fixture = {
  floors: [{ id: 'f1', name: '1F', entities: [
    { id: 'room', type: 'room', name: '', x: 0, y: 0, w: 600, h: 400, color: '#ffffff', surface: 'wood' },
    { id: 'front', type: 'wall', x1: 0, y1: 400, x2: 600, y2: 400 },
    { id: 'back', type: 'wall', x1: 0, y1: 0, x2: 600, y2: 0 },
    { id: 'left', type: 'wall', x1: 0, y1: 0, x2: 0, y2: 400 },
    { id: 'right', type: 'wall', x1: 600, y1: 0, x2: 600, y2: 400 },
    { id: 'window', type: 'window', x1: 160, y1: 400, x2: 440, y2: 400 },
    { id: 'door', type: 'door', x1: 250, y1: 0, x2: 330, y2: 0 },
    { id: 'table', type: 'furniture', kind: 'table', x: 220, y: 160, w: 160, h: 85, rotation: 0 },
    { id: 'fridge', type: 'furniture', kind: 'fridge', x: 440, y: 40, w: 65, h: 70, rotation: 0 },
  ] }], activeFloor: 0, selectedId: null, roofs: [],
};

export async function verifyInteriorZoom(page, output, touch = false) {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const onConsole = message => { if (message.type() === 'error') errors.push(message.text()); };
  page.on('console', onConsole);
  const session = touch ? await page.context().newCDPSession(page) : null;
  const suffix = touch ? 'mobile' : 'desktop';
  const pose = async () => {
    await page.waitForTimeout(touch ? 1600 : 650);
    return page.evaluate(key => JSON.parse(localStorage.getItem(key)).camera, viewKey);
  };
  const pixels = () => page.locator('#threeCanvas').evaluate(canvas => {
    const copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d'); ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
    const colors = new Set();
    let hash = 0;
    for (let i = 0; i < data.length; i += 64) {
      colors.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
      hash = (Math.imul(hash, 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) >>> 0;
    }
    return { colors: colors.size, hash };
  });
  const zoom = async (dy, count) => {
    const box = await page.locator('#threeCanvas').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (!touch) {
      await page.mouse.move(x, y);
      for (let i = 0; i < count; i++) await page.mouse.wheel(0, dy);
      return;
    }
    const fingers = radius => [{ id: 1, x: x - radius, y }, { id: 2, x: x + radius, y }];
    for (let i = 0; i < count; i++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(45) });
      for (let step = 1; step <= 4; step++) {
        const radius = 45 * Math.exp(-dy * 0.0005 * step / 4);
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(radius) });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };
  try {
    // 保存済みの視点から再現する。カメラを変更するテスト専用APIは使わない。
    await page.addInitScript(({ fixture, initialCamera, viewKey }) => {
      if (sessionStorage.getItem('interior-camera-seeded')) return;
      localStorage.setItem('madori-quick-3d-plan', JSON.stringify(fixture));
      localStorage.setItem('madori-quick-3d-view-mode', 'three');
      localStorage.setItem(viewKey, JSON.stringify({ camera: initialCamera, panelHidden: true }));
      sessionStorage.setItem('interior-camera-seeded', 'yes');
    }, { fixture, initialCamera, viewKey });
    await page.reload();
    await page.locator('#threeCanvas').waitFor({ state: 'visible' });
    const before = await pose();
    assert.ok(before.position.every((value, i) => Math.abs(value - initialCamera.position[i]) < 1e-6), 'starts immediately outside the window');
    const initialPixels = await pixels();
    assert.ok(initialPixels.colors > 30, 'window and interior render before zooming');
    await page.screenshot({ path: `${output}/camera-before-${suffix}.png` });
    await zoom(-200, 12);
    const inside = await pose();
    assert.ok(inside.position[2] < 3.4, `camera crosses the window at z=4 into the room: ${inside.position[2]}`);
    assert.ok(inside.position[2] > 0 && inside.position[1] > 1, 'camera stays inside the room above the floor');
    assert.ok(before.position[2] - inside.position[2] > 1.4, 'camera advances beyond its original orbit target');
    const interiorPixels = await pixels();
    assert.ok(interiorPixels.colors > 30, 'interior is not blank after crossing the window');
    assert.notEqual(interiorPixels.hash, initialPixels.hash, 'zoom visibly changes the scene');
    await page.screenshot({ path: `${output}/camera-inside-${suffix}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
    await page.reload();
    await page.locator('#threeCanvas').waitFor({ state: 'visible' });
    const restored = await pose();
    for (const key of ['position', 'target']) {
      assert.ok(restored[key].every((value, i) => Math.abs(value - inside[key][i]) < 1e-3), `interior ${key} survives reload: ${inside[key]} -> ${restored[key]}`);
    }
    await zoom(-200, 4);
    const deeper = await pose();
    assert.ok(inside.position[2] - deeper.position[2] > 0.5, 'zoom keeps advancing inside the room');
    await zoom(200, 12);
    const outside = await pose();
    assert.ok(outside.position[2] > 4.5, 'reverse zoom retreats outside');
    assert.ok([...outside.position, ...outside.target].every(Number.isFinite));
    await page.locator('[data-view-mode="split"]').click();
    if (!touch) await page.locator('#fitButton').click();
    assert.ok((await pose()).position[1] > 3, 'fit restores an overview');
    assert.deepEqual(errors, []);
    console.log(`PASS: ${suffix} camera crosses the window, advances indoors, restores its view, retreats and fits`);
  } finally {
    await session?.detach();
    page.off('pageerror', onError);
    page.off('console', onConsole);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { chromium } = await import('playwright');
  const output = '.codex/regression';
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(process.argv[2] || 'http://127.0.0.1:5185/');
    await verifyInteriorZoom(page, output);
    await page.context().close();
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.goto(process.argv[2] || 'http://127.0.0.1:5185/');
    await verifyInteriorZoom(mobile, output, true);
  } finally {
    await browser.close();
  }
}
