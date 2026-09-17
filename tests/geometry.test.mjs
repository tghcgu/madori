import test from 'node:test';
import assert from 'node:assert/strict';
import { openingIntervals, segmentInterval, solidWallSections, visibleRectangles } from '../src/geometry.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const area = rectangles => rectangles.reduce((sum, rect) => sum + rect.w * rect.h, 0);

test('diagonal openings preserve the angle, including reversed walls and openings', () => {
  for (const reversed of [false, true]) {
    const wall = reversed ? { x1: 300, y1: 400, x2: 0, y2: 0 } : { x1: 0, y1: 0, x2: 300, y2: 400 };
    const openings = openingIntervals(wall, [{ type: 'door', x1: 180, y1: 240, x2: 120, y2: 160 }], 12);
    assert.equal(openings.length, 1);
    close(openings[0].from, 194);
    close(openings[0].to, 306);
    for (const section of solidWallSections(500, openings, 2.6, 2.1, 0.84, 1.96)) {
      const segment = segmentInterval({ ...wall, id: 'wall' }, section.from, section.to);
      close((segment.x2 - segment.x1) * 4, (segment.y2 - segment.y1) * 3);
      assert.equal(segment.id, 'wall');
    }
  }
});

test('unrelated and zero-length openings do not cut the wall', () => {
  const wall = { x1: 0, y1: 0, x2: 400, y2: 0 };
  assert.deepEqual(openingIntervals(wall, [
    { type: 'door', x1: 100, y1: -50, x2: 100, y2: 50 },
    { type: 'door', x1: 100, y1: 100, x2: 200, y2: 100 },
    { type: 'window', x1: 500, y1: 0, x2: 600, y2: 0 },
    { type: 'window', x1: 100, y1: 0, x2: 100, y2: 0 },
  ], 12), []);
  assert.deepEqual(openingIntervals({ ...wall, x2: 0 }, [], 12), []);
});

test('overlapping door and window holes never refill each other', () => {
  const sections = solidWallSections(400, [
    { from: 100, to: 250, kind: 'door' },
    { from: 200, to: 300, kind: 'window' },
  ], 2.6, 2.1, 0.84, 1.96);
  assert.deepEqual(sections.filter(s => s.from === 200), [{ from: 200, to: 250, bottom: 2.1, top: 2.6 }]);
  assert.deepEqual(sections.filter(s => s.from === 250), [
    { from: 250, to: 300, bottom: 0, top: 0.84 },
    { from: 250, to: 300, bottom: 1.96, top: 2.6 },
  ]);
  close(sections.reduce((sum, s) => sum + (s.to - s.from) * (s.top - s.bottom), 0), 400 * 2.6 - 150 * 2.1 - 50 * 1.12);
});

test('overlapping floor regions have no coplanar faces and conserve visible area', () => {
  const source = { x: 0, y: 0, w: 600, h: 400 };
  const covers = [{ x: 100, y: 100, w: 200, h: 200 }, { x: 200, y: 200, w: 300, h: 200 }];
  const pieces = visibleRectangles(source, covers);
  close(area(pieces), 600 * 400 - 200 * 200 - 300 * 200 + 100 * 100);
  for (const [index, piece] of pieces.entries()) {
    for (const other of [...covers, ...pieces.slice(index + 1)]) {
      assert.ok(piece.x + piece.w <= other.x || other.x + other.w <= piece.x || piece.y + piece.h <= other.y || other.y + other.h <= piece.y);
    }
  }
  assert.deepEqual(visibleRectangles(source, [source]), []);
  assert.deepEqual(visibleRectangles(source, [{ x: 600, y: 0, w: 100, h: 400 }]), [source]);
});
