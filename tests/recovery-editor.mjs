import assert from 'node:assert/strict';

// 前に読み込めなかった保存データを開き直す: 2026-10-21〜11-15 は、名前を付けた階・間取りのある保存データを開き直すと読み込めず、
// 元データだけ退避していた。いまは読み込める退避データを、お知らせから開ける（元に戻すで戻せる。開くか閉じたら次からは出さない）
export async function verifyRecoveredBackup({ open, plan }) {
  const room = id => ({ id, type: 'room', name: '', x: 0, y: 0, w: 400, h: 300, surface: 'plain', color: '#ffffff' });
  const page = await open(JSON.stringify(plan([room('now')])));
  try {
    const snapshot = () => page.evaluate(() => window.__editorTest.snapshot());
    const notice = page.locator('#recoveryNotice');
    assert.equal(await notice.isVisible(), false, 'no notice without backups');
    // 退避された元データ（階と間取りに名前がある）と、いまも読み込めない元データ
    const time = new Date(2026, 10, 10, 14, 32).getTime();
    const lost = { name: '古い洋館', floors: [{ id: 'f1', name: '1F', label: '玄関', entities: [room('lost')] }], activeFloor: 0, selectedId: null, roofs: [] };
    await page.evaluate(([time, raw]) => {
      localStorage.setItem(`madori-quick-3d-plan-recovery-${time}-abcdef`, raw);
      localStorage.setItem(`madori-quick-3d-plan-recovery-${time - 1000}-broken`, '{ broken');
    }, [time, JSON.stringify(lost)]);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.equal(await notice.isVisible(), true, 'a backup that loads now is offered');
    assert.match(await page.locator('#recoveryMessage').textContent(), /2026-11-10 14:32/);
    assert.equal(await page.locator('#recoveryOpenButton').isVisible(), true);
    assert.equal((await snapshot()).floors[0].entities[0].id, 'now', 'the current plan stays until the backup is opened');
    await page.locator('#recoveryOpenButton').click();
    assert.equal(await notice.isVisible(), false);
    let state = await snapshot();
    assert.equal(state.name, '古い洋館', 'the backup opens with its plan name');
    assert.equal(state.floors[0].label, '玄関', 'and its floor name');
    assert.equal(state.floors[0].entities[0].id, 'lost');
    await page.keyboard.press('Control+z');
    assert.equal((await snapshot()).floors[0].entities[0].id, 'now', 'undo brings the current plan back');
    // 開いた退避データは、次からは出さない。いまも読み込めない元データも出さない
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    assert.equal(await notice.isVisible(), false, 'an opened backup is not offered again');
    state = await snapshot();
    assert.equal(state.floors[0].entities[0].id, 'now');
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(name => name.startsWith('madori-quick-3d-plan-recovery-')).length), 2, 'backups are never deleted');
  } finally {
    await page.context().close();
  }
  console.log('PASS: a backup of a plan that failed to load is offered again, opens with undo, and is offered only once');
}

// 自動保存に失敗したとき（ブラウザに保存できる量を超えたなど）は、目立つお知らせを出し、書き出せるようにする。
// 閉じたら次に保存できるまでは出さず、保存できたら消える
export async function verifySaveFailure({ open, plan }) {
  const room = { id: 'hall', type: 'room', name: '', x: 0, y: 0, w: 400, h: 300, surface: 'plain', color: '#ffffff' };
  const page = await open(JSON.stringify(plan([room])));
  try {
    const notice = page.locator('#saveFailNotice');
    const addFloor = () => page.locator('#floorTabs button[title="上の階を追加"]').click();
    await page.locator('button[data-view-mode="plan"]').first().click();
    assert.equal(await notice.isVisible(), false);
    // 間取りの保存だけ、容量いっぱいで失敗させる
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.__restoreStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function (key, value) {
        if (key === 'madori-quick-3d-plan') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await addFloor();
    assert.equal(await notice.isVisible(), true, 'a failed autosave shows a notice');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#saveFailExportButton').click()]);
    assert.match(download.suggestedFilename(), /\.json$/, 'the notice exports the plan');
    await page.locator('#saveFailCloseButton').click();
    await addFloor();
    assert.equal(await notice.isVisible(), false, 'a closed notice stays closed while saving keeps failing');
    await page.evaluate(() => window.__restoreStorage());
    await addFloor();
    assert.equal(await notice.isVisible(), false);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('madori-quick-3d-plan'))).floors.length, 4, 'saving works again');
    // また失敗したら、お知らせが出る
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'madori-quick-3d-plan') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await addFloor();
    assert.equal(await notice.isVisible(), true, 'the notice comes back when saving fails again');
  } finally {
    await page.context().close();
  }
  console.log('PASS: a failed autosave shows a notice with export, stays closed once closed, and goes away when saving works');
}
