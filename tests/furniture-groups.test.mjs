import assert from 'node:assert/strict';
import test from 'node:test';
import { FURNITURE_DEFS, FURNITURE_GROUPS } from '../src/furniture-catalog.ts';
import { isDoorStyle } from '../src/opening-shapes.ts';

const STAIRS = ['stairs', 'stairsU', 'stairsSpiral'];

test('every kind of furniture has exactly one home group, and groups may also show others', () => {
  const kinds = Object.keys(FURNITURE_DEFS).filter(kind => kind !== 'paint' && !STAIRS.includes(kind));
  const homes = FURNITURE_GROUPS.flatMap(group => group.kinds);
  assert.deepEqual([...homes].sort(), [...kinds].sort(), 'each kind is in exactly one group');
  assert.equal(new Set(FURNITURE_GROUPS.map(group => group.label)).size, FURNITURE_GROUPS.length);
  for (const group of FURNITURE_GROUPS) {
    assert.ok(group.kinds.length > 0, group.label);
    for (const kind of group.also ?? []) {
      assert.ok(FURNITURE_DEFS[kind], `${group.label}: ${kind} is a kind`);
      assert.ok(!group.kinds.includes(kind), `${group.label}: ${kind} is not listed twice`);
    }
    for (const style of group.doorStyles ?? []) assert.ok(isDoorStyle(style), `${group.label}: ${style}`);
  }
});

test('the Japanese group gathers Japanese things, including doors and garden pieces from other groups', () => {
  const japanese = FURNITURE_GROUPS[0];
  assert.match(japanese.label, /和風/);
  for (const kind of ['zabuton', 'tatami', 'zaisu', 'kotatsu', 'futon', 'stoneLantern']) assert.ok([...japanese.kinds, ...japanese.also].includes(kind), kind);
  for (const style of ['shoji', 'fusuma', 'koshi', 'itado', 'gate']) assert.ok(japanese.doorStyles.includes(style), style);
});
