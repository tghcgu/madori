import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CHANGELOG, changelogDate } from '../src/changelog.ts';

test('the changelog is newest first, with a date and at least one change per entry', () => {
  assert.ok(CHANGELOG.length > 0);
  for (let i = 0; i < CHANGELOG.length; i += 1) {
    assert.match(CHANGELOG[i].date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(CHANGELOG[i].items.length > 0 && CHANGELOG[i].items.every(item => item.ja && item.en));
    if (i) assert.ok(CHANGELOG[i - 1].date > CHANGELOG[i].date, `${CHANGELOG[i - 1].date} comes before ${CHANGELOG[i].date}`);
  }
  assert.equal(changelogDate('2026-10-04'), '2026年10月4日');
});

test('the README has the same changelog as the app, in Japanese and English', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const entry of CHANGELOG) {
    assert.ok(readme.includes(`### ${changelogDate(entry.date)}`), `README: ${entry.date}`);
    assert.ok(readme.includes(`### ${entry.date}`), `README (English): ${entry.date}`);
    for (const item of entry.items) {
      assert.ok(readme.includes(`- ${item.ja}`), `README: ${item.ja}`);
      assert.ok(readme.includes(`- ${item.en}`), `README (English): ${item.en}`);
    }
  }
});
