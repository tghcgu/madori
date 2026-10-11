import assert from 'node:assert/strict';
import test from 'node:test';
import { incomingStairs, isStair, sameStairPlacement, stairsBelow } from '../src/stairs.ts';

const stair = (kind = 'stairs', extra = {}) => ({ id: kind, type: 'furniture', kind, x: 100, y: 80, w: 100, h: 280, rotation: 0, ...extra });
const floor = (...entities) => ({ entities });

test('incoming stairs use only the immediately preceding floor and never add furniture', () => {
  const a = stair(), b = stair('stairsU', { x: 300 }), c = stair('stairsSpiral', { x: 500 });
  const floors = [floor(a, b, c, { ...a, id: 'chair', kind: 'chair' }), floor(), floor()];
  const before = structuredClone(floors);
  assert.deepEqual(incomingStairs(floors, 0), []);
  assert.deepEqual(incomingStairs(floors, 1), [a, b, c]);
  assert.equal(incomingStairs(floors, 1)[0], a);
  assert.deepEqual(incomingStairs(floors, 2), []);
  assert.deepEqual(incomingStairs(floors, -1), []);
  assert.deepEqual(incomingStairs(floors, 3), []);
  assert.deepEqual(floors, before);
});

test('the active flight wins over the arrival symbol at the same placement', () => {
  const a = stair(), next = stair('stairs', { id: 'upper' });
  const floors = [floor(a), floor(next), floor()];
  assert.deepEqual(incomingStairs(floors, 1), []);
  assert.deepEqual(stairsBelow(floors, 1), [a]);
  assert.deepEqual(incomingStairs(floors, 2), [next]);
  floors[1].entities = [];
  assert.deepEqual(incomingStairs(floors, 1), [a]);
});

test('duplicate detection respects dimensions, direction, rotation and mirrored stairs', () => {
  const a = stair('stairsU', { rotation: -90, flip: true });
  assert.ok(sameStairPlacement(a, { ...a, id: 'other', rotation: 270 }));
  assert.ok(sameStairPlacement(stair(), stair('stairs', { rotation: 360, flip: false })));
  for (const change of [{ x: 101 }, { y: 81 }, { w: 120 }, { h: 300 }, { rotation: 90 }, { flip: false }, { kind: 'stairs' }]) {
    assert.equal(sameStairPlacement(a, { ...a, ...change }), false);
  }
});

test('references follow lower-floor moves, resizing, flipping and deletion', () => {
  const a = stair(), floors = [floor(a), floor()];
  Object.assign(a, { x: -500, y: 120, w: 160, h: 320, rotation: 35, flip: true });
  assert.deepEqual(incomingStairs(floors, 1), [a]);
  floors[0].entities = [];
  assert.deepEqual(incomingStairs(floors, 1), []);
});

test('stair detection excludes non-stairs and invalid placements', () => {
  for (const value of [null, {}, { kind: 'stairs' }, { ...stair(), type: 'room' }, { ...stair(), kind: 'chair' }, { ...stair(), x: NaN }]) assert.equal(isStair(value), false);
  for (const kind of ['stairs', 'stairsU', 'stairsSpiral']) assert.ok(isStair(stair(kind)));
});
