import assert from 'node:assert/strict';

// 屋根: 庭や地面の床に重なった縁でも、2Dでクリックして選べる（いま見ている階の屋根を優先）。
// 屋根の色は見本とカラーコードで変えられ、3Dの屋根の色・透け具合になり、元に戻す・再読み込みでも残る
export async function verifyRoofColor({ open, output }) {
  const ground = { id: 'garden', type: 'room', name: '', x: 0, y: 0, w: 1000, h: 800, color: '#83ab57', surface: 'grass' };
  const house = { id: 'house', type: 'room', name: '', x: 300, y: 200, w: 400, h: 400, color: '#ffffff', surface: 'plain' };
  const upper = { id: 'upper', type: 'room', name: '', x: 300, y: 200, w: 400, h: 400, color: '#ffffff', surface: 'plain' };
  const roofs = [
    { id: 'roof1', type: 'roof', kind: 'gable', x: 260, y: 160, w: 480, h: 480, floorId: 'f1' },
    { id: 'roof2', type: 'roof', kind: 'hip', x: 260, y: 160, w: 480, h: 480, floorId: 'f2' },
  ];
  const data = { floors: [{ id: 'f1', name: '1F', entities: [ground, house] }, { id: 'f2', name: '2F', entities: [upper] }], activeFloor: 0, selectedId: null, roofs };
  const page = await open(JSON.stringify(data));
  try {
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('madori-quick-3d-plan')));
    const point = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
    const ids = () => page.evaluate(() => window.__editorTest.selection());
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.waitForTimeout(300);

    // 1階を見ているとき、庭の上にある縁をクリックすると1階の屋根が選ばれる（同じ形の2階の屋根より先）
    let at = await point(260, 400);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), ['roof1'], 'the 1F roof edge over the garden selects the 1F roof');
    // 縁から離れた庭は、ふつうに庭（床）が選ばれる
    at = await point(100, 400);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), ['garden']);
    // 2階を見ているときは、同じ所で2階の屋根が選ばれる
    await page.locator('#floorTabs button').filter({ hasText: /^2F$/ }).first().click();
    at = await point(260, 400);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), ['roof2'], 'the 2F roof is chosen while viewing 2F');
    await page.locator('#floorTabs button').filter({ hasText: /^1F$/ }).first().click();
    at = await point(260, 400);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), ['roof1']);

    // 色の見本: 赤茶にすると、3Dの屋根もその色
    const roofColor = async id => (await page.evaluate(id => window.__editorTest.materials(id), id)).map(item => item.color);
    assert.ok((await roofColor('roof1')).every(color => color === '5d6773'), 'the standard roof color');
    await page.locator('[data-roof-color="#9c4a2f"]').click();
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').color, '#9c4a2f');
    assert.ok((await roofColor('roof1')).every(color => color === '9c4a2f'), 'the 3D roof takes the chosen color');
    assert.ok((await roofColor('roof2')).every(color => color === '5d6773'), 'other roofs keep their color');
    assert.equal(await page.locator('[data-roof-color="#9c4a2f"]').getAttribute('class'), 'pen-color is-active');

    // カラーコードの末尾2桁で透かす
    await page.locator('#roofColorInputCode').fill('#2f6b4f80');
    await page.locator('#roofColorInputCode').press('Enter');
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').color, '#2f6b4f80');
    const translucent = await page.evaluate(() => window.__editorTest.materials('roof1'));
    assert.ok(translucent.every(item => item.color === '2f6b4f' && item.transparent && Math.abs(item.opacity - 128 / 255) < 0.01 && !item.shadow), JSON.stringify(translucent));
    await page.screenshot({ path: `${output}/roof-color.png` });

    // 見本を選び直しても透け具合は残り、標準の色を選ぶと色の指定がなくなる
    await page.locator('[data-roof-color="#c8452f"]').click();
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').color, '#c8452f80');
    await page.locator('#roofColorInputCode').fill('');
    await page.locator('#roofColorInputCode').press('Enter');
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').color, undefined);
    await page.keyboard.press('Control+z');
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').color, '#c8452f80');
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').color, '#c8452f80');
    assert.ok((await roofColor('roof1')).every(color => color === 'c8452f'));

    // 屋根ごとに置く高さを上げ下げできる（同じ階の屋根でも別の高さに）
    const bottom = async id => (await page.evaluate(id => window.__editorTest.bounds(id), id)).min[1];
    assert.deepEqual(await ids(), ['roof1']);
    const before = await bottom('roof1'), other = await bottom('roof2');
    await page.locator('#roofElevationInput').fill('-120');
    await page.locator('#roofElevationInput').press('Tab');
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').elevation, -120);
    assert.ok(Math.abs(await bottom('roof1') - (before - 1.2)) < 0.01, 'the roof is lowered by 120 cm');
    assert.ok(Math.abs(await bottom('roof2') - other) < 0.001, 'the other roof stays');
    await page.locator('#roofElevationInput').fill('0');
    await page.locator('#roofElevationInput').press('Tab');
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').elevation, undefined, '0 is not stored');
    await page.keyboard.press('Control+z');
    assert.equal((await saved()).roofs.find(item => item.id === 'roof1').elevation, -120);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.ok(Math.abs(await bottom('roof1') - (before - 1.2)) < 0.01, 'the height is kept after reload');
    console.log('PASS: roofs: edges over the garden select the roof of the viewed floor, color swatches, see-through color codes, raise/lower each roof, undo and reload');
  } finally {
    await page.context().close();
  }
}
