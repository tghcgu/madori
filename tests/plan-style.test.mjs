import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PAPER_COLOR, PLAN_STYLES, STYLE_LOOKS, brushStroke, dashPolyline, inkColor, lineCells, parseCssColor, shapeSeed, sketchLines, splitStrokes, styledFont, toneLevel,
  washColor, wobblePolygon,
} from '../src/plan-style.ts';

// 点から線分までの距離
function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

function signedArea(polygon) {
  let area = 0;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) area += polygon[j] * polygon[i + 1] - polygon[i] * polygon[j + 1];
  return area / 2;
}

test('there are nine 2D styles, each with a name, a hint and its own background and grid', () => {
  assert.deepEqual(PLAN_STYLES.map(style => style.value), ['standard', 'pixel', 'brush', 'pencil', 'manga', 'blueprint', 'parchment', 'chalk', 'neon']);
  for (const { value, label, hint } of PLAN_STYLES) {
    assert.ok(label && hint, value);
    const look = STYLE_LOOKS[value];
    assert.equal(look.grid.length, 2, `${value} has a fine and a bold grid color`);
    for (const color of look.grid) assert.ok(parseCssColor(color), `${value} grid color ${color}`);
    if (look.background) assert.ok(parseCssColor(look.background), `${value} background`);
  }
  assert.equal(STYLE_LOOKS.standard.background, null, 'the standard style keeps the usual background');
  const lightness = value => {
    const [r, g, b] = parseCssColor(STYLE_LOOKS[value].background);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  const [r, , b] = parseCssColor(STYLE_LOOKS.blueprint.background);
  assert.ok(b > r * 2, 'the blueprint is blue');
  assert.ok(lightness('neon') < 40 && lightness('chalk') < 90, 'neon and the chalkboard are dark');
  assert.ok(lightness('parchment') > 180 && lightness('pencil') > 230, 'old maps and pencil sketches are on light paper');
});

test('manga tones go from white to solid black in steps of a tenth', () => {
  assert.equal(toneLevel('#ffffff'), 0);
  assert.equal(toneLevel('#f6f6f6'), 0, 'nearly white stays white');
  assert.equal(toneLevel('#000000'), 1);
  assert.equal(toneLevel('#1a1a1a'), 1, 'nearly black becomes solid black');
  assert.equal(toneLevel('not a color'), 0);
  let previous = 0;
  for (let v = 255; v >= 0; v -= 5) {
    const level = toneLevel(`rgb(${v}, ${v}, ${v})`);
    assert.ok(level >= previous, `darker grays get darker tones (${v})`);
    assert.ok(Math.abs(level * 10 - Math.round(level * 10)) < 1e-9, `the tone of ${v} is a step of a tenth`);
    previous = level;
  }
  assert.ok(toneLevel('#808080') >= 0.4 && toneLevel('#808080') <= 0.6, 'middle gray is a middle tone');
  assert.ok(toneLevel('#b0413e') > 0 && toneLevel('#b0413e') < 1, 'a colour becomes a gray tone');
});

test('pencil lines go over a line a few times, stay close to it, and look the same every time', () => {
  const near = (lines, path, limit) => {
    for (const line of lines) {
      for (let i = 0; i < line.length; i += 2) {
        let distance = Infinity;
        for (let j = 0; j + 3 < path.length; j += 2) distance = Math.min(distance, segmentDistance(line[i], line[i + 1], path[j], path[j + 1], path[j + 2], path[j + 3]));
        assert.ok(distance <= limit, `(${line[i].toFixed(1)}, ${line[i + 1].toFixed(1)}) is ${distance.toFixed(2)} from the line`);
      }
    }
  };
  const path = [10, 20, 210, 20, 210, 120];
  const thin = sketchLines(path, { width: 1, unit: 1, seed: 7 });
  assert.equal(thin.length, 2, 'a thin line is drawn twice');
  near(thin, path, 4);
  assert.deepEqual(sketchLines(path, { width: 1, unit: 1, seed: 7 }), thin, 'the same line looks the same');
  assert.notDeepEqual(sketchLines(path, { width: 1, unit: 1, seed: 8 }), thin, 'another line looks a little different');

  // 太い線（壁）は、線の幅いっぱいに細い線を並べる
  const thick = sketchLines([0, 0, 300, 0], { width: 10, unit: 1, seed: 3 });
  assert.ok(thick.length >= 5 && thick.length <= 7, `a thick line is filled with ${thick.length} strokes`);
  near(thick, [0, 0, 300, 0], 10 / 2 + 2);
  const lanes = thick.map(line => line.filter((_, i) => i % 2 === 1).reduce((sum, y) => sum + y, 0) / (line.length / 2));
  assert.ok(Math.max(...lanes) - Math.min(...lanes) > 5, 'the strokes spread across the width of the wall');

  // 閉じた形はひと回りし、短すぎる線は描かない
  const square = [0, 0, 100, 0, 100, 100, 0, 100];
  const closed = sketchLines(square, { width: 1, unit: 1, seed: 5, closed: true });
  near(closed, [...square, 0, 0], 3);
  assert.ok(closed.every(line => line.length >= 8));
  assert.deepEqual(sketchLines([0, 0, 0.3, 0], { width: 1, unit: 1, seed: 1 }), []);
});

test('styles change only the typeface of text, keeping its size and weight', () => {
  const font = '700 12.5px "Yu Gothic UI", sans-serif';
  assert.equal(styledFont(font, 'standard'), font);
  const brush = styledFont(font, 'brush');
  assert.match(brush, /^700 12\.5px /);
  assert.match(brush, /教科書体|正楷書体/);
  assert.equal(styledFont(brush, 'brush'), brush, 'changing the typeface twice gives the same font');
  assert.match(styledFont('13px "Yu Gothic UI", sans-serif', 'pixel'), /^13px "MS Gothic"/);
  // 鉛筆と黒板は手書きらしい教科書体、古地図は明朝、設計図は図面の文字らしいゴシック。マンガとネオンはそのまま
  assert.match(styledFont(font, 'pencil'), /^700 12\.5px "UD デジタル 教科書体/);
  assert.match(styledFont(font, 'chalk'), /^700 12\.5px "UD デジタル 教科書体/);
  assert.match(styledFont(font, 'parchment'), /^700 12\.5px "Yu Mincho"/);
  assert.match(styledFont(font, 'blueprint'), /^700 12\.5px "BIZ UDGothic"/);
  assert.equal(styledFont(font, 'manga'), font);
  assert.equal(styledFont(font, 'neon'), font);
});

test('dot lines step one dot at a time, without doubled dots on curves, and keep square corners', () => {
  // A horizontal line covers every dot it passes through.
  assert.deepEqual(lineCells([1, 1, 31, 1], 3), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(x => [x, 0]));
  // A diagonal line steps diagonally: each dot touches the next one only at a corner.
  const diagonal = lineCells([0, 0, 15, 15], 3);
  assert.deepEqual(diagonal, [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
  // A curve made of short pieces has no L-shaped doubled dots.
  const arc = [];
  for (let i = 0; i <= 24; i += 1) arc.push(60 + Math.cos(i / 24 * Math.PI / 2) * 50, 60 - Math.sin(i / 24 * Math.PI / 2) * 50);
  const cells = lineCells(arc, 2);
  for (let i = 2; i < cells.length; i += 1) {
    const [a, b] = [cells[i - 2], cells[i]];
    assert.ok(!(Math.abs(a[0] - b[0]) === 1 && Math.abs(a[1] - b[1]) === 1), `no doubled dot at ${cells[i - 1]}`);
  }
  for (let i = 1; i < cells.length; i += 1) assert.ok(Math.max(Math.abs(cells[i][0] - cells[i - 1][0]), Math.abs(cells[i][1] - cells[i - 1][1])) === 1, 'the line has no gaps');
  // The corner of a rectangle keeps its dot.
  const square = lineCells([1, 1, 13, 1, 13, 13, 1, 13, 1, 1], 3);
  for (const corner of [[0, 0], [4, 0], [4, 4], [0, 4]]) assert.ok(square.some(([x, y]) => x === corner[0] && y === corner[1]), `corner ${corner}`);
});

test('dashed lines are cut into the drawn pieces of the dash pattern', () => {
  const pieces = dashPolyline([0, 0, 10, 0], [2, 2]);
  assert.deepEqual(pieces.map(piece => [piece[0], piece[piece.length - 2]]), [[0, 2], [4, 6], [8, 10]]);
  // An odd pattern repeats twice, like the canvas does.
  assert.equal(dashPolyline([0, 0, 12, 0], [3]).length, 2);
});

test('the brush draws each side of a square on its own, but a circle in one stroke', () => {
  const square = splitStrokes([0, 0, 100, 0, 100, 100, 0, 100], null, true);
  assert.equal(square.length, 4);
  assert.ok(square.every(piece => !piece.closed && piece.cornerStart && piece.cornerEnd));
  const circle = [];
  for (let i = 0; i < 40; i += 1) circle.push(Math.cos(i / 40 * Math.PI * 2) * 50, Math.sin(i / 40 * Math.PI * 2) * 50);
  // Points inside a curve are never corners, even when the curve is small and turns quickly.
  const smallCircle = circle.map(value => value / 10);
  assert.equal(splitStrokes(smallCircle, smallCircle.map(() => false).slice(0, 40), true).length, 1);
  const pieces = splitStrokes(circle, null, true);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].closed, true);
  // An L-shaped line is two strokes.
  assert.equal(splitStrokes([0, 0, 50, 0, 50, 50], null, false).length, 2);
});

test('brush strokes follow the path, vary in width, and look the same every time', () => {
  const path = [0, 0, 300, 0];
  const options = { width: 4, unit: 1, seed: 1234 };
  const polygons = brushStroke(path, options);
  assert.deepEqual(brushStroke(path, options), polygons, 'the same stroke has the same shape every time');
  assert.notDeepEqual(brushStroke(path, { ...options, seed: 99 }), polygons, 'another stroke wobbles differently');
  const points = polygons.flat();
  for (let i = 0; i < points.length; i += 2) assert.ok(segmentDistance(points[i], points[i + 1], 0, 0, 300, 0) < 4 * 1.5 + 4, `stays near the path: ${points[i]}, ${points[i + 1]}`);
  // The width changes along the stroke (the brush presses in and lifts out).
  const reach = x => Math.max(...polygons.flatMap(polygon => {
    const out = [];
    for (let i = 0; i < polygon.length; i += 2) if (Math.abs(polygon[i] - x) < 3) out.push(Math.abs(polygon[i + 1]));
    return out;
  }));
  const widths = [8, 60, 150, 240, 296].map(reach).filter(Number.isFinite);
  assert.ok(Math.max(...widths) / Math.min(...widths) > 1.1, `the width varies: ${widths}`);
  // Thick strokes are drawn as several bristles, all facing the same way so that they add up when filled.
  const thick = brushStroke(path, { width: 12, unit: 1, seed: 7 });
  assert.ok(thick.length >= 3, `bristles: ${thick.length}`);
  assert.ok(thick.every(polygon => signedArea(polygon) >= 0));
});

test('filled shapes get a slightly wavy edge that stays close to the shape', () => {
  const square = [0, 0, 100, 0, 100, 100, 0, 100];
  const wavy = wobblePolygon(square, 1, 5);
  assert.ok(wavy.length > square.length * 4, 'the edges are split into short pieces');
  for (let i = 0; i < wavy.length; i += 2) {
    const edge = Math.min(Math.abs(wavy[i]), Math.abs(wavy[i] - 100), Math.abs(wavy[i + 1]), Math.abs(wavy[i + 1] - 100));
    assert.ok(edge <= 1.2, `on the edge: ${wavy[i]}, ${wavy[i + 1]}`);
  }
});

test('ink and washes: black becomes sumi ink, white becomes paper, and transparency is kept', () => {
  const ink = parseCssColor(inkColor('#000000'));
  assert.ok(ink[0] < 60 && ink[0] >= ink[2], `warm black ink: ${ink}`);
  assert.deepEqual(parseCssColor(washColor('#ffffff')), parseCssColor(PAPER_COLOR));
  assert.equal(parseCssColor(inkColor('rgba(39, 117, 209, 0.35)'))[3], 0.35);
  const blue = parseCssColor(washColor('#2775d1'));
  assert.ok(blue[2] > blue[0] + 60, `colors stay recognizable: ${blue}`);
});

test('the brush gives the same shape the same look wherever it is drawn', () => {
  const shape = [0, 0, 40, 0, 40, 30];
  const moved = shape.map((value, i) => value + (i % 2 ? 500 : -230));
  assert.equal(shapeSeed(shape, 1), shapeSeed(moved, 1));
  assert.notEqual(shapeSeed(shape, 1), shapeSeed([0, 0, 40, 0, 40, 31], 1));
  // The seed uses lengths on the plan, so zooming in keeps the same look.
  assert.equal(shapeSeed(shape, 1), shapeSeed(shape.map(value => value * 2), 2));
});

test('lines and shapes far outside the screen are cut to the visible area, keeping the dash pattern in place', async () => {
  const { clipPolyline, clipPolygon } = await import('../src/plan-style.ts');
  const starts = [];
  // A very long line crossing a 100 x 100 screen.
  const runs = clipPolyline([-1e6, 50, 1e6, 50], 0, 0, 100, 100, starts);
  assert.deepEqual(runs, [[0, 50, 100, 50]]);
  assert.equal(starts[0], 1e6, 'the visible part starts 1,000,000 px along the line');
  // A path that leaves and comes back is two pieces.
  assert.equal(clipPolyline([10, 10, 500, 10, 500, 90, 10, 90], 0, 0, 100, 100).length, 2);
  // A huge square covering the screen becomes the screen.
  const square = clipPolygon([-1e6, -1e6, 1e6, -1e6, 1e6, 1e6, -1e6, 1e6], 0, 0, 100, 100);
  const xs = square.filter((_, i) => i % 2 === 0), ys = square.filter((_, i) => i % 2 === 1);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [0, 100, 0, 100]);
  assert.deepEqual(clipPolygon([200, 200, 300, 200, 300, 300], 0, 0, 100, 100), [], 'a shape off the screen is not drawn');
});
