import assert from 'node:assert/strict';

// ドアの種類（両開き・障子・襖・格子戸・板戸・門扉）: 一覧から選んで置き、種類を変え、3Dも同じ種類になる。
// 和風の欄にも障子などが重ねて並ぶ
export async function verifyDoors({ page, importPlan, choose, planPoint, move, saved, output }) {
  const room = { id: 'hall', type: 'room', name: '', x: 0, y: 0, w: 800, h: 400, color: '#ffffff' };
  const wall = { id: 'middle', type: 'wall', x1: 0, y1: 200, x2: 800, y2: 200 };
  await importPlan({ floors: [{ id: 'd1', name: '1F', entities: [room, wall] }], activeFloor: 0, selectedId: null, roofs: [] });
  await page.locator('button[data-view-mode="split"]').click();
  const group = label => page.locator('.palette-group').filter({ has: page.locator('summary', { hasText: label }) });
  const styles = locator => locator.locator('[data-door-style]').evaluateAll(buttons => buttons.map(button => button.dataset.doorStyle));
  assert.deepEqual(await styles(group(/^建具/)), ['swing', 'double', 'sliding', 'shoji', 'fusuma', 'koshi', 'itado', 'gate', 'opening'], 'every door style is in the fittings group');
  assert.deepEqual(await styles(group(/^和風/)), ['shoji', 'fusuma', 'koshi', 'itado', 'gate'], 'Japanese doors are also in the Japanese group');
  assert.equal(await group(/^和風/).locator('[data-furniture="zaisu"]').count(), 1, 'the Japanese group also shows the floor chair from the chairs group');
  assert.equal(await group(/^椅子/).locator('[data-furniture="zaisu"]').count(), 1);

  const doors = async () => (await saved()).floors[0].entities.filter(entity => entity.type === 'door');
  const drag = async (x1, x2) => {
    const from = await planPoint(x1, 200), to = await planPoint(x2, 200);
    await move(from, to.x - from.x, to.y - from.y);
  };
  await choose('[data-door-style="shoji"]');
  assert.equal(await page.locator('[data-door-style="shoji"]').first().getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#toolHint').textContent(), /障子/);
  await drag(100, 260);
  let placed = await doors();
  assert.equal(placed.length, 1);
  assert.equal(placed[0].doorStyle, 'shoji', 'the door is a shoji');
  assert.equal(await page.locator('#doorStyleInput').inputValue(), 'shoji');
  const names = id => page.evaluate(id => window.__editorTest.openingNames(id), id);
  assert.deepEqual(await names(placed[0].id), ['shoji-door']);
  await page.locator('#doorStyleInput').selectOption('fusuma');
  placed = await doors();
  assert.equal(placed[0].doorStyle, 'fusuma');
  assert.deepEqual(await names(placed[0].id), ['fusuma-door'], '3D follows the new style');
  // 戸のない開口: 3Dに戸を置かない
  await page.locator('#doorStyleInput').selectOption('opening');
  placed = await doors();
  assert.equal(placed[0].doorStyle, 'opening');
  assert.deepEqual(await names(placed[0].id), ['opening']);
  assert.equal(await page.evaluate(id => window.__editorTest.meshCount(id), placed[0].id), 0, 'an opening has no door in 3D');
  await page.locator('#doorStyleInput').selectOption('swing');
  placed = await doors();
  assert.equal(placed[0].doorStyle, undefined, 'a plain door keeps no style');
  assert.deepEqual(await names(placed[0].id), ['closed-door']);

  // 門扉と格子戸（玄関戸）も置ける。和風の欄から選んでも同じ
  await choose('[data-door-style="gate"]');
  await drag(400, 560);
  await choose('[data-door-style="koshi"]');
  await drag(600, 720);
  placed = await doors();
  assert.deepEqual(placed.map(door => door.doorStyle ?? 'swing'), ['swing', 'gate', 'koshi']);
  await page.locator('#planCanvas').screenshot({ path: `${output}/doors.png` });

  // 開き戸・門扉は、開く範囲（4分の1の円）の中を押しても選べる。範囲の外は、ふつうに床
  await page.locator('[data-tool="select"]').first().click();
  const clickAt = async (x, y) => { const at = await planPoint(x, y); await page.mouse.click(at.x, at.y); };
  const selection = () => page.evaluate(() => window.__editorTest.selection());
  await clickAt(160, 140);
  assert.deepEqual(await selection(), [placed[0].id], 'inside the swing of a door selects it');
  await clickAt(430, 150);
  assert.deepEqual(await selection(), [placed[1].id], 'inside the swing of a gate selects it');
  await clickAt(160, 300);
  assert.deepEqual(await selection(), ['hall'], 'the other side of the door is the floor');
  console.log('PASS: door styles: double, sliding, shoji, fusuma, lattice entrance, plank and gate doors from the palette, style changes in 2D and 3D, Japanese doors in the Japanese group, and selecting doors inside their swing');
}
