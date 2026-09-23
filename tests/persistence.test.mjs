import test from 'node:test';
import assert from 'node:assert/strict';
import { readStoredPlan } from '../src/persistence.ts';

const key = 'plan';
function storage(raw, full = false) {
  const entries = new Map(raw === null ? [] : [[key, raw]]);
  return {
    entries,
    getItem: name => entries.get(name) ?? null,
    get length() { return entries.size; },
    key: index => [...entries.keys()][index] ?? null,
    setItem(name, value) {
      if (full) throw new Error('QuotaExceededError');
      entries.set(name, value);
    },
  };
}
function normalize(data, recover = false) {
  if (!Array.isArray(data.entities)) return null;
  if (!recover && data.entities.some(item => item.invalid)) throw new Error('Unknown item');
  return { entities: data.entities.filter(item => !item.invalid) };
}

test('valid and missing autosaves need no recovery', () => {
  assert.deepEqual(readStoredPlan(storage(null), key, normalize), { plan: null, recovery: null });
  const source = storage('{"entities":[{"id":"room"}]}');
  assert.deepEqual(readStoredPlan(source, key, normalize), { plan: { entities: [{ id: 'room' }] }, recovery: null });
  assert.equal(source.entries.size, 1);
});

test('partial recovery preserves original bytes and salvages valid entities', () => {
  const raw = '{ "entities": [{"id":"room"}, {"invalid":true}] }';
  const source = storage(raw);
  const result = readStoredPlan(source, key, normalize);
  assert.deepEqual(result, { plan: { entities: [{ id: 'room' }] }, recovery: { raw, backupSaved: true } });
  assert.equal(source.getItem(key), raw);
  assert.equal(source.entries.size, 2);
  assert.deepEqual([...source.entries.values()], [raw, raw]);
});

test('malformed JSON and invalid top-level data remain downloadable', () => {
  for (const raw of ['{ broken', '{"wrong":true}']) {
    const source = storage(raw);
    assert.deepEqual(readStoredPlan(source, key, normalize), { plan: null, recovery: { raw, backupSaved: true } });
    assert.equal(source.getItem(key), raw);
  }
});

test('failed backups flag that the primary autosave must not be overwritten', () => {
  const raw = '{"entities":[{"id":"room"},{"invalid":true}]}';
  const source = storage(raw, true);
  const result = readStoredPlan(source, key, normalize);
  assert.equal(result.recovery.backupSaved, false);
  assert.equal(result.recovery.raw, raw);
  assert.equal(source.getItem(key), raw);
  assert.equal(source.entries.size, 1);
});

test('reopening the same broken autosave does not pile up backups', () => {
  const raw = '{ broken';
  const source = storage(raw);
  for (let i = 0; i < 3; i += 1) {
    assert.deepEqual(readStoredPlan(source, key, normalize), { plan: null, recovery: { raw, backupSaved: true } });
  }
  assert.equal(source.entries.size, 2);
});
