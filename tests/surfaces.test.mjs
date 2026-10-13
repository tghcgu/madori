import assert from 'node:assert/strict';
import test from 'node:test';
import { SURFACE_DEFS, SURFACE_TILE_CM, isRoomSurface, surfaceTileCm } from '../src/surfaces.ts';

test('every floor material has a name, a base color, a finish and a tile size', () => {
  const surfaces = Object.keys(SURFACE_DEFS);
  assert.ok(surfaces.length >= 20);
  for (const surface of surfaces) {
    const def = SURFACE_DEFS[surface];
    assert.ok(def.label.length > 0, surface);
    assert.match(def.color, /^#[0-9a-f]{6}$/, surface);
    assert.ok(def.roughness >= 0 && def.roughness <= 1, surface);
    assert.ok(surfaceTileCm(surface) > 0, surface);
    assert.ok(isRoomSurface(surface));
  }
  assert.equal(new Set(surfaces.map(surface => SURFACE_DEFS[surface].label)).size, surfaces.length, 'labels are unique');
});

test('floor materials keep the old names and add tatami, stone paving and outdoor ground', () => {
  for (const surface of ['plain', 'wood', 'tile', 'stone', 'grass', 'tatami', 'carpet', 'marble', 'brick', 'concrete', 'asphalt', 'gravel', 'sand', 'soil', 'snow', 'water']) {
    assert.ok(isRoomSurface(surface), surface);
  }
  assert.equal(isRoomSurface('lava'), false);
  assert.equal(isRoomSurface('constructor'), false);
  // 畳は180×90cmの畳を並べた模様。1枚の模様に縦横ちょうど畳の並びが入る
  assert.equal(surfaceTileCm('tatami') % 180, 0);
  assert.equal(surfaceTileCm('plain'), SURFACE_TILE_CM);
});
