import assert from 'node:assert/strict';
import test from 'node:test';
import { colorAlpha, parseColorCode, solidColor, withAlpha } from '../src/colors.ts';

test('color codes accept 3, 4, 6 and 8 digits, with or without #', () => {
  assert.deepEqual(parseColorCode('#2775D1'), { code: '#2775d1', rgb: '#2775d1', alpha: 1 });
  assert.deepEqual(parseColorCode('2775d1'), { code: '#2775d1', rgb: '#2775d1', alpha: 1 });
  assert.deepEqual(parseColorCode('#f00'), { code: '#ff0000', rgb: '#ff0000', alpha: 1 });
  assert.deepEqual(parseColorCode(' #f008 '), { code: '#ff000088', rgb: '#ff0000', alpha: 0x88 / 255 });
  assert.deepEqual(parseColorCode('#2775d160'), { code: '#2775d160', rgb: '#2775d1', alpha: 0x60 / 255 });
  assert.equal(parseColorCode('#000000ff').code, '#000000', 'a fully opaque alpha is dropped');
  assert.equal(parseColorCode('#00000000').alpha, 0);
});

test('invalid color codes are rejected', () => {
  for (const value of ['', '#', '#12', '#12345', '#1234567', '#123456789', '#ggg', 'red', 'rgb(0,0,0)', null, undefined, 123]) {
    assert.equal(parseColorCode(value), null, String(value));
  }
});

test('withAlpha writes the opacity as the last two digits', () => {
  assert.equal(withAlpha('#2775d1', 1), '#2775d1');
  assert.equal(withAlpha('#2775d1', 0.6), '#2775d199');
  assert.equal(withAlpha('#2775d1aa', 0), '#2775d100');
  assert.equal(withAlpha('#abc', 2), '#aabbcc', 'opacity is clamped');
  assert.equal(withAlpha('not a color', 0.5), '#00000080');
  for (let value = 0; value <= 255; value += 17) {
    const code = withAlpha('#123456', value / 255);
    assert.equal(Math.round(parseColorCode(code).alpha * 255), value, code);
  }
});

test('solidColor drops the alpha digits and colorAlpha reads them', () => {
  assert.equal(solidColor('#2775d180'), '#2775d1');
  assert.equal(solidColor('#ABC'), '#aabbcc');
  assert.equal(solidColor(undefined), undefined);
  assert.equal(solidColor('rgba(0,0,0,0.5)'), 'rgba(0,0,0,0.5)', 'anything else is passed through');
  assert.equal(colorAlpha('#2775d180'), 0x80 / 255);
  assert.equal(colorAlpha('#2775d1'), 1);
  assert.equal(colorAlpha(undefined), 1);
  assert.equal(colorAlpha('#0000'), 0);
});
