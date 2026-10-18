import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POST_FRAGMENT_SHADER, REAL_MATERIAL_IDS, THREE_STYLES, THREE_STYLE_GROUPS,
  isPostStyle, isThreeStyle, postStyleId, realColorCode, realMaterialKind, realSurfaceCode,
} from '../src/three-style.ts';

test('3D looks have unique values, Japanese labels and groups', () => {
  const values = THREE_STYLES.map(style => style.value);
  assert.equal(new Set(values).size, values.length);
  assert.equal(values[0], 'standard', 'standard comes first');
  assert.ok(values.includes('real'), 'there is a realistic look');
  for (const style of THREE_STYLES) {
    assert.ok(isThreeStyle(style.value));
    assert.match(style.label, /[ぁ-んァ-ヶ一-龠]/, `${style.value} has a Japanese label`);
    assert.ok(THREE_STYLE_GROUPS.includes(style.group));
  }
  assert.equal(isThreeStyle('nope'), false);
});

test('every post-processed look has its own branch in the shader', () => {
  assert.equal(isPostStyle('standard'), false);
  assert.equal(isPostStyle('real'), false);
  for (const style of THREE_STYLES.filter(item => isPostStyle(item.value))) {
    assert.ok(POST_FRAGMENT_SHADER.includes(`styleId == ${postStyleId(style.value)})`), `${style.value} is drawn by the shader`);
  }
});

test('realistic materials are sorted by name into wood, fabric, metal and so on', () => {
  const kind = (name, options = {}) => realMaterialKind(name, options.color ?? 0x888888, options.roughness ?? 0.7, options.metalness ?? 0, options.transparent ?? false);
  assert.equal(kind('wood'), 'wood');
  assert.equal(kind('part-wood'), 'wood');
  assert.equal(kind('crib-wood'), 'wood');
  assert.equal(kind('surface-herringbone'), 'wood');
  assert.equal(kind('upholstery'), 'fabric');
  assert.equal(kind('cushion'), 'fabric');
  assert.equal(kind('surface-tatami'), 'fabric');
  assert.equal(kind('brushed-metal'), 'metal');
  assert.equal(kind('brass'), 'metal');
  assert.equal(kind('grave-granite'), 'stone');
  assert.equal(kind('roof-tile'), 'stone');
  assert.equal(kind('concrete-slab'), 'stone');
  assert.equal(kind('surface-marble'), 'ceramic', 'polished marble shines');
  assert.equal(kind('ceramic'), 'ceramic');
  assert.equal(kind('piano-lacquer'), 'lacquer');
  assert.equal(kind('car-paint'), 'lacquer');
  assert.equal(kind('foliage'), 'plant');
  assert.equal(kind('grass-blades'), 'plant', 'grass is not glass');
  assert.equal(kind('table-glass', { transparent: true }), 'glass');
  assert.equal(kind('water-surface', { transparent: true }), 'water');
  assert.equal(kind('plaster-wall'), 'plaster');
  assert.equal(kind('shoji-paper'), 'paper');
  assert.equal(kind('soil'), 'soil');
  // 名前で分からない物は、光り方と色から
  assert.equal(kind('mystery', { metalness: 0.8 }), 'metal');
  assert.equal(kind('mystery', { roughness: 0.2 }), 'ceramic');
  assert.equal(kind('mystery', { color: 0x8a5a33 }), 'wood');
  assert.equal(kind('mystery', { color: 0x4477aa }), 'plastic');
});

test('every realistic material kind has balanced shader code', () => {
  for (const kind of Object.keys(REAL_MATERIAL_IDS)) {
    for (const code of [realColorCode(kind), realSurfaceCode(kind)]) {
      assert.equal((code.match(/\{/g) ?? []).length, (code.match(/\}/g) ?? []).length, `${kind}: braces`);
      assert.equal((code.match(/\(/g) ?? []).length, (code.match(/\)/g) ?? []).length, `${kind}: parentheses`);
    }
  }
});
