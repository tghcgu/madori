import assert from 'node:assert/strict';
import test from 'node:test';
import { brushStroke, floorFromRegion, regionArea, regionsOverlap, subtractRegion, tidyRegion, unionRegions, MAX_FREE_RING_POINTS } from '../src/brush-area.ts';
import { MAX_FLOOR_VERTICES, normalizeFloorHoles, normalizeOutline, signedArea } from '../src/floor-outline.ts';

const ring = (cx, cy, r, count = 120, turns = 1.06) => Array.from({ length: count }, (_, i) => {
  const a = (i / count) * Math.PI * 2 * turns;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});

test('a painted line is a band with round ends, and a single click is a round spot', () => {
  const band = brushStroke([[0, 0], [200, 0], [400, 0]], 100);
  assert.equal(band.length, 1, 'one piece');
  assert.equal(band[0].length, 1, 'no holes');
  const expected = 400 * 100 + Math.PI * 50 * 50;
  assert.ok(Math.abs(regionArea(band) - expected) < expected * 0.02, `area ${regionArea(band)} ≈ ${expected}`);
  const spot = brushStroke([[50, 50]], 60);
  assert.ok(Math.abs(regionArea(spot) - Math.PI * 30 * 30) < Math.PI * 30 * 30 * 0.03);
  assert.deepEqual(brushStroke([], 100), []);
});

test('painting a ring makes a donut: one piece with a hole in the middle', () => {
  const donut = brushStroke(ring(500, 500, 300), 100);
  assert.equal(donut.length, 1, 'one piece');
  assert.equal(donut[0].length, 2, 'the middle stays open as a hole');
  const outer = Math.abs(signedArea(donut[0][0])), hole = Math.abs(signedArea(donut[0][1]));
  assert.ok(Math.abs(outer - Math.PI * 350 * 350) < Math.PI * 350 * 350 * 0.03, `outer ${outer}`);
  assert.ok(Math.abs(hole - Math.PI * 250 * 250) < Math.PI * 250 * 250 * 0.04, `hole ${hole}`);
});

test('strokes that touch join into one shape, and a stroke can cut a hole or split a shape', () => {
  const a = brushStroke([[0, 0], [300, 0]], 100), b = brushStroke([[300, 0], [300, 300]], 100), c = brushStroke([[800, 800], [900, 800]], 100);
  assert.ok(regionsOverlap(a, b));
  assert.ok(!regionsOverlap(a, c));
  assert.equal(unionRegions(a, b).length, 1, 'touching strokes join');
  assert.equal(unionRegions(a, c).length, 2, 'separate strokes stay apart');
  const square = [[[[0, 0], [600, 0], [600, 600], [0, 600], [0, 0]]]];
  const holed = subtractRegion(square, brushStroke([[300, 300]], 100));
  assert.equal(holed.length, 1);
  assert.equal(holed[0].length, 2, 'a dab in the middle cuts a hole');
  const split = subtractRegion(square, brushStroke([[-100, 300], [700, 300]], 80));
  assert.equal(split.length, 2, 'a stroke across splits the shape in two');
});

test('painted shapes are tidied: fewer points, tiny holes and crumbs dropped, biggest piece first', () => {
  const wiggle = brushStroke(Array.from({ length: 3000 }, (_, i) => [i * 2, Math.sin(i / 30) * 200]), 80);
  const tidy = tidyRegion([...wiggle, [[[10000, 0], [10002, 0], [10002, 2], [10000, 2], [10000, 0]]]]);
  assert.equal(tidy.length, 1, 'a 2cm crumb is dropped');
  assert.ok(tidy[0][0].length <= MAX_FREE_RING_POINTS, `${tidy[0][0].length} points`);
  const pinhole = [[[[0, 0], [600, 0], [600, 600], [0, 600], [0, 0]], [[300, 300], [302, 300], [302, 302], [300, 302], [300, 300]]]];
  assert.equal(tidyRegion(pinhole)[0].length, 1, 'a 2cm pinhole is dropped');
});

test('a painted donut becomes a valid floor with a hole, within the floor point limit', () => {
  const [donut] = tidyRegion(brushStroke(ring(500, 500, 300), 100));
  const floor = floorFromRegion(donut);
  assert.ok(floor, 'the donut makes a floor');
  assert.equal(floor.holes?.length, 1);
  assert.ok(Math.abs(floor.w - 700) < 4 && Math.abs(floor.h - 700) < 4, `size ${floor.w} x ${floor.h}`);
  assert.deepEqual(normalizeOutline(floor.outline), floor.outline);
  assert.deepEqual(normalizeFloorHoles(floor.holes, floor.outline), floor.holes);
  assert.ok(floor.outline.length <= MAX_FLOOR_VERTICES && floor.holes[0].length <= MAX_FLOOR_VERTICES);
  // とても長い線でも、床の点の上限に収まる
  const [long] = tidyRegion(brushStroke(Array.from({ length: 2000 }, (_, i) => [i * 3, Math.sin(i / 20) * 300]), 60));
  const longFloor = floorFromRegion(long);
  assert.ok(longFloor && longFloor.outline.length <= MAX_FLOOR_VERTICES, `${longFloor?.outline.length} points`);
});
