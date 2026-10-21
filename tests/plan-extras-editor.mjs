import assert from 'node:assert/strict';

// 間取りの名前（書き出すファイルの名前になる）、文字の太字、ナイトモード、戸のない開口
export async function verifyPlanExtras({ open, plan }) {
  const room = { id: 'hall', type: 'room', name: '', x: 0, y: 0, w: 600, h: 400, color: '#ffffff', surface: 'wood' };
  const label = { id: 'note', type: 'text', text: 'メモ', x: 300, y: 200, size: 40, rotation: 0 };
  const page = await open(JSON.stringify(plan([room, label])));
  try {
    const snapshot = () => page.evaluate(() => window.__editorTest.snapshot());
    await page.locator('button[data-view-mode="split"]').first().click();

    // 間取りの名前: 「表示」で付けると、書き出すファイルの名前になる。元に戻せる
    await page.locator('#viewMenuButton').click();
    await page.locator('#planNameInput').fill('古い洋館/1');
    await page.locator('#planNameInput').press('Enter');
    assert.equal((await snapshot()).name, '古い洋館/1', 'the plan keeps its name');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exportButton').click()]);
    assert.match(download.suggestedFilename(), /^古い洋館1-\d{4}-\d{2}-\d{2}\.json$/, `the file is named after the plan: ${download.suggestedFilename()}`);
    await page.keyboard.press('Control+z');
    assert.equal((await snapshot()).name, undefined, 'naming can be undone');
    await page.keyboard.press('Escape');

    // Space を押しながらの左ドラッグ・中ボタンのドラッグで、2Dの画面が動く（物は動かない）
    const origin = () => page.evaluate(() => window.__editorTest.planPoint(0, 0));
    const plans = JSON.stringify((await snapshot()).floors);
    let from = await page.evaluate(() => window.__editorTest.planPoint(100, 300));
    await page.mouse.move(from.x, from.y);
    let start = await origin();
    await page.keyboard.down('Space');
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y + 30, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    let moved = await origin();
    assert.ok(Math.abs(moved.x - start.x - 60) < 2 && Math.abs(moved.y - start.y - 30) < 2, `Space + drag pans: ${JSON.stringify([start, moved])}`);
    from = await page.evaluate(() => window.__editorTest.planPoint(100, 300));
    await page.mouse.move(from.x, from.y);
    start = await origin();
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(from.x - 40, from.y, { steps: 6 });
    await page.mouse.up({ button: 'middle' });
    moved = await origin();
    assert.ok(Math.abs(moved.x - start.x + 40) < 2, 'a middle-button drag pans');
    assert.equal(JSON.stringify((await snapshot()).floors), plans, 'panning moves nothing in the plan');

    // 階の名前: タブをダブルクリックして付ける。空にすると、いつもの名前に戻る
    const tab = page.locator('#floorTabs .floor-tab-list button').first();
    page.once('dialog', (dialog) => dialog.accept('地下牢'));
    await tab.dblclick();
    await page.waitForTimeout(100);
    assert.equal((await snapshot()).floors[0].label, '地下牢', 'the floor keeps its name');
    assert.equal((await tab.textContent()).trim(), '地下牢', 'the tab shows the name');
    page.once('dialog', (dialog) => dialog.accept(''));
    await page.locator('#floorTabs .floor-tab-list button').first().dblclick();
    await page.waitForTimeout(100);
    assert.equal((await snapshot()).floors[0].label, undefined, 'an empty name goes back to the usual one');
    assert.equal((await page.locator('#floorTabs .floor-tab-list button').first().textContent()).trim(), '1F');

    // 文字の太字
    const at = await page.evaluate(() => window.__editorTest.planPoint(300, 200));
    await page.mouse.click(at.x, at.y);
    await page.locator('#textBoldInput').check();
    assert.equal((await snapshot()).floors[0].entities.find((item) => item.id === 'note').bold, true, 'the text is bold');
    await page.locator('#textBoldInput').uncheck();
    assert.equal((await snapshot()).floors[0].entities.find((item) => item.id === 'note').bold, undefined);

    // ナイトモード: 画面のまわりと3Dの背景が暗くなり、開き直しても続く。2Dの紙は白のまま
    const corner3d = () => page.locator('#threeCanvas').evaluate((canvas) => {
      const copy = document.createElement('canvas');
      copy.width = canvas.width; copy.height = canvas.height;
      const context = copy.getContext('2d');
      context.drawImage(canvas, 0, 0);
      const [r, g, b] = context.getImageData(4, canvas.height - 4, 1, 1).data;
      return (r + g + b) / 3;
    });
    assert.ok(await corner3d() > 180, 'the 3D background starts light');
    await page.locator('#themeToggle').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await page.locator('#themeToggle').getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(400);
    assert.ok(await corner3d() < 70, 'the 3D background turns dark');
    assert.equal(await page.locator('#planCanvas').evaluate((canvas) => getComputedStyle(canvas).backgroundColor), 'rgb(255, 255, 255)', 'the 2D paper stays white');
    const panel = await page.locator('.tool-panel').evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.notEqual(panel, 'rgb(255, 255, 255)', `the panels turn dark: ${panel}`);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'night mode is remembered');
    await page.locator('#themeToggle').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined, 'and can be turned off');
    console.log('PASS: plan extras: a plan name for exported files with undo, panning with Space or the middle button, floor names, bold text, and night mode for the panels and the 3D background that is remembered');
  } finally {
    await page.context().close();
  }
}
