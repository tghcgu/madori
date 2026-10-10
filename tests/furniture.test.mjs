import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FURNITURE_DEFS, FURNITURE_VARIANTS, FURNITURE_VARIANTS_2D_ONLY } from '../src/furniture-catalog.ts';
import {
  PERSON_HEIGHT, PERSON_PRESETS, bloodShape, evidenceMarkerShape, footprintPathTrail, footprintTrail, glassShards, markerTextSize, normalizePersonPose,
  JAPANESE_KINDS, japaneseParts,
  partTop, personLayout, personOutline, personRefSize, presetPose, reachHandle, rockShapes, rockVertexHeights, shardMargin, shardPieces, shardTrail,
} from '../src/furniture-shapes.ts';
import { buildFurnitureModel } from '../src/furniture-models.ts';

function dispose(group) {
  const materials = new Set();
  group.traverse(object => {
    object.geometry?.dispose();
    if (object.material) materials.add(object.material);
  });
  materials.forEach(material => material.dispose());
}

test('Japanese furniture uses ordered shared parts with visible tatami borders above the base', () => {
  for (const kind of JAPANESE_KINDS) {
    const def = FURNITURE_DEFS[kind];
    const parts = japaneseParts(kind, def.w, def.h, def.height);
    assert.ok(parts.length > 1);
    const tops = parts.map(part => part.bottom + part.height);
    assert.deepEqual(tops, [...tops].sort((a, b) => a - b), kind);
    assert.ok(parts.every(part => part.w > 0 && part.d > 0 && part.height > 0));
  }
  const parts = japaneseParts('tatami', 90, 180, 6);
  const base = parts.find(part => part.material === 'straw');
  for (const part of parts.filter(part => ['border', 'weave'].includes(part.material))) {
    assert.ok(part.bottom + part.height > base.bottom + base.height);
  }
});

// 標準と別デザイン（2Dの記号と同じ番号）のどちらも、同じ条件で確かめる
const designs = Object.entries(FURNITURE_DEFS).flatMap(([kind, defaults]) =>
  [0, ...(FURNITURE_VARIANTS[kind] ?? []).map((_, index) => index + 1)].map(symbol => ({ kind, defaults, symbol })));

// 形の見分け: 材質ごとの頂点の位置と色を足し合わせた値。材質や三角形の数が同じでも、形や色が違えば変わる
function signature(group) {
  group.updateMatrixWorld(true);
  const parts = group.children.map(mesh => {
    const positions = mesh.geometry.getAttribute('position'), v = new THREE.Vector3();
    let sum = 0;
    for (let i = 0; i < positions.count; i += 1) {
      v.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      sum += v.x * 1.3 + v.y * 3.7 + v.z * 7.1;
    }
    return `${mesh.material.name}#${mesh.material.color.getHexString()}:${positions.count}:${sum.toFixed(3)}`;
  });
  return parts.sort().join('|');
}

for (const { kind, defaults, symbol } of designs) {
  const name = symbol ? `${kind} (${FURNITURE_VARIANTS[kind][symbol - 1]})` : kind;
  test(`${name}: default, minimum, wide and deep models stay inside their footprint`, () => {
    for (const [w, h] of [[defaults.w, defaults.h], [20, 20], [defaults.w * 2, defaults.h * 0.5], [defaults.w * 0.5, defaults.h * 2]]) {
      const group = buildFurnitureModel({ kind, w, h, symbol });
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
  for (const { kind, symbol } of designs) {
    const normal = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind], symbol });
    const tinted = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind], symbol, color3d: '#cc4455' });
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
  for (const { kind, symbol } of designs) {
    const raw = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind], symbol }, false);
    const merged = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind], symbol });
    const a = new THREE.Box3().setFromObject(raw, true), b = new THREE.Box3().setFromObject(merged, true);
    assert.ok(a.min.distanceTo(b.min) < 1e-5 && a.max.distanceTo(b.max) < 1e-5, `${kind} ${symbol}`);
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

test('each design variant builds a different 3D model from the standard one and from each other', () => {
  for (const [kind, labels] of Object.entries(FURNITURE_VARIANTS)) {
    const seen = new Map();
    const only2d = FURNITURE_VARIANTS_2D_ONLY[kind] ?? [];
    for (let symbol = 0; symbol <= labels.length; symbol += 1) {
      const group = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind], symbol });
      const key = signature(group);
      if (only2d.includes(symbol)) {
        // 2Dの記号だけのデザインは、3Dでは標準と同じ形になる
        assert.equal(key, [...seen.entries()].find(([, value]) => value === 0)?.[0], `${kind}: 2D-only design ${symbol} should keep the standard 3D model`);
        dispose(group);
        continue;
      }
      assert.ok(!seen.has(key), `${kind}: design ${symbol} looks the same as design ${seen.get(key)}`);
      seen.set(key, symbol);
      dispose(group);
    }
  }
});

test('unknown design numbers fall back to the standard model', () => {
  for (const kind of ['chair', 'sofa', 'sideTable']) {
    const standard = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind] });
    const expected = signature(standard);
    dispose(standard);
    for (const symbol of [99, -1, 1.5, NaN]) {
      if (kind === 'sideTable' || symbol !== 1) {
        const group = buildFurnitureModel({ kind, ...FURNITURE_DEFS[kind], symbol });
        assert.equal(signature(group), expected, `${kind} ${symbol}`);
        dispose(group);
      }
    }
  }
});

test('rocks are made of flat faces between the ridges, with every outline point above the ground', () => {
  for (const [w, h] of [[120, 90], [20, 20], [300, 60], [60, 300]]) {
    for (const variant of [0, 1]) {
      for (const shape of rockShapes(w, h, variant)) {
        const heights = rockVertexHeights(shape);
        assert.ok(Math.min(...heights) >= 0.12, `${w}x${h} design ${variant}: ${Math.min(...heights)}`);
        assert.ok(heights.some(value => value !== 0.75), `${w}x${h} design ${variant}: fell back to a flat rim`);
      }
    }
  }
});

test('a 3D color code with an alpha makes every piece translucent with the same shape and tint', () => {
  for (const kind of ['sofa', 'aquarium', 'bed', 'tree']) {
    const { w, h } = FURNITURE_DEFS[kind];
    const solid = buildFurnitureModel({ kind, w, h, color3d: '#c04020' });
    const seeThrough = buildFurnitureModel({ kind, w, h, color3d: '#c0402080' });
    try {
      const shape = group => signature(group).replace(/#[0-9a-f]{6}/g, '');
      assert.equal(shape(seeThrough), shape(solid), `${kind}: same pieces and positions`);
      assert.equal(signature(seeThrough), signature(solid), `${kind}: the tint ignores the alpha digits`);
      const opacities = new Map();
      solid.traverse(object => { if (object.isMesh) opacities.set(object.material.name, object.material.opacity); });
      seeThrough.traverse(object => {
        if (!object.isMesh) return;
        assert.equal(object.material.transparent, true, `${kind} ${object.material.name} is transparent`);
        assert.ok(Math.abs(object.material.opacity - opacities.get(object.material.name) * 0x80 / 255) < 1e-6, `${kind} ${object.material.name} opacity`);
        assert.equal(object.material.depthWrite, false);
        assert.equal(object.castShadow, false, 'see-through pieces cast no shadow');
      });
    } finally { dispose(solid); dispose(seeThrough); }
  }
});

test('investigation marks stay inside their frame, and the body outline goes around every part', () => {
  const inside = ([x, y], polygon) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const within = (w, h) => ([x, y]) => Math.abs(x) <= w / 2 + 1e-6 && Math.abs(y) <= h / 2 + 1e-6;
  for (const [w, h] of [[100, 180], [60, 120], [200, 90], [20, 20]]) {
    // The two original fallen bodies and every pose preset of the posable person.
    for (const layout of [personLayout(w, h, null, 0), personLayout(w, h, null, 1), ...PERSON_PRESETS.map(preset => personLayout(w, h, preset.pose))]) {
      const outline = personOutline(layout);
      assert.ok(outline.length > 30, `outline points ${outline.length}`);
      assert.ok(outline.every(within(w, h)), 'the outline stays inside the frame');
      assert.ok(layout.outlines.flat().every(within(w, h)), 'every part seen from above stays inside the frame');
      // Parts thinner than the outline's grid (a tiny person in a 20 cm frame) may fall between its cells.
      const visible = part => Math.max(...part.axes.map(axis => Math.hypot(...axis))) > Math.max(0.4, Math.min(w, h) / 70);
      for (const part of layout.parts.filter(visible)) assert.ok(inside([(part.a[0] + part.b[0]) / 2, (part.a[2] + part.b[2]) / 2], outline), 'each part is inside the outline');
    }
    for (const bare of [false, true]) {
      for (const piece of footprintTrail(w, h, bare)) {
        const reachX = Math.hypot(piece.rx * Math.cos(piece.angle), piece.ry * Math.sin(piece.angle));
        const reachY = Math.hypot(piece.rx * Math.sin(piece.angle), piece.ry * Math.cos(piece.angle));
        assert.ok(Math.abs(piece.x) + reachX <= w / 2 + 1e-6 && Math.abs(piece.y) + reachY <= h / 2 + 1e-6, 'footprints stay inside');
      }
    }
    for (const variant of [0, 1, 2]) assert.ok(bloodShape(w, h, variant).blobs.flat().every(within(w, h)), 'blood stays inside');
    assert.ok(glassShards(w, h).flat().every(within(w, h)), 'glass stays inside');
  }
  const marker = evidenceMarkerShape(24, 24);
  assert.ok(markerTextSize(marker, '1234') < markerTextSize(marker, '12'), 'long numbers are written smaller');
  assert.equal(markerTextSize(marker, '7'), markerTextSize(marker, '12'));
});

test('footprints drawn along a path follow it, alternate sides, face the walking direction and stay inside the frame', () => {
  // An L-shaped path: 200 cm to the right, then 120 cm down.
  const path = [[-100, -60], [100, -60], [100, 60]];
  const pieces = footprintPathTrail(path, 300, 220, false, 42);
  const prints = [];
  for (let i = 0; i < pieces.length; i += 2) prints.push(pieces[i]);
  assert.equal(prints.length, Math.floor(320 / 42) + 1, 'one print every stride');
  // Toes point along the path: right on the first leg, down on the second.
  const heading = piece => Math.atan2(Math.sin(piece.angle), Math.cos(piece.angle));
  assert.ok(Math.abs(heading(prints[0])) < 0.3, `first print walks right: ${heading(prints[0])}`);
  assert.ok(Math.abs(heading(prints.at(-1)) - Math.PI / 2) < 0.3, `last print walks down: ${heading(prints.at(-1))}`);
  // Left and right prints sit on alternate sides of the first leg of the path (y = -60).
  assert.ok(prints[0].y < -60 && prints[1].y > -60 && prints[2].y < -60, 'prints alternate left and right');
  const within = piece => Math.abs(piece.x) <= 150 && Math.abs(piece.y) <= 110;
  assert.ok(pieces.every(within));
  // A longer stride gives fewer prints; bare feet have toes.
  assert.ok(footprintPathTrail(path, 300, 220, false, 80).length < pieces.length);
  assert.equal(footprintPathTrail(path, 300, 220, true, 42).length, prints.length * 7);
  // The straight trail is unchanged with the standard stride.
  assert.deepEqual(footprintTrail(60, 200, false, 42), footprintTrail(60, 200, false));
});

test('the posable person stands about 170 cm tall, poses change its shape, and dragged hands and feet reach their target', () => {
  assert.equal(PERSON_HEIGHT, 170);
  const top = layout => Math.max(...layout.parts.map(partTop));
  const size = personRefSize(presetPose('stand'));
  const standing = personLayout(size.w, size.h, presetPose('stand'));
  assert.ok(Math.abs(standing.scale - 1) < 1e-6);
  assert.ok(Math.abs(top(standing) - 170) < 1, `standing height ${top(standing)}`);
  for (const id of ['prone', 'supine', 'spread']) {
    const pose = presetPose(id), lying = personRefSize(pose);
    assert.ok(top(personLayout(lying.w, lying.h, pose)) < 30, `${id} lies on the floor`);
  }
  const sitting = personRefSize(presetPose('sit'));
  assert.ok(Math.abs(top(personLayout(sitting.w, sitting.h, presetPose('sit'))) - 135) < 15, 'sitting lowers the body');
  // The standing person is drawn in separate layers so the head shows on top of the shoulders.
  assert.ok(standing.layers.length > 1);
  assert.equal(personLayout(100, 200, presetPose('prone')).layers.length, 1, 'a lying body is one shape from above');
  // Dragging a hand: lying bodies bend the elbow in the floor plane, standing bodies swing the arm.
  const handleAt = (pose, handle) => {
    const ref = personRefSize(pose);
    const layout = personLayout(ref.w, ref.h, pose);
    return layout.handles[handle].map((value, i) => value / layout.scale + layout.center[i]);
  };
  for (const [id, handle, target] of [['prone', 0, [-60, -70]], ['prone', 3, [30, 70]], ['stand', 1, [-50, 20]], ['stand', 2, [10, 35]]]) {
    const end = handleAt(reachHandle(presetPose(id), handle, target), handle);
    assert.ok(Math.hypot(end[0] - target[0], end[1] - target[1]) < 1, `${id} handle ${handle} reaches ${target}: ${end}`);
  }
  // Elbows, knees and the head: the joint moves toward the target (it cannot leave its circle around the shoulder, hip or waist).
  for (const [id, handle, offset] of [['prone', 4, [-25, 5]], ['prone', 7, [15, -10]], ['stand', 5, [-20, 15]], ['stand', 6, [0, 25]], ['prone', 8, [25, 5]], ['stand', 8, [0, 30]]]) {
    const pose = presetPose(id);
    const before = handleAt(pose, handle);
    const target = [before[0] + offset[0], before[1] + offset[1]];
    const after = handleAt(reachHandle(pose, handle, target), handle);
    assert.ok(Math.hypot(after[0] - target[0], after[1] - target[1]) < Math.hypot(before[0] - target[0], before[1] - target[1]) - 3, `${id} handle ${handle} moves toward ${target}: ${before} -> ${after}`);
  }
  // Bending the waist forward lowers the head of a standing person; turning the neck keeps the height.
  const tall = pose => { const ref = personRefSize(pose); return top(personLayout(ref.w, ref.h, pose)); };
  const bowing = presetPose('stand');
  bowing.waist = [60, 0, 0];
  assert.ok(tall(bowing) < 150, `bowing lowers the head: ${tall(bowing)}`);
  const turning = presetPose('stand');
  turning.neck = [0, 0, 80];
  assert.ok(Math.abs(tall(turning) - 170) < 1.5);
  // Saved poses are checked and rounded; old poses without wrists, ankles, waist and neck are read as straight.
  assert.deepEqual(normalizePersonPose({ posture: 'stand', arms: [[10.04, 0, 0, 370], [0, 0, 0, 0]], legs: [[0, 0, 0, 0], [0, 0, 0, 0]] }).arms[0], [10, 0, 0, 10, 0]);
  assert.deepEqual(normalizePersonPose({ posture: 'stand', arms: [[0, 0, 0, 0], [0, 0, 0, 0]], legs: [[0, 0, 0, 0], [0, 0, 0, 0]] }).waist, [0, 0, 0]);
  assert.equal(normalizePersonPose({ posture: 'stand', arms: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], legs: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], neck: [1, 2] }), undefined);
  assert.equal(normalizePersonPose({ posture: 'fly', arms: [], legs: [] }), undefined);
  assert.equal(normalizePersonPose({ posture: 'stand', arms: [[0, 0, 0]], legs: [[0, 0, 0, 0], [0, 0, 0, 0]] }), undefined);
});

test('people and drawn footprints build 3D models that fill their frame and follow the pose', () => {
  const height = group => new THREE.Box3().setFromObject(group, true).getSize(new THREE.Vector3()).y;
  const size = personRefSize(presetPose('stand'));
  const standing = buildFurnitureModel({ kind: 'person', w: size.w, h: size.h });
  const lying = buildFurnitureModel({ kind: 'person', w: 100, h: 200, pose: presetPose('prone') });
  const legacy = buildFurnitureModel({ kind: 'fallenPerson', w: 100, h: 180 });
  const paint = buildFurnitureModel({ kind: 'paint', w: 200, h: 120, color: '#1c7ed680', path: [[-0.4, 0], [0.4, 0]] });
  const path = buildFurnitureModel({ kind: 'footprints', w: 300, h: 220, path: [[-0.33, -0.27], [0.33, -0.27], [0.33, 0.27]] });
  const straight = buildFurnitureModel({ kind: 'footprints', w: 300, h: 220 });
  try {
    assert.ok(Math.abs(height(standing) - 1.7) < 0.02, `standing person is 1.7 m: ${height(standing)}`);
    assert.ok(height(lying) < 0.3, 'a lying person stays low');
    assert.ok(height(legacy) < 0.3, 'the original fallen person still lies on the floor');
    assert.notEqual(signature(path), signature(straight), 'a drawn path changes the footprints');
    // Pen strokes are a flat, see-through decal on the floor that casts no shadow.
    const decal = paint.children.find(child => child.material.name === 'paint-decal');
    assert.ok(decal && decal.material.transparent && Math.abs(decal.material.opacity - 0x80 / 255) < 1e-6 && !decal.castShadow);
    assert.ok(height(paint) < 0.01, 'the pen decal lies on the floor');
    // The mannequin is one wood color with slightly darker ball joints.
    const materials = new Set(standing.children.map(child => child.material.name));
    assert.deepEqual([...materials].sort(), ['footprint', 'mannequin', 'mannequin-joint']);
  } finally { [standing, lying, legacy, path, straight, paint].forEach(dispose); }
});

test('shards drawn along a path stay near the path and inside the frame, and more of them with a higher amount', () => {
  const path = [[-100, 0], [100, 0]];
  const margin = shardMargin(40);
  const w = 200 + margin * 2, h = margin * 2;
  const pieces = shardTrail(path, w, h, 40, 1);
  assert.ok(pieces.length >= 25, `shards along 200 cm: ${pieces.length}`);
  assert.ok(pieces.flat().every(([x, y]) => Math.abs(x) <= w / 2 + 1e-6 && Math.abs(y) <= h / 2 + 1e-6), 'shards stay inside the frame');
  assert.ok(pieces.every(piece => piece.length === 3 || piece.length === 4));
  const centers = pieces.map(piece => piece.reduce((sum, p) => sum + p[1], 0) / piece.length);
  assert.ok(centers.every(y => Math.abs(y) <= 20 + 1e-6), 'shards stay within the spread of the path');
  assert.ok(shardTrail(path, w, h, 40, 2).length > pieces.length * 1.8, 'more shards with "多め"');
  assert.deepEqual(shardTrail(path, w, h, 40, 1), pieces, 'the same shards every time (2D and 3D agree)');
  // Without a path, the original cluster is kept.
  assert.equal(shardPieces(80, 60).length, 11);
  assert.deepEqual(shardPieces(w, h, [[-100 / w, 0], [100 / w, 0]], 40, 1), pieces);
});

test('shard models follow the path and use an opaque tinted color when one is chosen', () => {
  const glass = buildFurnitureModel({ kind: 'brokenGlass', w: 280, h: 80, path: [[-0.35, 0], [0.35, 0]], brush: 40 });
  const brown = buildFurnitureModel({ kind: 'brokenGlass', w: 280, h: 80, path: [[-0.35, 0], [0.35, 0]], brush: 40, color3d: '#8b5a2b' });
  try {
    const shard = group => group.children.find(child => child.material.name === 'glass-shard').material;
    assert.ok(shard(glass).transparent, 'plain shards are see-through glass');
    assert.ok(!shard(brown).transparent && shard(brown).color.getHexString() === '8b5a2b', 'colored shards are solid');
    const box = new THREE.Box3().setFromObject(glass, true).getSize(new THREE.Vector3());
    assert.ok(Math.abs(box.x - 2.8) < 1e-5 && Math.abs(box.z - 0.8) < 1e-5 && box.y < 0.01);
  } finally { dispose(glass); dispose(brown); }
});
