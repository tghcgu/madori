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
    console.log('PASS: plan extras: a plan name for exported files with undo, bold text, and night mode for the panels and the 3D background that is remembered');
  } finally {
    await page.context().close();
  }
}
