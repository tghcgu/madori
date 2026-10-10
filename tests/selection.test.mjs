import assert from 'node:assert/strict';
import test from 'node:test';
import { translateSelection } from '../src/selection.ts';

test('group translation preserves offsets, line lengths, sizes and rotations', () => {
  const origins = [
    { id: 'chair', x: 13, y: -47, w: 45, h: 45, rotation: 25 },
    { id: 'room', x: 101, y: 93, labelOffsetX: 7 },
    { id: 'wall', x1: -23, y1: 35, x2: 189, y2: 127 },
    { id: 'label', x: 8.5, y: 9.2 },
    { id: 'locked', x: 7, y: 1, locked: true },
  ];
  const items = structuredClone(origins);
  const find = id => items.find(item => item.id === id);
  translateSelection(origins, find, 60, -40);
  assert.deepEqual(items[0], { ...origins[0], x: 73, y: -87 });
  assert.deepEqual(items[1], { ...origins[1], x: 161, y: 53 });
  assert.deepEqual(items[2], { ...origins[2], x1: 37, y1: -5, x2: 249, y2: 87 });
  assert.deepEqual(items[3], { ...origins[3], x: 68.5, y: -30.8 });
  assert.deepEqual(items[4], origins[4]);
  translateSelection(origins, find, 20, 20);
  assert.equal(items[0].x, 33, 'each frame starts from the original, not the previous frame');
  items[0].locked = true;
  translateSelection(origins, find, 0, 0);
  assert.equal(items[0].x, 33);
  assert.doesNotThrow(() => translateSelection(origins, () => undefined, 0, 0));
});
