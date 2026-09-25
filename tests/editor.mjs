import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const key = 'madori-quick-3d-plan';
const output = '.codex/regression';
await mkdir(output, { recursive: true });
// Read-only geometry probes are added only by this isolated test server.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'editor-test-probes',
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/src/main.ts')) return;
    return `${code}\nwindow.__editorTest = {
      catalog: FURNITURE_DEFS,
      roomLabelBounds(id) {
        const room = findEntity(id);
        return room?.type === 'room' ? getRoomLabelBounds(room) : null;
      },
      symbolImage(item) {
        const r = planCanvas.getBoundingClientRect(), ratio = planCanvas.width/r.width;
        const margin = 12, copy = document.createElement('canvas');
        copy.width = item.w*view.zoom+margin*2; copy.height = item.h*view.zoom+margin*2;
        copy.getContext('2d').drawImage(planCanvas,
          (item.x*view.zoom+view.x-margin)*ratio, (item.y*view.zoom+view.y-margin)*ratio,
          copy.width*ratio, copy.height*ratio, 0, 0, copy.width, copy.height);
        return copy.toDataURL();
      },
      project(x, y, height = 0.08) {
        const p = new THREE.Vector3((x-threeSceneCenter.x)*SCALE_3D,height,(y-threeSceneCenter.y)*SCALE_3D).project(camera);
        const r = threeCanvas.getBoundingClientRect();
        return { x:r.left+(p.x+1)*r.width/2, y:r.top+(1-p.y)*r.height/2 };
      },
      bounds(id) {
        const objects = planGroup.children.filter(o => o.userData.entityId === id);
        if (!objects.length) return null;
        const box = new THREE.Box3();
        objects.forEach(o => box.union(new THREE.Box3().setFromObject(o, true)));
        return { min:box.min.toArray(), max:box.max.toArray() };
      },
      planPoint(x,y) {
        const r = planCanvas.getBoundingClientRect();
        return { x:r.left+x*view.zoom+view.x, y:r.top+y*view.zoom+view.y };
      },
      grassTufts() {
        return planGroup.children.filter(o => o.isInstancedMesh).reduce((sum, o) => sum + o.count, 0);
      },
      floorPieces(id) {
        return planGroup.children.filter(o => o.userData.entityId===id).flatMap(o => o.children.filter(c=>c.isMesh).map(c=>{
          const b = new THREE.Box3().setFromObject(c); return { min:b.min.toArray(),max:b.max.toArray() };
        }));
      }
    };`;
  },
}] });
await server.listen();
let browser;
const errors = [];
const room = (id = 'room', x = 0, y = 0, w = 600, h = 400, surface = 'plain') => ({ id, type: 'room', name: id, x, y, w, h, surface, color: '#ffffff' });
const plan = (entities = [room()], roofs = []) => ({ floors: [{ id: 'f1', name: '1F', entities }], activeFloor: 0, selectedId: null, roofs });
let page;
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
async function change(selector, value) {
  await page.locator(selector).fill(String(value));
  await page.locator(selector).press('Tab');
}
async function choose(selector) {
  const button = page.locator(selector);
  const details = button.locator('xpath=ancestor::details');
  if (await details.count() && await details.getAttribute('open') === null) await details.locator('summary').click();
  await button.click();
}
async function importPlan(data) {
  await page.locator('#importInput').setInputFiles({ name: 'test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.waitForTimeout(180);
  assert.notEqual(await page.locator('#saveStatus').textContent(), '読み込み失敗');
}
async function move(from, dx, dy, cancel = false) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}
const project = (x, y, height) => page.evaluate(([x, y, height]) => window.__editorTest.project(x, y, height), [x, y, height]);
const planPoint = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
async function pixels(target = page) {
  await target.waitForTimeout(300);
  return target.locator('#threeCanvas').evaluate(canvas => {
    const copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
    const colors = new Set();
    let hash = 0;
    for (let i = 0; i < data.length; i += 64) {
      colors.add(`${data[i] >> 4},${data[i+1] >> 4},${data[i+2] >> 4}`);
      hash = (Math.imul(hash, 31) + data[i] + data[i+1]*3 + data[i+2]*7) >>> 0;
    }
    return { colors: colors.size, hash, width: copy.width, height: copy.height };
  });
}
async function open(raw = JSON.stringify(plan()), extra = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...extra });
  const target = await context.newPage();
  target.on('pageerror', error => errors.push(error.message));
  target.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await target.addInitScript(({ key, raw }) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem(key, raw);
    sessionStorage.setItem('seeded', 'yes');
  }, { key, raw });
  await target.goto(server.resolvedUrls.local[0]);
  await target.waitForFunction(() => Boolean(window.__editorTest));
  return target;
}

try {
  browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  page = await open();
  assert.equal(await page.locator('#mobileNotice').isVisible(), false);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);

  // Destructive reset and native text undo must not silently remove a plan.
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#resetButton').click();
  assert.equal((await saved()).floors[0].entities.length, 1);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#resetButton').click();
  assert.equal((await saved()).floors[0].entities.length, 0);
  await page.locator('#undoButton').click();
  assert.equal((await saved()).floors[0].entities.length, 1);
  await page.locator('button[data-view-mode="plan"]').click();
  let point = await planPoint(50, 50);
  await page.mouse.click(point.x, point.y);
  await change('#roomWInput', 640);
  await page.locator('#roomNameInput').focus();
  await page.locator('#roomNameInput').press('End');
  await page.locator('#roomNameInput').pressSequentially('AB');
  await page.keyboard.press('Control+z');
  assert.equal((await saved()).floors[0].entities[0].w, 640);
  await page.locator('#roomNameInput').press('Tab');
  console.log('PASS: reset confirmation and text-field undo');

  const previousName = (await saved()).floors[0].entities[0].name;
  await change('#roomNameInput', '');
  assert.equal(await page.locator('#roomNameInput').inputValue(), '');
  assert.equal((await saved()).floors[0].entities[0].name, '');
  assert.equal(await page.evaluate(() => window.__editorTest.roomLabelBounds('room')), null);
  await page.locator('#undoButton').click();
  assert.equal((await saved()).floors[0].entities[0].name, previousName);
  await page.locator('#redoButton').click();
  assert.equal((await saved()).floors[0].entities[0].name, '');
  await page.screenshot({ path: `${output}/unnamed-room.png` });
  point = await planPoint(25, 20);
  await move(point, 80, 60);
  const movedUnnamedRoom = (await saved()).floors[0].entities[0];
  assert.ok(movedUnnamedRoom.x !== 0 || movedUnnamedRoom.y !== 0);
  assert.equal(movedUnnamedRoom.labelOffsetX, undefined);
  assert.equal(movedUnnamedRoom.labelOffsetY, undefined);
  await page.locator('#undoButton').click();
  await page.locator('#dimensionToggle').click();
  assert.ok(await page.evaluate(() => window.__editorTest.roomLabelBounds('room')));
  // 名前がないときは寸法が1行目に詰まるので、その行をつかむ
  point = await planPoint(35, 20);
  await move(point, 60, 40);
  const movedDimensions = (await saved()).floors[0].entities[0];
  assert.equal(movedDimensions.x, 0);
  assert.equal(movedDimensions.y, 0);
  assert.ok(movedDimensions.labelOffsetX !== undefined);
  await page.locator('#undoButton').click();
  await page.locator('#dimensionToggle').click();
  await change('#roomNameInput', '   ');
  assert.equal(await page.evaluate(() => window.__editorTest.roomLabelBounds('room')), null);
  await change('#roomNameInput', '');
  const unnamedExportEvent = page.waitForEvent('download');
  await page.locator('#exportButton').click();
  const unnamedExport = await unnamedExportEvent, unnamedChunks = [];
  for await (const chunk of await unnamedExport.createReadStream()) unnamedChunks.push(chunk);
  const unnamedPlan = JSON.parse(Buffer.concat(unnamedChunks).toString());
  assert.equal(unnamedPlan.floors[0].entities[0].name, '');
  await importPlan(unnamedPlan);
  await page.reload();
  assert.equal((await saved()).floors[0].entities[0].name, '');
  assert.equal(await page.locator('#recoveryNotice').isVisible(), false);
  point = await planPoint(50, 50);
  await page.mouse.click(point.x, point.y);
  assert.equal(await page.locator('#roomNameInput').inputValue(), '');
  await change('#roomNameInput', 'Renamed');
  assert.equal((await saved()).floors[0].entities[0].name, 'Renamed');
  console.log('PASS: unnamed rooms, label hit testing, dimension dragging, undo/redo, export/import and reload');

  const diagonal = { id: 'diagonal', type: 'wall', x1: 17, y1: 19, x2: 417, y2: 319 };
  await importPlan(plan([room(), diagonal, { id: 'door', type: 'door', x1: 177, y1: 139, x2: 257, y2: 199 }]));
  point = await planPoint(97, 79);
  await move(point, 39, 47);
  const movedWall = (await saved()).floors[0].entities.find(e => e.id === 'diagonal');
  assert.notEqual(movedWall.x1, diagonal.x1);
  assert.equal(movedWall.x2 - movedWall.x1, 400);
  assert.equal(movedWall.y2 - movedWall.y1, 300);
  await page.locator('#undoButton').click();
  await page.locator('button[data-view-mode="split"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/diagonal.png` });
  console.log('PASS: dragging diagonal walls preserves length and angle');

  // Free text labels are 2D-only annotations with editable content, size, rotation and color.
  await importPlan(plan());
  await page.locator('button[data-view-mode="plan"]').click();
  await page.locator('[data-tool="text"]').click();
  point = await planPoint(300, 200);
  await page.mouse.click(point.x, point.y);
  const textOf = async () => (await saved()).floors[0].entities.find(e => e.type === 'text');
  let label = await textOf();
  assert.equal(label.text, 'テキスト');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'textContentInput');
  await change('#textContentInput', '寝室\nベッド');
  await change('#textSizeInput', 40);
  await change('#textRotationInput', 90);
  label = await textOf();
  assert.deepEqual([label.text, label.size, label.rotation], ['寝室\nベッド', 40, 90]);
  await page.locator('[data-tool="text"]').click();
  point = await planPoint(label.x, label.y);
  await page.mouse.click(point.x, point.y);
  assert.equal((await saved()).floors[0].entities.filter(e => e.type === 'text').length, 1);
  await move(point, 60, 30);
  const movedLabel = await textOf();
  assert.ok(movedLabel.x > label.x && movedLabel.y > label.y);
  await page.locator('#undoButton').click();
  assert.deepEqual([(await textOf()).x, (await textOf()).y], [label.x, label.y]);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  const reloaded = await textOf();
  assert.deepEqual([reloaded.text, reloaded.x, reloaded.y, reloaded.size, reloaded.rotation], [label.text, label.x, label.y, label.size, label.rotation]);
  await page.locator('button[data-view-mode="plan"]').click();
  point = await planPoint(label.x, label.y);
  await page.mouse.click(point.x, point.y);
  await change('#textContentInput', '');
  assert.equal(await textOf(), undefined);
  await page.locator('#undoButton').click();
  assert.equal((await textOf()).text, '寝室\nベッド');
  // Text is 2D-only: the 3D view of this bare floor must still render, and page errors are asserted at the end.
  await page.locator('button[data-view-mode="three"]').click();
  assert.ok((await pixels()).colors > 1);
  console.log('PASS: free text labels: place, edit, resize, rotate, move, undo, reload and delete when emptied');

  // 2D symbol variants are picked from thumbnails or with V, remembered for new items, and validated on load.
  await importPlan(plan([room(), { id: 'seat', type: 'furniture', kind: 'chair', x: 200, y: 100, w: 45, h: 45, rotation: 0, symbol: 99 }, { id: 'oak', type: 'furniture', kind: 'tree', x: 300, y: 100, w: 300, h: 300, rotation: 0, height: -5 }]));
  await page.locator('button[data-view-mode="split"]').click();
  const itemOf = async id => (await saved()).floors[0].entities.find(e => e.id === id);
  assert.equal((await itemOf('seat')).symbol, undefined);
  assert.equal((await itemOf('oak')).height, 10);
  point = await planPoint(222, 122);
  await page.mouse.click(point.x, point.y);
  assert.equal(await page.locator('.symbol-option').count(), 3);
  assert.ok(await page.locator('.symbol-option canvas').nth(2).evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)));
  await page.locator('.symbol-option[data-symbol="2"]').click();
  assert.equal((await itemOf('seat')).symbol, 2);
  assert.equal(await page.locator('.symbol-option.is-active').getAttribute('data-symbol'), '2');
  await page.keyboard.press('v');
  assert.equal((await itemOf('seat')).symbol, undefined);
  await page.keyboard.press('Shift+V');
  assert.equal((await itemOf('seat')).symbol, 2);
  await page.locator('#undoButton').click();
  assert.equal((await itemOf('seat')).symbol, undefined);
  await page.locator('#redoButton').click();
  assert.equal((await itemOf('seat')).symbol, 2);
  await choose('[data-furniture="chair"]');
  point = await planPoint(100, 330);
  await page.mouse.click(point.x, point.y);
  const chairs = (await saved()).floors[0].entities.filter(e => e.kind === 'chair');
  assert.equal(chairs.length, 2);
  assert.ok(chairs.every(e => e.symbol === 2));
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.equal((await itemOf('seat')).symbol, 2);
  console.log('PASS: 2D symbol variants: thumbnails, V key, undo/redo, remembered for new items, reload and invalid numbers');

  // Trees and other outdoor items with a height setting grow to that height in 3D.
  await page.locator('button[data-view-mode="split"]').click();
  point = await planPoint(450, 250);
  await page.mouse.click(point.x, point.y);
  assert.equal(await page.locator('#furnitureHeightInput').inputValue(), '10');
  await change('#furnitureHeightInput', 800);
  assert.equal((await itemOf('oak')).height, 800);
  let top = (await page.evaluate(() => window.__editorTest.bounds('oak'))).max[1];
  assert.ok(Math.abs(top - 8.08) < 0.03, `tree top ${top}`);
  await change('#furnitureHeightInput', 450);
  assert.equal((await itemOf('oak')).height, undefined);
  top = (await page.evaluate(() => window.__editorTest.bounds('oak'))).max[1];
  assert.ok(Math.abs(top - 4.58) < 0.03, `default tree top ${top}`);
  point = await planPoint(222, 122);
  await page.mouse.click(point.x, point.y);
  assert.equal(await page.locator('#furnitureHeightInput').count(), 0);
  console.log('PASS: outdoor tree height: field, 3D top, back to default, and hidden for fixed-height items');

  // New rooms and ground start without a name; grass ground grows blades in 3D only while it is grass.
  await importPlan(plan());
  await page.locator('button[data-view-mode="split"]').click();
  await choose('[data-surface="grass"]');
  point = await planPoint(40, 40);
  const corner = await planPoint(440, 340);
  await move(point, corner.x - point.x, corner.y - point.y);
  const ground = (await saved()).floors[0].entities.find(e => e.type === 'room' && e.id !== 'room');
  assert.deepEqual([ground.name, ground.surface, ground.w, ground.h], ['', 'grass', 400, 300]);
  assert.equal(await page.evaluate(() => window.__editorTest.grassTufts()), Math.round(400 * 300 / 10000 * 70));
  await page.locator('#roomSurfaceInput').selectOption('stone');
  assert.equal(await page.evaluate(() => window.__editorTest.grassTufts()), 0);
  await page.locator('#undoButton').click();
  assert.equal(await page.evaluate(() => window.__editorTest.grassTufts()), 840);
  await page.screenshot({ path: `${output}/grass-and-unnamed-ground.png` });
  console.log('PASS: new ground has no name, and grass blades follow the grass surface in 3D');

  // The 2D/3D boundary can be dragged, nudged with arrow keys, reset by double-click, and is remembered.
  await page.locator('button[data-view-mode="split"]').click();
  const panes = () => page.evaluate(() => ['.plan-pane', '.three-pane', '#planCanvas', '#threeCanvas'].map(selector => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }));
  const dragDivider = async (dx, dy) => {
    const handle = await page.locator('#splitDivider').boundingBox();
    await move({ x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, dx, dy);
  };
  const [plan0, three0] = await panes();
  assert.ok(Math.abs(plan0.w - three0.w) < 2, 'panes start equal');
  assert.equal(await page.locator('#splitDivider').getAttribute('aria-orientation'), 'vertical');
  await dragDivider(200, 0);
  let [plan1, three1, planCanvas1, threeCanvas1] = await panes();
  assert.ok(Math.abs(plan1.w - plan0.w - 200) < 8, `2D grew ${plan1.w - plan0.w}`);
  assert.ok(Math.abs(plan1.w + three1.w - plan0.w - three0.w) < 2);
  assert.ok(Math.abs(planCanvas1.w - plan1.w) < 2 && Math.abs(threeCanvas1.w - three1.w) < 2, 'canvases follow the panes');
  assert.ok(Number(await page.evaluate(() => localStorage.getItem('madori-quick-3d-split'))) > 0.6);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.ok(Math.abs((await panes())[0].w - plan1.w) < 2, 'boundary is remembered');
  await page.locator('#splitDivider').focus();
  await page.keyboard.press('ArrowLeft');
  const total = plan0.w + three0.w;
  assert.ok(Math.abs((await panes())[0].w - (plan1.w - total * 0.05)) < 4, 'arrow key moves 5%');
  await dragDivider(-2000, 0);
  assert.ok((await panes())[0].w >= 299, 'the 2D side keeps a usable width');
  await dragDivider(4000, 0);
  const [planWide, threeNarrow] = await panes();
  assert.ok(threeNarrow.w >= 299, 'the 3D side keeps a usable width');
  assert.ok(Math.abs(planWide.w + threeNarrow.w - plan0.w - three0.w) < 2, 'no empty strip is left at the edge');
  await page.locator('#splitDivider').dblclick();
  const [planReset, threeReset] = await panes();
  assert.ok(Math.abs(planReset.w - threeReset.w) < 2, 'double-click restores the default split');
  assert.equal(await page.evaluate(() => localStorage.getItem('madori-quick-3d-split')), null);
  await page.locator('button[data-view-mode="plan"]').click();
  assert.equal(await page.locator('#splitDivider').isVisible(), false);
  await page.locator('button[data-view-mode="split"]').click();
  console.log('PASS: 2D/3D boundary: drag, canvases follow, remembered, arrow keys, limits, reset and hidden in single views');

  const surfaces = plan([{ ...room('grass', 0, 0, 600, 400, 'grass'), color: '#83ab57' }, { ...room('stone', 100, 100, 400, 200, 'stone'), color: '#aeb3b1' }]);
  await importPlan(surfaces);
  await page.locator('button[data-view-mode="three"]').click();
  const grassPieces = await page.evaluate(() => window.__editorTest.floorPieces('grass'));
  const stonePieces = await page.evaluate(() => window.__editorTest.floorPieces('stone'));
  assert.equal(grassPieces.length, 4);
  assert.equal(stonePieces.length, 1);
  for (const a of grassPieces) for (const b of stonePieces) {
    assert.ok(a.max[0] <= b.min[0]+1e-6 || b.max[0] <= a.min[0]+1e-6 || a.max[2] <= b.min[2]+1e-6 || b.max[2] <= a.min[2]+1e-6);
  }
  assert.ok((await pixels()).colors > 20);
  await page.screenshot({ path: `${output}/overlapping-floors.png` });
  console.log('PASS: overlapping floor meshes do not share visible areas');

  const roof = { id: 'roof', type: 'roof', kind: 'gable', x: -40, y: -40, w: 680, h: 480 };
  const twoStory = plan([room()], [roof]);
  twoStory.floors.push({ id: 'f2', name: '2F', entities: [room('upper')] });
  await importPlan(twoStory);
  assert.equal((await saved()).roofs[0].floorId, 'f2');
  const roofBounds = await page.evaluate(() => window.__editorTest.bounds('roof'));
  assert.ok(roofBounds);
  await page.locator('#floorVisibility button').filter({ hasText: /^2F$/ }).click();
  assert.equal(await page.evaluate(() => window.__editorTest.bounds('roof')), null);
  await page.locator('#floorVisibility button').filter({ hasText: /^2F$/ }).click();
  assert.deepEqual(await page.evaluate(() => window.__editorTest.bounds('roof')), roofBounds);
  await choose('.roof-list-select');
  await page.locator('#roofFloorInput').selectOption('f1');
  const lowerBounds = await page.evaluate(() => window.__editorTest.bounds('roof'));
  assert.ok(Math.abs(roofBounds.min[1] - lowerBounds.min[1] - 2.75) < 1e-6);
  await page.locator('#entityLockedInput').check();
  assert.equal(await page.locator('#roofFloorInput').isDisabled(), true);
  await page.locator('#entityLockedInput').uncheck();
  await page.locator('#roofFloorInput').selectOption('f2');
  await page.reload();
  await page.locator('button[data-view-mode="plan"]').click();
  await page.locator('[title="上の階を追加"]').click();
  assert.equal((await saved()).roofs[0].floorId, 'f2');
  await page.locator('#floorTabs button').filter({ hasText: /^2F$/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[title="表示中の階を削除"]').click();
  assert.equal((await saved()).roofs.length, 0);
  await page.locator('#undoButton').click();
  assert.equal((await saved()).roofs[0].floorId, 'f2');
  console.log('PASS: roof migration, floor assignment, visibility, lock, reload and undo');

  await importPlan(plan());
  await page.locator('button[data-view-mode="three"]').click();
  await choose('[data-furniture="table"]');
  point = await project(300, 200);
  await page.mouse.click(point.x, point.y);
  let furniture = (await saved()).floors[0].entities.find(e => e.type === 'furniture');
  assert.ok(furniture);
  assert.equal(await page.locator('[data-furniture="table"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-tool="select"]').click();
  point = await project(furniture.x + furniture.w/2, furniture.y + furniture.h/2, 0.42);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 90, point.y + 40, { steps: 8 });
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.up();
  assert.deepEqual((await saved()).floors[0].entities.find(e => e.id === furniture.id), furniture);
  await move(point, 100, 45);
  let movedFurniture = (await saved()).floors[0].entities.find(e => e.id === furniture.id);
  assert.ok(movedFurniture.x !== furniture.x || movedFurniture.y !== furniture.y);
  assert.equal(movedFurniture.w, furniture.w);
  assert.equal(movedFurniture.h, furniture.h);
  await page.locator('#undoButton').click();
  assert.deepEqual((await saved()).floors[0].entities.find(e => e.id === furniture.id), furniture);
  await page.locator('#redoButton').click();
  assert.deepEqual((await saved()).floors[0].entities.find(e => e.id === furniture.id), movedFurniture);
  point = await project(movedFurniture.x + movedFurniture.w/2, movedFurniture.y + movedFurniture.h/2, 0.42);
  await move(point, 80, 20, true);
  assert.deepEqual((await saved()).floors[0].entities.find(e => e.id === furniture.id), movedFurniture);
  await page.locator('#entityLockedInput').check();
  const locked = (await saved()).floors[0].entities.find(e => e.id === furniture.id);
  point = await project(locked.x + locked.w/2, locked.y + locked.h/2, 0.42);
  await move(point, 70, 30);
  assert.deepEqual((await saved()).floors[0].entities.find(e => e.id === furniture.id), locked);
  await choose('[data-furniture="chair"]');
  point = await project(160, 150);
  await move(point, 30, 20, true);
  assert.equal((await saved()).floors[0].entities.filter(e => e.type === 'furniture').length, 1);
  await page.locator('[data-tool="select"]').click();
  await page.waitForTimeout(1000);
  const beforeOrbit = await pixels();
  const beforeProjection = await project(100, 100);
  const canvas = await page.locator('#threeCanvas').boundingBox();
  const background = { x: canvas.x + canvas.width * 0.8, y: canvas.y + 100 };
  await move(background, 100, 40);
  assert.notEqual((await pixels()).hash, beforeOrbit.hash);
  assert.notDeepEqual(await project(100, 100), beforeProjection);
  const beforePan = await pixels();
  await page.mouse.move(background.x, background.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(background.x - 70, background.y + 30, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  assert.notEqual((await pixels()).hash, beforePan.hash);
  const beforeZoom = await pixels();
  await page.mouse.wheel(0, -160);
  assert.notEqual((await pixels()).hash, beforeZoom.hash);
  await page.screenshot({ path: `${output}/three-editing.png` });
  console.log('PASS: 3D placement, move, dimensions, lock, cancel, undo/redo, orbit, pan and zoom');

  const upperPlan = plan();
  upperPlan.floors.push({ id: 'f2', name: '2F', entities: [room('upper')] });
  upperPlan.activeFloor = 1;
  await importPlan(upperPlan);
  await choose('[data-furniture="chair"]');
  point = await project(300, 200, 2.75);
  await page.mouse.click(point.x, point.y);
  assert.equal((await saved()).floors[0].entities.filter(e => e.type === 'furniture').length, 0);
  assert.equal((await saved()).floors[1].entities.filter(e => e.type === 'furniture').length, 1);
  await page.locator('#floorVisibility button').filter({ hasText: /^2F$/ }).click();
  point = await project(100, 100, 2.75);
  await page.mouse.click(point.x, point.y);
  assert.equal((await saved()).floors[1].entities.filter(e => e.type === 'furniture').length, 1);
  console.log('PASS: 3D placement uses the active floor and skips hidden floors');
  await page.context().close();

  page = await open(JSON.stringify(plan([{ id: 'quality', type: 'furniture', kind: 'chair', x: 200, y: 100, w: 40, h: 40, rotation: 0 }])));
  await page.locator('button[data-view-mode="split"]').click();
  point = await planPoint(220, 120);
  await page.mouse.click(point.x, point.y);
  const catalog = await page.evaluate(() => window.__editorTest.catalog);
  const symbols = [];
  for (const [kind, defaults] of Object.entries(catalog)) {
    await page.locator('#furnitureKindInput').selectOption(kind);
    await change('#furnitureRotationInput', 0);
    await page.locator('#furnitureFlipInput').uncheck();
    await page.locator('#fitButton').click();
    const original = (await saved()).floors[0].entities[0];
    symbols.push({ label: defaults.label, url: await page.evaluate(item => window.__editorTest.symbolImage(item), original) });
    const w = Math.max(20, Math.round(defaults.w*1.5/20)*20), h = Math.max(20, Math.round(defaults.h*0.75/20)*20);
    await change('#furnitureWInput', w);
    await change('#furnitureHInput', h);
    await change('#furnitureRotationInput', 90);
    await page.locator('#furnitureFlipInput').check();
    await page.locator('#furnitureColor3dInput').evaluate(input => { input.value = '#6c998e'; input.dispatchEvent(new Event('change', { bubbles: true })); });
    const edited = (await saved()).floors[0].entities[0];
    assert.equal(edited.w, w); assert.equal(edited.h, h); assert.equal(edited.rotation, 90);
    assert.equal(edited.flip, true); assert.equal(edited.color3d, '#6c998e');
    const box = await page.evaluate(() => window.__editorTest.bounds('quality'));
    assert.ok(Math.abs(box.max[0]-box.min[0]-h/100)<1e-5, `${kind}: rotated depth`);
    assert.ok(Math.abs(box.max[2]-box.min[2]-w/100)<1e-5, `${kind}: rotated width`);
    assert.ok(box.min[1] >= 0.08-1e-5, `${kind}: below floor`);
  }
  const lastFurniture = (await saved()).floors[0].entities[0];
  await page.reload();
  assert.deepEqual((await saved()).floors[0].entities[0], lastFurniture);
  await page.locator('button[data-view-mode="three"]').click();
  assert.ok((await pixels()).colors > 20);
  await page.screenshot({ path: `${output}/furniture-edited.png` });
  const contactHeight = Math.ceil(symbols.length / 4) * 270;
  const contact = await browser.newPage({ viewport: { width: 1200, height: contactHeight } });
  await contact.setContent('<style>*{box-sizing:border-box}body{margin:0;display:grid;grid-template-columns:repeat(4,300px);font:14px system-ui;background:white}figure{margin:0;height:270px;padding:14px;border:1px solid #ddd;display:flex;flex-direction:column;gap:10px}img{width:100%;height:210px;object-fit:contain}</style>');
  await contact.evaluate(symbols => {
    for (const { label, url } of symbols) {
      const figure=document.createElement('figure'), caption=document.createElement('figcaption'), image=document.createElement('img');
      caption.textContent=label;image.src=url;figure.append(caption,image);document.body.append(figure);
    }
  }, symbols);
  await contact.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  for (let part = 0; part * 810 < contactHeight; part += 1) await contact.screenshot({ path: `${output}/symbols-${part+1}.png`, clip: { x:0, y:part*810, width:1200, height:Math.min(810, contactHeight - part*810) } });
  await contact.close();
  await page.context().close();
  console.log(`PASS: all ${symbols.length} furniture symbols, resizing, rotation, flip, color, 3D footprints and reload`);

  // Recovery is tested through actual localStorage and the download UI.
  const broken = JSON.stringify(plan([room(), { type: 'furniture', kind: 'unknown', x: 0, y: 0, w: 100, h: 100 }]));
  page = await open(broken);
  assert.equal(await page.locator('#recoveryNotice').isVisible(), true);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), broken);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#recoveryExportButton').click();
  const download = await downloadEvent;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), broken);
  const backups = await page.evaluate(key => Object.keys(localStorage).filter(k => k.startsWith(key+'-recovery-')).map(k => localStorage.getItem(k)), key);
  assert.deepEqual(backups, [broken]);
  // Reopening the same broken autosave reuses the existing backup instead of adding a copy.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.deepEqual(await page.evaluate(key => Object.keys(localStorage).filter(k => k.startsWith(key+'-recovery-')).map(k => localStorage.getItem(k)), key), [broken]);
  await page.locator('button[data-view-mode="plan"]').click();
  point = await planPoint(50, 50);
  await page.mouse.click(point.x, point.y);
  await change('#roomWInput', 640);
  assert.equal((await saved()).floors[0].entities.length, 1);
  assert.equal((await saved()).floors[0].entities[0].w, 640);
  await page.context().close();
  page = await open(broken);
  // Drop the backup made on first load so the reload has to write a new one and hits the quota error.
  await page.evaluate(key => Object.keys(localStorage).filter(k => k.startsWith(key+'-recovery-')).forEach(k => localStorage.removeItem(k)), key);
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.includes('-recovery-')) throw new DOMException('Full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await page.reload();
  await page.locator('button[data-view-mode="plan"]').click();
  point = await planPoint(50, 50);
  await page.mouse.click(point.x, point.y);
  await change('#roomWInput', 640);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), broken);
  assert.match(await page.locator('#saveStatus').textContent(), /自動保存停止/);
  await page.context().close();
  console.log('PASS: partial recovery, original download and quota-failure protection');

  page = await open(JSON.stringify(surfaces), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  assert.equal(await page.locator('#mobileNotice').isVisible(), true);
  await page.locator('button[data-view-mode="split"]').click();
  assert.equal(await page.locator('#splitDivider').getAttribute('aria-orientation'), 'horizontal');
  const mobilePlan = async () => (await page.locator('.plan-pane').boundingBox()).height;
  const mobileBefore = await mobilePlan();
  // スマホでは境目がページの下の方にあるので、見える所まで送ってからつかむ
  await page.locator('#splitDivider').scrollIntoViewIfNeeded();
  const mobileHandle = await page.locator('#splitDivider').boundingBox();
  await move({ x: mobileHandle.x + mobileHandle.width / 2, y: mobileHandle.y + mobileHandle.height / 2 }, 0, -120);
  const mobileAfter = await mobilePlan();
  assert.ok(Math.abs(mobileAfter - (mobileBefore - 120)) < 8, `mobile boundary moves up and down: ${mobileBefore} -> ${mobileAfter}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('button[data-view-mode="three"]').click();
  assert.ok((await pixels()).colors > 20);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: mobile canvas, layout and no browser errors');
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
