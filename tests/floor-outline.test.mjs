import assert from 'node:assert/strict';
import test from 'node:test';
import { floorPoints, floorPolygon, normalizeOutline, normalizeFloorHoles, outlineFromPoints, pointInPolygon, tracedFloorPoints, visibleFloorPolygons, signedArea, MAX_FLOOR_VERTICES } from '../src/floor-outline.ts';

const room = { x: 0, y: 0, w: 600, h: 400 };
const l = [[0, 0], [1, 0], [1, .5], [.5, .5], [.5, 1], [0, 1]];
const area = polygons => polygons.reduce((sum, rings) => sum + Math.abs(signedArea(rings[0])) - rings.slice(1).reduce((holes, ring) => holes + Math.abs(signedArea(ring)), 0), 0);

test('floor outlines accept concave shapes but reject malformed and crossed paths', () => {
  assert.equal(normalizeOutline(undefined), undefined);
  assert.deepEqual(normalizeOutline(l), l);
  for (const bad of [null, [], [[0, 0], [1, 1], [0, 1], [1, 0]], [[0, 0], [1, 1], [2, 0]], [[0, 0], [1, 0], [NaN, 1]], [[0, 0], [0, 0], [0, 0]]]) assert.throws(() => normalizeOutline(bad));
});
test('a traced loop becomes a valid floor outline: smoothed, reduced and untangled where the line crosses itself', () => {
  // 手で描いた円（揺れつき、閉じ目で少し行き過ぎる）
  const circle = Array.from({ length: 600 }, (_, i) => {
    const a = (i / 600) * Math.PI * 2.08, r = 300 + Math.sin(i * 1.7) * 4;
    return [500 + r * Math.cos(a), 400 + r * Math.sin(a)];
  });
  const points = tracedFloorPoints(circle, 1.5);
  assert.ok(points.length >= 12 && points.length <= MAX_FLOOR_VERTICES, `${points.length} points`);
  assert.ok(outlineFromPoints(points), 'the outline is a valid floor');
  assert.ok(Math.abs(Math.abs(signedArea(points)) - Math.PI * 300 * 300) < 0.04 * Math.PI * 300 * 300, 'about the traced area');
  // 8の字は、大きい方の輪だけを床にする
  const eight = [[0, 0], [300, 300], [600, 0], [600, 300], [300, 0], [0, 300]];
  const untangled = tracedFloorPoints(eight);
  assert.ok(untangled && outlineFromPoints(untangled), 'a crossed loop is untangled');
  // とても長い線でも、床の点の上限を超えない
  const wiggle = Array.from({ length: 4000 }, (_, i) => {
    const a = (i / 4000) * Math.PI * 2, r = 800 + 60 * Math.sin(a * 40);
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  assert.ok(tracedFloorPoints(wiggle).length <= MAX_FLOOR_VERTICES);
  assert.equal(tracedFloorPoints([[0, 0], [10, 0]]), null, 'too few points');
});
test('resizing and translating use normalized vertices, not stale world coordinates', () => {
  const original = { ...room, outline: l };
  assert.deepEqual(floorPoints({ ...original, x: 100, w: 1000 })[3], [600, 200]);
  assert.deepEqual(floorPoints(original)[3], [300, 200]);
  const next = outlineFromPoints([[-20, 40], [180, 40], [80, 240]]);
  assert.deepEqual(next, { x: -20, y: 40, w: 200, h: 200, outline: [[0, 0], [1, 0], [.5, 1]] });
  assert.equal(outlineFromPoints([[0, 0], [0, 0], [0, 0]]), null);
});
test('a concave floor does not fill its cutout and subtracts later floors', () => {
  const result = visibleFloorPolygons({ ...room, outline: l }, []);
  assert.equal(area(result), 180000);
  assert.equal(pointInPolygon(500, 300, result[0]), false);
  assert.equal(pointInPolygon(100, 300, result[0]), true);
  const covered = visibleFloorPolygons({ ...room, outline: l }, [{ x: 0, y: 0, w: 300, h: 400 }]);
  assert.equal(area(covered), 60000);
});
test('polygon floor clipping preserves interior holes and complete occlusion', () => {
  const hole = { x: 100, y: 100, w: 100, h: 100 };
  const result = visibleFloorPolygons(room, [hole]);
  assert.equal(result[0].length, 2);
  assert.equal(area(result), 230000);
  assert.equal(pointInPolygon(150, 150, result[0]), false);
  assert.deepEqual(visibleFloorPolygons(room, [room]), []);
});

test('saved stairwell holes survive transforms and reject invalid or overlapping rings', () => {
  const hole = [[.2,.2],[.4,.2],[.4,.4],[.2,.4]];
  assert.deepEqual(normalizeFloorHoles([hole]), [hole]);
  assert.equal(normalizeFloorHoles([]), undefined);
  for (const bad of [null, [undefined], [hole,hole], [[[.9,.9],[1.1,.9],[1.1,1.1]]]]) assert.throws(() => normalizeFloorHoles(bad));
  assert.throws(() => normalizeFloorHoles([[[.7,.7],[.9,.7],[.9,.9]]], l));
  const floor = { ...room, holes: [hole] };
  assert.equal(pointInPolygon(150,100,floorPolygon(floor)),false);
  assert.equal(area(visibleFloorPolygons(floor,[])),230400);
  assert.deepEqual(floorPolygon({...floor,x:100,w:1000})[1][0],[300,80]);
});
