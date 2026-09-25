import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FURNITURE_DEFS } from '../src/furniture-catalog.ts';
import { buildFurnitureModel } from '../src/furniture-models.ts';

function dispose(group) {
  const materials = new Set();
  group.traverse(object => {
    object.geometry?.dispose();
    if (object.material) materials.add(object.material);
  });
  materials.forEach(material => material.dispose());
}

for (const [kind, defaults] of Object.entries(FURNITURE_DEFS)) {
  test(`${kind}: default, minimum, wide and deep models stay inside their footprint`, () => {
    for (const [w, h] of [[defaults.w, defaults.h], [20, 20], [defaults.w * 2, defaults.h * 0.5], [defaults.w * 0.5, defaults.h * 2]]) {
      const group = buildFurnitureModel({ kind, w, h });
      try {
        const box = new THREE.Box3().setFromObject(group, true);
        const size = box.getSize(new THREE.Vector3());
        assert.ok(Math.abs(size.x - w / 100) < 1e-5, `${kind} width ${size.x}`);
        assert.ok(Math.abs(size.z - h / 100) < 1e-5, `${kind} depth ${size.z}`);
        assert.ok(Number.isFinite(size.y) && size.y > 0);
        assert.ok(box.min.y >= -1e-5, `${kind} below floor`);
        assert.ok(Math.abs(box.min.x + box.max.x) < 1e-5);
        assert.ok(Math.abs(box.min.z + box.max.z) < 1e-5);
        assert.ok(group.children.length <= 24, `${kind} draw calls ${group.children.length}`);
        let triangles = 0;
        group.traverse(object => {
          if (!object.geometry) return;
          triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
          for (const attribute of ['position', 'normal']) {
            assert.ok(object.geometry.getAttribute(attribute).array.every(Number.isFinite), `${kind} invalid ${attribute}`);
          }
        });
        assert.ok(triangles < 42000, `${kind} triangle budget ${triangles}`);
      } finally { dispose(group); }
    }
  });
}

test('chairs, including all four dining chairs, have separate legs', () => {
  for (const [kind, count] of [['chair', 4], ['diningTable', 20]]) {
    const group = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind] }, false);
    assert.equal(group.children.filter(part => part.name === 'leg').length, count);
    dispose(group);
  }
});

test('custom colors preserve glass, clock faces, metal, leaves and screen materials', () => {
  for (const kind of Object.keys(FURNITURE_DEFS)) {
    const normal = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind] });
    const tinted = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind], color3d: '#cc4455' });
    const materials = new Map(normal.children.map(mesh => [mesh.material.name, mesh.material.color.getHexString()]));
    for (const mesh of tinted.children) {
      assert.equal(mesh.material.color.getHexString(), mesh.material.userData.tintable ? 'cc4455' : materials.get(mesh.material.name), `${kind}: ${mesh.material.name}`);
    }
    dispose(normal); dispose(tinted);
  }
});

test('TV screens keep a 16:9 ratio as width changes', () => {
  for (const w of [40, 120, 300, 500]) {
    const group = buildFurnitureModel({ kind: 'tv', w, h: 40 });
    const screen = group.children.find(mesh => mesh.material.name === 'screen');
    group.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(screen).getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x / size.y - 16 / 9) < 0.001);
    dispose(group);
  }
});

test('merging parts keeps the same model geometry bounds', () => {
  for (const kind of Object.keys(FURNITURE_DEFS)) {
    const raw = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind] }, false);
    const merged = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind] });
    const a = new THREE.Box3().setFromObject(raw, true), b = new THREE.Box3().setFromObject(merged, true);
    assert.ok(a.min.distanceTo(b.min) < 1e-5 && a.max.distanceTo(b.max) < 1e-5, kind);
    dispose(raw); dispose(merged);
  }
});

test('invalid dimensions fail instead of producing corrupt geometry', () => {
  for (const w of [0, -20, NaN, Infinity]) assert.throws(() => buildFurnitureModel({ kind: 'chair', w, h: 40 }));
});

test('trees, rocks, fences and garden lights reach the requested height', () => {
  for (const kind of Object.keys(FURNITURE_DEFS).filter(kind => FURNITURE_DEFS[kind].height)) {
    for (const height of [FURNITURE_DEFS[kind].height, 50, 1200]) {
      const group = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind], height });
      const box = new THREE.Box3().setFromObject(group, true);
      assert.ok(box.min.y >= -1e-5, `${kind} ${height}: below floor`);
      assert.ok(Math.abs(box.max.y - height / 100) < 0.02, `${kind} ${height}: top ${box.max.y}`);
      dispose(group);
    }
  }
});
