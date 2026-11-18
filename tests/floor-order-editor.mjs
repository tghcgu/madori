import assert from 'node:assert/strict';

// 階の並べ替え: 編集中の階を、となりの階と入れ替えるボタン・Shift+[ ]・階のタブのドラッグ。
// 地下の数はそのままで、1F・B1F などの名前は位置で付け直す。付けた名前・3Dに出すかどうか・その階の屋根は階と一緒に動き、
// いちばん上の階の屋根（建物の屋根）は、並べ替えたあとのいちばん上の階に残る
export async function verifyFloorOrder({ open }) {
  const room = id => ({ id, type: 'room', name: '', x: 0, y: 0, w: 400, h: 300, surface: 'plain', color: '#ffffff' });
  // 屋根は部屋に重ねない（2Dで部屋をクリックして選べるように）
  const roof = (id, floorId, x) => ({ id, type: 'roof', kind: 'gable', x, y: 0, w: 200, h: 200, floorId });
  // 取り込んだ画像（1画素の PNG）
  const photo = { id: 'photo', type: 'furniture', kind: 'image', x: 1300, y: 0, w: 100, h: 100, rotation: 0,
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' };
  const start = {
    name: '古い洋館',
    floors: [
      { id: 'b1', name: 'B1F', entities: [room('cellar'), photo] },
      { id: 'f1', name: '1F', entities: [room('ground')] },
      { id: 'f2', name: '2F', label: '書斎', entities: [room('study')] },
    ],
    basements: 1,
    activeFloor: 1,
    selectedId: null,
    roofs: [roof('porch', 'f1', 600), roof('main', 'f2', 900)],
  };
  const page = await open(JSON.stringify(start));
  try {
    const snapshot = () => page.evaluate(() => window.__editorTest.snapshot());
    const order = async () => (await snapshot()).floors.map(floor => floor.id);
    const titles = async () => (await snapshot()).floors.map(floor => floor.label ?? floor.name);
    const tabs = async () => (await page.locator('#floorTabs .floor-tab-list button').allTextContents()).map(text => text.trim());
    const roofFloor = async id => (await snapshot()).roofs.find(item => item.id === id).floorId;
    const bounds = id => page.evaluate(id => window.__editorTest.bounds(id), id);
    const selection = () => page.evaluate(() => window.__editorTest.selection());
    const down = page.locator('#floorTabs [data-floor-move="down"]');
    const up = page.locator('#floorTabs [data-floor-move="up"]');
    const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    // 2Dだけの表示（欄が広いので、階のボタンが全部並ぶ）
    await page.locator('button[data-view-mode="plan"]').first().click();
    await frames();
    assert.equal(await page.locator('#floorTabs .floor-tab-more').isVisible(), false, 'a wide bar shows every floor button');
    // 名前を付けた階・間取りと、取り込んだ画像のある保存データも、開いたときに読み込める（前は読み込めずに「壊れていた」と出た）
    assert.equal(await page.locator('#recoveryNotice').isVisible(), false, 'a saved plan with names and an image loads');
    const loaded = await snapshot();
    assert.equal(loaded.name, '古い洋館', 'the plan name is loaded');
    assert.equal(loaded.floors[2].label, '書斎', 'the floor name is loaded');
    assert.equal(loaded.floors[0].entities.find(item => item.id === 'photo')?.image, photo.image, 'the image is loaded');

    // ボタン: 編集中の階を1つ下の階と入れ替える。選んでいる物はそのままで、動かした階の編集を続ける
    const at = await page.evaluate(() => window.__editorTest.planPoint(200, 150));
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await selection(), ['ground']);
    await down.click();
    assert.deepEqual(await order(), ['f1', 'b1', 'f2']);
    assert.deepEqual(await titles(), ['B1F', '1F', '書斎'], 'names follow the position, a given name follows its floor');
    assert.deepEqual(await tabs(), ['B1F', '1F', '書斎']);
    let state = await snapshot();
    assert.equal(state.basements, 1, 'the number of basements stays');
    assert.equal(state.activeFloor, 0, 'the moved floor is still the one being edited');
    assert.deepEqual(await selection(), ['ground'], 'the selection is kept');
    assert.equal(await roofFloor('porch'), 'f1', 'a roof moves with its floor');
    assert.equal(await roofFloor('main'), 'f2', 'the roof of the top floor stays');
    assert.equal(await down.isDisabled(), true, 'the bottom floor cannot go down');
    assert.equal(await up.isDisabled(), false);
    // 3Dでも、動かした階の高さになる（地下の階は地面の下、1Fは地面の上）
    assert.ok((await bounds('ground')).max[1] < -1, 'the moved floor is below ground in 3D');
    assert.ok((await bounds('cellar')).max[1] > -0.01, 'the old basement is now the ground floor');
    // 元に戻す・やり直す
    await page.keyboard.press('Control+z');
    assert.deepEqual(await order(), ['b1', 'f1', 'f2'], 'undo puts the floors back');
    assert.equal((await snapshot()).activeFloor, 1);
    await page.keyboard.press('Control+y');
    assert.deepEqual(await order(), ['f1', 'b1', 'f2']);
    await page.keyboard.press('Control+z');

    // Shift+] で1つ上の階と入れ替える。いちばん上になった階に、建物の屋根が載り替わる。Shift+[ で戻る
    await page.keyboard.press('Shift+BracketRight');
    assert.deepEqual(await order(), ['b1', 'f2', 'f1'], 'Shift+] swaps with the floor above');
    assert.deepEqual(await titles(), ['B1F', '書斎', '2F']);
    assert.equal(await roofFloor('main'), 'f1', 'the building roof moves onto the new top floor');
    assert.equal(await roofFloor('porch'), 'f1');
    assert.equal(await up.isDisabled(), true, 'the top floor cannot go up');
    await page.keyboard.press('Shift+BracketLeft');
    assert.deepEqual(await order(), ['b1', 'f1', 'f2'], 'Shift+[ swaps with the floor below');
    assert.equal(await roofFloor('main'), 'f2', 'the building roof stays on top');

    // 3Dで隠した階は、動かしても隠れたまま（隠すボタンは3Dの欄にあるので、いったん同時表示にする）
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.locator('#floorVisibility button').filter({ hasText: /^書斎$/ }).click();
    assert.equal(await page.locator('#floorVisibility button').filter({ hasText: /^書斎$/ }).getAttribute('aria-pressed'), 'false');
    await page.locator('button[data-view-mode="plan"]').first().click();
    await frames();

    // タブのドラッグ: B1F のタブを右端まで動かすと、いちばん上の階になる。ドラッグの間は、ほかのタブが空いた所へずれる
    const list = page.locator('#floorTabs .floor-tab-list button');
    const first = await list.nth(0).boundingBox();
    const last = await list.nth(2).boundingBox();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width - 4, first.y + first.height / 2, { steps: 10 });
    const during = await page.evaluate(() => [...document.querySelectorAll('#floorTabs .floor-tab-list button')].map(tab => tab.style.transform));
    assert.ok(during[0] && during[1] && during[2], `every tab moves while dragging: ${JSON.stringify(during)}`);
    await page.mouse.up();
    assert.deepEqual(await order(), ['f1', 'f2', 'b1'], 'dragging a tab reorders the floors');
    assert.deepEqual(await tabs(), ['B1F', '書斎', '2F']);
    state = await snapshot();
    assert.equal(state.activeFloor, 2, 'the dragged floor becomes the one being edited (the click after the drag does not switch back)');
    assert.equal(await roofFloor('main'), 'b1', 'the building roof stays on top after a drag');
    assert.ok((await bounds('cellar')).min[1] > 1, 'the old basement is the top floor in 3D');
    assert.equal(await page.locator('#floorVisibility button').filter({ hasText: /^書斎$/ }).getAttribute('aria-pressed'), 'false', 'a hidden floor stays hidden');
    assert.equal(await bounds('study'), null, 'the hidden floor is not drawn in 3D');
    const after = await page.evaluate(() => [...document.querySelectorAll('#floorTabs .floor-tab-list button')].map(tab => tab.style.transform));
    assert.deepEqual(after, ['', '', ''], 'the tabs are back in place after the drop');
    // ドラッグのあとも、ふつうのクリックで階を切り替えられる。少し動かしただけなら、クリックのまま
    await list.nth(0).click();
    assert.equal((await snapshot()).activeFloor, 0, 'a click after a drag still switches floors');
    const tab = await list.nth(1).boundingBox();
    await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
    await page.mouse.down();
    await page.mouse.move(tab.x + tab.width / 2 + 3, tab.y + tab.height / 2);
    await page.mouse.up();
    assert.equal((await snapshot()).activeFloor, 1, 'a tiny drag is a click');
    assert.deepEqual(await order(), ['f1', 'f2', 'b1']);
    // ドラッグの途中で Esc を押すと、やめる
    await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
    await page.mouse.down();
    await page.mouse.move(tab.x - 40, tab.y + tab.height / 2, { steps: 6 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.deepEqual(await order(), ['f1', 'f2', 'b1'], 'Escape cancels the drag');
    // 幅の広いタブ（書斎）も、幅の狭いタブ（2F・B1F）の先の、いちばん端まで動かせる（前は真ん中どうしで比べていて届かなかった）
    const dragTo = async (index, x) => {
      const box = await list.nth(index).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(x, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
    };
    const widths = await list.evaluateAll(tabs => tabs.map(tab => tab.getBoundingClientRect().width));
    assert.ok(widths[1] > widths[0] && widths[1] > widths[2], `the named tab is the widest: ${widths}`);
    const strip = await page.locator('#floorTabs .floor-tab-list').boundingBox();
    await dragTo(1, strip.x + strip.width + 40);
    assert.deepEqual(await order(), ['f1', 'b1', 'f2'], 'a wide tab goes past a narrow one to the right end');
    await page.keyboard.press('Control+z');
    await dragTo(1, strip.x - 40);
    assert.deepEqual(await order(), ['f2', 'f1', 'b1'], 'a wide tab goes past a narrow one to the left end');
    await page.keyboard.press('Control+z');
    assert.deepEqual(await order(), ['f1', 'f2', 'b1']);
    await page.keyboard.press('Control+z');
    assert.deepEqual(await order(), ['b1', 'f1', 'f2'], 'undo puts the floors back after a drag');

    // 2Dと3Dを同時に出すと欄が狭いので、地下の追加・複製・入れ替え・削除は「…」のメニューにまとまる（どのボタンも欄からはみ出さない）
    await page.locator('button[data-view-mode="split"]').first().click();
    await frames();
    const bar = () => page.evaluate(() => {
      const right = document.querySelector('.pane-left').getBoundingClientRect().right;
      return [...document.querySelectorAll('#floorTabs > *')].filter(item => item.getClientRects().length)
        .filter(item => item.getBoundingClientRect().right > right + 0.5).map(item => item.title || item.className);
    });
    assert.deepEqual(await bar(), [], 'no floor button is cut off');
    const more = page.locator('#floorTabs .floor-tab-more');
    assert.equal(await more.isVisible(), true, 'a narrow bar folds the rarer floor buttons into the … menu');
    assert.equal(await down.isVisible(), false);
    assert.equal(await page.locator('#floorTabs .floor-tab-list button').filter({ hasText: /^書斎$/ }).isVisible(), true, 'the floor tabs stay');
    await page.locator('#floorTabs .floor-tab-list button').filter({ hasText: /^書斎$/ }).click();
    await more.click();
    const menu = page.locator('.floor-menu');
    assert.equal(await menu.isVisible(), true);
    assert.equal(await more.getAttribute('aria-expanded'), 'true');
    assert.deepEqual((await menu.locator('button').allTextContents()).map(text => text.trim()), [
      '地下の階を追加（いちばん下に増えます）', '書斎を複製（すぐ上に同じ階を足す）', '書斎を1つ下の階と入れ替える', '書斎を1つ上の階と入れ替える', '書斎の名前を変える', '表示中の階を削除',
    ]);
    assert.equal(await menu.locator('button').filter({ hasText: '1つ上の階と入れ替える' }).isDisabled(), true, 'the top floor cannot go up');
    await menu.locator('button').filter({ hasText: '1つ下の階と入れ替える' }).click();
    assert.equal(await menu.isVisible(), false, 'the menu closes after an action');
    assert.deepEqual(await order(), ['b1', 'f2', 'f1'], 'the menu swaps floors too');
    await more.click();
    await page.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false, 'Escape closes the menu');
    await more.click();
    await page.locator('.pane-left strong').first().click();
    assert.equal(await menu.isVisible(), false, 'a click elsewhere closes the menu');
    await page.keyboard.press('Control+z');
    assert.deepEqual(await order(), ['b1', 'f1', 'f2']);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.deepEqual(await order(), ['b1', 'f1', 'f2'], 'the order is saved');
  } finally {
    await page.context().close();
  }
  console.log('PASS: floor order: swap buttons, Shift+[ ], tab drag with Escape, the … menu in a narrow bar, names, roofs, hidden floors, 3D heights, undo and loading named plans');
}
