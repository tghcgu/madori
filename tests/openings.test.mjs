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
