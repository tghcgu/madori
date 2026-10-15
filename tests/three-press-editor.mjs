import assert from 'node:assert/strict';

// 3Dの家具: マウスの1回クリックでは選ばず、選び方（ダブルクリック）を案内する。
// タッチ（指）では、長押しで選んで、そのまま指を動かすと家具が動く。ドア・窓も、ダブルクリック（タッチは長押し）で選ぶ
export async function verifyThreePress({ open, plan, project }) {
  const table = { id: 'table', type: 'furniture', kind: 'table', x: 220, y: 160, w: 160, h: 85, rotation: 0 };
  const floor = { id: 'floor', type: 'room', name: '', x: 0, y: 0, w: 600, h: 400, color: '#c9ae7c', surface: 'wood' };
  const wall = { id: 'back', type: 'wall', x1: 0, y1: 40, x2: 600, y2: 40 };
  const door = { id: 'door', type: 'door', x1: 440, y1: 40, x2: 530, y2: 40 };
  const windowItem = { id: 'window', type: 'window', x1: 80, y1: 40, x2: 180, y2: 40 };
  const page = await open(JSON.stringify(plan([floor, wall, door, windowItem, table])), { hasTouch: true });
  try {
    const ids = () => page.evaluate(() => window.__editorTest.selection());
    const furniture = async () => (await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.find(item => item.id === 'table');
    await page.locator('[data-view-mode="three"]').click();
    await page.waitForTimeout(500);
    const center = await page.evaluate(([x, y]) => window.__editorTest.project(x, y, 0.42), [table.x + table.w / 2, table.y + table.h / 2]);
    await page.mouse.click(center.x, center.y);
    assert.deepEqual(await ids(), [], 'a single click does not select furniture');
    assert.equal(await page.locator('#threeHint').isVisible(), true, 'it tells how to select furniture instead');
    assert.match(await page.locator('#threeHint').textContent(), /ダブルクリック/);

    // 指で長押しすると選ばれ、そのまま指を動かすと家具が動く
    const client = await page.context().newCDPSession(page);
    const touch = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', center.x, center.y);
    await page.waitForTimeout(700);
    assert.deepEqual(await ids(), ['table'], 'a long press selects the furniture');
    for (let i = 1; i <= 6; i += 1) {
      await touch('touchMove', center.x + i * 10, center.y + i * 4);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    await page.waitForTimeout(200);
    const moved = await furniture();
    assert.ok(moved.x !== table.x || moved.y !== table.y, `the furniture follows the finger: ${moved.x}, ${moved.y}`);
    await page.keyboard.press('Control+z');
    const back = await furniture();
    assert.deepEqual([back.x, back.y], [table.x, table.y], 'the move is one undo step');

    // 移動のモードを終えて（Esc）から、指をすぐ動かせば、家具は動かず視点が回る
    await page.keyboard.press('Escape');
    const before = await furniture();
    await touch('touchStart', center.x, center.y);
    for (let i = 1; i <= 6; i += 1) {
      await touch('touchMove', center.x + i * 12, center.y);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(600);
    await touch('touchEnd');
    assert.deepEqual(await furniture(), before, 'a quick drag turns the view instead');

    // ドア・窓も家具と同じ: 1回のクリックでは選ばずに案内し、ダブルクリック（タッチは長押し）で選ぶ。ドラッグで動かすモードにはしない
    for (const item of [door, windowItem]) {
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      assert.deepEqual(await ids(), []);
      const at = await page.evaluate(([x, y]) => window.__editorTest.project(x, y, 1.2), [(item.x1 + item.x2) / 2, item.y1]);
      await page.mouse.click(at.x, at.y);
      assert.deepEqual(await ids(), [], `a single click does not select the ${item.id}`);
      assert.match(await page.locator('#threeHint').textContent(), /ドア・窓はダブルクリック/);
      await page.mouse.dblclick(at.x, at.y);
      assert.deepEqual(await ids(), [item.id], `a double-click selects the ${item.id}`);
      assert.equal(await page.locator('#threeMoveToggle').getAttribute('aria-pressed'), 'false');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await touch('touchStart', at.x, at.y);
      await page.waitForTimeout(700);
      await touch('touchEnd');
      await page.waitForTimeout(200);
      assert.deepEqual(await ids(), [item.id], `a long press selects the ${item.id}`);
    }
    console.log('PASS: 3D furniture, doors and windows: a single click explains double-click, a touch long press selects (and drags furniture), and a quick swipe still orbits');
  } finally {
    await page.context().close();
  }
}
