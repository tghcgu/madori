import assert from 'node:assert/strict';

// 家具を置くツール・消すツールのままでも、ダブルクリック（タッチは2回タップ・長押し）で物を選べる。2Dでも3Dでも同じ。
// 1回目のクリックで置いた家具・消した物は取り消し、取り消した変更は「やり直し」にも残さない
export async function verifyDoublePress({ open, plan }) {
  const floor = { id: 'floor', type: 'room', name: '', x: 0, y: 0, w: 600, h: 400, color: '#c9ae7c', surface: 'wood' };
  const table = { id: 'table', type: 'furniture', kind: 'table', x: 220, y: 160, w: 160, h: 85, rotation: 0 };
  const page = await open(JSON.stringify(plan([floor, table])), { hasTouch: true });
  try {
    const ids = () => page.evaluate(() => window.__editorTest.selection());
    const furniture = async () => (await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.filter(item => item.type === 'furniture');
    const point = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
    const tool = () => page.locator('[data-tool].is-active').first().getAttribute('data-tool');
    const chairTool = async () => {
      await page.locator('[data-furniture="chair"]').first().click();
      assert.equal(await page.locator('[data-furniture="chair"]').first().getAttribute('aria-pressed'), 'true');
    };
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.waitForTimeout(300);

    // 2D: 椅子を置くツールのまま、テーブルをダブルクリックするとテーブルが選ばれ、椅子は増えない
    await chairTool();
    let at = await point(300, 200);
    await page.mouse.dblclick(at.x, at.y);
    assert.deepEqual(await ids(), ['table'], 'double-click selects the table under the chair tool');
    assert.equal((await furniture()).length, 1, 'no chair is left behind');
    assert.equal(await tool(), 'select');
    assert.equal(await page.locator('#redoButton').isDisabled(), true, 'the cancelled placement is not kept for redo');
    // 何もない所（床の上）なら床が選ばれる
    await chairTool();
    at = await point(80, 80);
    await page.mouse.dblclick(at.x, at.y);
    assert.deepEqual(await ids(), ['floor']);
    assert.equal((await furniture()).length, 1);
    // 1回のクリックでは、これまでどおり椅子を置ける。別の家具を選び直せば、同じ所にすぐ続けて置ける
    await chairTool();
    at = await point(80, 300);
    await page.mouse.click(at.x, at.y);
    assert.equal((await furniture()).length, 2, 'a single click still places a chair');
    await page.locator('[data-furniture="stool"]').first().click();
    await page.mouse.click(at.x, at.y);
    assert.deepEqual((await furniture()).map(item => item.kind), ['table', 'chair', 'stool'], 'choosing another item starts a new click');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    assert.equal((await furniture()).length, 1);

    // 2D: 消すツールのままダブルクリックしても消さずに選ぶ
    await page.locator('[data-tool="erase"]').first().click();
    at = await point(300, 200);
    await page.mouse.dblclick(at.x, at.y);
    assert.equal((await furniture()).length, 1, 'the table is not erased');
    assert.deepEqual(await ids(), ['table']);

    // 2D: 指で2回続けてタップしても選べる
    const client = await page.context().newCDPSession(page);
    const touch = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const tap = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd'); };
    await page.keyboard.press('Escape');
    await chairTool();
    at = await point(300, 200);
    await tap(at.x, at.y);
    await page.waitForTimeout(80);
    await tap(at.x, at.y);
    await page.waitForTimeout(200);
    assert.deepEqual(await ids(), ['table'], 'a double tap selects the table');
    assert.equal((await furniture()).length, 1);

    // 3D: 椅子を置くツールのまま、テーブルをダブルクリックするとテーブルが選ばれ、そのまま動かせる
    await chairTool();
    const center = await page.evaluate(([x, y]) => window.__editorTest.project(x, y, 0.42), [table.x + table.w / 2, table.y + table.h / 2]);
    await page.mouse.dblclick(center.x, center.y);
    await page.waitForTimeout(200);
    assert.deepEqual(await ids(), ['table'], 'double-click in 3D selects the table under the chair tool');
    assert.equal((await furniture()).length, 1, 'no chair is placed in 3D');
    assert.equal(await page.locator('#threeMoveToggle').getAttribute('aria-pressed'), 'true', 'the table can be dragged right away');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // 3D: 指の長押しでも、置くツールのまま選べ、そのまま動かせる
    await chairTool();
    await touch('touchStart', center.x, center.y);
    await page.waitForTimeout(700);
    assert.deepEqual(await ids(), ['table'], 'a long press in 3D selects the table');
    assert.equal((await furniture()).length, 1, 'the chair started by the press is dropped');
    for (let i = 1; i <= 6; i += 1) {
      await touch('touchMove', center.x + i * 10, center.y + i * 4);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    await page.waitForTimeout(200);
    const moved = (await furniture()).find(item => item.id === 'table');
    assert.ok(moved.x !== table.x || moved.y !== table.y, 'the table follows the finger');
    await page.keyboard.press('Control+z');
    const back = (await furniture()).find(item => item.id === 'table');
    assert.deepEqual([back.x, back.y], [table.x, table.y]);
    console.log('PASS: double-click, double tap and long press select things while placing or erasing, in 2D and 3D, without leaving placements behind');
  } finally {
    await page.context().close();
  }
}
