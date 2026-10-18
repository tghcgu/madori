import assert from 'node:assert/strict';

// 2Dで家具や壁をドラッグしている間も、3Dがすぐ追いつく（離す前から3Dが動く）。
// 3Dの左ドラッグは、押した所を中心に回る（押した物が画面の同じ所にとどまる）
export async function verifyLiveThree({ open, plan, output }) {
  const floor = { id: 'floor', type: 'room', name: '', x: 0, y: 0, w: 800, h: 500, color: '#c9ae7c', surface: 'wood' };
  const table = { id: 'table', type: 'furniture', kind: 'table', x: 520, y: 300, w: 160, h: 85, rotation: 0 };
  const wall = { id: 'wall', type: 'wall', x1: 0, y1: 0, x2: 400, y2: 0 };
  const page = await open(JSON.stringify(plan([floor, wall, table])));
  try {
    const bounds = id => page.evaluate(id => window.__editorTest.bounds(id), id);
    const point = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
    const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.waitForTimeout(300);
    const zoom = await page.evaluate(() => window.__editorTest.planZoom());

    // 2Dで家具をドラッグしている途中で、3Dの家具も同じだけ動いている
    const before = await bounds('table');
    let at = await point(table.x + table.w / 2, table.y + table.h / 2);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x - 60, at.y - 40, { steps: 6 });
    await page.mouse.move(at.x - 100 * zoom, at.y - 60 * zoom, { steps: 6 });
    await frame();
    const during = await bounds('table');
    assert.ok(Math.abs((during.min[0] - before.min[0]) - (-1.0)) < 0.25, `3D follows while dragging (x): ${during.min[0] - before.min[0]}`);
    assert.ok(Math.abs((during.min[2] - before.min[2]) - (-0.6)) < 0.25, `3D follows while dragging (z): ${during.min[2] - before.min[2]}`);
    await page.mouse.up();
    await frame();
    const moved = (await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.find(item => item.id === 'table');
    const after = await bounds('table');
    assert.ok(Math.abs(after.min[0] - during.min[0]) < 0.05 && Math.abs(after.min[2] - during.min[2]) < 0.05, 'releasing keeps the same place in 3D');

    // 大きさを変えている途中も、3Dの家具の大きさが変わる
    const corner = await point(moved.x + moved.w, moved.y + moved.h);
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(corner.x + 40 * zoom, corner.y, { steps: 6 });
    await frame();
    const resizing = await bounds('table');
    assert.ok((resizing.max[0] - resizing.min[0]) - (after.max[0] - after.min[0]) > 0.25, 'the 3D table grows while resizing');
    await page.mouse.up();

    // 壁の端をドラッグしている途中も、3Dの壁が伸びる（3D全体を作り直す物）
    await page.keyboard.press('Escape');
    const wallBefore = await bounds('wall');
    at = await point(200, 0);
    await page.mouse.click(at.x, at.y);
    const end = await point(400, 0);
    await page.mouse.move(end.x, end.y);
    await page.mouse.down();
    await page.mouse.move(end.x + 100 * zoom, end.y, { steps: 8 });
    await frame();
    await frame();
    const wallDuring = await bounds('wall');
    assert.ok((wallDuring.max[0] - wallDuring.min[0]) - (wallBefore.max[0] - wallBefore.min[0]) > 0.6, 'the 3D wall stretches while dragging its end');
    await page.mouse.up();
    await page.keyboard.press('Escape');

    // 3Dの左ドラッグ: 押した家具の点が、回したあとも画面の同じ所にある（画面の中央のまわりには回らない）
    await page.locator('button[data-view-mode="three"]').first().click();
    await page.waitForTimeout(400);
    const current = (await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.find(item => item.id === 'table');
    const start = await page.evaluate(([x, y]) => window.__editorTest.project(x, y, 0.6), [current.x + current.w / 2, current.y + current.h / 2]);
    const world = await page.evaluate(([x, y]) => window.__editorTest.pickPoint(x, y), [start.x, start.y]);
    assert.ok(world, 'something is under the mouse');
    const project = () => page.evaluate(p => window.__editorTest.projectWorld(p), world);
    const pose = await page.evaluate(() => window.__editorTest.cameraPose());
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 90, start.y + 30, { steps: 10 });
    await page.mouse.up();
    await frame();
    const turned = await page.evaluate(() => window.__editorTest.cameraPose());
    assert.notDeepEqual(turned.position, pose.position, 'the camera turned');
    const stay = await project();
    assert.ok(Math.hypot(stay.x - start.x, stay.y - start.y) < 4, `the pressed point stays under the mouse: ${JSON.stringify([start, stay])}`);
    assert.deepEqual((await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.find(item => item.id === 'table'), current, 'turning does not move the furniture');
    // 上下の向きに制限はない: 下へ回し続けると、注視点より下から見上げる向きまで回れる
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y - 500, { steps: 12 });
    await page.mouse.up();
    await frame();
    const low = await page.evaluate(() => window.__editorTest.cameraPose());
    const offset = low.position.map((value, i) => value - low.target[i]);
    assert.ok(offset[1] < 0, `the camera can look up from below: ${offset}`);
    await page.screenshot({ path: `${output}/orbit-around-point.png` });
    console.log('PASS: 3D follows 2D drags of furniture, sizes and walls before release, and 3D left-drag turns around the pressed point');
  } finally {
    await page.context().close();
  }
}
