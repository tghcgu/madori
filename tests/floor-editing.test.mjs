import assert from 'node:assert/strict';
import test from 'node:test';
import { centeredFloorSize, floorPreset, isEllipseFloor, presetOutline, regularFloor, regularFloorOutline, regularFloorSize, regularFloorSides } from '../src/floor-editing.ts';
import { floorPolygon, normalizeOutline, outlineFromPoints, pointInPolygon } from '../src/floor-outline.ts';

test('floor presets are valid, independent and detectable after persistence', () => {
  for (const preset of ['rectangle', 'circle', 'ellipse', 'polygon', 'l']) {
    const floor = { x: 20, y: -80, w: 600, h: ['circle','polygon'].includes(preset) ? 600 : 400, outline: presetOutline(preset) };
    normalizeOutline(floor.outline);
    assert.equal(floorPreset(JSON.parse(JSON.stringify(floor))), preset);
  }
  const points = presetOutline('l'); points[0][0] = .2;
  assert.equal(presetOutline('l')[0][0], 0);
  assert.equal(floorPreset({ x: 0, y: 0, w: 200, h: 400, outline: points }), 'free');
});

test('regular floors retain equal edges, angles and center at 3 to 12 sides after resizing and reload', () => {
  assert.equal(regularFloorSides(2),3);assert.equal(regularFloorSides(99),12);assert.equal(regularFloorSides(NaN),6);
  for(let sides=3;sides<=12;sides++) for(const rotation of [0,17.5,90,270]) {
    let floor={x:-300,y:120,w:600,h:600,outline:regularFloorOutline(sides,rotation)};
    normalizeOutline(floor.outline);
    let p=regularFloor(JSON.parse(JSON.stringify(floor)));
    assert.equal(p.sides,sides);assert.ok(Math.abs(p.rotation-rotation)<1e-6);
    assert.equal(floorPreset(floor),'polygon');
    floor={...floor,...regularFloorSize(floor,535)};
    p=regularFloor(floor);
    assert.ok(Math.abs(p.diameter-535)<1e-6);assert.ok(Math.abs(p.x)<1e-6);assert.ok(Math.abs(p.y-420)<1e-6);
    const points=floor.outline.map(([x,y])=>[floor.x+x*floor.w,floor.y+y*floor.h]);
    const lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%sides][0],p[1]-points[(i+1)%sides][1]));
    assert.ok(lengths.every(n=>Math.abs(n-lengths[0])<1e-6));
    assert.ok(regularFloor(outlineFromPoints(points)), 'recognizes existing tightly bounded polygon floors');
    floor.outline[0][0]+=.01;
    assert.equal(regularFloor(floor),null,'vertex edits leave regular polygon mode');
  }
  assert.equal(regularFloor({x:0,y:0,w:600,h:400}),null);
  assert.equal(regularFloor({x:0,y:0,w:600,h:400,outline:presetOutline('l')}),null);
  assert.equal(regularFloor({x:0,y:0,w:600,h:400,outline:regularFloorOutline(6,0)}),null);
});

test('round floors retain simple size handles after rotation, but not after vertex deformation', () => {
  const floor = { x: 0, y: 0, w: 400, h: 400, outline: presetOutline('circle') };
  floor.outline = floor.outline.map(([x, y]) => [1-y, x]);
  assert.equal(isEllipseFloor(floor), true);
  floor.outline[4][0] -= .1;
  assert.equal(isEllipseFloor(floor), false);
  assert.equal(isEllipseFloor({ ...floor, outline: undefined }), false);
});

test('diameter changes keep the center and normalized openings when scaled', () => {
  const floor = { x: -100, y: 100, w: 400, h: 400, outline: presetOutline('circle'), holes: [[[.4,.4],[.6,.4],[.6,.6],[.4,.6]]] };
  const next = { ...floor, ...centeredFloorSize(floor, 800, 800) };
  assert.deepEqual([next.x, next.y, next.w, next.h], [-300, -100, 800, 800]);
  assert.equal(pointInPolygon(100, 300, floorPolygon(next)), false);
  assert.equal(pointInPolygon(-200, 300, floorPolygon(next)), true);
});

test('clicked paths make concave floors but not bowties, lines, or undersized drafts', () => {
  const l = outlineFromPoints([[0,0],[400,0],[400,200],[200,200],[200,400],[0,400]]);
  assert.equal(floorPreset(l), 'l');
  for (const points of [[], [[0,0]], [[0,0],[400,0]], [[0,0],[100,0],[200,0]], [[0,0],[400,400],[0,400],[400,0]]]) assert.equal(outlineFromPoints(points), null);
});
