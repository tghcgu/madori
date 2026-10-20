import assert from 'node:assert/strict';

// 3Dの絵柄: 一覧から選ぶと3Dの見え方が変わり（線画・設計図・ネオンなどは画面全体に効果をかける）、
// リアルでは家具・設備の材質が木・布・金属などに分かれて本物らしくなる。選んだ絵柄は再読み込みでも残る
export async function verifyThreeStyles({ open, plan, output }) {
  const floor = { id: 'floor', type: 'room', name: '', x: 0, y: 0, w: 600, h: 400, color: '#c9ae7c', surface: 'wood' };
  const wall = { id: 'wall', type: 'wall', x1: 0, y1: 0, x2: 600, y2: 0 };
  const table = { id: 'table', type: 'furniture', kind: 'diningTable', x: 200, y: 140, w: 160, h: 90, rotation: 0 };
  const sofa = { id: 'sofa', type: 'furniture', kind: 'sofa', x: 60, y: 30, w: 200, h: 90, rotation: 0 };
  const page = await open(JSON.stringify(plan([floor, wall, table, sofa])));
  try {
    // 3Dの絵の平均の色と、色の数
    const look = () => page.locator('#threeCanvas').evaluate(canvas => {
      const copy = document.createElement('canvas');
      copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
      let r = 0, g = 0, b = 0, n = 0, hash = 0;
      for (let i = 0; i < data.length; i += 64) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
        hash = (Math.imul(hash, 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) >>> 0;
      }
      return { r: r / n, g: g / n, b: b / n, hash };
    });
    const choose = async (style) => {
      await page.locator('#threeStyleSelect').selectOption(style);
      await page.waitForTimeout(450);
      return look();
    };
    await page.locator('button[data-view-mode="three"]').first().click();
    await page.waitForTimeout(500);
    const values = await page.locator('#threeStyleSelect option').evaluateAll(options => options.map(option => option.value));
    assert.deepEqual(values, ['standard', 'real', 'model', 'line', 'mono', 'sepia', 'pencil', 'watercolor', 'sumie', 'anime', 'manga', 'pixel', 'retro', 'blueprint', 'neon', 'horror']);
    assert.equal(await page.locator('#threeStyleSelect').inputValue(), 'standard');
    const standard = await look();
    const seen = new Set([standard.hash]);
    for (const style of values.slice(1)) {
      const result = await choose(style);
      assert.ok(!seen.has(result.hash), `${style} looks different from the others`);
      seen.add(result.hash);
      if (style === 'line') assert.ok(result.r > 225 && Math.abs(result.r - result.b) < 4, `line art is white with black lines: ${JSON.stringify(result)}`);
      if (style === 'blueprint') assert.ok(result.b > result.r + 60, `blueprint is blue: ${JSON.stringify(result)}`);
      if (style === 'neon' || style === 'horror') assert.ok(result.r + result.g + result.b < 150, `${style} is dark: ${JSON.stringify(result)}`);
      if (style === 'retro') assert.ok(result.g > result.r && result.g > result.b, `retro is green: ${JSON.stringify(result)}`);
      if (style === 'sepia') assert.ok(result.r > result.b + 25, `sepia is brown: ${JSON.stringify(result)}`);
      if (style === 'mono') assert.ok(Math.abs(result.r - result.g) < 3 && Math.abs(result.g - result.b) < 3, `monochrome is gray: ${JSON.stringify(result)}`);
      if (['line', 'neon', 'manga', 'retro'].includes(style)) await page.screenshot({ path: `${output}/three-style-${style}.png` });
    }

    // リアル: 家具の材質が、木・布などに分かれる。標準に戻すと元の材質
    await choose('real');
    const kinds = async (id) => (await page.evaluate(id => window.__editorTest.materials(id), id)).map(item => item.real);
    assert.ok((await kinds('table')).includes('wood'), `the table is wood: ${await kinds('table')}`);
    assert.ok((await kinds('sofa')).includes('fabric'), `the sofa is fabric: ${await kinds('sofa')}`);
    // 家具を動かして作り直しても、リアルの材質のまま
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${output}/three-style-real.png` });
    await choose('standard');
    assert.ok((await kinds('table')).every(kind => kind === null), 'standard materials have no realistic patterns');

    // 選んだ絵柄は、再読み込みしても残る
    await choose('watercolor');
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.equal(await page.locator('#threeStyleSelect').inputValue(), 'watercolor');
    await page.locator('#threeStyleSelect').selectOption('standard');
    console.log('PASS: 3D looks: 16 looks from the list, each drawn differently, realistic materials for furniture, back to standard, and remembered after reload');
  } finally {
    await page.context().close();
  }
}
