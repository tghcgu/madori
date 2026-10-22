import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildOpeningModel } from '../src/opening-models.ts';

const bounds = object => new THREE.Box3().setFromObject(object, true);
function dispose(group) {
  const materials = new Set();
  group.traverse(object => { object.geometry?.dispose(); if (object.material) materials.add(object.material); });
  materials.forEach(material => material.dispose());
}

for (const options of [{ type: 'door' }, { type: 'door', doorStyle: 'sliding' }, { type: 'window' }, { type: 'window', mullion: true }]) {
  test(`${options.type} ${options.doorStyle ?? options.mullion ?? ''}: valid frames and panes at small and large widths`, () => {
    for (const length of [0.2, 0.9, 1.6, 4]) {
      const group = buildOpeningModel({ ...options, length });
      try {
        const box = bounds(group);
        assert.ok(box.min.y >= 0.08-1e-6);
        assert.ok(box.max.y <= (options.type === 'door' ? 2.1 : 1.96)+1e-6);
        assert.ok(box.max.x - box.min.x <= length + 0.12);
        group.traverse(object => {
          if (!object.geometry) return;
          assert.ok(object.geometry.getAttribute('position').array.every(Number.isFinite));
          const size = bounds(object).getSize(new THREE.Vector3());
          assert.ok(size.x > 0 && size.y > 0 && size.z > 0);
        });
      } finally { dispose(group); }
    }
  });
}

test('swing doors remain closed and clear the floor slab on either floor', () => {
  for (const floorTop of [0, 0.08]) {
    const group = buildOpeningModel({ type: 'door', length: 0.9, floorTop });
    const panel = group.children.find(part => part.name === 'door-panel');
    assert.equal(panel.rotation.y, 0);
    assert.ok(bounds(panel).min.y > floorTop);
    assert.equal(group.children.filter(part => part.name === 'handle-lever').length, 2);
    assert.equal(group.children.filter(part => part.name === 'hinge').length, 3);
    dispose(group);
  }
});

test('sliding door panels overlap horizontally but use separate depth tracks, including flipped doors', () => {
  for (const flip of [false, true]) {
    const group = buildOpeningModel({ type: 'door', doorStyle: 'sliding', length: 1.6, flip });
    const panels = group.children.filter(part => part.name === 'sliding-panel');
    const [a, b] = panels.map(bounds);
    assert.ok(a.max.x > b.min.x);
    assert.ok(a.max.z < b.min.z || b.max.z < a.min.z);
    assert.equal(Math.sign(panels[0].position.z), flip ? 1 : -1);
    dispose(group);
  }
});

test('window colors affect frames without tinting the glass or hardware', () => {
  const group = buildOpeningModel({ type: 'window', length: 1.6, mullion: true, color3d: '#cc4455' });
  assert.equal(group.children.filter(part => part.name === 'glass').length, 2);
  for (const part of group.children) {
    if (part.material.name === 'frame') assert.equal(part.material.color.getHexString(), 'cc4455');
    else assert.notEqual(part.material.color.getHexString(), 'cc4455');
    if (part.name === 'glass') {
      assert.equal(part.material.transparent, true);
      assert.equal(part.material.depthWrite, false);
    }
  }
  dispose(group);
});

test('doors and windows with a color code alpha become translucent, opaque codes stay solid', () => {
  for (const options of [{ type: 'door' }, { type: 'door', doorStyle: 'sliding' }, { type: 'window' }]) {
    const solid = buildOpeningModel({ ...options, length: 0.9, color3d: '#335577' });
    const seeThrough = buildOpeningModel({ ...options, length: 0.9, color3d: '#33557740' });
    try {
      const materials = group => { const found = new Map(); group.traverse(object => { if (object.isMesh) found.set(object.material.name, object.material); }); return found; };
      const before = materials(solid), after = materials(seeThrough);
      assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
      for (const [name, material] of after) {
        assert.equal(material.color.getHexString(), before.get(name).color.getHexString(), `${name} keeps its color`);
        assert.equal(material.transparent, true, `${name} is transparent`);
        assert.ok(Math.abs(material.opacity - before.get(name).opacity * 0x40 / 255) < 1e-6, `${name} opacity`);
      }
      for (const [name, material] of before) if (name !== 'glass') assert.equal(material.transparent, false, `${name} stays solid without an alpha`);
    } finally { dispose(solid); dispose(seeThrough); }
  }
});

// ---- 両開きドア・門扉と、和風の引き戸（障子・襖・格子戸・板戸） ----
import { BROKEN_CUT_MARGIN, DOOR_STYLES, brokenCutRange, brokenHoleEdges, brokenRubble, brokenTopAt, brokenWallOutline, doorStyleInfo, isBrokenStyle, isDoorStyle, panelBars, slidingPanels } from '../src/opening-shapes.ts';
import { solidWallSections } from '../src/geometry.ts';

test('every door style builds a closed door that stays inside the opening, at small and large widths', () => {
  for (const { value } of DOOR_STYLES) {
    // 壊れた壁は、下の別のテスト
    if (isBrokenStyle(value)) continue;
    for (const length of [0.3, 0.9, 1.8, 3.6]) {
      for (const flip of [false, true]) {
        const group = buildOpeningModel({ type: 'door', doorStyle: value, length, flip });
        try {
          const box = bounds(group);
          assert.ok(box.min.y >= 0.08 - 1e-6 && box.max.y <= 2.1 + 1e-6, `${value} ${length}: height`);
          assert.ok(box.max.x - box.min.x <= length + 0.1, `${value} ${length}: width`);
          assert.ok(box.max.z - box.min.z <= 0.2, `${value} ${length}: depth`);
          group.traverse(object => {
            if (!object.geometry) return;
            assert.ok(object.geometry.getAttribute('position').array.every(Number.isFinite), `${value}: finite`);
          });
        } finally { dispose(group); }
      }
    }
  }
});

test('Japanese sliding doors stand on separate tracks in the same order as the 2D symbol, with four panels for wide shoji and fusuma', () => {
  // 板の真ん中にある部品（障子・格子戸は腰板、襖・板戸は板そのもの）で、板の位置とレールを調べる
  const names = { shoji: 'shoji-knee', fusuma: 'fusuma-panel', koshi: 'koshi-knee', itado: 'itado-panel' };
  for (const [style, name] of Object.entries(names)) {
    for (const flip of [false, true]) {
      for (const length of [1.6, 3.6]) {
        const group = buildOpeningModel({ type: 'door', doorStyle: style, length, flip });
        const panels = slidingPanels(style, length * 100);
        assert.equal(panels.length, length >= 2.4 && (style === 'shoji' || style === 'fusuma') ? 4 : 2);
        // 板ごとに、レールの側（z の符号）が2Dの並びと同じ
        const parts = group.children.filter(part => part.name === name);
        for (const panel of panels) {
          const near = parts.filter(part => Math.abs(part.position.x / (length - Math.min(length * 0.09, 0.045)) - panel.center) < 0.01);
          assert.equal(near.length, 1, `${style}: one panel at ${panel.center}`);
          for (const part of near) assert.equal(Math.sign(part.position.z), panel.track * (flip ? -1 : 1), `${style}: track of the panel at ${panel.center}`);
        }
        dispose(group);
      }
    }
  }
});

test('sliding panels cover the whole opening and overlap a little; bars stay inside their panel', () => {
  for (const style of ['shoji', 'fusuma', 'koshi', 'itado']) {
    for (const length of [60, 160, 240, 400]) {
      const panels = slidingPanels(style, length);
      assert.ok(Math.abs(panels[0].center - panels[0].width / 2 + 0.5) < 0.03, 'starts at the jamb');
      assert.ok(Math.abs(panels.at(-1).center + panels.at(-1).width / 2 - 0.5) < 0.03, 'ends at the other jamb');
      for (let i = 1; i < panels.length; i += 1) assert.ok(panels[i - 1].center + panels[i - 1].width / 2 > panels[i].center - panels[i].width / 2, 'neighbors overlap');
      // 2枚は奥と手前、4枚は外の2枚が奥で中の2枚が手前（引き違いの4枚建て）
      assert.deepEqual(panels.map(panel => panel.track), panels.length === 4 ? [-1, 1, 1, -1] : [-1, 1]);
      for (const bar of panelBars(style, length / panels.length)) assert.ok(bar > -0.5 && bar < 0.5);
    }
  }
  assert.ok(panelBars('koshi', 80).length > panelBars('shoji', 80).length, 'the lattice door has more bars than shoji');
  assert.deepEqual(panelBars('fusuma', 80), []);
});

test('door style names: every style has a label and keywords, and unknown styles are plain doors', () => {
  assert.deepEqual(DOOR_STYLES.map(style => style.value), ['swing', 'double', 'sliding', 'shoji', 'fusuma', 'koshi', 'itado', 'gate', 'opening', 'hole', 'broken']);
  for (const style of DOOR_STYLES) assert.ok(style.label && style.keywords, style.value);
  assert.equal(isDoorStyle('shoji'), true);
  assert.equal(isDoorStyle('hidden'), false);
  assert.equal(doorStyleInfo(undefined).value, 'swing');
  assert.deepEqual(DOOR_STYLES.filter(style => style.japanese).map(style => style.value), ['shoji', 'fusuma', 'koshi', 'itado', 'gate']);
});

// ---- 壊れた壁（壁の大穴・崩れ落ちた壁） ----
test('broken walls fill the cut with a jagged rim, and drop rubble at the same places as the 2D symbol', () => {
  for (const style of ['hole', 'broken']) {
    for (const length of [0.6, 1.1, 2, 4]) {
      // ふつうの壁・ブロック塀（低い）・土塀（厚い）
      for (const [thickness, wallTop] of [[10, 2.6], [15, 1.4], [30, 2]]) {
        const group = buildOpeningModel({ type: 'door', doorStyle: style, length, wallThickness: thickness, wallTop, wallColor: '#a5523a', floorTop: 0.08, wallKind: 'box' });
        try {
          const half = length / 2 + BROKEN_CUT_MARGIN / 200;
          const remain = group.children.find(part => part.name === 'broken-wall');
          const box = bounds(remain);
          const [cutBottom, cutTop] = brokenCutRange(style, wallTop * 100);
          assert.ok(box.min.x >= -half - 1e-6 && box.max.x <= half + 1e-6, `${style} ${length}: the rim stays in the cut`);
          assert.ok(box.min.y >= cutBottom - 1e-6 && box.max.y <= Math.min(wallTop, cutTop) + 1e-6, `${style} ${length} ${wallTop}: height ${box.min.y}..${box.max.y}`);
          assert.ok(Math.abs(box.max.z - box.min.z - thickness / 100) < 1e-6, `${style}: as thick as the wall`);
          assert.equal(remain.material.color.getHexString(), 'a5523a', 'the rim has the color of its wall');
          assert.ok(remain.geometry.getAttribute('position').array.every(Number.isFinite));
          // かけら: 床の上にあり、2Dの並びと同じ所
          const rubble = group.children.filter(part => part.name === 'rubble');
          const pieces = brokenRubble(style, length * 100, thickness);
          assert.equal(rubble.length, pieces.length);
          rubble.forEach((mesh, index) => {
            assert.ok(Math.abs(mesh.position.x - pieces[index].x / 100) < 1e-9 && Math.abs(mesh.position.z - pieces[index].y / 100) < 1e-9, 'rubble matches 2D');
            assert.ok(Math.abs(bounds(mesh).min.y - 0.08) < 0.03, 'rubble lies on the floor');
            assert.ok(Math.abs(pieces[index].y) >= thickness / 2, 'rubble is beside the wall');
          });
        } finally { dispose(group); }
      }
    }
    // ガラスの壁は透けるガラスで埋め、かけらも薄いガラス。石垣・生け垣などは、残る所を壁の側で作るので、かけらだけ
    const glass = buildOpeningModel({ type: 'door', doorStyle: style, length: 1.2, wallThickness: 4, wallTop: 2.6, wallColor: '#bfe0ee', wallKind: 'glass' });
    const pane = glass.children.find(part => part.name === 'broken-wall');
    assert.ok(pane.material.transparent && pane.material.opacity < 0.5, `${style}: a glass wall breaks as glass`);
    assert.ok(glass.children.filter(part => part.name === 'rubble').every(part => part.material.transparent), 'glass shards');
    dispose(glass);
    const hedge = buildOpeningModel({ type: 'door', doorStyle: style, length: 1.2, wallThickness: 60, wallTop: 1.2, wallColor: '#4f7f3a', wallKind: 'free' });
    assert.equal(hedge.children.filter(part => part.name === 'broken-wall').length, 0, `${style}: free-shape walls are cut on the wall side`);
    assert.ok(hedge.children.some(part => part.name === 'rubble'));
    dispose(hedge);
  }
  // 大穴は床から2mまで切り、上に壁が残る。崩れ落ちた壁は下に低い壁が残る（低い壁は、高さの半分ほどまで崩れる）
  assert.deepEqual(brokenCutRange('hole', 260), [0, 2]);
  assert.deepEqual(brokenCutRange('broken', 260), [0.6, Infinity]);
  assert.ok(brokenCutRange('broken', 100)[0] <= 0.45 + 1e-9, 'a low stone wall still collapses visibly');
  const hole = solidWallSections(300, [{ from: 100, to: 210, kind: 'door', range: brokenCutRange('hole', 260) }], 2.6, 2.1, 0.84, 1.96);
  assert.deepEqual(hole.filter(section => section.from === 100).map(section => [section.bottom, section.top]), [[2, 2.6]]);
  const broken = solidWallSections(300, [{ from: 100, to: 210, kind: 'door', range: brokenCutRange('broken', 260) }], 2.6, 2.1, 0.84, 1.96);
  assert.deepEqual(broken.filter(section => section.from === 100).map(section => [section.bottom, section.top]), [[0, 0.6]]);
  // 崩れたふちの高さ: 両端は壁の高さ、真ん中は低い。石垣などを段々に作るときにも使う
  for (const wallTop of [100, 120, 260]) {
    const low = brokenCutRange('broken', wallTop)[0] * 100;
    const middle = brokenTopAt(200, wallTop, 0), end = brokenTopAt(200, wallTop, 105);
    assert.ok(middle > low && middle < wallTop * 0.8, `${wallTop}: the middle is low (${middle})`);
    assert.ok(Math.abs(end - wallTop) < 1e-6, `${wallTop}: the ends keep the wall height (${end})`);
  }
  // 2Dで描く穴のふち（1mの高さ。低い壁は半分の高さ）は、開口の中にあり、左が負・右が正
  for (const [length, wallTop] of [[60, 260], [110, 260], [300, 260], [110, 140]]) {
    const [left, right] = brokenHoleEdges(length, wallTop);
    assert.ok(left < 0 && right > 0 && -left < length / 2 + 5 && right < length / 2 + 5, `${length}: ${left}, ${right}`);
    const outline = brokenWallOutline('hole', length, wallTop);
    assert.ok(outline.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  }
});
