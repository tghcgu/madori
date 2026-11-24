import assert from 'node:assert/strict';

// 回した家具の当たり: 体は回したあとの形で選び、大きさを変えるつまみ（四隅）も回したあとの角にある。
// 前はつまみの当たりが回す前の四角の角のままで、回した家具のまわりの何もない所を押すと、その家具をつかんでいた
export async function verifyRotatedHits({ open }) {
  const hall = { id: 'hall', type: 'room', name: '', x: 0, y: 0, w: 600, h: 400, surface: 'plain', color: '#ffffff' };
  // 横100・奥行200のベッドを90°回す（見た目は横200・奥行100。真ん中は (250, 200)）
  const bed = { id: 'bed', type: 'furniture', kind: 'bed', x: 200, y: 100, w: 100, h: 200, rotation: 90 };
  // 縦に回した長い文字（回したあとの形は、縦に細長い）
  const label = { id: 'label', type: 'text', text: '縦に回した長い文字のラベル', x: 500, y: 200, size: 20, rotation: 90 };
  const plan = { floors: [{ id: 'f1', name: '1F', entities: [hall, bed, label] }], activeFloor: 0, selectedId: null, roofs: [] };
  const page = await open(JSON.stringify(plan));
  try {
    await page.locator('button[data-view-mode="plan"]').first().click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const hit = (x, y) => page.evaluate(([x, y]) => window.__editorTest.hit(x, y), [x, y]);
    const item = async () => (await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.find(entity => entity.id === 'bed');
    // 回したあとの形の中（回す前の四角の外）は選べ、回す前の四角の角（回したあとの形の外）は選ばない
    assert.equal(await hit(165, 200), 'bed', 'the rotated body is hit');
    assert.equal(await hit(200, 100), 'hall', 'the old corner of the unrotated box is not the bed');
    assert.equal(await hit(300, 300), 'hall');
    // 回したあとの角（つまみ）をつかむと、向かいの角を動かさずに家具の向きに沿って大きさが変わる
    const corner = await page.evaluate(() => window.__editorTest.planPoint(150, 250));
    const target = await page.evaluate(() => window.__editorTest.planPoint(130, 290));
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await page.mouse.up();
    let after = await item();
    assert.equal(after.rotation, 90);
    assert.ok(Math.abs(after.w - 140) <= 10 && Math.abs(after.h - 220) <= 10, `the size follows the rotated axes: ${after.w} x ${after.h}`);
    // 向かいの角（回したあとの左上 = (350, 150)）は動かない
    const fixedX = after.x + after.w / 2 + after.h / 2, fixedY = after.y + after.h / 2 - after.w / 2;
    assert.ok(Math.abs(fixedX - 350) < 1 && Math.abs(fixedY - 150) < 1, `the opposite corner stays: ${fixedX}, ${fixedY}`);
    await page.keyboard.press('Control+z');
    after = await item();
    assert.deepEqual([after.x, after.y, after.w, after.h], [200, 100, 100, 200], 'undo puts the size back');
    // 斜め（Shift+R を2回で 120°）でも、見えている角でつかめ、回す前の角では選ばない
    const body = await page.evaluate(() => window.__editorTest.planPoint(165, 200));
    await page.mouse.click(body.x, body.y);
    assert.deepEqual(await page.evaluate(() => window.__editorTest.selection()), ['bed']);
    await page.keyboard.press('Shift+R');
    await page.keyboard.press('Shift+R');
    assert.equal((await item()).rotation, 120);
    const a = (120 * Math.PI) / 180, cx = 250, cy = 200;
    const se = { x: cx + 50 * Math.cos(a) - 100 * Math.sin(a), y: cy + 50 * Math.sin(a) + 100 * Math.cos(a) };
    assert.equal(await hit(se.x, se.y), 'bed', 'the corner of a slanted bed is the bed');
    assert.equal(await hit(300, 100), 'hall', 'the old corner of a slanted bed is not the bed');
    // 斜めの角を外へ引くと、家具の向きに沿って大きくなる（回した向きはそのまま）
    const from = await page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [se.x, se.y]);
    const outward = { x: se.x + 30 * Math.cos(a) - 20 * Math.sin(a), y: se.y + 30 * Math.sin(a) + 20 * Math.cos(a) };
    const to = await page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [outward.x, outward.y]);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    after = await item();
    assert.equal(after.rotation, 120);
    assert.ok(Math.abs(after.w - 130) <= 10 && Math.abs(after.h - 220) <= 10, `a slanted bed grows along its own axes: ${after.w} x ${after.h}`);
    // 回した文字も、回したあとの形で囲んで選べる（縦に細長い四角で囲む）
    await page.keyboard.press('Escape');
    const [from2, to2] = await page.evaluate(() => [window.__editorTest.planPoint(470, 40), window.__editorTest.planPoint(530, 360)]);
    await page.keyboard.down('Control');
    await page.mouse.move(from2.x, from2.y);
    await page.mouse.down();
    await page.mouse.move(to2.x, to2.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    assert.deepEqual(await page.evaluate(() => window.__editorTest.selection()), ['label'], 'a rotated text is selected by a box around its rotated shape');
  } finally {
    await page.context().close();
  }
  console.log('PASS: rotated furniture: the body and the resize corners follow the rotation, resizing keeps the opposite corner, undo');
}
