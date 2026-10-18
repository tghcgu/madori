import assert from 'node:assert/strict';

// 自由な形: 池などは2Dをドラッグで囲むと、その形になる（クリックならいつもの形）。川などは、なぞった道すじに沿う。
// 幅を変えられ、なぞり直せ、いつもの形に戻せる。形の上だけで選べ、3Dにも同じ形が出て、再読み込みでも残る
export async function verifyFreeShapes({ open, plan, output }) {
  const floor = { id: 'ground', type: 'room', name: '', x: 0, y: 0, w: 1200, h: 800, color: '#83ab57', surface: 'grass' };
  const page = await open(JSON.stringify(plan([floor])));
  try {
    const point = (x, y) => page.evaluate(([x, y]) => window.__editorTest.planPoint(x, y), [x, y]);
    const items = async () => (await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.filter(item => item.type === 'furniture');
    const ids = () => page.evaluate(() => window.__editorTest.selection());
    const choose = async (kind) => {
      const button = page.locator(`[data-furniture="${kind}"]`).first();
      const details = button.locator('xpath=ancestor::details');
      if (await details.count() && await details.getAttribute('open') === null) await details.locator('summary').click();
      await button.click();
    };
    // 2Dの上を、点を順にたどってドラッグする
    const trace = async (points) => {
      const first = await point(...points[0]);
      await page.mouse.move(first.x, first.y);
      await page.mouse.down();
      for (const [x, y] of points.slice(1)) {
        const at = await point(x, y);
        await page.mouse.move(at.x, at.y, { steps: 6 });
      }
      await page.mouse.up();
      await page.waitForTimeout(150);
    };
    await page.locator('button[data-view-mode="split"]').first().click();
    await page.waitForTimeout(300);

    // 池: 囲んだ形になる
    await choose('pond');
    assert.match(await page.locator('#toolHint').textContent(), /囲んで形を作る/);
    await trace([[100, 100], [300, 80], [380, 200], [300, 320], [140, 300], [90, 200], [100, 110]]);
    let pond = (await items()).find(item => item.kind === 'pond');
    assert.ok(pond?.path?.length >= 3, 'the pond keeps the traced outline');
    assert.ok(pond.w > 260 && pond.h > 220, `the frame fits the traced shape: ${pond.w} x ${pond.h}`);
    assert.deepEqual(await ids(), [pond.id]);
    const waterNames = async (id) => (await page.evaluate(id => window.__editorTest.materials(id), id)).map(item => item.name);
    assert.ok((await waterNames(pond.id)).includes('water'), 'the 3D pond has water');
    // クリックだけなら、いつもの池
    const tap = await point(700, 650);
    await page.mouse.click(tap.x, tap.y);
    const usual = (await items()).filter(item => item.kind === 'pond').find(item => item.id !== pond.id);
    assert.ok(usual && !usual.path, 'a click places the usual pond');
    await page.keyboard.press('Control+z');

    // 川: なぞった道すじに沿う。幅を変えると範囲も合わせ直す
    await choose('river');
    await trace([[450, 80], [600, 200], [520, 380], [700, 560], [900, 600]]);
    let river = (await items()).find(item => item.kind === 'river');
    assert.ok(river?.path?.length >= 2);
    await page.locator('#freeWidthInput').fill('220');
    await page.locator('#freeWidthInput').press('Tab');
    const wider = (await items()).find(item => item.id === river.id);
    assert.equal(wider.brush, 220);
    assert.ok(wider.w > river.w && wider.h > river.h, 'the frame grows with the width');
    river = wider;
    await page.screenshot({ path: `${output}/free-shapes.png` });

    // 形の上だけで選べる: 川の範囲の四角の中でも、川から離れた所は地面
    await page.keyboard.press('Escape');
    await page.locator('[data-tool="select"]').first().click();
    let at = await point(880, 120);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), ['ground'], 'empty parts of the frame are not the river');
    at = await point(600, 200);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), [river.id], 'the river itself is selected');

    // なぞり直す: 同じ川の道すじが変わる
    await page.locator('#freeRedrawButton').click();
    await trace([[450, 700], [700, 650], [1000, 700]]);
    const redrawn = (await items()).find(item => item.id === river.id);
    assert.notDeepEqual(redrawn.path, river.path, 'the river follows the new path');
    assert.equal((await items()).filter(item => item.kind === 'river').length, 1);

    // いつもの形に戻す（池）
    await page.keyboard.press('Escape');
    at = await point(240, 200);
    await page.mouse.click(at.x, at.y);
    assert.deepEqual(await ids(), [pond.id]);
    await page.locator('#freeResetButton').click();
    pond = (await items()).find(item => item.id === pond.id);
    assert.equal(pond.path, undefined);
    await page.keyboard.press('Control+z');
    pond = (await items()).find(item => item.id === pond.id);
    assert.ok(pond.path?.length >= 3, 'undo brings the traced shape back');

    // 3Dにも同じ広がりで出る
    const bounds = await page.evaluate(id => window.__editorTest.bounds(id), river.id);
    assert.ok(bounds && bounds.max[0] - bounds.min[0] > 4, 'the 3D river spans the traced path');

    // 再読み込みしても、道すじと幅が残る
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    const kept = (await items()).find(item => item.id === river.id);
    assert.deepEqual([kept.path, kept.brush], [redrawn.path, 220]);
    console.log('PASS: free shapes: trace ponds and rivers in 2D, click for the usual shape, width, redraw, reset, select by shape, 3D and reload');
  } finally {
    await page.context().close();
  }
}
