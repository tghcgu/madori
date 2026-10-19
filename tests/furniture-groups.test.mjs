import assert from 'node:assert/strict';
import test from 'node:test';
import { FURNITURE_DEFS, FURNITURE_GROUPS, PALETTE_ORDER } from '../src/furniture-catalog.ts';
import { isDoorStyle } from '../src/opening-shapes.ts';

const STAIRS = ['stairs', 'stairsU', 'stairsSpiral'];
const group = id => FURNITURE_GROUPS.find(item => item.id === id);

test('every kind of furniture has exactly one home group, and groups may also show others', () => {
  const kinds = Object.keys(FURNITURE_DEFS).filter(kind => kind !== 'paint' && !STAIRS.includes(kind));
  const homes = FURNITURE_GROUPS.flatMap(group => group.kinds);
  assert.deepEqual([...homes].sort(), [...kinds].sort(), 'each kind is in exactly one group');
  assert.equal(new Set(FURNITURE_GROUPS.map(group => group.label)).size, FURNITURE_GROUPS.length);
  assert.equal(new Set(FURNITURE_GROUPS.map(group => group.id)).size, FURNITURE_GROUPS.length);
  for (const group of FURNITURE_GROUPS) {
    assert.ok(group.kinds.length > 0, group.label);
    const shown = [...group.kinds, ...(group.also ?? [])];
    assert.equal(new Set(shown).size, shown.length, `${group.label}: nothing is listed twice`);
    for (const kind of group.also ?? []) assert.ok(FURNITURE_DEFS[kind], `${group.label}: ${kind} is a kind`);
    for (const style of group.doorStyles ?? []) assert.ok(isDoorStyle(style), `${group.label}: ${style}`);
  }
});

test('the palette is ordered by use: household furniture first, Japanese and themed groups lower down', () => {
  const sections = ['fittings', 'stairs', 'trace', 'surfaces', 'roofs', 'shapes'];
  assert.deepEqual([...PALETTE_ORDER].sort(), [...FURNITURE_GROUPS.map(group => group.id), ...sections].sort(), 'every group and section appears once');
  // 「種類」の選択欄（FURNITURE_GROUPS の並び）も、一覧と同じ順
  assert.deepEqual(FURNITURE_GROUPS.map(group => group.id), PALETTE_ORDER.filter(id => !sections.includes(id)));
  const at = id => PALETTE_ORDER.indexOf(id);
  assert.equal(at('fittings'), 0, 'doors and windows come first');
  assert.equal(at('seating'), 1);
  for (const id of ['tables', 'beds', 'storage', 'kitchen', 'bath', 'appliances', 'decor', 'outdoor']) assert.ok(at(id) < at('japanese'), `${id} comes before the Japanese group`);
  for (const id of ['shrine', 'play', 'fantasy']) assert.ok(at('japanese') < at(id), `${id} comes after the Japanese group`);
  assert.equal(PALETTE_ORDER.at(-1), 'shapes', 'shape walls come last');
});

test('the Japanese group gathers Japanese things, including doors and garden pieces from other groups', () => {
  const japanese = group('japanese');
  assert.match(japanese.label, /和風/);
  for (const kind of ['zabuton', 'tatami', 'zaisu', 'kotatsu', 'futon', 'stoneLantern']) assert.ok([...japanese.kinds, ...japanese.also].includes(kind), kind);
  for (const style of ['shoji', 'fusuma', 'koshi', 'itado', 'gate']) assert.ok(japanese.doorStyles.includes(style), style);
});

test('things used in several places are also shown in each of those groups', () => {
  const shows = (id, kind) => [...group(id).kinds, ...(group(id).also ?? [])].includes(kind);
  for (const [kind, ids] of Object.entries({
    chochin: ['japanese', 'decor', 'shop', 'shrine'],
    torii: ['shrine', 'japanese', 'outdoor'],
    barStool: ['seating', 'kitchen', 'shop'],
    car: ['vehicles', 'outdoor', 'street'],
    vendingMachine: ['shop', 'appliances', 'street'],
    hospitalBed: ['hospital', 'beds'],
    schoolDesk: ['school', 'tables'],
    curtain: ['decor', 'hospital'],
    kamado: ['japanese', 'kitchen'],
  })) for (const id of ids) assert.ok(shows(id, kind), `${kind} is in ${id}`);
});
