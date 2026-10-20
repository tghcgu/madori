import assert from 'node:assert/strict';

// 地図づくりの道具: 壁の厚み、表示（部屋名・広さ・方眼）、階の複製、最前面・最背面、家具なしのテンプレート、
// モノクロの絵柄、好きな画像の取り込み、一覧の家具の絵、キーの操作
export async function verifyMapTools({ open, plan, output, readFile }) {
  const room = { id: 'living', type: 'room', name: 'リビング', x: 0, y: 0, w: 600, h: 405, color: '#ffffff', surface: 'wood' };
  const wall = { id: 'north', type: 'wall', x1: 0, y1: 0, x2: 600, y2: 0 };
  const sofa = { id: 'sofa', type: 'furniture', kind: 'sofa', x: 100, y: 200, w: 200, h: 85, rotation: 0 };
  const rug = { id: 'rug', type: 'furniture', kind: 'rug', x: 80, y: 180, w: 260, h: 160, rotation: 0 };
  const page = await open(JSON.stringify({ ...plan([room, wall, sofa, rug]), roofs: [{ id: 'roof', type: 'roof', kind: 'flat', x: -20, y: -20, w: 640, h: 445, floorId: 'f1' }] }));
  try {
    const snapshot = () => page.evaluate(() => window.__editorTest.snapshot());
    const point = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.waitForTimeout(300);

    // 壁の厚み: 選んだ壁の欄で変えると、2Dの当たりと3Dの厚みが変わる（種類を変えると標準に戻る）
    const at = await point(300, 0);
    await page.mouse.click(at.x, at.y);
    await page.locator('#wallThicknessInput').fill('40');
    await page.locator('#wallThicknessInput').press('Enter');
    let saved = (await snapshot()).floors[0].entities.find(item => item.id === 'north');
    assert.equal(saved.thickness, 40, 'the wall keeps its new thickness');
    const box = await page.evaluate(() => window.__editorTest.bounds('north'));
    assert.ok(box.max[2] - box.min[2] > 0.38, `the 3D wall is 40 cm thick: ${box.max[2] - box.min[2]}`);
    await page.locator('#wallStylePicker [data-wall-style-choice="brick"]').click();
    saved = (await snapshot()).floors[0].entities.find(item => item.id === 'north');
    assert.equal(saved.thickness, undefined, 'changing the wall type goes back to its usual thickness');
    await page.keyboard.press('Escape');

    // 表示: 部屋名を隠す・広さ（帖）を出す・方眼の大きさ
    await page.locator('#viewMenuButton').click();
    assert.equal(await page.locator('#viewMenu').isVisible(), true);
    await page.locator('#roomAreaSelect').selectOption('jo');
    const label = await page.evaluate(() => window.__editorTest.roomLabelBounds('living'));
    assert.ok(label && label.h > 30, 'the room label grows to show the area');
    await page.locator('#roomNamesInput').uncheck();
    await page.locator('#roomAreaSelect').selectOption('none');
    assert.equal(await page.evaluate(() => window.__editorTest.roomLabelBounds('living')), null, 'hidden names leave no label');
    await page.locator('#roomNamesInput').check();
    await page.locator('#gridSizeSelect').selectOption('100');
    assert.equal(await page.evaluate(() => window.__editorTest.gridStep()), 100, 'the grid uses the chosen size');
    await page.locator('#viewMenuButton').click();
    await page.keyboard.press('g');
    assert.equal((await page.evaluate(() => window.__editorTest.display())).grid, false, 'G hides the grid');
    await page.keyboard.press('g');
    // 書き出しでは、画像の端を方眼の線に合わせ、1マスを決めた px にする
    const exported = await page.evaluate(() => window.__editorTest.exportImageSize(50));
    assert.ok(exported.width % 50 === 0 && exported.height % 50 === 0, `the image is whole cells of 50 px: ${exported.width} x ${exported.height}`);

    // 最前面・最背面: ラグをいちばん手前へ、またいちばん奥へ
    const rugAt = await point(320, 330);
    await page.mouse.click(rugAt.x, rugAt.y);
    assert.deepEqual(await page.evaluate(() => window.__editorTest.selection()), ['rug']);
    await page.locator('#bringFrontButton').click();
    assert.equal((await snapshot()).floors[0].entities.at(-1).id, 'rug', 'bring to front puts it last');
    await page.locator('#sendBackButton').click();
    assert.equal((await snapshot()).floors[0].entities[0].id, 'rug', 'send to back puts it first');
    await page.keyboard.press('Escape');

    // 階の複製: すぐ上に同じ階。中の物は新しい id で写し、この階の屋根は写しへ移る。[ ] で階を移る
    await page.locator('.floor-tab-duplicate').click();
    let state = await snapshot();
    assert.deepEqual(state.floors.map(floor => floor.name), ['1F', '2F']);
    assert.equal(state.activeFloor, 1);
    assert.equal(state.floors[1].entities.length, state.floors[0].entities.length, 'the copy has every item');
    assert.ok(state.floors[1].entities.every(item => !state.floors[0].entities.some(other => other.id === item.id)), 'the copies have new ids');
    assert.equal(state.roofs[0].floorId, state.floors[1].id, 'the roof moves up onto the copy');
    await page.keyboard.press('[');
    assert.equal((await snapshot()).activeFloor, 0, '[ goes down a floor');
    await page.keyboard.press(']');
    assert.equal((await snapshot()).activeFloor, 1, '] goes up a floor');
    await page.keyboard.press('Control+z');
    assert.equal((await snapshot()).floors.length, 1, 'undo removes the copy');

    // モノクロの絵柄
    await page.locator('#planStyleButton').click();
    await page.locator('[data-plan-style="mono"]').click();
    assert.equal(await page.evaluate(() => window.__editorTest.planStyle()), 'mono');
    await page.keyboard.press('Escape');
    await page.locator('#planStyleButton').click();
    await page.locator('[data-plan-style="standard"]').click();
    await page.keyboard.press('Escape');

    // 好きな画像を取り込む: 2Dに置かれ、3Dの床にも同じ画像を貼る。濃さを変えられる
    const png = await readFile('public/icon-512.png');
    await page.locator('#imageImportInput').setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => window.__editorTest.snapshot().floors[0].entities.some(item => item.kind === 'image'));
    const image = (await snapshot()).floors[0].entities.find(item => item.kind === 'image');
    assert.match(image.image, /^data:image\/(webp|png);base64,/, 'the image is kept in the plan');
    assert.ok(image.w === 300 && image.h === 300, `a square image is 3 m wide: ${image.w} x ${image.h}`);
    assert.deepEqual(await page.evaluate(() => window.__editorTest.selection()), [image.id]);
    await page.waitForFunction(id => window.__editorTest.materials(id).some(material => material.map), image.id);
    await page.locator('#imageOpacityInput').fill('40');
    await page.locator('#imageOpacityInput').dispatchEvent('change');
    assert.equal((await snapshot()).floors[0].entities.find(item => item.id === image.id).opacity, 0.4, 'the image can be made see-through');
    await page.screenshot({ path: `${output}/map-tools.png` });

    // 家具なし（間取りだけ）でテンプレートを開く
    const details = page.locator('details.template-details', { has: page.locator('#templateList') });
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
    await page.locator('#templateSearch').fill('病院');
    assert.equal(await page.locator('[data-template="hospital"]').isVisible(), true, 'search finds the hospital');
    assert.equal(await page.locator('[data-template="oneLdk"]').isVisible(), false, 'other templates are hidden while searching');
    await page.locator('#templateSearch').fill('');
    await page.locator('#templateStructureOnly').check();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-template="oneLdk"]').click();
    state = await snapshot();
    const items = state.floors.flatMap(floor => floor.entities);
    assert.ok(items.some(item => item.type === 'room') && items.some(item => item.type === 'wall'), 'rooms and walls stay');
    assert.ok(items.filter(item => item.type === 'furniture').every(item => ['stairs', 'stairsU', 'stairsSpiral'].includes(item.kind) || ['lawn', 'river', 'pathway', 'hedge', 'stoneWall', 'railway', 'pond', 'flowerBed', 'rug', 'fence', 'takegaki', 'steppingStones'].includes(item.kind)), 'furniture is left out');

    // 一覧の家具のボタンには、2Dの記号の小さな絵がある
    const seating = page.locator('details.palette-group', { has: page.locator('summary', { hasText: /^椅子・ソファ$/ }) });
    if (await seating.getAttribute('open') === null) await seating.locator('summary').click();
    await page.waitForTimeout(100);
    assert.equal(await seating.locator('button[data-furniture] canvas.furniture-thumb').count(), await seating.locator('button[data-furniture]').count(), 'every furniture button shows its symbol');
    console.log('PASS: map tools: wall thickness, room names, room area, grid size and grid-aligned export, bring to front and send to back, duplicate floor with [ ] keys, monochrome style, image import shown in 2D and 3D, structure-only templates, template search, and furniture pictures in the palette');
  } finally {
    await page.context().close();
  }
}
