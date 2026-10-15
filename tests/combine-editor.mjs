import assert from 'node:assert/strict';

// 組み合わせ: 書き出したファイルを、いまの間取りに足す（いくつでも一度に）。
// 右に並べる・同じ位置に重ねる・上の階に積むを選べ、同じ階どうしを合わせ、1回の「元に戻す」で取り消せる
export async function verifyCombine({ open, output }) {
  const room = (id, x, y, w, h) => ({ id, type: 'room', name: '', x, y, w, h, color: '#ffffff', surface: 'plain' });
  const base = {
    floors: [
      { id: 'a1', name: '1F', entities: [room('a-room', 0, 0, 400, 300), { id: 'a-wall', type: 'wall', x1: 0, y1: 0, x2: 400, y2: 0 }] },
      { id: 'a2', name: '2F', entities: [room('a-upper', 0, 0, 400, 300)] },
    ],
    activeFloor: 0, selectedId: null,
    roofs: [{ id: 'a-roof', type: 'roof', kind: 'gable', x: -40, y: -40, w: 480, h: 380, floorId: 'a2' }],
  };
  // 1階建ての小屋（家具と屋根つき）
  const shed = {
    floors: [{ id: 'b1', name: '1F', entities: [room('b-room', 100, 100, 300, 200), { id: 'b-desk', type: 'furniture', kind: 'desk', x: 140, y: 140, w: 120, h: 60, rotation: 0 }] }],
    activeFloor: 0, selectedId: null,
    roofs: [{ id: 'b-roof', type: 'roof', kind: 'hip', x: 80, y: 80, w: 340, h: 240, floorId: 'b1' }],
  };
  // 地下つき（B1F と 1F）
  const cellar = {
    floors: [{ id: 'c0', name: 'B1F', entities: [room('c-cellar', 0, 0, 200, 200)] }, { id: 'c1', name: '1F', entities: [room('c-room', 0, 0, 200, 200)] }],
    activeFloor: 1, selectedId: null, roofs: [], basements: 1,
  };
  const file = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)) });
  const page = await open(JSON.stringify(base));
  try {
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('madori-quick-3d-plan')));
    const ids = () => page.evaluate(() => window.__editorTest.selection());
    const entities = (plan, floor) => plan.floors[floor].entities;
    const combine = async (files) => {
      await page.locator('#combineInput').setInputFiles(files);
      await page.waitForFunction(() => /組み合わせました|読み込み失敗/.test(document.querySelector('#saveStatus').textContent));
    };
    await page.locator('button[data-view-mode="split"]').first().click();
    const placement = async (value) => {
      if (!await page.locator('#combineMenu').isVisible()) await page.locator('#combineButton').click();
      await page.locator('#combinePlacement').selectOption(value);
    };

    // メニュー: 置き方を選んで「ファイルを選んで足す」。いくつでも選べる
    await page.locator('#combineButton').click();
    assert.equal(await page.locator('#combineMenu').isVisible(), true);
    assert.equal(await page.locator('#combinePlacement').inputValue(), 'side', 'side by side is the default');
    assert.equal(await page.locator('#combineInput').getAttribute('multiple'), '');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#combineChoose').click();
    await (await chooser).setFiles([file('shed.json', shed), file('cellar.json', cellar)]);
    await page.waitForFunction(() => /組み合わせました/.test(document.querySelector('#saveStatus').textContent));
    assert.match(await page.locator('#saveStatus').textContent(), /2個を組み合わせました/);
    assert.equal(await page.locator('#combineMenu').isVisible(), false);

    // 右に並べる: 小屋は、いまの間取り（屋根を含む）の右へ 200cm あけて、上の端をそろえて置く。同じ階どうし（1Fは1Fへ）
    let plan = await saved();
    assert.equal(plan.basements, 1, 'a basement was added for the cellar');
    assert.deepEqual(plan.floors.map(floor => floor.name), ['B1F', '1F', '2F']);
    const ground = entities(plan, 1);
    const shedRoof = plan.roofs.find(item => item.kind === 'hip');
    assert.deepEqual([shedRoof.x, shedRoof.y], [440 + 200, -40], 'the shed (with its roof) sits to the right of the house with a 200 cm gap, tops aligned');
    assert.equal(shedRoof.floorId, plan.floors[1].id, 'the shed roof is on 1F');
    const shedRoom = ground.find(item => item.type === 'room' && item.w === 300);
    assert.deepEqual([shedRoom.x - shedRoof.x, shedRoom.y - shedRoof.y], [20, 20], 'the shed keeps its shape');
    const desk = ground.find(item => item.kind === 'desk');
    assert.deepEqual([desk.x - shedRoom.x, desk.y - shedRoom.y], [40, 40], 'furniture keeps its place in the shed');
    assert.ok(!ground.some(item => item.id === 'b-room' || item.id === 'b-desk'), 'added things get new ids');
    // 地下つきのファイルは、小屋のさらに右へ。地下は地下へ
    const cellarRoom = entities(plan, 0).find(item => item.type === 'room');
    const cellarGround = ground.find(item => item.type === 'room' && item.w === 200);
    assert.equal(cellarRoom.x, cellarGround.x);
    assert.equal(cellarGround.x, shedRoof.x + shedRoof.w + 200, 'the next file goes to the right of the previous one');
    // 表示中の階（1F）の、足した物が選ばれている。いまの間取りの物は選ばれない
    const selected = await ids();
    assert.equal(selected.length, 4, `shed room, desk, shed roof and the cellar's 1F room: ${selected}`);
    assert.ok(!selected.includes('a-room'));
    await page.screenshot({ path: `${output}/combine-side.png` });

    // 1回の「元に戻す」で、足した物も足した階も元どおり
    await page.keyboard.press('Control+z');
    plan = await saved();
    assert.equal(plan.floors.length, 2);
    assert.equal(plan.basements, undefined);
    assert.deepEqual(plan.floors.map(floor => floor.entities.map(item => item.id)), [['a-room', 'a-wall'], ['a-upper']]);
    assert.deepEqual(plan.roofs.map(item => item.id), ['a-roof']);

    // 同じ位置に重ねる
    await placement('same');
    await combine([file('shed.json', shed)]);
    plan = await saved();
    const same = entities(plan, 0).find(item => item.type === 'room' && item.w === 300);
    assert.deepEqual([same.x, same.y], [100, 100], 'the shed keeps its own position');
    await page.keyboard.press('Control+z');

    // 上の階に積む: 小屋は 3F になり、屋根も 3F に付く
    await placement('stack');
    await combine([file('shed.json', shed)]);
    plan = await saved();
    assert.deepEqual(plan.floors.map(floor => floor.name), ['1F', '2F', '3F']);
    const top = entities(plan, 2).find(item => item.type === 'room');
    assert.deepEqual([top.x, top.y], [100, 100]);
    assert.equal(plan.roofs.find(item => item.kind === 'hip').floorId, plan.floors[2].id);
    assert.equal(plan.roofs.find(item => item.id === 'a-roof').floorId, 'a2', 'the old roof stays on 2F');
    assert.equal(await page.locator('#floorTabs button.is-active').textContent().then(text => text.trim()), '3F', 'the stacked floor is shown');

    // 置き方は覚えておく。読めないファイルだけなら何も変えない
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.equal(await page.locator('#combinePlacement').inputValue(), 'stack');
    const before = await saved();
    await combine([file('broken.json', '{ not json')]);
    assert.match(await page.locator('#saveStatus').textContent(), /読み込み失敗/);
    assert.deepEqual(await saved(), before);
    // 読めないファイルがまざっていても、読めた分は足す
    await combine([file('broken.json', '{ not json'), file('shed.json', shed)]);
    assert.match(await page.locator('#saveStatus').textContent(), /1個を組み合わせました（1個は読めず）/);
    assert.equal((await saved()).floors.length, 4);

    // 何もない間取りに足すときは、ファイルの位置と階のまま
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#resetButton').click();
    await placement('side');
    await combine([file('cellar.json', cellar)]);
    plan = await saved();
    assert.deepEqual(plan.floors.map(floor => floor.name), ['B1F', '1F']);
    assert.deepEqual([entities(plan, 1)[0].x, entities(plan, 1)[0].y], [0, 0]);
    console.log('PASS: combine files: several at once, side by side, same place or stacked, matching floors and basements, roofs, new ids, selection, one undo, remembered placement and broken files');
  } finally {
    await page.context().close();
  }
}
