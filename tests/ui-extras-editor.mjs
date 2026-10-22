import assert from 'node:assert/strict';

// 2026-10-21 の後半: 3Dでマウスを乗せたときの「ダブルクリックで選択」、2Dの上に出す「選択中」の欄、
// 家具の幅を1cm単位で、ドア・窓を置く幅、一覧の壁・ドア・窓の絵、天井に付ける物、壊れた壁（大穴・崩れ落ちた壁）
export async function verifyUiExtras({ open, plan, output }) {
  const room = { id: 'room', type: 'room', name: '', x: 0, y: 0, w: 600, h: 400, color: '#ffffff', surface: 'wood' };
  const north = { id: 'north', type: 'wall', x1: 0, y1: 0, x2: 600, y2: 0 };
  const south = { id: 'south', type: 'wall', x1: 0, y1: 400, x2: 600, y2: 400 };
  // 机は北の壁の近く（3Dで、南の壁に隠れない所）
  const table = { id: 'table', type: 'furniture', kind: 'table', x: 380, y: 40, w: 160, h: 85, rotation: 0 };
  const phone = { id: 'phone', type: 'furniture', kind: 'smartphone', x: 100, y: 250, w: 8, h: 15, rotation: 0 };
  const page = await open(JSON.stringify(plan([room, north, south, table, phone])));
  try {
    const snapshot = () => page.evaluate(() => window.__editorTest.snapshot());
    const find = async (id) => (await snapshot()).floors[0].entities.find((item) => item.id === id);
    const point = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
    const ids = () => page.evaluate(() => window.__editorTest.selection());
    const choose = async (selector) => {
      const button = page.locator(selector).first();
      const details = button.locator('xpath=ancestor::details');
      if (await details.count() && await details.getAttribute('open') === null) await details.locator('summary').click();
      await button.click();
    };
    const change = async (selector, value) => {
      await page.locator(selector).fill(String(value));
      await page.locator(selector).press('Tab');
    };
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.waitForTimeout(300);

    // 「選択中」の欄を2Dの上にも出す（表示のメニューで入れる）。選んだ物と反対の側に出て、同じ欄の入力が使える
    await page.locator('#viewMenuButton').click();
    await page.locator('#selectionOnPlanInput').check();
    await page.locator('#viewMenuButton').click();
    let at = await point(460, 82);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), ['table']);
    assert.equal(await page.locator('#planSelection').isVisible(), true, 'the selection panel floats over the 2D plan');
    assert.equal(await page.locator('#planSelection #furnitureWInput').count(), 1, 'with the same fields');
    assert.equal(await page.locator('#propertiesAway').isVisible(), true, 'the left panel says where it went');
    const panelBox = await page.locator('#planSelection').boundingBox();
    assert.ok(panelBox.x + panelBox.width / 2 < at.x, 'it opens on the side away from the table');
    // 家具の幅・奥行は1cm単位（20cmに丸めない）
    await change('#furnitureWInput', 45);
    assert.equal((await find('table')).w, 45, 'the width is kept to the centimeter');
    await page.screenshot({ path: `${output}/selection-on-plan.png` });
    // たたむ・ひらく
    await page.locator('#planSelectionCollapse').click();
    assert.equal(await page.locator('#planSelectionBody').isVisible(), false, 'the panel collapses');
    await page.locator('#planSelectionCollapse').click();
    assert.equal(await page.locator('#planSelectionBody').isVisible(), true);
    // 小物は小さいまま（最小1cm）。いまの欄は左に寄っていて小物に重なるので、選択を外してから押す
    await page.keyboard.press('Escape');
    at = await point(104, 257);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), ['phone']);
    assert.equal(await page.locator('#furnitureWInput').inputValue(), '8');
    await change('#furnitureWInput', 6);
    assert.equal((await find('phone')).w, 6, 'a small item can be made smaller than 20 cm');
    // 何も選ばなければ左の欄に戻る。3Dだけの表示でも左の欄
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#planSelection').isVisible(), false);
    assert.equal(await page.locator('#propertiesHome #propertiesPanel').count(), 1, 'the panel goes back to the left');
    // 欄のボタンで左の欄だけに戻すと、表示のメニューも切れる（机は幅45cmにしたので、左の端の近くを押す）
    at = await point(400, 82);
    await page.mouse.click(at.x, at.y);
    await page.locator('#planSelectionDock').click();
    assert.equal(await page.locator('#planSelection').isVisible(), false);
    assert.equal(await page.locator('#propertiesHome #furnitureWInput').count(), 1);
    assert.equal(await page.locator('#selectionOnPlanInput').isChecked(), false, 'the view menu remembers the choice');
    // Esc で選択を外す
    await page.keyboard.press('Escape');
    assert.deepEqual(await ids(), []);

    // 3D: 家具にマウスを乗せると、マウスのそばに「ダブルクリックで選択」。1回クリックでは選ばず、案内を目立たせる
    await page.locator('button[data-view-mode="three"]').first().click();
    await page.waitForTimeout(500);
    // 机の天板の上（幅は45cmにした）。3Dの視点が落ち着くまで、少しずつ動かして待つ
    let over = null, shown = false;
    for (let i = 0; i < 12 && !shown; i += 1) {
      const top = (await page.evaluate(() => window.__editorTest.bounds('table'))).max[1] - 0.01;
      over = await page.evaluate(([x, y, h]) => window.__editorTest.project(x, y, h), [table.x + 22, table.y + table.h / 2, top]);
      await page.mouse.move(over.x + (i % 2), over.y, { steps: 2 });
      await page.waitForTimeout(150);
      shown = await page.locator('#threeHoverTip').isVisible();
    }
    assert.ok(shown, 'hovering shows a tip');
    assert.equal(await page.locator('#threeHoverTip').textContent(), 'ダブルクリックで選択');
    await page.screenshot({ path: `${output}/three-hover-tip.png` });
    await page.mouse.click(over.x, over.y);
    assert.deepEqual(await ids(), [], 'one click does not select');
    assert.equal(await page.locator('#threeHoverTip.is-nudge').isVisible(), true, 'a single click makes the tip stand out');
    const empty = await page.evaluate(() => window.__editorTest.project(-400, -300, 0));
    await page.mouse.move(empty.x, empty.y, { steps: 4 });
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#threeHoverTip').isVisible(), false, 'the tip goes away off the furniture');
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.waitForTimeout(300);

    // 一覧の壁・ドア・窓のボタンにも絵
    for (const label of ['建具（ドア・窓）', '壁']) {
      const group = page.locator('details.palette-group', { has: page.locator('summary', { hasText: label }) }).first();
      if (await group.getAttribute('open') === null) await group.locator('summary').click();
      await page.waitForTimeout(100);
      assert.equal(await group.locator('canvas.furniture-thumb').count(), await group.locator('button').count(), `${label}: every button has a picture`);
    }

    // ドア・窓のツールでは、置く幅を決められる（決めた幅で壁をクリックして置く）
    await choose('button[data-door-style="swing"]');
    assert.equal(await page.locator('#openingWidthInput').inputValue(), '80');
    await change('#openingWidthInput', 95);
    at = await point(150, 0);
    await page.mouse.click(at.x, at.y);
    let state = await snapshot();
    let door = state.floors[0].entities.filter((item) => item.type === 'door').at(-1);
    assert.equal(Math.round(Math.hypot(door.x2 - door.x1, door.y2 - door.y1)), 95, 'the door is placed at the chosen width');
    assert.match(await page.locator('#lineLengthInput').locator('xpath=..').textContent(), /幅 cm/, 'a door shows its width');
    await page.keyboard.press('Escape');

    // 壊れた壁: 大穴は壁を切ってかけらを置き、崩れ落ちた壁は上を切る（一覧の「建物の部分・工事」にもある）
    const structure = page.locator('details.palette-group', { has: page.locator('summary', { hasText: /^建物の部分・工事$/ }) });
    assert.equal(await structure.locator('button[data-door-style="hole"]').count(), 1, 'broken walls are listed under building parts');
    await choose('button[data-door-style="hole"]');
    at = await point(420, 0);
    await page.mouse.click(at.x, at.y);
    state = await snapshot();
    const hole = state.floors[0].entities.filter((item) => item.type === 'door').at(-1);
    assert.equal(hole.doorStyle, 'hole');
    assert.deepEqual(await page.evaluate((id) => window.__editorTest.openingNames(id), hole.id), ['hole-wall']);
    await page.keyboard.press('Escape');
    await choose('button[data-door-style="broken"]');
    at = await point(300, 400);
    await page.mouse.click(at.x, at.y);
    state = await snapshot();
    const broken = state.floors[0].entities.filter((item) => item.type === 'door').at(-1);
    assert.equal(broken.doorStyle, 'broken');
    const southBox = await page.evaluate(() => window.__editorTest.bounds('south'));
    const brokenBox = await page.evaluate((id) => window.__editorTest.bounds(id), broken.id);
    assert.ok(brokenBox.max[1] <= southBox.max[1] + 1e-6 && brokenBox.min[1] < 0.2, 'the collapsed part stays within the wall height');
    await page.keyboard.press('Escape');

    // 天井に付ける物: シャンデリアは天井から下がる
    await page.locator('#paletteSearch').fill('シャンデリア');
    await choose('button[data-furniture="chandelier"]');
    await page.locator('#paletteSearch').fill('');
    at = await point(200, 150);
    await page.mouse.click(at.x, at.y);
    state = await snapshot();
    const chandelier = state.floors[0].entities.find((item) => item.kind === 'chandelier');
    assert.ok(chandelier, 'the chandelier is placed');
    const lamp = await page.evaluate((id) => window.__editorTest.bounds(id), chandelier.id);
    assert.ok(lamp.max[1] > 2.55 && lamp.min[1] > 1.3, `it hangs from the ceiling: ${lamp.min[1]}..${lamp.max[1]}`);
    await page.screenshot({ path: `${output}/broken-walls-and-ceiling.png` });
  } finally {
    await page.context().close();
  }

  // どの種類の壁でも崩れる: 生け垣は崩れた所が段々に低くなり、レンガは同じレンガの色で崩れたふちを残す。一覧の「壁」にも並ぶ
  const hedge = { id: 'hedge', type: 'wall', x1: 0, y1: 0, x2: 600, y2: 0, wallStyle: 'hedge' };
  const brick = { id: 'brick', type: 'wall', x1: 0, y1: 300, x2: 600, y2: 300, wallStyle: 'brick' };
  const hedgeCut = { id: 'hedgeCut', type: 'door', x1: 200, y1: 0, x2: 400, y2: 0, doorStyle: 'broken' };
  const brickCut = { id: 'brickCut', type: 'door', x1: 200, y1: 300, x2: 400, y2: 300, doorStyle: 'broken' };
  // 竹垣の大穴: 穴の下と上に竹垣が残る（ただの切れ目にしない）
  const bamboo = { id: 'bamboo', type: 'wall', x1: 0, y1: 150, x2: 600, y2: 150, wallStyle: 'takegaki' };
  const bambooHole = { id: 'bambooHole', type: 'door', x1: 240, y1: 150, x2: 360, y2: 150, doorStyle: 'hole' };
  const walls = await open(JSON.stringify(plan([room, hedge, brick, hedgeCut, brickCut, bamboo, bambooHole])));
  try {
    await walls.locator('button[data-view-mode="split"]').first().click();
    await walls.waitForTimeout(300);
    const top = (id, x, y) => walls.evaluate(([id, x, y]) => window.__editorTest.topAt(id, x, y), [id, x, y]);
    const whole = await top('hedge', 60, 0), middle = await top('hedge', 300, 0);
    assert.ok(whole > 1.1 && middle < whole - 0.25, `the hedge is lower where it collapsed: ${middle} / ${whole}`);
    const bambooPieces = await walls.evaluate(() => window.__editorTest.pieces('bamboo'));
    // 高さの範囲 [下, 上]（m）: 穴の上に残る所と、穴の下に残る低い所がある
    assert.ok(bambooPieces.some(([low]) => low > 0.8) && bambooPieces.some(([low, high]) => low < 0.2 && high < 0.6),
      `the bamboo fence keeps a part above and below the hole: ${JSON.stringify(bambooPieces)}`);
    const rim = (await walls.evaluate(() => window.__editorTest.materials('brickCut'))).find((material) => material.name === 'wall-brick');
    assert.equal(rim?.color, 'a5523a', 'the brick wall breaks as brick');
    const group = walls.locator('details.palette-group', { has: walls.locator('summary', { hasText: /^壁$/ }) });
    if (await group.getAttribute('open') === null) await group.locator('summary').click();
    for (const selector of ['[data-door-style="hole"]', '[data-door-style="broken"]', '[data-furniture="wallCrack"]', '[data-furniture="collapsedWall"]', '[data-furniture="wallHole"]']) {
      assert.equal(await group.locator(selector).count(), 1, `the wall group lists ${selector}`);
    }
    await walls.screenshot({ path: `${output}/broken-wall-types.png` });
  } finally {
    await walls.context().close();
  }
  console.log('PASS: UI extras: the double-click tip in 3D, the selection panel over the 2D plan, furniture sizes to the centimeter, door widths to place, pictures for wall, door and window buttons, broken walls on every wall type and in the wall group, and ceiling fixtures');
}
