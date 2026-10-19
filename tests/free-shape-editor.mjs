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
    // なぞれる物は、一覧で波線の印が付き、「なぞって形を決める」欄にまとまっている
    for (const selector of ['[data-furniture="pond"]', '[data-furniture="river"]', '[data-furniture="footprints"]', '[data-surface="grass"]']) {
      assert.ok(await page.locator(`${selector}.is-traceable`).count() >= 1, `${selector} is marked as traceable`);
    }
    assert.equal(await page.locator('[data-furniture="sofa"].is-traceable').count(), 0, 'other furniture is not marked');
    const traceGroup = page.locator('details.palette-group', { has: page.locator('summary', { hasText: 'なぞって形を決める' }) });
    assert.equal(await traceGroup.locator('[data-pen-shortcut].is-traceable').count(), 1, 'the pen is in the trace group');
    assert.ok(await traceGroup.locator('[data-furniture]').count() >= 14, 'all traceable items are gathered in one group');

    // 床・地面の素材: ぐるっとなぞると、その形の床。斜めのドラッグは、いつもどおりの四角
    const rooms = async () => (await page.evaluate(() => window.__editorTest.snapshot())).floors[0].entities.filter(item => item.type === 'room');
    const surfaces = page.locator('details.palette-group', { has: page.locator('summary', { hasText: '床・地面' }) });
    if (await surfaces.getAttribute('open') === null) await surfaces.locator('summary').click();
    await page.locator('[data-surface="gravel"]').click();
    assert.match(await page.locator('#toolHint').textContent(), /ぐるっとなぞるとその形の床/);
    await trace([[150, 450], [350, 420], [420, 560], [330, 720], [160, 700], [110, 560], [160, 455]]);
    const traced = (await rooms()).find(room => room.surface === 'gravel');
    assert.ok(traced?.outline?.length >= 6, `the traced floor keeps its outline: ${traced?.outline?.length}`);
    assert.ok(traced.w > 260 && traced.w < 340 && traced.h > 260 && traced.h < 330, `the floor fits the traced loop: ${traced.w} x ${traced.h}`);
    assert.deepEqual(await ids(), [traced.id], 'the new floor is selected');
    await page.locator('[data-surface="sand"]').click();
    await trace([[700, 100], [1000, 300]]);
    const box = (await rooms()).find(room => room.surface === 'sand');
    assert.ok(box && !box.outline && box.w === 300 && box.h === 200, 'a diagonal drag still draws a rectangle');
    // 選んだ床の形を、なぞって描き直す（床材・IDはそのまま）。Escでやめられる
    await page.locator('[data-tool="select"]').first().click();
    const boxAt = await point(850, 200);
    await page.mouse.click(boxAt.x, boxAt.y);
    assert.deepEqual(await ids(), [box.id]);
    await page.locator('#floorRetraceButton').click();
    assert.match(await page.locator('#toolHint').textContent(), /床の形を描き直す/);
    await page.keyboard.press('Escape');
    assert.equal((await rooms()).find(room => room.id === box.id).outline, undefined, 'Escape leaves the floor as it was');
    await page.mouse.click(boxAt.x, boxAt.y);
    await page.locator('#floorRetraceButton').click();
    await trace([[720, 120], [960, 90], [1040, 260], [900, 380], [740, 330], [700, 200], [722, 125]]);
    const retraced = (await rooms()).find(room => room.id === box.id);
    assert.ok(retraced.outline?.length >= 5, 'the floor takes the traced shape');
    assert.equal(retraced.surface, 'sand', 'the floor keeps its material');
    assert.equal((await rooms()).filter(room => room.surface === 'sand').length, 1, 'no new floor is added');
    assert.deepEqual(await ids(), [box.id], 'the retraced floor stays selected');
    await page.keyboard.press('Control+z');
    assert.equal((await rooms()).find(room => room.id === box.id).outline, undefined, 'undo brings the rectangle back');

    // ペンでも川・池などを描ける（描く物を選ぶ）。川の幅は一覧から置くときと同じ「最後に使った幅」で、描いたあともペンのまま
    await page.locator('.tool-button[data-tool="paint"]').click();
    await page.locator('[data-pen-kind="river"]').click();
    assert.match(await page.locator('#toolHint').textContent(), /ドラッグで川を描く/);
    await page.locator('#penShapeWidthInput').fill('260');
    await page.locator('#penShapeWidthInput').press('Enter');
    const rivers = async () => (await items()).filter(item => item.kind === 'river');
    const riverCount = (await rivers()).length;
    await trace([[150, 760], [500, 700], [900, 760]]);
    assert.equal((await rivers()).length, riverCount + 1, 'the pen draws a river');
    const penRiver = (await rivers()).at(-1);
    assert.equal(penRiver.brush, 260, 'the pen river has the chosen width');
    assert.ok(penRiver.path?.length >= 2, 'the pen river follows the traced path');
    assert.deepEqual(await ids(), [], 'the new river is not selected, so the pen keeps drawing');
    assert.equal(await page.locator('[data-pen-kind="river"]').getAttribute('aria-checked'), 'true');
    await page.locator('[data-pen-kind="pond"]').click();
    assert.equal(await page.locator('#penShapeWidthInput').count(), 0, 'ponds have no width setting');
    await trace([[900, 150], [1100, 140], [1120, 300], [920, 320], [900, 160]]);
    const penPond = (await items()).filter(item => item.kind === 'pond').at(-1);
    assert.ok(penPond.path?.length >= 3 && penPond.w > 160, 'the pen pond takes the traced shape');
    // 次に開いたときも、ペンで描く物を覚えている
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    await page.locator('.tool-button[data-tool="paint"]').click();
    assert.equal(await page.locator('[data-pen-kind="pond"]').getAttribute('aria-checked'), 'true', 'the pen remembers what it draws');
    await page.locator('[data-pen-kind="paint"]').click();
    console.log('PASS: free shapes: trace ponds and rivers in 2D, click for the usual shape, width, redraw, reset, select by shape, 3D and reload; traceable items are marked and gathered; floors and grounds take a traced shape; the pen draws rivers and ponds');
  } finally {
    await page.context().close();
  }
}
