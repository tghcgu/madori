import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FREE_AREA_KINDS, FREE_LINE_KINDS, ALWAYS_FREE_KINDS, RAILWAY, bandOutline, defaultFreePath, distanceToFreeLine, freeBand, freeFlowerBed,
  freeLawn, freeLineLength, freeLineWidth, freeMargin, freeOutline, freePathPoints, freePond, freePosts, freeShapeLine, freeSteppingStones,
  curveThrough, freeCenterLine, isAlwaysFreeKind, sharpCorners, isFreeAreaKind, isFreeShapeKind, isFreeWidthAdjustable, offsetFreeLine, pointInFreePolygon, polygonArea, samplesAlong,
  smoothFreeLine,
} from '../src/free-shapes.ts';

const blob = [[0, -100], [80, -60], [100, 20], [40, 90], [-60, 80], [-100, 0], [-70, -70]];

test('free shapes are split into closed areas and lines along a path', () => {
  for (const kind of FREE_AREA_KINDS) assert.ok(isFreeShapeKind(kind) && isFreeAreaKind(kind), kind);
  for (const kind of FREE_LINE_KINDS) assert.ok(isFreeShapeKind(kind) && !isFreeAreaKind(kind), kind);
  for (const kind of ALWAYS_FREE_KINDS) assert.ok(isFreeShapeKind(kind) && isAlwaysFreeKind(kind), kind);
  assert.equal(isFreeShapeKind('sofa'), false);
  assert.equal(isAlwaysFreeKind('pond'), false, 'a clicked pond keeps its usual shape');
  assert.ok(isFreeWidthAdjustable('river') && !isFreeWidthAdjustable('fence'));
  assert.equal(freeLineWidth('river'), 140);
  assert.equal(freeLineWidth('river', 300), 300);
  assert.equal(freeLineWidth('river', 99999), 2000, 'widths are limited');
  assert.equal(freeLineWidth('fence', 300), 6, 'fences keep their own thickness');
});

test('default paths fit inside their frame with room for the margin', () => {
  for (const kind of [...FREE_AREA_KINDS, ...FREE_LINE_KINDS]) {
    const path = defaultFreePath(kind);
    assert.ok(path.length >= 2, kind);
    for (const [x, y] of path) assert.ok(Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5, `${kind}: ${x},${y}`);
    assert.ok(freeMargin(kind) > 0, kind);
  }
});

test('smoothing keeps the ends of lines and stays inside the drawn hull', () => {
  const line = smoothFreeLine([[0, 0], [100, 0], [100, 100]], false);
  assert.deepEqual(line[0], [0, 0]);
  assert.deepEqual(line[line.length - 1], [100, 100]);
  for (const [x, y] of line) assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100);
  const outline = freeOutline(blob);
  assert.ok(polygonArea(outline) > 0, 'outlines turn one way');
  assert.ok(outline.length > blob.length);
});

test('a line drawn back to where it started keeps its whole loop', () => {
  const loop = [[0, 0], [400, 0], [400, 300], [0, 300], [0, 0]];
  const line = freeCenterLine(loop);
  assert.ok(line.length >= 5, `kept ${line.length} points`);
  assert.ok(freeLineLength(line) > 1300, 'the loop is about 1400cm long');
  for (const corner of [[400, 0], [400, 300], [0, 300]]) assert.ok(distanceToFreeLine(corner[0], corner[1], line, false) < 30, `passes by ${corner}`);
});

test('straight shapes keep sharp corners after smoothing, and curves pass through their points', () => {
  const corner = [[0, 0], [300, 0], [300, 200]];
  assert.deepEqual(freeCenterLine(sharpCorners(corner, false)), corner, 'the corner of a straight line stays sharp');
  const box = freeOutline(sharpCorners([[0, 0], [200, 0], [200, 100], [0, 100]], true));
  for (const p of [[0, 0], [200, 0], [200, 100], [0, 100]]) assert.ok(box.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01), `the box keeps the corner ${p}`);
  const curve = curveThrough(corner, false);
  assert.ok(curve.length > 10, 'a curve has many points');
  for (const p of corner) assert.ok(Math.min(...curve.map(q => Math.hypot(q[0] - p[0], q[1] - p[1]))) < 0.01, `the curve passes ${p}`);
  const loop = curveThrough([[0, 0], [200, 0], [200, 200], [0, 200]], true);
  assert.ok(loop.length > 20 && Math.hypot(loop[0][0] - loop.at(-1)[0], loop[0][1] - loop.at(-1)[1]) > 1, 'a closed curve does not repeat its first point');
  assert.deepEqual(curveThrough([[0, 0], [10, 0]], false), [[0, 0], [10, 0]], 'two points stay a straight line');
});

test('offset lines run beside the path at the given distance', () => {
  const line = [[0, 0], [100, 0], [200, 0]];
  const left = offsetFreeLine(line, 10, false), right = offsetFreeLine(line, -10, false);
  left.forEach(([, y]) => assert.ok(Math.abs(y - 10) < 1e-9));
  right.forEach(([, y]) => assert.ok(Math.abs(y + 10) < 1e-9));
  const band = freeBand(line, 40);
  assert.equal(bandOutline(band).length, 6);
  assert.ok(distanceToFreeLine(50, 20, line, false) === 20);
});

test('samples along a path are evenly spaced and face along it', () => {
  const samples = samplesAlong([[0, 0], [100, 0], [100, 100]], 25, false, 0);
  assert.equal(samples.length, 9);
  assert.deepEqual([samples[0].x, samples[0].y, samples[0].angle], [0, 0, 0]);
  assert.ok(Math.abs(samples[8].angle - Math.PI / 2) < 1e-9);
  assert.equal(freeLineLength([[0, 0], [30, 40]]), 50);
  const posts = freePosts([[0, 0], [300, 0]], 150);
  assert.deepEqual(posts.map(post => post.x), [0, 150, 300], 'posts at both ends and between');
});

test('ponds, flower beds and lawns put their pieces inside or along the outline', () => {
  const pond = freePond(blob);
  assert.ok(pond.stones.length > 10, 'stones go around the pond');
  for (const stone of pond.stones) assert.ok(!pointInFreePolygon(stone.x, stone.y, pond.water), 'stones sit just outside the water');
  for (const ripple of pond.ripples) assert.ok(pointInFreePolygon(ripple.x, ripple.y, pond.water));
  const bed = freeFlowerBed(blob);
  assert.ok(bed.plants.length > 10);
  for (const plant of bed.plants) assert.ok(pointInFreePolygon(plant.x, plant.y, bed.outline));
  const lawn = freeLawn(blob);
  assert.ok(lawn.tufts.length > 20);
  // 大きな芝生でも、株の数は増えすぎない
  const huge = freeLawn([[0, 0], [5000, 0], [5000, 5000], [0, 5000]]);
  assert.ok(huge.tufts.length <= 1600, `tufts: ${huge.tufts.length}`);
});

test('stepping stones follow the path, and railway sizes are real', () => {
  const stones = freeSteppingStones([[0, 0], [400, 0]]);
  assert.ok(stones.length >= 6);
  for (const stone of stones) assert.ok(Math.abs(stone.y) <= 9 && stone.x >= 0 && stone.x <= 400);
  assert.equal(RAILWAY.gauge, 107, 'narrow gauge 1067 mm');
});

test('the shape line of an item is in cm around its center', () => {
  const points = freePathPoints([[-0.5, 0], [0.5, 0]], 200, 50);
  assert.deepEqual(points, [[-100, 0], [100, 0]]);
  const line = freeShapeLine('river', [[-0.4, 0], [0, 0.2], [0.4, 0]], 500, 200);
  assert.deepEqual(line[0], [-200, 0]);
  const area = freeShapeLine('pond', defaultFreePath('pond'), 300, 200);
  assert.ok(area.every(([x, y]) => Math.abs(x) <= 150 && Math.abs(y) <= 100));
});
