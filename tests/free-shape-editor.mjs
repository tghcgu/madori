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
    // 池・花壇・芝生・ラグは、ペンで塗る（はじめから）。輪のように塗ると真ん中があき、重ねて塗るとつながり、けずると小さくなる
    await page.locator('[data-pen-kind="pond"]').click();
    assert.equal(await page.locator('#penShapeWidthInput').count(), 0, 'ponds have no line width setting');
    assert.equal(await page.locator('[data-draw-method="brush"]').getAttribute('aria-checked'), 'true', 'the pen paints ponds');
    assert.match(await page.locator('#toolHint').textContent(), /塗った所が池になる/);
    await page.locator('#brushWidthInput').fill('80');
    await page.locator('#brushWidthInput').press('Enter');
    const pondsNow = async () => (await items()).filter(item => item.kind === 'pond');
    const pondsBefore = (await pondsNow()).length;
    await trace([[900, 150], [1100, 140], [1120, 300], [920, 320], [900, 160]]);
    let penPond = (await pondsNow()).at(-1);
    assert.equal((await pondsNow()).length, pondsBefore + 1, 'painting makes a pond');
    assert.equal(penPond.holes?.length, 1, 'painting a ring leaves the middle open');
    assert.ok(penPond.w > 280 && penPond.w < 340, `the pond is as wide as the painted ring: ${penPond.w}`);
    assert.deepEqual(await ids(), [], 'the painted pond is not selected, so the pen keeps painting');
    assert.equal(await page.evaluate(([id, x, y]) => window.__editorTest.floorAt(id, x, y), [penPond.id, 1000, 145]), true, 'the painted band is water in 3D');
    assert.equal(await page.evaluate(([id, x, y]) => window.__editorTest.floorAt(id, x, y), [penPond.id, 1010, 230]), false, 'the middle of the ring is open in 3D');
    await trace([[1110, 300], [1150, 420]]);
    assert.equal((await pondsNow()).length, pondsBefore + 1, 'painting over the pond joins it');
    const joined = (await pondsNow()).find(item => item.id === penPond.id);
    assert.ok(joined.h > penPond.h + 60, `the joined pond grows: ${penPond.h} -> ${joined.h}`);
    await page.locator('[data-brush-mode="cut"]').click();
    assert.match(await page.locator('#toolHint').textContent(), /池をけずる/);
    await trace([[1080, 440], [1220, 440]]);
    const cut = (await pondsNow()).find(item => item.id === penPond.id);
    assert.ok(cut.h < joined.h - 20, `cutting trims the pond: ${joined.h} -> ${cut.h}`);
    await page.locator('[data-brush-mode="paint"]').click();
    const penPond2 = cut;
    assert.ok(penPond2.path?.length >= 3, 'the painted pond keeps its outline');
    // 次に開いたときも、ペンで描く物を覚えている
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__editorTest));
    await page.locator('.tool-button[data-tool="paint"]').click();
    assert.equal(await page.locator('[data-pen-kind="pond"]').getAttribute('aria-checked'), 'true', 'the pen remembers what it draws');
    await page.locator('[data-pen-kind="paint"]').click();
    // 描き方は物ごとに「ペンで描く・直線で描く・曲線で描く」から選べる。直線・曲線はクリックで点を打ち、線は Enter、閉じる形は最初の点で終える
    const clickAt = async (x, y) => { const at = await point(x, y); await page.mouse.click(at.x, at.y); await page.waitForTimeout(80); };
    const near = (path, item, [x, y]) => {
      const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
      return Math.min(...path.map(([u, v]) => Math.hypot(cx + u * item.w - x, cy + v * item.h - y)));
    };
    await page.locator('[data-pen-kind="river"]').click();
    assert.equal(await page.locator('[data-draw-method="trace"]').getAttribute('aria-checked'), 'true', 'rivers start with tracing');
    await page.locator('[data-draw-method="straight"]').click();
    assert.match(await page.locator('#toolHint').textContent(), /クリックで点を打ち/);
    const riverTotal = (await rivers()).length;
    for (const [x, y] of [[200, 600], [500, 520], [800, 600]]) await clickAt(x, y);
    assert.match(await page.locator('#floorToolbar').textContent(), /川の作図/);
    assert.match(await page.locator('#floorToolbar').textContent(), /3点/);
    await page.keyboard.press('Enter');
    assert.equal((await rivers()).length, riverTotal + 1, 'the river is drawn through the clicked points');
    const straightRiver = (await rivers()).at(-1);
    assert.equal(straightRiver.path.length, 5, 'a straight river keeps a sharp corner at the middle point');
    // 曲線: 点を通るなめらかな線
    await page.locator('[data-draw-method="curve"]').click();
    for (const [x, y] of [[200, 400], [500, 320], [800, 400]]) await clickAt(x, y);
    await page.keyboard.press('Enter');
    const curvedRiver = (await rivers()).at(-1);
    assert.ok(curvedRiver.path.length > 10, `a curved river is a smooth line: ${curvedRiver.path.length} points`);
    assert.ok(near(curvedRiver.path, curvedRiver, [500, 320]) < 3, 'the curve passes through the clicked points');
    // 池: 最初の点を押すと閉じる（直線は角をとがらせる）
    await page.locator('[data-pen-kind="pond"]').click();
    await page.locator('[data-draw-method="straight"]').click();
    const ponds = async () => (await items()).filter(item => item.kind === 'pond');
    const pondTotal = (await ponds()).length;
    for (const [x, y] of [[900, 420], [1100, 420], [1100, 560], [900, 560], [900, 420]]) await clickAt(x, y);
    assert.equal((await ponds()).length, pondTotal + 1, 'clicking the first point again closes the pond');
    assert.equal((await ponds()).at(-1).path.length, 12, 'every corner of a straight pond stays sharp');
    // ペンの線: 点と点のあいだはまっすぐ
    await page.locator('[data-pen-kind="paint"]').click();
    await page.locator('[data-draw-method="straight"]').click();
    const strokes = async () => (await items()).filter(item => item.kind === 'paint');
    const strokeTotal = (await strokes()).length;
    for (const [x, y] of [[100, 100], [300, 100], [300, 250]]) await clickAt(x, y);
    await page.keyboard.press('Enter');
    assert.equal((await strokes()).length, strokeTotal + 1);
    assert.equal((await strokes()).at(-1).path.length, 3, 'the pen line keeps its corners');
    await page.locator('[data-draw-method="trace"]').click();
    // 石垣ははじめから直線。点を打つ前にドラッグすると、そのまま1本の直線
    await page.locator('[data-pen-kind="stoneWall"]').click();
    assert.equal(await page.locator('[data-draw-method="straight"]').getAttribute('aria-checked'), 'true', 'stone walls start as straight lines');
    const walls = async () => (await items()).filter(item => item.kind === 'stoneWall');
    const wallTotal = (await walls()).length;
    await trace([[150, 760], [650, 760]]);
    assert.equal((await walls()).length, wallTotal + 1, 'a drag draws one straight stone wall');
    assert.equal((await walls()).at(-1).path.length, 2);
    // 床: 部屋のツールで「直線」「曲線」を選ぶと線で囲んで床を作成、「ペンで描く」で部屋のツールに戻る
    await page.locator('.tool-button[data-tool="room"]').click();
    assert.equal(await page.locator('[data-draw-method="trace"]').getAttribute('aria-checked'), 'true');
    await page.locator('[data-draw-method="curve"]').click();
    assert.equal(await page.locator('.tool-button[data-tool="floor"]').getAttribute('aria-pressed'), 'true', 'clicking points for floors uses the floor drawing tool');
    assert.equal(await page.locator('[data-draw-method="curve"]').getAttribute('aria-checked'), 'true');
    await page.locator('[data-draw-method="trace"]').click();
    assert.equal(await page.locator('.tool-button[data-tool="room"]').getAttribute('aria-pressed'), 'true', 'tracing floors uses the room tool');
    // 床もペンで塗れる: 輪のように塗ると真ん中があいた床。同じ素材の床に重ねるとつながり、けずると穴があく
    await page.locator('[data-draw-method="brush"]').click();
    assert.equal(await page.locator('.tool-button[data-tool="room"]').getAttribute('aria-pressed'), 'true', 'painting floors uses the room tool');
    await page.locator('#roomToolSurfacePicker [data-surface-choice="snow"]').click();
    await page.locator('#brushWidthInput').fill('60');
    await page.locator('#brushWidthInput').press('Enter');
    const snowFloors = async () => (await rooms()).filter(room => room.surface === 'snow');
    await trace(Array.from({ length: 25 }, (_, i) => [600 + Math.cos((i / 24) * Math.PI * 2.1) * 120, 400 + Math.sin((i / 24) * Math.PI * 2.1) * 120]));
    assert.equal((await snowFloors()).length, 1, 'painting makes one snow floor');
    let ring = (await snowFloors())[0];
    assert.equal(ring.holes?.length, 1, 'a painted ring is a floor with a hole');
    assert.equal(ring.name, '', 'painted floors have no name');
    assert.equal(await page.evaluate(([id, x, y]) => window.__editorTest.floorAt(id, x, y), [ring.id, 600, 400]), false, 'the hole is open in 3D');
    assert.equal(await page.evaluate(([id, x, y]) => window.__editorTest.floorAt(id, x, y), [ring.id, 720, 400]), true);
    // 重ねて塗るとつながる。けずると穴
    await trace([[720, 400], [900, 400]]);
    assert.equal((await snowFloors()).length, 1, 'painting over the floor joins it');
    ring = (await snowFloors())[0];
    assert.ok(ring.w > 400, `the joined floor grows: ${ring.w}`);
    await page.locator('[data-brush-mode="cut"]').click();
    const joinedWidth = ring.w;
    await trace([[880, 400], [960, 400]]);
    assert.equal((await snowFloors()).length, 1, 'cutting the end does not split the floor');
    ring = (await snowFloors())[0];
    assert.ok(ring.w < joinedWidth - 30, `cutting trims the floor: ${joinedWidth} -> ${ring.w}`);
    assert.equal(ring.holes?.length, 1, 'the hole of the ring stays');
    await page.locator('[data-brush-mode="paint"]').click();
    await page.keyboard.press('Control+z');
    assert.ok((await snowFloors())[0].w > ring.w, 'undo brings the cut part back');
    console.log('PASS: free shapes: trace ponds and rivers in 2D, click for the usual shape, width, redraw, reset, select by shape, 3D and reload; traceable items are marked and gathered; floors and grounds take a traced shape; the pen draws rivers and paints ponds; floors and ponds can be painted with a hole, joined and cut; every shape can be drawn by tracing or by clicking points');
  } finally {
    await page.context().close();
  }
}
