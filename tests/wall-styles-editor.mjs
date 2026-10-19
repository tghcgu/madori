import assert from 'node:assert/strict';

// 壁の種類: 一覧の「壁」から選んで2Dをドラッグすると、その種類の壁。選んだ壁の種類を絵で変えられ、3Dの高さも種類に合う。再読み込みでも残る
export async function verifyWallStyles({ open, plan, output }) {
  const ground = { id: 'ground', type: 'room', name: '', x: 0, y: 0, w: 1200, h: 800, color: '#83ab57', surface: 'grass' };
  const page = await open(JSON.stringify(plan([ground])));
  try {
    const point = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
    const walls = async () => (await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.filter(item => item.type === 'wall');
    const height = async (id) => { const box = await page.evaluate(id => window.__editorTest.bounds(id), id); return box ? box.max[1] - box.min[1] : 0; };
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.waitForTimeout(300);

    // 一覧の「壁」に、種類が絵付きで並ぶ
    const group = page.locator('details.palette-group', { has: page.locator('summary', { hasText: /^壁$/ }) });
    if (await group.getAttribute('open') === null) await group.locator('summary').click();
    assert.ok(await group.locator('[data-wall-style]').count() >= 10, 'the wall group lists the wall types');
    assert.equal(await group.locator('[data-wall-style] .wall-swatch').count(), await group.locator('[data-wall-style]').count(), 'each wall type has a picture');
    await group.locator('[data-wall-style="stoneWall"]').click();
    assert.equal(await page.locator('.tool-button[data-tool="wall"]').getAttribute('aria-pressed'), 'true', 'choosing a wall type starts the wall tool');
    assert.equal(await page.locator('#wallToolStylePicker [data-wall-style-choice="stoneWall"]').getAttribute('aria-checked'), 'true');

    // ドラッグで、その種類の壁
    const from = await point(100, 200), to = await point(700, 200);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    let wall = (await walls()).at(-1);
    assert.equal(wall?.wallStyle, 'stoneWall', 'the new wall is a stone wall');
    const stoneHeight = await height(wall.id);
    assert.ok(stoneHeight > 0.8 && stoneHeight < 1.3, `the stone wall is low in 3D: ${stoneHeight}`);

    // 選んだ壁の種類を、絵の欄で変える（ふつうの壁は種類を持たない）
    await page.locator('[data-tool="select"]').first().click();
    const at = await point(400, 200);
    await page.mouse.click(at.x, at.y);
    assert.equal(await page.locator('#wallStylePicker [data-wall-style-choice="stoneWall"]').getAttribute('aria-checked'), 'true');
    await page.locator('#wallStylePicker [data-wall-style-choice="brick"]').click();
    wall = (await walls()).find(item => item.id === wall.id);
    assert.equal(wall.wallStyle, 'brick');
    assert.ok(await height(wall.id) > 2.4, 'a brick wall is as tall as the floor');
    await page.locator('#wallStylePicker [data-wall-style-choice="earthen"]').click();
    const earthen = await page.evaluate(id => window.__editorTest.bounds(id), wall.id);
    assert.ok(earthen.max[1] - earthen.min[1] > 1.9 && earthen.max[1] - earthen.min[1] < 2.3, 'an earthen wall stands with its tile cap');
    await page.screenshot({ path: `${output}/wall-styles.png` });
    await page.locator('#wallStylePicker [data-wall-style-choice="plain"]').click();
    wall = (await walls()).find(item => item.id === wall.id);
    assert.equal(wall.wallStyle, undefined, 'a plain wall has no type');
    await page.keyboard.press('Control+z');
    assert.equal((await walls()).find(item => item.id === wall.id).wallStyle, 'earthen', 'undo brings the type back');

    // 再読み込みしても、種類が残る
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.equal((await walls()).find(item => item.id === wall.id).wallStyle, 'earthen');
    console.log('PASS: wall types: chosen from pictures in the palette and the selection panel, drawn by dragging, 3D heights by type, undo and reload');
  } finally {
    await page.context().close();
  }
}
