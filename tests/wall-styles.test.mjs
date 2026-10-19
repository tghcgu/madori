import assert from 'node:assert/strict';
import test from 'node:test';
import { CAP_OVERHANG, WALL_STYLES, isWallStyle, wallJoints, wallStyleInfo, wallTopWidth } from '../src/wall-styles.ts';
import { FURNITURE_DEFS } from '../src/furniture-catalog.ts';
import { freeLineWidth } from '../src/free-shapes.ts';

test('every wall type has a name, a thickness and a color, and plain walls come first', () => {
  assert.equal(WALL_STYLES[0].value, 'plain');
  assert.equal(new Set(WALL_STYLES.map(style => style.value)).size, WALL_STYLES.length, 'no type is listed twice');
  for (const style of WALL_STYLES) {
    assert.ok(style.label && style.thickness > 0 && /^#[0-9a-f]{6}$/.test(style.color), style.value);
    assert.ok(isWallStyle(style.value));
    assert.equal(wallStyleInfo(style.value), style);
  }
  assert.equal(isWallStyle('castle'), false);
  assert.equal(wallStyleInfo(undefined).value, 'plain', 'walls without a type are plain walls');
});

test('stone walls, hedges, bamboo fences and fences are the free shapes of the same size', () => {
  for (const style of WALL_STYLES.filter(item => item.freeKind)) {
    assert.equal(style.thickness, freeLineWidth(style.freeKind), `${style.value}: width`);
    assert.equal(style.height, FURNITURE_DEFS[style.freeKind].height, `${style.value}: height`);
    assert.equal(style.label, FURNITURE_DEFS[style.freeKind].label, `${style.value}: name`);
  }
});

test('the top view width includes the tile cap, and joints sit inside the wall', () => {
  const earthen = wallStyleInfo('earthen');
  assert.equal(wallTopWidth(earthen), earthen.thickness + CAP_OVERHANG * 2);
  assert.equal(wallTopWidth(wallStyleInfo('brick')), wallStyleInfo('brick').thickness);
  const joints = wallJoints(wallStyleInfo('block'), 200);
  assert.deepEqual(joints, [40, 80, 120, 160]);
  assert.deepEqual(wallJoints(wallStyleInfo('concrete'), 200), [], 'smooth walls have no joints');
});
