import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { isRoofKind, roofSides, roofRise, roofOutline, radialRoofModel, regularRoofSize } from '../src/roof-shapes.ts';
import { templatePlan } from '../src/templates.ts';
import { FURNITURE_DEFS } from '../src/furniture-catalog.ts';

const base = { x: -300, y: -300, w: 600, h: 600 };
const material = new MeshStandardMaterial();
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.003, `${a} != ${b}`);

test('roof kinds and numeric options are validated', () => {
  for (const value of ['gable', 'hip', 'flat', 'cone', 'dome', 'polygon']) assert.equal(isRoofKind(value), true);
  for (const value of ['none', 'constructor', '__proto__', '', null, 4]) assert.equal(isRoofKind(value), false);
  assert.equal(roofSides(NaN), 6); assert.equal(roofSides(1), 3); assert.equal(roofSides(50), 12);
  assert.equal(roofRise({ ...base, kind: 'cone', rise: Infinity }), 270);
  assert.equal(roofRise({ ...base, kind: 'dome', rise: 0 }), 10);
  assert.equal(roofRise({ ...base, kind: 'polygon', rise: 5000 }), 2000);
  assert.deepEqual(regularRoofSize({ x: 100, y: 100, w: 200, h: 400 }), { x: 0, y: 100, w: 400, h: 400 });
});

for (const kind of ['cone', 'dome', 'polygon']) test(`${kind} roof shares its footprint with 2D at different dimensions and angles`, () => {
  for (const sides of kind === 'polygon' ? [3,4,5,6,7,8,9,10,11,12] : [64]) {
    for (const rotation of [0,17,90]) {
      const roof = { ...base, kind, h: kind === 'polygon' ? 600 : 400, sides, rotation, rise: 240 };
      const points = roofOutline(roof), cx = roof.x + roof.w / 2, cy = roof.y + roof.h / 2;
      const model = radialRoofModel(roof, material), bounds = new Box3().setFromObject(model, true);
      close(bounds.min.x, Math.min(...points.map(p => p[0])) - cx);
      close(bounds.max.x, Math.max(...points.map(p => p[0])) - cx);
      close(bounds.min.z, Math.min(...points.map(p => p[1])) - cy);
      close(bounds.max.z, Math.max(...points.map(p => p[1])) - cy);
      close(bounds.min.y, 0); close(bounds.max.y, 248);
      model.updateMatrixWorld(true);
      const ray = new Raycaster(new Vector3(0,1000,0), new Vector3(0,-1,0));
      assert.ok(ray.intersectObject(model,true).length, 'roof covers its center');
      if (kind === 'polygon') {
        const lengths = points.map((p,i) => Math.hypot(p[0]-points[(i+1)%sides][0],p[1]-points[(i+1)%sides][1]));
        for (const length of lengths) close(length,lengths[0]);
      }
      model.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    }
  }
});

test('circular tower templates have matching circular roofs', () => {
  let id = 0;
  for (const key of ['wizardTower','castle']) {
    const plan = templatePlan(key, prefix => `${prefix}-${id++}`, FURNITURE_DEFS);
    // 城は2つの塔と、中庭の前の角の2つの見張り台
    assert.equal(plan.roofs.filter(r => r.kind === 'cone').length, key === 'castle' ? 4 : 1);
    for (const roof of plan.roofs.filter(r => r.kind === 'cone')) {
      const floor = plan.floors.find(f => f.id === roof.floorId).entities.find(e => e.type === 'room' && e.outline?.length >= 24 && e.x + e.w / 2 === roof.x + roof.w / 2 && e.y + e.h / 2 === roof.y + roof.h / 2);
      assert.ok(floor, 'roof centered over its circular floor');
      assert.ok(roof.w > floor.w);
    }
  }
});
