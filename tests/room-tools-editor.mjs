import assert from 'node:assert/strict';

// 部屋と家具の扱い: 壁ぎわに置く家具は背を壁に向けて付く（Alt で付けない）、部屋を動かすと中身も動く（Alt で部屋だけ）、
// 中身のある部屋を消すと一緒に消すかを聞く、消しゴムはドラッグで続けて消せる
export async function verifyRoomTools({ open, plan }) {
  const room = (id, x, y, w, h) => ({ id, type: 'room', name: '', x, y, w, h, color: '#ffffff', surface: 'wood' });
  const wall = (id, x1, y1, x2, y2) => ({ id, type: 'wall', x1, y1, x2, y2 });
  const chair = (id, x, y) => ({ id, type: 'furniture', kind: 'chair', x, y, w: 45, h: 45, rotation: 0 });
  const entities = [
    room('a', 0, 0, 400, 300), room('b', 400, 0, 300, 300),
    wall('aN', 0, 0, 400, 0), wall('aW', 0, 0, 0, 300), wall('aS', 0, 300, 400, 300), wall('shared', 400, 0, 400, 300),
    wall('bN', 400, 0, 700, 0), wall('bE', 700, 0, 700, 300), wall('bS', 400, 300, 700, 300),
    { id: 'door', type: 'door', x1: 150, y1: 300, x2: 230, y2: 300 },
    chair('chairA', 100, 100), chair('chairB', 500, 100),
    chair('e1', 100, 500), chair('e2', 200, 500), chair('e3', 300, 500),
  ];
  const page = await open(JSON.stringify(plan(entities)));
  try {
    const snapshot = () => page.evaluate(() => window.__editorTest.snapshot());
    const find = async (id) => (await snapshot()).floors[0].entities.find((item) => item.id === id);
    const point = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
    const dragPlan = async (from, to, steps = 12) => {
      const a = await point(...from), b = await point(...to);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps });
      await page.mouse.up();
    };
    const tool = (name) => page.locator(`.tool-button[data-tool="${name}"]`).click();
    await page.locator('button[data-view-mode="split"]').first().click();

    // 部屋を動かすと、中の家具・その部屋の壁とドアも動く。隣の部屋との境の壁と、隣の部屋の物は動かない
    await tool('select');
    await dragPlan([300, 220], [400, 220]);
    assert.equal((await find('a')).x, 100, 'the room moved');
    assert.equal((await find('chairA')).x, 200, 'the chair inside moved with it');
    assert.deepEqual([(await find('aN')).x1, (await find('aW')).x1, (await find('aS')).x1, (await find('door')).x1], [100, 100, 100, 250], 'its own walls and door moved');
    assert.equal((await find('shared')).x1, 400, 'the shared wall stayed');
    assert.equal((await find('chairB')).x, 500, 'the next room kept its chair');
    await page.keyboard.press('Control+z');
    assert.equal((await find('chairA')).x, 100, 'one undo puts everything back');
    // Alt を押しながらなら、部屋だけ
    await page.keyboard.down('Alt');
    await dragPlan([300, 220], [400, 220]);
    await page.keyboard.up('Alt');
    assert.equal((await find('a')).x, 100);
    assert.equal((await find('chairA')).x, 100, 'Alt moves only the room');
    await page.keyboard.press('Control+z');

    // 中身のある部屋を消すと、一緒に消すかを聞く。OK なら中身も、キャンセルなら部屋だけ
    const at = await point(300, 220);
    await page.mouse.click(at.x, at.y);
    let message = '';
    page.once('dialog', (dialog) => { message = dialog.message(); dialog.accept(); });
    await page.keyboard.press('Delete');
    await page.waitForTimeout(100);
    assert.match(message, /部屋の中に\d+個の物があります/);
    let ids = (await snapshot()).floors[0].entities.map((item) => item.id);
    for (const id of ['a', 'chairA', 'aN', 'aW', 'aS', 'door']) assert.ok(!ids.includes(id), `${id} was deleted with the room`);
    for (const id of ['b', 'shared', 'chairB']) assert.ok(ids.includes(id), `${id} stays`);
    await page.keyboard.press('Control+z');
    await page.mouse.click(at.x, at.y);
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.keyboard.press('Delete');
    await page.waitForTimeout(100);
    ids = (await snapshot()).floors[0].entities.map((item) => item.id);
    assert.ok(!ids.includes('a') && ids.includes('chairA') && ids.includes('aN'), 'Cancel deletes only the room');
    await page.keyboard.press('Control+z');

    // 消しゴムでドラッグすると、通った所の家具を続けて消す。元に戻すは1回で全部戻る
    await tool('erase');
    await dragPlan([80, 522], [340, 522], 30);
    ids = (await snapshot()).floors[0].entities.map((item) => item.id);
    assert.ok(!ids.includes('e1') && !ids.includes('e2') && !ids.includes('e3'), 'dragging the eraser deletes every chair it crosses');
    await page.keyboard.press('Control+z');
    ids = (await snapshot()).floors[0].entities.map((item) => item.id);
    assert.ok(ids.includes('e1') && ids.includes('e2') && ids.includes('e3'), 'one undo brings them all back');

    // 壁ぎわに置く家具は、背を壁に向けて壁に付く（壁の厚み10cm: 壁の面は 5cm）
    const palette = page.locator('button[data-furniture="shelf"]').first();
    const details = palette.locator('xpath=ancestor::details');
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
    await palette.click();
    let spot = await point(600, 40);
    await page.mouse.click(spot.x, spot.y);
    let shelf = (await snapshot()).floors[0].entities.filter((item) => item.kind === 'shelf').at(-1);
    assert.equal(shelf.rotation, 0, 'near the north wall the back faces up');
    assert.equal(shelf.y, 5, 'and touches the wall');
    spot = await point(690, 150);
    await page.mouse.click(spot.x, spot.y);
    shelf = (await snapshot()).floors[0].entities.filter((item) => item.kind === 'shelf').at(-1);
    assert.equal(shelf.rotation, 90, 'near the east wall the back faces right');
    assert.equal(shelf.x + shelf.w / 2, 700 - 5 - shelf.h / 2);
    // Alt を押しながら置くと、壁に付けない
    await page.keyboard.down('Alt');
    spot = await point(600, 40);
    await page.mouse.click(spot.x, spot.y);
    await page.keyboard.up('Alt');
    shelf = (await snapshot()).floors[0].entities.filter((item) => item.kind === 'shelf').at(-1);
    assert.ok(shelf.rotation === 0 && shelf.y !== 5, `Alt places it without snapping: ${shelf.y}`);
    console.log('PASS: room tools: furniture backs onto nearby walls (Alt to skip), rooms move with their furniture, walls and doors (Alt for the room only), deleting a furnished room asks about its contents, and the eraser deletes what it is dragged across');
  } finally {
    await page.context().close();
  }
}
