import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
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
      variants: FURNITURE_VARIANTS,
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
      planZoom() {
        return view.zoom;
      },
      cameraDistance() {
        return camera.position.distanceTo(controls.target);
      },
      cameraPosition() {
        return camera.position.toArray();
      },
      materials(id) {
        const found = [];
        planGroup.traverse(o => {
          if (!o.isMesh || entityIdFromObject(o) !== id) return;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => found.push({ name: m.name, transparent: m.transparent, opacity: m.opacity, color: m.color.getHexString(), shadow: o.castShadow, map: Boolean(m.map) }));
        });
        return found;
      },
      personEnds(id) {
        const item = findEntity(id);
        return personLayoutOf(item).handles.map(handle => furnitureLocalToWorld(item, handle));
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
  // 表示の切り替えは次の描画で全体に合わせ直すので、それを待ってから座標を求める
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const itemOf = async id => (await saved()).floors[0].entities.find(e => e.id === id);
  assert.equal((await itemOf('seat')).symbol, undefined);
  assert.equal((await itemOf('oak')).height, 10);
  point = await planPoint(222, 122);
  await page.mouse.click(point.x, point.y);
  assert.equal(await page.locator('.symbol-option').count(), 3, await page.locator('#propertiesPanel').innerText());
  assert.ok(await page.locator('.symbol-option canvas').nth(2).evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)));
  const standardSeat = await page.evaluate(() => window.__editorTest.bounds('seat'));
  await page.locator('.symbol-option[data-symbol="2"]').click();
  assert.equal((await itemOf('seat')).symbol, 2);
  // The 3D model follows the chosen design too (the round-seat chair has a lower bentwood back).
  const roundSeat = await page.evaluate(() => window.__editorTest.bounds('seat'));
  assert.ok(Math.abs(roundSeat.max[1] - standardSeat.max[1]) > 0.01, '3D chair changes with the design');
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

  // Both views zoom far beyond the old limits (2D 0.25-3.6x, 3D 4-48 m) without freezing.
  const zoomWith = async (selector, dy, count) => {
    const box = await page.locator(selector).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < count; i += 1) await page.mouse.wheel(0, dy);
    await page.waitForTimeout(300);
  };
  await zoomWith('#planCanvas', -200, 40);
  assert.ok(await page.evaluate(() => window.__editorTest.planZoom()) > 1000, '2D zooms far in');
  // Deep inside a white room the grid is drawn over the floor, so panning visibly moves something.
  const planColors = () => page.locator('#planCanvas').evaluate(canvas => {
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d'); context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, copy.width, copy.height), colors = new Set();
    for (let i = 0; i < data.length; i += 16) colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
    return colors.size;
  });
  assert.ok(await planColors() > 1, 'grid shows inside rooms when zoomed in');
  const zoomedPlan = await page.locator('#planCanvas').boundingBox();
  const zoomedView = await planPoint(0, 0);
  await page.mouse.move(zoomedPlan.x + 200, zoomedPlan.y + 200);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(zoomedPlan.x + 400, zoomedPlan.y + 300, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  const pannedView = await planPoint(0, 0);
  assert.ok(Math.abs(pannedView.x - zoomedView.x - 200) < 1 && Math.abs(pannedView.y - zoomedView.y - 100) < 1, '2D right-drag follows the mouse when zoomed in');
  await zoomWith('#planCanvas', 200, 90);
  assert.ok(await page.evaluate(() => window.__editorTest.planZoom()) < 0.01, '2D zooms far out');
  await zoomWith('#threeCanvas', -200, 40);
  assert.ok(await page.evaluate(() => window.__editorTest.cameraDistance()) < 0.5, '3D zooms far in');
  // Right-drag still moves the camera a usable distance after zooming right up to a surface.
  const threeBox = await page.locator('#threeCanvas').boundingBox();
  const cameraBefore = await page.evaluate(() => window.__editorTest.cameraPosition());
  await page.mouse.move(threeBox.x + threeBox.width / 2, threeBox.y + threeBox.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(threeBox.x + threeBox.width / 2 + 250, threeBox.y + threeBox.height / 2 + 120, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(300);
  const cameraAfter = await page.evaluate(() => window.__editorTest.cameraPosition());
  const panned = Math.hypot(...cameraAfter.map((value, index) => value - cameraBefore[index]));
  assert.ok(panned > 0.2, `3D right-drag moves after zooming in: ${panned}`);
  await zoomWith('#threeCanvas', 200, 70);
  assert.ok(await page.evaluate(() => window.__editorTest.cameraDistance()) > 5000, '3D zooms far out');
  await page.locator('#fitButton').click();
  console.log('PASS: 2D and 3D zoom almost without limit in both directions, and right-drag still pans when zoomed in');

  // Reloading keeps the 2D view, the 3D camera, visibility toggles, the tool panel and the palette groups as they were.
  await importPlan({ floors: [{ id: 'f1', name: '1F', entities: [room()] }, { id: 'f2', name: '2F', entities: [room('upper')] }], activeFloor: 0, selectedId: null,
    roofs: [{ id: 'roof1', type: 'roof', kind: 'gable', x: -40, y: -40, w: 680, h: 480, floorId: 'f2' }] });
  await page.locator('button[data-view-mode="split"]').click();
  await page.waitForTimeout(200);
  await zoomWith('#planCanvas', -200, 4);
  const planArea = await page.locator('#planCanvas').boundingBox();
  await page.mouse.move(planArea.x + 150, planArea.y + 150);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(planArea.x + 230, planArea.y + 110, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  const threeArea = await page.locator('#threeCanvas').boundingBox();
  await move({ x: threeArea.x + threeArea.width * 0.8, y: threeArea.y + 120 }, 90, 30);
  await zoomWith('#threeCanvas', -200, 3);
  await page.locator('#floorVisibility button').filter({ hasText: /^2F$/ }).click();
  await page.locator('#floorVisibility button').filter({ hasText: /^屋根/ }).click();
  await page.locator('#roofToggle2d').click();
  const bedGroup = page.locator('.palette-group').filter({ has: page.locator('summary', { hasText: /^ベッド$/ }) });
  const bedWasOpen = await bedGroup.evaluate(details => details.open);
  await bedGroup.locator('summary').click();
  await page.locator('#panelToggle').click();
  await page.waitForTimeout(300);
  const viewSnapshot = async () => ({
    origin: await planPoint(0, 0),
    zoom: await page.evaluate(() => window.__editorTest.planZoom()),
    camera: await page.evaluate(() => window.__editorTest.cameraPosition()),
    distance: await page.evaluate(() => window.__editorTest.cameraDistance()),
  });
  const beforeReload = await viewSnapshot();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  await page.waitForTimeout(400);
  const afterReload = await viewSnapshot();
  assert.ok(Math.abs(afterReload.zoom - beforeReload.zoom) < 1e-9, '2D zoom is kept');
  assert.ok(Math.abs(afterReload.origin.x - beforeReload.origin.x) < 1 && Math.abs(afterReload.origin.y - beforeReload.origin.y) < 1, '2D position is kept');
  assert.ok(afterReload.camera.every((value, index) => Math.abs(value - beforeReload.camera[index]) < 1e-3), '3D camera is kept');
  assert.ok(Math.abs(afterReload.distance - beforeReload.distance) < 1e-3, '3D orbit center is kept');
  assert.equal(await page.evaluate(() => document.querySelector('.workspace').dataset.panel), 'hidden');
  assert.equal(await page.locator('#floorVisibility button').filter({ hasText: /^2F$/ }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#floorVisibility button').filter({ hasText: /^屋根/ }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#roofToggle2d').getAttribute('aria-pressed'), 'false');
  await page.locator('#panelToggle').click();
  assert.equal(await bedGroup.evaluate(details => details.open), !bedWasOpen, 'palette group open state is kept');
  // Switching the view mode still frames everything, as before.
  await page.locator('button[data-view-mode="split"]').click();
  await page.waitForTimeout(200);
  assert.notEqual(await page.evaluate(() => window.__editorTest.planZoom()), afterReload.zoom);
  console.log('PASS: reload keeps the 2D view, 3D camera, floor/roof visibility, tool panel and palette groups');

  // Basements can be added below 1F any number of times, upper floors have no limit, and basements sit below ground in 3D.
  await importPlan(plan());
  await page.locator('button[data-view-mode="split"]').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const addBasementButton = page.locator('#floorTabs button[title^="地下の階を追加"]');
  const addAboveButton = page.locator('#floorTabs button[title="上の階を追加"]');
  const floorNames = async () => (await saved()).floors.map(floor => floor.name);
  await addBasementButton.click();
  assert.deepEqual(await floorNames(), ['B1F', '1F']);
  assert.equal((await saved()).basements, 1);
  assert.equal((await saved()).activeFloor, 0);
  await addBasementButton.click();
  assert.deepEqual(await floorNames(), ['B2F', 'B1F', '1F']);
  for (let i = 0; i < 5; i += 1) await addAboveButton.click();
  assert.deepEqual(await floorNames(), ['B2F', 'B1F', '1F', '2F', '3F', '4F', '5F', '6F']);
  // With many floors only the floor tabs scroll: the add/remove buttons and the active tab stay visible, and the 2D pane keeps its width.
  const tabLayout = await page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect();
    const list = document.querySelector('.floor-tab-list'), shown = list.getBoundingClientRect(), active = list.querySelector('.is-active').getBoundingClientRect();
    return { pane: box('.plan-pane').width, canvas: box('#planCanvas').width, bar: box('.pane-bar').right, add: box('#floorTabs button[title="上の階を追加"]').right,
      remove: box('#floorTabs button[title="表示中の階を削除"]').right, scrolls: list.scrollWidth > list.clientWidth,
      activeVisible: active.left >= shown.left - 1 && active.right <= shown.right + 1, stats: getComputedStyle(document.querySelector('#planStats')).display };
  });
  assert.ok(Math.abs(tabLayout.canvas - tabLayout.pane) < 1, `the 2D canvas stays inside its pane: ${JSON.stringify(tabLayout)}`);
  assert.ok(tabLayout.scrolls && tabLayout.add <= tabLayout.bar && tabLayout.remove <= tabLayout.bar, `the add and remove buttons stay visible: ${JSON.stringify(tabLayout)}`);
  assert.ok(tabLayout.activeVisible, 'the active floor tab is scrolled into view');
  assert.equal(tabLayout.stats, 'none', 'the counts give way to the floor tabs');
  assert.match(await page.locator('#threeStats').textContent(), /^地上6階・地下2階/);
  // Deleting a basement renumbers the rest; the plan keeps one ground floor.
  await page.locator('#floorTabs button').filter({ hasText: /^B2F$/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#floorTabs button[title="表示中の階を削除"]').click();
  assert.deepEqual(await floorNames(), ['B1F', '1F', '2F', '3F', '4F', '5F', '6F']);
  assert.equal((await saved()).basements, 1);
  await importPlan({ floors: [{ id: 'b1', name: '', entities: [room('cellar')] }, { id: 'f1', name: '', entities: [room()] }], basements: 1, activeFloor: 1, selectedId: null, roofs: [] });
  assert.deepEqual(await floorNames(), ['B1F', '1F']);
  const cellar = await page.evaluate(() => window.__editorTest.bounds('cellar'));
  const groundRoom = await page.evaluate(() => window.__editorTest.bounds('room'));
  assert.ok(cellar.max[1] < -1, `basement floor below ground: ${cellar.max[1]}`);
  assert.ok(groundRoom.min[1] < -0.05 && Math.abs(groundRoom.max[1] - 0.08) < 1e-4, 'the 1F slab closes the gap above the basement');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.deepEqual(await floorNames(), ['B1F', '1F']);
  console.log('PASS: basements below 1F, unlimited floors, renumbering on delete, 3D height and reload');

  // Ghost floors are drawn once at a uniform opacity (crossing walls are no darker), and the floor and tint can be chosen.
  await importPlan({ floors: [
    { id: 'g1', name: '', entities: [{ id: 'wa', type: 'wall', x1: 0, y1: 200, x2: 600, y2: 200 }, { id: 'wb', type: 'wall', x1: 300, y1: 0, x2: 300, y2: 400 }] },
    { id: 'g2', name: '', entities: [] },
    { id: 'g3', name: '', entities: [] },
  ], activeFloor: 1, selectedId: null, roofs: [] });
  await page.locator('button[data-view-mode="plan"]').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (await page.locator('#ghostToggle').getAttribute('aria-pressed') !== 'true') await page.locator('#ghostToggle').click();
  const pixelAt = async (x, y) => {
    const screen = await planPoint(x, y);
    return page.locator('#planCanvas').evaluate((canvas, [px, py]) => {
      const rect = canvas.getBoundingClientRect(), ratio = canvas.width / rect.width;
      return [...canvas.getContext('2d').getImageData(Math.round((px - rect.left) * ratio), Math.round((py - rect.top) * ratio), 1, 1).data];
    }, [screen.x, screen.y]);
  };
  const close = (a, b, tolerance = 2) => a.every((value, i) => Math.abs(value - b[i]) <= tolerance);
  const crossing = await pixelAt(300, 200), single = await pixelAt(450, 200);
  assert.ok(close(crossing, single), `ghost walls are uniform: ${crossing} vs ${single}`);
  await page.locator('#ghostToggle').click();
  const noGhost = await pixelAt(450, 200);
  assert.ok(!close(noGhost, single), 'the ghost of 1F is visible on 2F');
  await page.locator('#ghostToggle').click();
  await page.locator('#ghostMenuButton').click();
  await page.locator('#ghostFloorSelect').selectOption('above');
  assert.ok(close(await pixelAt(450, 200), noGhost), 'nothing is shown when the floor above is empty');
  await page.locator('#ghostFloorSelect').selectOption('g1');
  assert.ok(close(await pixelAt(450, 200), single), 'a floor can be picked by name');
  await page.locator('#ghostColorInput').fill('#ff000099');
  await page.locator('#ghostColorInput').press('Enter');
  const tinted = await pixelAt(450, 200);
  assert.ok(tinted[0] > tinted[1] + 40 && tinted[0] > tinted[2] + 40, `the ghost uses the color code tint: ${tinted}`);
  assert.equal(await page.locator('#ghostOpacityValue').textContent(), '60%');
  await page.locator('#ghostColorInput').fill('#12');
  await page.locator('#ghostColorInput').press('Enter');
  assert.equal(await page.locator('#ghostColorInput').evaluate(input => input.classList.contains('is-invalid')), true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
  assert.equal(await page.locator('#ghostFloorSelect').inputValue(), 'g1');
  assert.equal(await page.locator('#ghostColorInput').inputValue(), '#ff000099');
  assert.equal(await page.locator('#ghostOpacityValue').textContent(), '60%');
  // The menu closes on reload and when clicking elsewhere.
  assert.equal(await page.locator('#ghostMenu').isVisible(), false);
  await page.locator('#ghostMenuButton').click();
  assert.equal(await page.locator('#ghostMenu').isVisible(), true);
  await page.locator('.topbar h1').click({ position: { x: 10, y: 8 } });
  assert.equal(await page.locator('#ghostMenu').isVisible(), false);
  await page.locator('#ghostMenuButton').click();
  await page.locator('#ghostColorInput').fill('');
  await page.locator('#ghostColorInput').press('Enter');
  await page.locator('#ghostFloorSelect').selectOption('below');
  console.log('PASS: ghost floors: uniform opacity, choose below/above/any floor, color code tint with opacity, reload');

  // Colors can be typed as color codes; two more digits make them see-through, evenly in 2D and as transparent materials in 3D.
  await importPlan({ floors: [{ id: 'c1', name: '', entities: [
    { id: 'wa', type: 'wall', x1: 0, y1: 200, x2: 600, y2: 200 }, { id: 'wb', type: 'wall', x1: 300, y1: 0, x2: 300, y2: 400 },
    { id: 'cr', type: 'room', name: '', x: 700, y: 0, w: 300, h: 300, color: '#FFF' },
  ] }], activeFloor: 0, selectedId: null, roofs: [] });
  assert.equal((await saved()).floors[0].entities.find(item => item.id === 'cr').color, '#ffffff', 'short and upper-case codes are normalized');
  await page.locator('button[data-view-mode="split"]').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('[data-tool="select"]').click();
  const pick = async (x, y) => {
    const point = await planPoint(x, y);
    await page.mouse.click(point.x, point.y);
  };
  await pick(150, 200);
  assert.equal(await page.locator('#lineXInput').inputValue(), '0', 'the first wall is selected');
  const colorOf = async id => (await saved()).floors[0].entities.find(item => item.id === id);
  const setCode = async (selector, value) => {
    await page.locator(selector).fill(value);
    await page.locator(selector).press('Enter');
  };
  assert.equal(await page.locator('#lineColorInputCode').inputValue(), '#000000');
  await setCode('#lineColorInputCode', '#D1272780');
  assert.equal((await colorOf('wa')).color, '#d1272780');
  assert.equal(await page.locator('#lineColorInputCode').inputValue(), '#d1272780');
  assert.equal(await page.locator('#lineColorInput').inputValue(), '#d12727');
  // The canvas is transparent where nothing is drawn, so look at the pixel as shown on the white page (and off the grid lines).
  const shown = pixel => [0, 1, 2].map(i => Math.round(pixel[i] * pixel[3] / 255 + 255 * (1 - pixel[3] / 255)));
  const halfRed = shown(await pixelAt(150, 203));
  assert.ok(halfRed[0] > 200 && halfRed[1] > 110 && halfRed[1] < 190, `the wall is half see-through red: ${halfRed}`);
  // The picker keeps the alpha digits.
  await page.locator('#lineColorInput').evaluate(input => { input.value = '#2040c0'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal((await colorOf('wa')).color, '#2040c080');
  // Walls of the same see-through color are composited once, so the crossing is no darker.
  await pick(300, 80);
  assert.equal(await page.locator('#lineXInput').inputValue(), '300', 'the second wall is selected');
  await setCode('#lineColorInputCode', '#2040c080');
  // Zoom in on the crossing so that the samples sit well inside both walls and off the grid lines.
  const crossingPoint = await planPoint(300, 200);
  await page.mouse.move(crossingPoint.x, crossingPoint.y);
  for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
  const crossingWall = shown(await pixelAt(302, 202)), singleWall = shown(await pixelAt(346, 202));
  assert.ok(close(crossingWall, singleWall, 3), `see-through walls are even where they cross: ${crossingWall} vs ${singleWall}`);
  await page.locator('#fitButton').click();
  // Invalid codes are refused, an empty code returns to the default color.
  await setCode('#lineColorInputCode', '#12345');
  assert.equal(await page.locator('#lineColorInputCode').evaluate(input => input.classList.contains('is-invalid')), true);
  assert.equal((await colorOf('wb')).color, '#2040c080');
  await setCode('#lineColor3dInputCode', '#2775d140');
  const wallMaterials = await page.evaluate(() => window.__editorTest.materials('wb'));
  assert.ok(wallMaterials.length > 0 && wallMaterials.every(m => m.transparent && Math.abs(m.opacity - 0x40 / 255) < 1e-6 && m.color === '2775d1' && !m.shadow),
    `the 3D wall is a see-through material: ${JSON.stringify(wallMaterials)}`);
  await setCode('#lineColorInputCode', '');
  assert.equal((await colorOf('wb')).color, undefined);
  assert.equal((await colorOf('wb')).color3d, '#2775d140');
  // Rooms keep their alpha when the floor material changes, and the 3D floor is see-through too.
  await pick(850, 200);
  assert.equal(await page.locator('#roomColorInputCode').inputValue(), '#ffffff', 'the room is selected');
  await setCode('#roomColorInputCode', '#2775d180');
  await page.locator('#roomSurfaceInput').selectOption('wood');
  const tintedRoom = await colorOf('cr');
  assert.match(tintedRoom.color, /^#[0-9a-f]{6}80$/);
  assert.match(tintedRoom.color3d, /^#[0-9a-f]{6}80$/);
  const roomMaterials = await page.evaluate(() => window.__editorTest.materials('cr'));
  assert.ok(roomMaterials.every(m => m.transparent && Math.abs(m.opacity - 0x80 / 255) < 1e-6), `the 3D floor and its sides are see-through: ${JSON.stringify(roomMaterials)}`);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.equal((await colorOf('cr')).color, tintedRoom.color, 'color codes with alpha survive a reload');
  console.log('PASS: color codes: typing, alpha digits, picker keeps alpha, even 2D overlap, see-through 3D, invalid and empty codes, reload');

  // Investigation marks: numbered markers count up across floors, the number can be edited, and the 3D marker shows it on top.
  await importPlan({ floors: [{ id: 'm1', name: '', entities: [room()] }, { id: 'm2', name: '', entities: [
    { id: 'old-marker', type: 'furniture', kind: 'evidenceMarker', x: 0, y: 0, w: 24, h: 24, rotation: 0, markerLabel: '7' },
  ] }], activeFloor: 0, selectedId: null, roofs: [] });
  await choose('[data-furniture="evidenceMarker"]');
  for (const [x, y] of [[150, 150], [300, 150]]) {
    const point = await planPoint(x, y);
    await page.mouse.click(point.x, point.y);
  }
  const markers = async () => (await saved()).floors[0].entities.filter(item => item.kind === 'evidenceMarker');
  assert.deepEqual((await markers()).map(item => item.markerLabel), ['8', '9'], 'numbers continue from the highest one on any floor');
  assert.equal(await page.locator('#markerLabelInput').inputValue(), '9');
  await page.locator('#markerLabelInput').fill('A12345');
  await page.locator('#markerLabelInput').press('Enter');
  assert.equal((await markers())[1].markerLabel, 'A123', 'up to four characters');
  const markerId = (await markers())[1].id;
  const markerMaterials = await page.evaluate(id => window.__editorTest.materials(id), markerId);
  assert.ok(markerMaterials.some(m => m.name === 'marker-label' && m.map), `the number is drawn on the 3D marker: ${JSON.stringify(markerMaterials)}`);
  // The other marks can be placed from the same group.
  for (const kind of ['footprints', 'fallenPerson', 'bloodPool', 'brokenGlass']) {
    await choose(`[data-furniture="${kind}"]`);
    const point = await planPoint(400, 250);
    await page.mouse.click(point.x, point.y);
    assert.equal((await saved()).floors[0].entities.at(-1).kind, kind);
  }
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.deepEqual((await markers()).map(item => item.markerLabel), ['8', 'A123']);
  await page.locator('[data-tool="select"]').click();
  console.log('PASS: investigation marks: numbered markers count up, editable number, number on the 3D marker, footprints, body, blood, glass and reload');

  // Footprints follow a path drawn by dragging; a click still places a straight trail. The stride and the path can be changed later.
  await importPlan({ floors: [{ id: 'p1', name: '', entities: [{ id: 'floor', type: 'room', name: '', x: 0, y: 0, w: 900, h: 600, color: '#ffffff' }] }], activeFloor: 0, selectedId: null, roofs: [] });
  await page.locator('button[data-view-mode="split"]').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const footprints = async () => (await saved()).floors[0].entities.filter(item => item.kind === 'footprints');
  const dragAlong = async points => {
    const first = await planPoint(...points[0]);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const [x, y] of points.slice(1)) {
      const next = await planPoint(x, y);
      await page.mouse.move(next.x, next.y, { steps: 6 });
    }
    await page.mouse.up();
  };
  await choose('[data-furniture="footprints"]');
  await dragAlong([[100, 450], [400, 450], [400, 150]]);
  let trail = (await footprints())[0];
  assert.ok(trail?.path?.length >= 2, 'the drawn path is saved');
  assert.ok(trail.w > 300 && trail.h > 300, `the frame covers the path: ${trail.w} x ${trail.h}`);
  const pathAt = ([u, v]) => [trail.x + trail.w / 2 + u * trail.w, trail.y + trail.h / 2 + v * trail.h];
  const [startX, startY] = pathAt(trail.path[0]), [endX, endY] = pathAt(trail.path.at(-1));
  assert.ok(Math.hypot(startX - 100, startY - 450) < 6 && Math.hypot(endX - 400, endY - 150) < 6, 'the path starts and ends where it was drawn');
  const trailBox = await page.evaluate(id => window.__editorTest.bounds(id), trail.id);
  assert.ok(trailBox && trailBox.max[1] < 0.1, 'the footprints lie on the floor in 3D');
  const clickAt = await planPoint(700, 300);
  await page.mouse.click(clickAt.x, clickAt.y);
  assert.equal((await footprints()).length, 2);
  assert.equal((await footprints())[1].path, undefined, 'a click places a straight trail');
  // Stride and redrawing the path of the selected footprints.
  await page.locator('[data-tool="select"]').click();
  await pick(trail.x + 30, trail.y + trail.h - 50);
  assert.equal(await page.locator('#footprintStrideInput').count(), 1, 'the drawn footprints are selected');
  await page.locator('#footprintStrideInput').fill('80');
  await page.locator('#footprintStrideInput').press('Enter');
  assert.equal((await footprints())[0].stride, 80);
  await page.locator('#footprintRedrawButton').click();
  await dragAlong([[150, 100], [500, 100]]);
  trail = (await footprints())[0];
  assert.equal((await footprints()).length, 2, 'redrawing does not add another trail');
  assert.equal(trail.stride, 80, 'redrawing keeps the stride');
  assert.ok(trail.h < 120 && trail.w > 380, `the redrawn path is the new straight line: ${trail.w} x ${trail.h}`);
  await page.locator('#footprintStraightButton').click();
  assert.equal((await footprints())[0].path, undefined, 'the trail can be made straight again');
  console.log('PASS: footprints: drawn along a dragged path, straight on click, stride, redraw and straighten, flat in 3D');

  // Shards ("破片", formerly broken glass) are scattered along a dragged path; a click still places the cluster.
  await choose('[data-furniture="brokenGlass"]');
  assert.equal((await page.locator('[data-furniture="brokenGlass"]').textContent()).trim(), '破片');
  await dragAlong([[100, 300], [500, 300]]);
  const shardItems = async () => (await saved()).floors[0].entities.filter(item => item.kind === 'brokenGlass');
  let shards = (await shardItems())[0];
  assert.ok(shards.path?.length >= 2 && shards.brush === 40, 'the drawn path and the spread are saved');
  assert.ok(shards.w > 400, 'the frame covers the path');
  const clusterAt = await planPoint(700, 450);
  await page.mouse.click(clusterAt.x, clusterAt.y);
  assert.equal((await shardItems()).length, 2);
  assert.equal((await shardItems())[1].path, undefined, 'a click places the cluster');
  // Spread, amount and color of the selected shards.
  await page.locator('[data-tool="select"]').click();
  const shardCenter = await planPoint(shards.x + shards.w / 2, shards.y + shards.h / 2);
  await page.mouse.click(shardCenter.x, shardCenter.y);
  assert.equal(await page.locator('#shardSpreadInput').inputValue(), '40');
  await page.locator('#shardSpreadInput').fill('80');
  await page.locator('#shardSpreadInput').press('Enter');
  shards = (await shardItems())[0];
  assert.equal(shards.brush, 80);
  assert.ok(shards.h > 100, 'a wider spread makes the frame deeper');
  await page.locator('#shardDensityInput').selectOption('2');
  assert.equal((await shardItems())[0].density, 2);
  await page.locator('#furnitureColorInputCode').fill('#8b5a2b');
  await page.locator('#furnitureColorInputCode').press('Enter');
  assert.equal((await shardItems())[0].color, '#8b5a2b');
  const shardMaterials = await page.evaluate(id => window.__editorTest.materials(id), shards.id);
  assert.ok(shardMaterials.some(m => m.name === 'glass-shard' && m.color === '8b5a2b' && !m.transparent), `colored shards in 3D: ${JSON.stringify(shardMaterials.slice(0, 2))}`);
  await page.locator('#shardGatherButton').click();
  assert.equal((await shardItems())[0].path, undefined, 'the shards can be gathered into the cluster again');
  await page.keyboard.press('Control+z');
  assert.ok((await shardItems())[0].path, 'undo');
  console.log('PASS: shards: scattered along a dragged path, cluster on click, spread, amount, color, gather and undo');

  // People: stand about 170 cm tall, change posture and poses, move each arm and leg with sliders or by dragging the wrist/ankle handles.
  await importPlan({ floors: [{ id: 'q1', name: '', entities: [{ id: 'floor', type: 'room', name: '', x: 0, y: 0, w: 900, h: 600, color: '#ffffff' }] }], activeFloor: 0, selectedId: null, roofs: [] });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await choose('[data-furniture="person"]');
  const spot = await planPoint(300, 300);
  await page.mouse.click(spot.x, spot.y);
  await page.locator('[data-tool="select"]').click();
  const personOf = async () => (await saved()).floors[0].entities.find(item => item.kind === 'person');
  let person = await personOf();
  const height3d = async () => {
    const box = await page.evaluate(id => window.__editorTest.bounds(id), person.id);
    return box.max[1] - box.min[1];
  };
  assert.ok(Math.abs(await height3d() - 1.7) < 0.03, `a standing person is 1.7 m tall: ${await height3d()}`);
  await pick(person.x + person.w / 2, person.y + person.h / 2);
  assert.equal(await page.locator('#personHeightInput').inputValue(), '170');
  // Posture: lying down, then a preset.
  await page.locator('#personPostureInput').selectOption('prone');
  person = await personOf();
  assert.equal(person.pose.posture, 'prone');
  assert.ok(await height3d() < 0.4, 'lying on the floor');
  assert.ok(person.h > 150, 'lying down makes the frame long');
  await page.locator('[data-pose-preset="sit"]').click();
  person = await personOf();
  assert.equal(person.pose.posture, 'stand');
  assert.ok(Math.abs(await height3d() - 1.35) < 0.15, `sitting lowers the body: ${await height3d()}`);
  // Slider: raise the right arm straight to the side.
  await page.locator('[data-pose-preset="stand"]').click();
  const before = await personOf();
  await page.locator('.pose-limb[data-part="arm1"] input[data-angle="0"]').evaluate(input => {
    input.value = '90';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  person = await personOf();
  assert.equal(person.pose.arms[1][0], 90);
  assert.ok(person.w > before.w + 40, `the outstretched arm widens the frame: ${before.w} -> ${person.w}`);
  // The waist and neck have their own joints: bowing forward lowers the head.
  await page.locator('[data-pose-preset="stand"]').click();
  await page.locator('.pose-limb[data-part="waist"] input[data-angle="0"]').evaluate(input => {
    input.value = '60';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  person = await personOf();
  assert.deepEqual(person.pose.waist, [60, 0, 0]);
  assert.ok(await height3d() < 1.5, `bowing lowers the head: ${await height3d()}`);
  await page.locator('.pose-limb[data-part="arm0"] input[data-angle="4"]').evaluate(input => {
    input.value = '45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal((await personOf()).pose.arms[0][4], 45, 'the wrist bends');
  await page.locator('[data-pose-preset="armsOut"]').click();
  // 身長 scales the whole body.
  await page.locator('#personHeightInput').fill('85');
  await page.locator('#personHeightInput').press('Enter');
  person = await personOf();
  assert.ok(Math.abs(await height3d() - 0.85) < 0.03, `half the height: ${await height3d()}`);
  await page.locator('#personHeightInput').fill('170');
  await page.locator('#personHeightInput').press('Enter');
  // Drag the left wrist of a lying body to a new place on the floor.
  await page.locator('#personPostureInput').selectOption('supine');
  person = await personOf();
  let ends = await page.evaluate(id => window.__editorTest.personEnds(id), person.id);
  const target = { x: ends[0].x + 30, y: ends[0].y - 25 };
  const handle = await planPoint(ends[0].x, ends[0].y), goal = await planPoint(target.x, target.y);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(goal.x, goal.y, { steps: 8 });
  await page.mouse.up();
  ends = await page.evaluate(id => window.__editorTest.personEnds(id), person.id);
  assert.ok(Math.hypot(ends[0].x - target.x, ends[0].y - target.y) < 2, `the wrist follows the drag: ${JSON.stringify(ends[0])} vs ${JSON.stringify(target)}`);
  // The elbow handle swings the upper arm; the knee handle the thigh.
  ends = await page.evaluate(id => window.__editorTest.personEnds(id), person.id);
  const elbow = ends[4], elbowTarget = { x: ends[4].x - 12, y: ends[4].y + 10 };
  const elbowFrom = await planPoint(elbow.x, elbow.y), elbowTo = await planPoint(elbowTarget.x, elbowTarget.y);
  await page.mouse.move(elbowFrom.x, elbowFrom.y);
  await page.mouse.down();
  await page.mouse.move(elbowTo.x, elbowTo.y, { steps: 8 });
  await page.mouse.up();
  const movedElbow = (await page.evaluate(id => window.__editorTest.personEnds(id), person.id))[4];
  assert.ok(Math.hypot(movedElbow.x - elbowTarget.x, movedElbow.y - elbowTarget.y) < Math.hypot(elbow.x - elbowTarget.x, elbow.y - elbowTarget.y) - 3, 'the elbow follows the drag');
  await page.keyboard.press('Control+z');
  const dragged = await personOf();
  assert.notDeepEqual(dragged.pose.arms[0], person.pose.arms[0]);
  await page.keyboard.press('Control+z');
  assert.deepEqual((await personOf()).pose, person.pose, 'undo puts the arm back');
  await page.keyboard.press('Control+y');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.deepEqual((await personOf()).pose, dragged.pose, 'the pose is kept after a reload');
  // The fallen person keeps its original shape until a hand is moved, then becomes posable.
  await importPlan({ floors: [{ id: 'q2', name: '', entities: [{ id: 'body', type: 'furniture', kind: 'fallenPerson', x: 200, y: 100, w: 100, h: 180, rotation: 0 }] }], activeFloor: 0, selectedId: 'body', roofs: [] });
  await page.locator('[data-tool="select"]').click();
  await pick(250, 190);
  ends = await page.evaluate(() => window.__editorTest.personEnds('body'));
  const wrist = await planPoint(ends[1].x, ends[1].y), away = await planPoint(ends[1].x + 40, ends[1].y);
  await page.mouse.move(wrist.x, wrist.y);
  await page.mouse.down();
  await page.mouse.move(away.x, away.y, { steps: 6 });
  await page.mouse.up();
  const body = (await saved()).floors[0].entities[0];
  assert.equal(body.pose?.posture, 'prone', 'moving a hand turns the original fallen body into a posable one');
  // Choosing the original design again brings the original shape back.
  await page.locator('.symbol-option[data-symbol="0"]').click();
  assert.equal((await saved()).floors[0].entities[0].pose, undefined);
  console.log('PASS: people: 170 cm standing, postures, presets, sliders for waist, wrist and limbs, height, dragging wrists and elbows, undo, reload and the original fallen body');

  // The pen draws with a color: drag for a line, a click for a dot, or "囲んで塗る" to fill the area drawn around.
  await importPlan({ floors: [{ id: 'w1', name: '', entities: [{ id: 'floor', type: 'room', name: '', x: 0, y: 0, w: 900, h: 600, color: '#ffffff' }] }], activeFloor: 0, selectedId: null, roofs: [] });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('[data-tool="paint"]').click();
  assert.equal(await page.locator('#penColorInputCode').inputValue(), '#9b1c17', 'the pen starts with the color of blood');
  await page.locator('[data-pen-color="#1c7ed6"]').click();
  await page.locator('#penWidthInput').fill('20');
  await page.locator('#penWidthInput').press('Enter');
  await dragAlong([[100, 100], [300, 300], [500, 100]]);
  const strokes = async () => (await saved()).floors[0].entities.filter(item => item.kind === 'paint');
  let stroke = (await strokes())[0];
  assert.equal(stroke.color, '#1c7ed6');
  assert.equal(stroke.brush, 20);
  assert.ok(stroke.path.length >= 3 && stroke.w > 400 && stroke.h > 200, `the stroke covers the drawn line: ${stroke.w} x ${stroke.h}`);
  const strokePixel = shown(await pixelAt(200, 200));
  assert.ok(strokePixel[2] > 150 && strokePixel[0] < 100, `the line is drawn in blue: ${strokePixel}`);
  const strokeMaterials = await page.evaluate(id => window.__editorTest.materials(id), stroke.id);
  assert.ok(strokeMaterials.some(m => m.name === 'paint-decal' && m.map && m.color === '1c7ed6'), `the same line is painted on the 3D floor: ${JSON.stringify(strokeMaterials)}`);
  // A click makes a dot; fill mode fills a loop.
  const dotAt = await planPoint(700, 500);
  await page.mouse.click(dotAt.x, dotAt.y);
  assert.equal((await strokes()).length, 2);
  assert.equal((await strokes())[1].path.length, 1, 'a click is a dot');
  await page.locator('[data-pen-mode="fill"]').click();
  await page.locator('[data-pen-color="#9b1c17"]').click();
  await dragAlong([[600, 150], [800, 150], [800, 350], [600, 350], [600, 160]]);
  const pool = (await strokes())[2];
  assert.equal(pool.filled, true);
  const poolPixel = shown(await pixelAt(700, 250));
  assert.ok(poolPixel[0] > 120 && poolPixel[1] < 60, `the inside of the loop is filled: ${poolPixel}`);
  // Select a stroke on its line (not in the empty part of its frame) and make it thicker.
  await page.locator('[data-tool="select"]').click();
  await pick(400, 150);
  assert.equal(await page.locator('#paintWidthInput').count(), 0, 'the empty part of the frame does not select the line');
  await pick(200, 200);
  assert.equal(await page.locator('#paintWidthInput').inputValue(), '20');
  await page.locator('#paintWidthInput').fill('60');
  await page.locator('#paintWidthInput').press('Enter');
  stroke = (await strokes())[0];
  assert.equal(stroke.brush, 60);
  assert.ok(stroke.w > 440, 'the frame grows with the line');
  await page.keyboard.press('Control+z');
  assert.equal((await strokes())[0].brush, 20, 'undo');
  // The eraser removes a stroke, and the pen settings are kept after a reload.
  await page.locator('[data-tool="erase"]').click();
  await pick(700, 500);
  assert.equal((await strokes()).length, 2);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  await page.locator('[data-tool="paint"]').click();
  assert.equal(await page.locator('#penColorInputCode').inputValue(), '#9b1c17');
  assert.equal(await page.locator('[data-pen-mode="fill"]').getAttribute('aria-checked'), 'true');
  await page.locator('[data-pen-mode="line"]').click();
  await page.locator('[data-tool="select"]').click();
  console.log('PASS: pen: color swatches, width, lines, dots, filled loops, 2D and 3D paint, selection on the line, undo, eraser and kept settings');

  // Images: the 2D plan (the current floor, or all floors in one image) and the 3D view are saved as PNG.
  await importPlan({ floors: [{ id: 's1', name: '', entities: [
    { id: 'hall', type: 'room', name: '', x: 0, y: 0, w: 600, h: 400, color: '#ffffff' },
    { id: 'east', type: 'wall', x1: 600, y1: 0, x2: 600, y2: 400 },
    { id: 'clue', type: 'furniture', kind: 'bloodPool', x: 200, y: 150, w: 120, h: 100, rotation: 0 },
  ] }, { id: 's2', name: '', entities: [{ id: 'up', type: 'room', name: '', x: 0, y: 0, w: 300, h: 200, color: '#ffffff' }] }], activeFloor: 0, selectedId: null, roofs: [] });
  await page.locator('button[data-view-mode="split"]').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const isRed = ([r, g, b]) => r > 120 && r > g + 60 && r > b + 60;
  const exportImage = async (button, floors) => {
    if (await page.locator('#imageExportMenu').isHidden()) await page.locator('#imageExportButton').click();
    await page.locator('#imageExportFloors').selectOption(floors);
    const download = page.waitForEvent('download');
    await page.locator(button).click();
    const file = await download;
    const path = `${output}/${file.suggestedFilename()}`;
    await file.saveAs(path);
    const data = (await readFile(path)).toString('base64');
    return { name: file.suggestedFilename(), ...(await page.evaluate(async data => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      // The image starts 60 cm before the plan; its scale comes from the 720 cm wide area.
      const scale = image.width / 720;
      const at = (x, y) => [...context.getImageData(Math.round((x + 60) * scale), Math.round((y + 60) * scale), 1, 1).data].slice(0, 3);
      return { width: image.width, height: image.height, scale, blood: at(260, 200), wall: at(600, 195), corner: at(-50, -50) };
    }, data)) };
  };
  const image = await exportImage('#imageExportPlan', 'current');
  assert.match(image.name, /^madori-\d{4}-\d{2}-\d{2}-1F\.png$/);
  assert.ok(Math.abs(image.height - 520 * image.scale) <= 1, `the image keeps the plan's proportions: ${image.width}x${image.height}`);
  // Line widths and text keep the same proportions as the whole plan shown on a 1600 x 1000 screen, at twice the resolution.
  assert.ok(Math.abs(image.scale - 2 * Math.min(1600 / 720, 1000 / 520)) < 0.01, `scale ${image.scale}`);
  assert.ok(isRed(image.blood), `the plan contents are in the image: ${image.blood}`);
  assert.ok(image.wall.every(value => value < 80), `walls are drawn: ${image.wall}`);
  assert.ok(image.corner.every(value => value > 230), `the background is white: ${image.corner}`);
  const all = await exportImage('#imageExportPlan', 'all');
  assert.match(all.name, /-all\.png$/);
  // Two floors side by side (or stacked) change the proportions of the image a lot.
  assert.ok(Math.abs(Math.log((all.width / all.height) / (image.width / image.height))) > Math.log(1.4), `all floors are laid out in one image: ${all.width}x${all.height}`);
  await page.locator('#imageExportButton').click();
  const threeDownload = page.waitForEvent('download');
  await page.locator('#imageExport3d').click();
  assert.match((await threeDownload).suggestedFilename(), /-3d\.png$/);
  console.log('PASS: image export: the current floor and all floors as PNG with the plan contents, and the 3D view');

  // 2D styles: dots or brush on washi change how the whole plan is drawn (and the exported image), never the plan itself.
  const planBeforeStyle = JSON.stringify((await saved()).floors);
  const chooseStyle = async style => {
    await page.locator('#planStyleButton').click();
    await page.locator(`[data-plan-style="${style}"]`).click();
    await page.locator('#planStyleButton').click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const canvasPixels = async (x, y, size) => {
    const screen = await planPoint(x, y);
    return page.locator('#planCanvas').evaluate((canvas, [px, py, size]) => {
      const rect = canvas.getBoundingClientRect(), ratio = canvas.width / rect.width;
      const left = Math.round((px - rect.left) * ratio), top = Math.round((py - rect.top) * ratio);
      return { left, top, ratio, data: [...canvas.getContext('2d').getImageData(left, top, size, size).data] };
    }, [screen.x, screen.y, size]);
  };
  // Every dot is one square of a single color, lined up with the canvas.
  const dotted = ({ left, top, data }, size, dot) => {
    let colors = new Set(), uniform = true;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4, color = data.slice(i, i + 3).join();
        colors.add(color);
        const ox = x - ((left + x) % dot), oy = y - ((top + y) % dot);
        if (ox < 0 || oy < 0) continue;
        const j = (oy * size + ox) * 4;
        if (data.slice(j, j + 3).join() !== color) uniform = false;
      }
    }
    return { uniform, colors: colors.size };
  };
  assert.equal(await page.locator('#planStyleLabel').textContent(), '絵柄');
  await chooseStyle('pixel');
  assert.equal(await page.locator('#planStyleLabel').textContent(), 'ドット');
  assert.equal(await page.locator('[data-plan-style="pixel"]').getAttribute('aria-checked'), 'true');
  const dotArea = await canvasPixels(230, 160, 60);
  const dots = dotted(dotArea, 60, 3 * dotArea.ratio);
  assert.ok(dots.uniform && dots.colors >= 2, `the blood pool is drawn in square dots: ${JSON.stringify(dots)}`);
  // Smaller dots, and the exported image is made of dots too (each dot is 3 px on the screen, twice that in the image).
  await page.locator('#planStyleButton').click();
  await page.locator('#pixelDotSelect').selectOption('5');
  await page.locator('#planStyleButton').click();
  const bigDots = dotted(await canvasPixels(230, 160, 60), 60, 5 * dotArea.ratio);
  assert.ok(bigDots.uniform, 'coarse dots are 5 px');
  await page.locator('#planStyleButton').click();
  await page.locator('#pixelDotSelect').selectOption('3');
  await page.locator('#planStyleButton').click();
  const pixelImage = await exportImage('#imageExportPlan', 'current');
  assert.ok(isRed(pixelImage.blood) && pixelImage.wall.every(value => value < 80), `the dot image keeps the plan: ${pixelImage.blood} ${pixelImage.wall}`);
  await chooseStyle('brush');
  assert.equal(await page.locator('#planStyleLabel').textContent(), '筆・和風');
  assert.equal(await page.locator('#pixelDotRow').isHidden(), true, 'the dot size is only for dots');
  const paper = shown(await pixelAt(450, 330));
  assert.ok(paper[0] > 200 && paper[0] > paper[2] + 8, `a white room is washi paper: ${paper}`);
  // Walls are brush strokes in ink (the dry end of a stroke may leave a few gaps).
  const inked = [];
  for (const y of [80, 160, 240, 320]) inked.push(shown(await pixelAt(600, y)).every(value => value < 110));
  assert.ok(inked.filter(Boolean).length >= 2, `walls are drawn in ink: ${inked}`);
  const brushImage = await exportImage('#imageExportPlan', 'current');
  assert.ok(brushImage.corner[0] > 200 && brushImage.corner[0] > brushImage.corner[2] + 8, `the image is on washi paper too: ${brushImage.corner}`);
  assert.ok(isRed(brushImage.blood), `the blood pool keeps its color in the brush style: ${brushImage.blood}`);
  // The plan is edited the same way: dragging the blood pool moves it.
  const bloodBefore = (await saved()).floors[0].entities.find(entity => entity.id === 'clue');
  await move(await planPoint(260, 200), 60, 0);
  const bloodAfter = (await saved()).floors[0].entities.find(entity => entity.id === 'clue');
  assert.ok(bloodAfter.x > bloodBefore.x + 20, `selecting and dragging still work: ${bloodBefore.x} -> ${bloodAfter.x}`);
  await page.keyboard.press('Control+z');
  assert.equal(JSON.stringify((await saved()).floors), planBeforeStyle, 'choosing a style never changes the plan');
  // The style is kept after a reload, like the other display settings.
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.equal(await page.locator('#planStyleLabel').textContent(), '筆・和風');
  // The menu shows every style as a small sample drawn in that style.
  await page.locator('#planStyleButton').click();
  const samples = await page.locator('.style-thumb').evaluateAll(canvases => canvases.map(canvas => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set();
    let hash = 0;
    for (let i = 0; i < data.length; i += 16) {
      colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
      hash = (Math.imul(hash, 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) >>> 0;
    }
    return { colors: colors.size, hash };
  }));
  await page.locator('#planStyleButton').click();
  assert.equal(samples.length, 17);
  assert.equal(await page.locator('#planStyleChoices .style-group').count(), 5, 'the styles are shown in five groups');
  // （レトロゲームは4色だけで描く）
  assert.ok(samples.every(sample => sample.colors >= 4), `every sample is drawn: ${samples.map(sample => sample.colors)}`);
  assert.equal(new Set(samples.map(sample => sample.hash)).size, 17, 'each style has its own sample');
  // The other styles each have their own paper or board, and the walls stand out from it.
  const lightness = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  const looks = {
    pencil: { label: '鉛筆', ground: c => lightness(c) > 225 },
    manga: { label: 'マンガ', ground: c => lightness(c) > 235 },
    blueprint: { label: '設計図', ground: c => c[2] > c[0] + 50 },
    parchment: { label: '古地図', ground: c => c[0] > 180 && c[0] > c[2] + 25 },
    chalk: { label: '黒板', ground: c => lightness(c) < 120 && c[1] > c[0] },
    neon: { label: 'ネオン', ground: c => lightness(c) < 60 },
    watercolor: { label: '水彩', ground: c => lightness(c) > 225 },
    sumie: { label: '墨絵', ground: c => lightness(c) > 215 && Math.max(...c) - Math.min(...c) < 30 },
    crayon: { label: 'クレヨン', ground: c => lightness(c) > 225 },
    pop: { label: 'ポップ', ground: c => lightness(c) > 235 },
    cad: { label: 'CAD', ground: c => lightness(c) < 40 },
    horror: { label: 'ホラー', ground: c => lightness(c) < 90 },
    copy: { label: 'コピー', ground: c => lightness(c) > 225 && Math.max(...c) - Math.min(...c) < 12 },
    retro: { label: 'レトロゲーム', ground: c => c[1] > c[0] + 10 && c[1] > c[2] + 60 },
  };
  for (const [style, look] of Object.entries(looks)) {
    await chooseStyle(style);
    assert.equal(await page.locator('#planStyleLabel').textContent(), look.label);
    const ground = shown(await pixelAt(452, 333));
    assert.ok(look.ground(ground), `${style}: a white room takes the look of the style: ${ground}`);
    const walls = [];
    for (const y of [80, 160, 240, 320]) walls.push(Math.abs(lightness(shown(await pixelAt(600, y))) - lightness(ground)) > 60);
    assert.ok(walls.filter(Boolean).length >= 2, `${style}: the walls stand out: ${walls}`);
    if (style === 'retro') assert.equal(await page.locator('#pixelDotRow').getAttribute('hidden'), null, 'the retro game has a dot size too');
    if (style === 'blueprint' || style === 'neon' || style === 'retro') {
      const styledImage = await exportImage('#imageExportPlan', 'current');
      assert.ok(look.ground(styledImage.corner), `${style}: the image has the same background: ${styledImage.corner}`);
      assert.ok(Math.abs(lightness(styledImage.wall) - lightness(styledImage.corner)) > 60, `${style}: the image keeps the walls: ${styledImage.wall}`);
    }
  }
  assert.equal(JSON.stringify((await saved()).floors), planBeforeStyle, 'no style changes the plan');
  await chooseStyle('standard');
  assert.equal(await page.locator('#planStyleLabel').textContent(), '絵柄');
  const white = shown(await pixelAt(450, 330));
  assert.ok(white.every(value => value > 240), `back to the plain drawing: ${white}`);
  console.log('PASS: 2D styles: 17 styles in five groups with samples, dots, brush on washi and every other style, exported images, editing, undo and kept after a reload');

  // The top bar never squeezes its buttons: the notice hides and the buttons turn into icons when the window is narrower.
  const squeezed = () => page.evaluate(() => {
    const problems = [];
    for (const button of document.querySelectorAll('.top-actions button, .top-actions a')) {
      const box = button.getBoundingClientRect();
      if (!box.width) continue;
      for (const part of button.querySelectorAll('span, svg')) {
        const r = part.getBoundingClientRect();
        if (r.width > 1 && getComputedStyle(part).position !== 'absolute' && (r.right > box.right + 1 || r.left < box.left - 1)) problems.push(button.id || button.textContent.trim());
      }
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) problems.push(`page ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    return problems;
  });
  for (const width of [1360, 1280, 1100, 1024, 900, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    assert.deepEqual(await squeezed(), [], `the top bar fits at ${width} px`);
    assert.equal(await page.locator('#topNote').isVisible(), width >= 1340, `the notice shows only where it fits (${width} px)`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('PASS: top bar: buttons never squeezed from 390 to 1360 px, the notice hides where it does not fit');

  // The plan-only edition at /plan/ shows the same plan without the 3D pane or 3D-only settings, and the full app announces it.
  assert.equal(await page.locator('#editionNote').isVisible(), true, 'the full app announces the plan-only edition in the top bar');
  assert.equal(await page.locator('#alphaNote').isVisible(), false, 'in place of the alpha note');
  assert.match(await page.locator('#editionNote a').getAttribute('href'), /\/plan\/$/);
  const fullModeBefore = await page.evaluate(() => document.querySelector('.workspace').dataset.viewMode);
  const planBefore = await saved();
  await page.goto(new URL('plan/', server.resolvedUrls.local[0]).href);
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.equal(await page.evaluate(() => document.documentElement.dataset.edition), 'plan');
  assert.equal(await page.title(), '間取りクイック 間取り専用版');
  for (const selector of ['.three-pane', '.view-switch', '#roofCategory', '#imageExport3d', '#editionNote']) {
    assert.equal(await page.locator(selector).isVisible(), false, `${selector} is not in the plan-only edition`);
  }
  assert.equal(await page.locator('#fullEditionLink').isVisible(), true, 'a link back to the full app');
  // The feedback form opens with the edition, app version and browser filled in (and nothing from the plan).
  const formLink = await page.locator('#feedbackFormLink').getAttribute('href');
  assert.ok(formLink.startsWith('https://docs.google.com/forms/d/e/1FAIpQLSd2tDbVHoz1r5CUKdsK221_-KkIjx0U6NSRZFmiZZqPWk7jEg/viewform?usp=pp_url&entry.144245894='), formLink);
  const filledIn = decodeURIComponent(new URL(formLink).searchParams.get('entry.144245894'));
  assert.match(filledIn, /^間取り専用版 \/ 版 [0-9a-f]{7} \/ (Edge|Chrome) \d+ \/ Windows \/ 画面 \d+×\d+ \/ 127\.0\.0\.1:\d+$/, filledIn);
  assert.equal(await page.locator('#feedbackFormLink').getAttribute('target'), '_blank');
  // The changelog lists the updates newest first, with the latest date next to its heading.
  assert.match(await page.locator('#changelogLatest').textContent(), /^最新 \d{1,2}月\d{1,2}日$/);
  const days = await page.locator('#changelogList .changelog-day time').evaluateAll(times => times.map(time => time.getAttribute('datetime')));
  assert.ok(days.length > 10 && days.every((day, i) => !i || days[i - 1] > day), `newest first: ${days.slice(0, 3)}`);
  assert.equal(days[days.length - 1], '2026-06-27', 'back to the first version');
  // The credit is copied in one click, from the image menu or the about section, always with the production URL.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  if (await page.locator('#imageExportMenu').isHidden()) await page.locator('#imageExportButton').click();
  await page.locator('#imageExportMenu [data-copy-credit="ja"]').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '間取りクイック3D https://madori-5yu.pages.dev/');
  assert.equal(await page.locator('#imageExportMenu [data-copy-credit="ja"]').textContent(), 'コピーしました');
  await page.locator('.topbar h1').click({ position: { x: 10, y: 8 } });
  await page.locator('.credit-box [data-copy-credit="en"]').evaluate(button => button.click());
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'Madori Quick 3D https://madori-5yu.pages.dev/');
  // The form with images gets the same environment.
  const imageFormLink = await page.locator('#feedbackImageFormLink').getAttribute('href');
  assert.ok(imageFormLink.startsWith('https://docs.google.com/forms/d/e/1FAIpQLSfd6lucVdNQ5GqqXep8xos68t2Ri9CatBdMrap5dHaSH-EdeQ/viewform?usp=pp_url&entry.144245894='), imageFormLink);
  assert.equal(decodeURIComponent(new URL(imageFormLink).searchParams.get('entry.144245894')), filledIn);
  assert.deepEqual((await saved()).floors, planBefore.floors, 'the same plan opens in both editions');
  await page.locator('[data-tool="select"]').click();
  const clue = await planPoint(260, 200);
  await page.mouse.click(clue.x, clue.y);
  assert.equal(await page.locator('#furnitureColorInputCode').count(), 1);
  assert.equal(await page.locator('#furnitureColor3dInput').count(), 0, 'no 3D color');
  await page.locator('#furnitureColorInputCode').fill('#4a2a8a');
  await page.locator('#furnitureColorInputCode').press('Enter');
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.equal((await saved()).floors[0].entities.find(item => item.id === 'clue').color, '#4a2a8a', 'edits in the plan-only edition show up in the full app');
  assert.equal(await page.evaluate(() => document.querySelector('.workspace').dataset.viewMode), fullModeBefore, 'the plan-only edition keeps the view mode of the full app');
  // The notice does not take any height: the 2D pane starts right below the top bar.
  assert.ok(Math.abs((await page.locator('.workspace').boundingBox()).y - (await page.locator('.topbar').boundingBox()).height) < 2);
  await page.locator('#topNoteClose').click();
  assert.equal(await page.locator('#editionNote').isVisible(), false);
  assert.equal(await page.locator('#alphaNote').isVisible(), true, 'the alpha note comes back after the notice is closed');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.equal(await page.locator('#editionNote').isVisible(), false, 'a closed notice stays closed');
  await page.locator('#topNoteClose').click();
  assert.equal(await page.locator('#topNote').isVisible(), false, 'the alpha note can be closed too');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__editorTest));
  assert.equal(await page.locator('#topNote').isVisible(), false, 'closed texts stay closed');
  console.log('PASS: plan-only edition: no 3D pane or 3D settings, same plan both ways, keeps the full view mode, and the notice with its link');

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
  const variants = await page.evaluate(() => window.__editorTest.variants);
  for (const [kind, defaults] of Object.entries(catalog)) {
    // Pen strokes are drawn with the pen tool, not chosen as a kind of furniture.
    if (kind === 'paint') continue;
    await page.locator('#furnitureKindInput').selectOption(kind);
    const designs = variants[kind]?.length ?? 0;
    assert.equal(await page.locator('.symbol-option').count(), designs ? designs + 1 : 0, `${kind}: design picker`);
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
  // End on a piece with volume (the catalog now ends with flat marks on the floor) for the 3D check below.
  await page.locator('#furnitureKindInput').selectOption('catTower');
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

  // Templates: 50 in six groups. The newer ones are whole buildings with walls, doors, furniture, floors and roofs.
  page = await open();
  page.on('dialog', dialog => dialog.accept());
  assert.equal(await page.locator('#templateList .template-group').count(), 6);
  assert.equal(await page.locator('[data-template]').count(), 50);
  await choose('[data-template="westernMansion"]');
  let built = await saved();
  assert.deepEqual(built.floors.map(floor => floor.name), ['B1F', '1F', '2F'], 'the mansion has a cellar and two floors');
  assert.equal(built.activeFloor, 1, 'it opens on the ground floor');
  assert.ok(built.roofs.length >= 1);
  assert.equal(await page.locator('#floorTabs .floor-tab.is-active').first().textContent().then(text => text.trim()), '1F');
  for (const [template, names] of [['castle', ['玉座の間', '大広間', '城門']], ['hospital', ['診察室1', 'ナース室', '手術室']], ['dungeon', ['牢屋', '大広間', '宝物庫']], ['cafe', ['客席', '厨房']]]) {
    await choose(`[data-template="${template}"]`);
    built = await saved();
    const entities = built.floors.flatMap(floor => floor.entities);
    for (const name of names) assert.ok(entities.some(entity => entity.type === 'room' && entity.name === name), `${template} has ${name}`);
    assert.ok(entities.filter(entity => entity.type === 'wall').length >= 8 && entities.some(entity => entity.type === 'door'), `${template} has walls and doors`);
    assert.ok(entities.filter(entity => entity.type === 'furniture').length >= 10, `${template} is furnished`);
  }
  await page.locator('button[data-view-mode="three"]').click();
  assert.ok((await pixels()).colors > 20, 'the template shows in 3D');
  await page.locator('#undoButton').click();
  assert.ok((await saved()).floors.flatMap(floor => floor.entities).some(entity => entity.name === '宝物庫'), 'loading a template can be undone');
  await page.context().close();
  console.log('PASS: templates: 50 in six groups, mansion with a cellar, castle, hospital, dungeon and cafe in 2D and 3D, and undo');

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
  // Closing the notice hides it only while this visit lasts; it comes back on the next visit.
  await page.locator('#mobileNoticeClose').click();
  assert.equal(await page.locator('#mobileNotice').isVisible(), false);
  await page.reload();
  assert.equal(await page.locator('#mobileNotice').isVisible(), false);
  await page.context().close();
  // A phone showing the desktop site (desktop user agent) is still recognized by its touch-first screen,
  // and an old permanent "dismissed" record no longer hides the notice.
  page = await open(JSON.stringify(plan()), { viewport: { width: 412, height: 915 }, screen: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
  await page.evaluate(() => localStorage.setItem('madori-quick-3d-mobile-notice', 'dismissed'));
  await page.reload();
  assert.equal(await page.locator('#mobileNotice').isVisible(), true);
  await page.context().close();
  assert.deepEqual(errors, []);
  console.log('PASS: mobile canvas, layout and no browser errors');
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
