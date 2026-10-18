import assert from 'node:assert/strict';
import test from 'node:test';
import { FURNITURE_DEFS } from '../src/furniture-catalog.ts';
import { TEMPLATE_GROUPS, hasTemplatePlan, templatePlan } from '../src/templates.ts';
import { incomingStairs, isStair } from '../src/stairs.ts';
import { floorPolygon, pointInPolygon, normalizeOutline, normalizeFloorHoles, signedArea } from '../src/floor-outline.ts';
import { stairFootprint } from '../src/template-floors.ts';
import clipping from 'polygon-clipping';
import {
  defaultFreePath, distanceToFreeLine, freeCenterLine, freeLineWidth, freeOutline, freePathPoints, isAlwaysFreeKind, isFreeAreaKind,
  isFreeShapeKind, pointInFreePolygon,
} from '../src/free-shapes.ts';

// main.ts で作るテンプレート（住まいの4種類と作例）
const IN_MAIN = ['studio', 'oneLdk', 'twoLdk', 'twoStory', 'sample'];
const keys = TEMPLATE_GROUPS.flatMap(group => group.templates.map(template => template.key));

function build(key) {
  let counter = 0;
  return templatePlan(key, prefix => `${prefix}-${(counter += 1)}`, FURNITURE_DEFS);
}

// 自由な形（池・川・石垣など）は、範囲の四角ではなく形そのもので確かめる。間取りの上の点（cm）にした輪郭・中心線と幅
function freeShape(item) {
  if (!isFreeShapeKind(item.kind) || !(item.path || isAlwaysFreeKind(item.kind))) return null;
  const points = freePathPoints(item.path ?? defaultFreePath(item.kind), item.w, item.h).map(([x, y]) => [item.x + item.w / 2 + x, item.y + item.h / 2 + y]);
  const area = isFreeAreaKind(item.kind);
  const line = area ? freeOutline(points) : freeCenterLine(points);
  const reach = area ? 0 : (item.kind === 'railway' ? 300 : item.kind === 'river' ? freeLineWidth(item.kind, item.brush) + 28 : freeLineWidth(item.kind, item.brush)) / 2;
  return { area, line, reach };
}

// 自由な形が、四角い範囲（文字の箱など）に重なるか
function freeShapeTouches(shape, x0, y0, x1, y1) {
  const probes = [];
  for (let i = 0; i <= 4; i += 1) for (let j = 0; j <= 2; j += 1) probes.push([x0 + ((x1 - x0) * i) / 4, y0 + ((y1 - y0) * j) / 2]);
  const hit = ([x, y]) => (shape.area ? pointInFreePolygon(x, y, shape.line) : distanceToFreeLine(x, y, shape.line, false) <= shape.reach);
  return probes.some(hit) || shape.line.some(([x, y]) => x > x0 && x < x1 && y > y0 && y < y1);
}

// 回したあとの見た目の箱
function visualBox(item) {
  const sideways = item.rotation === 90 || item.rotation === 270;
  const w = sideways ? item.h : item.w, h = sideways ? item.w : item.h;
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

test('there are 153 templates in 11 groups, each with a plan', () => {
  assert.equal(keys.length, 153);
  assert.equal(TEMPLATE_GROUPS.length, 11);
  assert.equal(new Set(keys).size, 153, 'no key is listed twice');
  for (const key of keys) assert.ok(IN_MAIN.includes(key) || hasTemplatePlan(key), `${key} has a plan`);
  for (const group of TEMPLATE_GROUPS) {
    assert.ok(group.label && group.templates.length);
    for (const template of group.templates) assert.ok(template.label && template.title, template.key);
  }
});

for (const key of keys.filter(hasTemplatePlan)) {
  test(`the ${key} template is a tidy plan: real furniture, doors on walls, nothing outside or through a wall`, () => {
    const plan = build(key);
    assert.ok(plan.floors.length >= 1);
    const ids = [plan.floors.map(floor => floor.id), plan.roofs.map(roof => roof.id), plan.floors.flatMap(floor => floor.entities.map(entity => entity.id))].flat();
    assert.equal(new Set(ids).size, ids.length, 'ids are unique');
    for (const roof of plan.roofs) assert.ok(plan.floors.some(floor => floor.id === roof.floorId), 'each roof sits on a floor');
    for (const [index, floor] of plan.floors.entries()) {
      const rooms = floor.entities.filter(entity => entity.type === 'room');
      const walls = floor.entities.filter(entity => entity.type === 'wall');
      assert.ok(rooms.length >= 1 && walls.length >= 4, `floor ${index} has rooms and walls`);
      for (const room of rooms) {
        assert.ok(room.w > 0 && room.h > 0);
        normalizeFloorHoles(room.holes, normalizeOutline(room.outline));
      }
      // 円形の塔でも、建具の両端が実際の壁の上にある。
      const edges = walls.map(wall => [Math.min(wall.x1, wall.x2), Math.min(wall.y1, wall.y2), Math.max(wall.x1, wall.x2), Math.max(wall.y1, wall.y2)]);
      for (const opening of floor.entities.filter(entity => entity.type === 'door' || entity.type === 'window')) {
        const { x1, y1, x2, y2 } = opening;
        const onEdge = edges.some(([ex1, ey1, ex2, ey2]) => (y1 === y2 && ey1 === ey2 && y1 === ey1 && Math.min(x1, x2) >= ex1 - 0.01 && Math.max(x1, x2) <= ex2 + 0.01)
          || (x1 === x2 && ex1 === ex2 && x1 === ex1 && Math.min(y1, y2) >= ey1 - 0.01 && Math.max(y1, y2) <= ey2 + 0.01));
        assert.ok(onEdge, `${opening.type} (${x1}, ${y1})-(${x2}, ${y2}) on floor ${index} is on a wall`);
      }
      for (const item of floor.entities.filter(entity => entity.type === 'furniture')) {
        const label = `${item.kind} at (${item.x}, ${item.y}) on floor ${index}`;
        assert.ok(FURNITURE_DEFS[item.kind], `${label} is a known kind`);
        assert.ok(item.w > 0 && item.h > 0, label);
        assert.ok([0, 90, 180, 270].includes(item.rotation), label);
        const box = visualBox(item);
        // 部屋か屋外の場所の中に置く
        const inside = (x, y) => rooms.some(room => {
          const polygon = floorPolygon(isStair(item) ? { ...room, holes: undefined } : room);
          return pointInPolygon(x, y, polygon) || clipping.intersection(polygon, [[[x-.01,y-.01],[x+.01,y-.01],[x+.01,y+.01],[x-.01,y+.01]]]).length > 0;
        });
        // 自由な形は、輪郭・道すじの点が間取りの中にあればよい（堀や石垣は建物に沿って回り込むので、範囲の四角は壁をまたぐ）
        const shape = freeShape(item);
        if (shape) {
          assert.equal(item.rotation, 0, `${label} is drawn without rotation`);
          for (const [x, y] of shape.line) assert.ok(inside(x, y), `${label} follows a path inside the plan at (${Math.round(x)}, ${Math.round(y)})`);
          continue;
        }
        for (const [x, y] of [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]]) assert.ok(inside(x, y), `${label} is inside the plan`);
        // 壁を突き抜けない（壁に沿わせるのはよい）
        for (const wall of walls) {
          if (wall.y1 === wall.y2) {
            const crosses = box.y0 < wall.y1 - 1 && box.y1 > wall.y1 + 1 && box.x0 < Math.max(wall.x1, wall.x2) - 1 && box.x1 > Math.min(wall.x1, wall.x2) + 1;
            assert.ok(!crosses, `${label} does not cut through the wall at y=${wall.y1}`);
          } else if (wall.x1 === wall.x2) {
            const crosses = box.x0 < wall.x1 - 1 && box.x1 > wall.x1 + 1 && box.y0 < Math.max(wall.y1, wall.y2) - 1 && box.y1 > Math.min(wall.y1, wall.y2) + 1;
            assert.ok(!crosses, `${label} does not cut through the wall at x=${wall.x1}`);
          }
        }
      }
    }
  });
}

// 部屋の名前の文字の箱。全体を表示したとき（2Dと3Dを並べた画面の2D）の文字の大きさで見積もる
function labelBoxes(plan, floor) {
  const boxes = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (ax, ay, bx, by) => {
    x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by); x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by);
  };
  for (const entity of floor.entities) {
    if (entity.type === 'room') grow(entity.x, entity.y, entity.x + entity.w, entity.y + entity.h);
    else if (entity.type === 'wall') grow(entity.x1, entity.y1, entity.x2, entity.y2);
    else if (entity.type === 'furniture') {
      const box = visualBox(entity);
      grow(box.x0, box.y0, box.x1, box.y1);
    }
  }
  for (const roof of plan.roofs) grow(roof.x, roof.y, roof.x + roof.w, roof.y + roof.h);
  const zoom = Math.min((656 - 140) / (x1 - x0), (790 - 140) / (y1 - y0));
  const font = Math.max(12, 13 / zoom);
  for (const room of floor.entities.filter(entity => entity.type === 'room' && entity.name.trim())) {
    const width = [...room.name].reduce((sum, char) => sum + (char.charCodeAt(0) < 0x2000 ? 0.6 : 1) * font, 0);
    const x = room.x + (room.labelOffsetX ?? 10), y = room.y + (room.labelOffsetY ?? 10);
    boxes.push({ room, x0: x, y0: y, x1: x + width, y1: y + font * 1.1 });
  }
  return boxes;
}

for (const key of keys.filter(hasTemplatePlan)) {
  test(`the room names of the ${key} template fit in their rooms and are not hidden under furniture`, () => {
    const plan = build(key);
    for (const [index, floor] of plan.floors.entries()) {
      const furniture = floor.entities.filter(entity => entity.type === 'furniture');
      for (const label of labelBoxes(plan, floor)) {
        const { room } = label;
        const name = `"${room.name}" on floor ${index}`;
        // 縁側のような細い所では、名前が横にはみ出してもよい
        const fitsAcross = room.w < 150 || label.x1 <= room.x + room.w + 2;
        assert.ok(label.x0 >= room.x && fitsAcross && label.y1 <= room.y + room.h, `${name} fits in its room`);
        for (const item of furniture) {
          const box = visualBox(item);
          const shape = freeShape(item);
          const overlaps = shape
            ? freeShapeTouches(shape, label.x0 + 2, label.y0 + 2, label.x1 - 2, label.y1 - 2)
            : box.x0 < label.x1 - 2 && box.x1 > label.x0 + 2 && box.y0 < label.y1 - 2 && box.y1 > label.y0 + 2;
          assert.ok(!overlaps, `${name} is not under the ${item.kind} at (${item.x}, ${item.y})`);
        }
      }
    }
  });
}

// 下階からの到着側は参照表示で補い、最上階に上り階段の実物を重ねない。
for (const key of keys.filter(hasTemplatePlan)) {
  test(`the ${key} template connects floors without stairs above its top floor`, () => {
    const plan = build(key);
    const stairs = plan.floors.map(floor => floor.entities.filter(isStair));
    for (let i = 1; i < plan.floors.length; i += 1) {
      assert.ok(stairs[i - 1].length > 0, `floor ${i} is reached from below`);
      for (const room of plan.floors[i].entities.filter(item => item.type === 'room')) {
        for (const stair of stairs[i - 1]) {
          const overlap = clipping.intersection(floorPolygon(room), [stairFootprint(stair)]);
          const area = overlap.reduce((sum, polygon) => sum + Math.abs(signedArea(polygon[0])) - polygon.slice(1).reduce((s, ring) => s + Math.abs(signedArea(ring)), 0), 0);
          assert.ok(area < 0.01, `floor ${i} does not cover ${stair.kind} at ${stair.x},${stair.y}`);
        }
      }
    }
    if (plan.floors.length > 1) {
      const index = plan.floors.length - 1, top = plan.floors[index].id;
      assert.equal(stairs[index].length, 0, 'no extra flight on the top floor');
      assert.deepEqual(incomingStairs(plan.floors, index), stairs[index - 1], 'top plan shows the actual stairs arriving from below');
      assert.ok(plan.roofs.some(roof => roof.floorId === top), 'the top floor has a roof');
    }
  });
}

test('templates of buildings that usually have more floors have them', () => {
  const floors = key => build(key).floors.length;
  for (const key of ['ryokan', 'hospital', 'library', 'police', 'museum', 'castle']) assert.ok(floors(key) >= 2, `${key} has an upper floor`);
  for (const key of ['hotel', 'school']) assert.ok(floors(key) >= 3, `${key} has three floors`);
});

test('the mansion has a cellar under the ground floor, and opens on the ground floor', () => {
  const plan = build('westernMansion');
  assert.equal(plan.basements, 1);
  assert.equal(plan.floors.length, 3);
  assert.equal(plan.activeFloor, 1);
});

test('the apartment stairs arrive at the corridor landing without an upper slab blocking the flight', () => {
  const plan = build('apartment');
  const stairs = plan.floors[0].entities.filter(isStair);
  assert.equal(stairs.length, 1);
  const stair = stairs[0], box = visualBox(stair);
  assert.equal(stair.rotation, 180, 'the flight rises toward the corridor');
  const upperRooms = plan.floors[1].entities.filter(entity => entity.type === 'room');
  for (const room of upperRooms) {
    const overlap = box.x0 < room.x + room.w && box.x1 > room.x && box.y0 < room.y + room.h && box.y1 > room.y;
    assert.ok(!overlap, 'no upper slab covers the staircase');
  }
  const landing = upperRooms.find(room => room.y === box.y1 && room.x <= box.x0 && room.x + room.w >= box.x1);
  assert.ok(landing && landing.h >= 100, 'a landing covers the entire arrival edge');
  const corridor = upperRooms.find(room => room.x + room.w === landing.x && room.y <= landing.y && room.y + room.h >= landing.y + landing.h);
  assert.ok(corridor, 'the landing joins the corridor');
  assert.equal(plan.floors[1].entities.filter(isStair).length, 0, 'no onward flight into the roof');
});

test('wizard and castle towers share round floor and wall outlines on every floor', () => {
  for (const key of ['wizardTower','castle']) {
    const plan=build(key);
    for (const floor of plan.floors) {
      const towers=floor.entities.filter(e=>e.type==='room' && (key==='wizardTower'||e.name.includes('塔')));
      assert.equal(towers.length,key==='wizardTower'?1:2);
      for (const tower of towers) {
        assert.ok(tower.outline.length>40,'a round perimeter, not a rectangular box');
        assert.equal(tower.w,tower.h);
        for (const [x,y] of tower.outline) assert.ok(Math.abs(Math.hypot(x-.5,y-.5)-.5)<1e-8,'vertices lie on the same circle');
        const edges=floorPolygon(tower)[0];
        for (let i=0;i<edges.length;i++) {
          const a=edges[i],b=edges[(i+1)%edges.length];
          assert.ok(floor.entities.some(w=>w.type==='wall'&&Math.hypot(w.x1-a[0],w.y1-a[1])<.01&&Math.hypot(w.x2-b[0],w.y2-b[1])<.01),'the wall follows the floor perimeter');
        }
      }
    }
  }
});

test('the three-story house has an unobstructed arrival hall before its third-floor bedroom', () => {
  const floor=build('threeStory').floors[2];
  for(const x of [405,440,475]) {
    assert.ok(floor.entities.some(r=>r.type==='room'&&pointInPolygon(x,340,floorPolygon(r))));
    assert.ok(!floor.entities.some(w=>w.type==='wall'&&w.y1===380&&w.y2===380&&Math.min(w.x1,w.x2)<x&&Math.max(w.x1,w.x2)>x));
  }
});
