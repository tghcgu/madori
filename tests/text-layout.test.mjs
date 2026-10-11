import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutText } from '../src/text-layout.ts';
const measure = text => Array.from(text).length * 20;
test('horizontal labels retain centered multiline layout and line spacing', () => {
  const result = layoutText('玄関\nホール', 20, 'horizontal', measure);
  assert.equal(result.w, 60); assert.equal(result.h, 50);
  assert.deepEqual(result.runs.map(r => [r.x, r.y]), [[30, 12.5], [30, 37.5]]);
});
test('vertical labels flow down then right to left, without breaking graphemes', () => {
  const result = layoutText('和室\nか\u3099族', 20, 'vertical', measure);
  assert.equal(result.w, 50); assert.equal(result.h, 40);
  assert.deepEqual(result.runs.map(r => r.text), ['和', '室', 'か\u3099', '族']);
  assert.ok(result.runs[0].x > result.runs[2].x);
  assert.ok(result.runs[0].y < result.runs[1].y);
});
test('vertical punctuation, empty lines, long marks and newlines have stable geometry', () => {
  const result = layoutText('「ホール」\r\n\r\n。', 20, 'vertical', measure);
  assert.equal(result.w, 75); assert.equal(result.h, 100);
  assert.ok(result.runs.filter(r => r.rotate).length >= 3);
  assert.ok(layoutText('', 20, 'vertical', measure).h > 0);
});
