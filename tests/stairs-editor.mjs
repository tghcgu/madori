import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function verifyStairs({ page, importPlan, planPoint, output }) {
  const stairs = [
    { id: 'straight', type: 'furniture', kind: 'stairs', x: 500, y: 100, w: 100, h: 280, rotation: 0 },
    { id: 'turn', type: 'furniture', kind: 'stairsU', x: 50, y: 60, w: 160, h: 180, rotation: 35, flip: true },
    { id: 'spiral', type: 'furniture', kind: 'stairsSpiral', x: 50, y: 260, w: 120, h: 120, rotation: 90 },
  ];
  const room = { id: 'upper-room', type: 'room', name: '', x: 0, y: 0, w: 300, h: 400, color: '#ffffff' };
  const fixture = {
    floors: [{ id: 'f1', name: '1F', entities: stairs }, { id: 'f2', name: '2F', entities: [room] }, { id: 'f3', name: '3F', entities: [] }],
    activeFloor: 1, selectedId: null, roofs: [],
  };
  const state = () => page.evaluate(() => window.__editorTest.snapshot());
  const incoming = () => page.evaluate(() => window.__editorTest.incomingStairIds());
  const models = () => page.evaluate(() => window.__editorTest.stairModelIds());
  const switchFloor = name => page.locator('#floorTabs .floor-tab-list button').filter({ hasText: new RegExp(`^${name}$`) }).click();
  const darkRegion = async (x, y, w, h) => {
    const a = await planPoint(x, y), b = await planPoint(x + w, y + h);
    return page.locator('#planCanvas').evaluate((canvas, [a, b]) => {
      const r = canvas.getBoundingClientRect(), scale = canvas.width / r.width;
      const data = canvas.getContext('2d').getImageData(Math.round((a.x-r.left)*scale), Math.round((a.y-r.top)*scale), Math.max(1, Math.round((b.x-a.x)*scale)), Math.max(1, Math.round((b.y-a.y)*scale))).data;
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i+3] > 128 && data[i] < 120 && data[i+1] < 120 && data[i+2] < 120) dark++;
      return dark;
    }, [a, b]);
  };
  await page.locator('button[data-view-mode="split"]').click();
  await importPlan(fixture);
  await page.locator('[data-tool="select"]').click();
  if (await page.locator('#ghostToggle').getAttribute('aria-pressed') === 'true') await page.locator('#ghostToggle').click();
  assert.deepEqual(await incoming(), stairs.map(item => item.id));
  assert.deepEqual((await models()).sort(), stairs.map(item => item.id).sort());
  assert.equal((await state()).floors[1].entities.length, 1, 'arrival symbols are not copied into the upper floor');
  assert.ok(await darkRegion(505, 105, 90, 265) > 150, 'external stairs are clearly visible with ghosting off');
  assert.ok(await darkRegion(65, 85, 125, 145) > 100, 'rotated and mirrored U-shaped stairs show over the upper floor');
  assert.ok(await darkRegion(55, 265, 110, 110) > 100, 'spiral stairs show on the arrival floor');
  await page.screenshot({ path: `${output}/stairs-arrival.png` });
  const corner = await planPoint(600, 380), canvas = await page.locator('#planCanvas').boundingBox();
  assert.ok(corner.x < canvas.x + canvas.width - 20, 'fit includes stairs outside the upper floor bounds');
  const reference = await planPoint(550, 240);
  await page.mouse.click(reference.x, reference.y);
  await page.keyboard.press('Delete');
  assert.equal((await state()).floors[0].entities.length, 3, 'arrival display cannot delete a lower-floor item');
  await page.locator('#ghostToggle').click();
  assert.ok(await darkRegion(505, 105, 90, 265) > 150, 'arrival display also works with ghosting on');
  await page.locator('#ghostToggle').click();
  await switchFloor('3F');
  assert.deepEqual(await incoming(), [], 'stairs do not leak into non-adjacent floors');
  await switchFloor('2F');

  await page.locator('#imageExportButton').click();
  await page.locator('#imageExportFloors').selectOption('current');
  await page.locator('#imageExportGrid').uncheck();
  const pending = page.waitForEvent('download');
  await page.locator('#imageExportPlan').click();
  const download = await pending, path = `${output}/stairs-upper-export.png`;
  await download.saveAs(path);
  const data = (await readFile(path)).toString('base64');
  const exported = await page.evaluate(async data => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const s = c.width / 720, pixels = ctx.getImageData(Math.round(565*s), Math.round(165*s), Math.round(90*s), Math.round(265*s)).data;
    let dark = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 120 && pixels[i+1] < 120 && pixels[i+2] < 120) dark++;
    return { dark, aspect: c.width / c.height };
  }, data);
  assert.ok(Math.abs(exported.aspect - 720/520) < 0.01 && exported.dark > 500, 'PNG bounds and contents include the external arrival stairs');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.deepEqual(await incoming(), stairs.map(item => item.id));
  await switchFloor('1F');
  const original = await planPoint(550, 240);
  await page.mouse.click(original.x, original.y);
  await page.locator('#furnitureWInput').fill('140');
  await page.locator('#furnitureWInput').press('Tab');
  await switchFloor('2F');
  assert.equal((await state()).floors[0].entities[0].w, 140);
  assert.ok(await darkRegion(600, 110, 35, 250) > 50, 'arrival display follows lower-floor resizing');

  const duplicated = structuredClone(fixture);
  duplicated.floors[1].entities.push({ ...stairs[0], id: 'duplicate', locked: true });
  await importPlan(duplicated);
  const duplicate = await planPoint(550, 240);
  await page.mouse.click(duplicate.x, duplicate.y);
  assert.equal(await page.locator('#useLowerStairButton').isDisabled(), true, 'locked stairs cannot be removed');
  await page.locator('#entityLockedInput').uncheck();
  await page.locator('#useLowerStairButton').click();
  assert.equal((await state()).floors[1].entities.length, 1);
  assert.deepEqual(await incoming(), stairs.map(item => item.id));
  assert.equal((await models()).includes('duplicate'), false, 'duplicate 3D flight is removed');
  await page.locator('#undoButton').click();
  assert.ok((await state()).floors[1].entities.some(item => item.id === 'duplicate'), 'conversion is one undo step');
  assert.equal((await models()).includes('duplicate'), true);
  await page.locator('#redoButton').click();
  assert.equal((await models()).includes('duplicate'), false);
  console.log('PASS: incoming stairs: 2D, external bounds, PNG, no 3D copies, reload, edits, locks and undoable duplicate removal');
}
