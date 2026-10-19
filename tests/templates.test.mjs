import assert from 'node:assert/strict';
import test from 'node:test';
import { FURNITURE_DEFS } from '../src/furniture-catalog.ts';
import { TEMPLATE_GROUPS, hasTemplatePlan, templatePlan } from '../src/templates.ts';
import { incomingStairs, isStair } from '../src/stairs.ts';
import { floorPolygon, pointInPolygon, normalizeOutline, normalizeFloorHoles, signedArea } from '../src/floor-outline.ts';
import { stairFootprint } from '../src/template-floors.ts';
import { roofOutline } from '../src/roof-shapes.ts';
import { doubleLeaves } from '../src/opening-shapes.ts';
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

// 床に敷く物・床の上の印（ほかの家具と重なってよく、ドアの前にあってもよい）
const FLAT_KINDS = new Set(['rug', 'tatami', 'stage', 'paint', 'footprints', 'bloodPool', 'brokenGlass', 'evidenceMarker', 'lawn', 'flowerBed', 'pond', 'sandbox', 'manhole', 'engawa', 'futon', 'zabuton']);
const SEATS = new Set(['chair', 'officeChair', 'stool', 'barStool', 'zaisu', 'zabuton', 'bench', 'armchair', 'sofa', 'sofa2', 'schoolDesk', 'wheelchair']);
const TABLES = new Set(['table', 'diningTable', 'desk', 'deskL', 'longTable', 'roundTable', 'chabudai', 'kotatsu', 'counter', 'kitchenIsland', 'pingPongTable', 'poolTable', 'sideTable', 'irori', 'hibachi', 'lectern']);
// わざと重ねる組（屋台のテントと台・L字ソファの内側の机・積んだ岩・焼肉のロースター・流しの付いた実験台）
const STACKED = new Set(['counter+tent', 'sofaCorner+table', 'rock+rock', 'stove+table', 'longTable+washbasin']);
// 屋根のない、囲まれた庭や闘技場
const OPEN_ROOMS = new Set(['中庭', '坪庭', '闘技場']);
const solidItems = entities => entities.filter(item => item.type === 'furniture' && !freeShape(item));
const segmentDistance = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0;
  return Math.hypot(px - x1 - dx * t, py - y1 - dy * t);
};
// 縁の6割以上に壁がある部屋（屋外の場所ではない）
const walledRooms = entities => {
  const walls = entities.filter(item => item.type === 'wall');
  return entities.filter(item => item.type === 'room').filter(room => {
    const ring = floorPolygon(room)[0];
    let total = 0, covered = 0;
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length], steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20));
      for (let k = 0; k < steps; k += 1) {
        const x = a[0] + (b[0] - a[0]) * (k + 0.5) / steps, y = a[1] + (b[1] - a[1]) * (k + 0.5) / steps;
        total += 1;
        if (walls.some(wall => segmentDistance(x, y, wall.x1, wall.y1, wall.x2, wall.y2) < 3)) covered += 1;
      }
    });
    return covered / total > 0.6;
  });
};

for (const key of keys.filter(hasTemplatePlan)) {
  test(`the ${key} template keeps furniture apart and leaves doors free to open`, () => {
    const plan = build(key);
    for (const [index, floor] of plan.floors.entries()) {
      const items = solidItems(floor.entities);
      // 家具どうしが重ならない（椅子は机の下に少し入ってよい）
      for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i], b = items[j];
        if (FLAT_KINDS.has(a.kind) || FLAT_KINDS.has(b.kind) || a.kind === 'parasol' || b.kind === 'parasol' || STACKED.has([a.kind, b.kind].sort().join('+'))) continue;
        const pa = visualBox(a), pb = visualBox(b);
        const area = Math.max(0, Math.min(pa.x1, pb.x1) - Math.max(pa.x0, pb.x0)) * Math.max(0, Math.min(pa.y1, pb.y1) - Math.max(pa.y0, pb.y0));
        const ratio = area / Math.min((pa.x1 - pa.x0) * (pa.y1 - pa.y0), (pb.x1 - pb.x0) * (pb.y1 - pb.y0));
        const seated = (SEATS.has(a.kind) && TABLES.has(b.kind)) || (SEATS.has(b.kind) && TABLES.has(a.kind));
        assert.ok(ratio <= (seated ? 0.6 : 0.12), `${a.kind} at (${a.x}, ${a.y}) and ${b.kind} at (${b.x}, ${b.y}) on floor ${index} do not overlap`);
      }
      // ドアが開く所と、出入りする所（戸の前後40cm）に家具がない（パラソルは頭の上、ユニットバスは自分の戸がある箱）
      const blockers = items.filter(item => !FLAT_KINDS.has(item.kind) && !isStair(item) && item.kind !== 'parasol' && item.kind !== 'unitBath');
      const hit = (x, y) => blockers.find(item => { const b = visualBox(item); return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1; });
      for (const door of floor.entities.filter(item => item.type === 'door')) {
        const swing = !door.doorStyle || door.doorStyle === 'double' || door.doorStyle === 'gate';
        const a = Math.atan2(door.y2 - door.y1, door.x2 - door.x1), length = Math.hypot(door.x2 - door.x1, door.y2 - door.y1);
        const open = a + ((door.flip ? 1 : -1) * Math.PI) / 2;
        const found = new Map();
        const count = (x, y) => { const item = hit(x, y); if (item) found.set(item, (found.get(item) ?? 0) + 1); };
        if (swing) {
          const leaves = door.doorStyle ? doubleLeaves() : [{ hinge: -1, width: 1 }];
          for (const leaf of leaves) {
            const [hx, hy] = leaf.hinge < 0 ? [door.x1, door.y1] : [door.x2, door.y2];
            const closed = leaf.hinge < 0 ? a : a + Math.PI;
            let sweep = open - closed;
            while (sweep > Math.PI) sweep -= 2 * Math.PI;
            while (sweep < -Math.PI) sweep += 2 * Math.PI;
            for (let r = 15; r < length * leaf.width - 5; r += 10) for (let t = 0.1; t < 1; t += 0.1) count(hx + r * Math.cos(closed + sweep * t), hy + r * Math.sin(closed + sweep * t));
          }
        }
        for (const side of swing ? [-1] : [-1, 1]) for (let d = 10; d <= 40; d += 10) for (let t = 0.15; t < 0.9; t += 0.1) {
          count(door.x1 + (door.x2 - door.x1) * t + side * Math.cos(open) * d, door.y1 + (door.y2 - door.y1) * t + side * Math.sin(open) * d);
        }
        for (const [item, n] of found) assert.ok(n < 3, `the door (${door.x1}, ${door.y1})-(${door.x2}, ${door.y2}) on floor ${index} is not blocked by the ${item.kind} at (${item.x}, ${item.y})`);
      }
    }
  });
}

// 壁で囲んだ部屋の上には、屋根か上の階がある（階段の穴と、囲まれた庭・闘技場は除く）
for (const key of keys.filter(hasTemplatePlan)) {
  test(`the rooms of the ${key} template are under a roof or the floor above`, () => {
    const plan = build(key);
    plan.floors.forEach((floor, index) => {
      const roofs = plan.roofs.filter(roof => roof.floorId === floor.id).map(roof => [roofOutline(roof)]);
      const upper = (plan.floors[index + 1]?.entities ?? []).filter(item => item.type === 'room').map(room => [floorPolygon(room)[0]]);
      const stairs = floor.entities.filter(isStair).map(stair => [stairFootprint(stair)]);
      const covered = (x, y) => [...roofs, ...upper, ...stairs].some(polygon => pointInPolygon(x, y, polygon));
      for (const room of walledRooms(floor.entities).filter(room => !OPEN_ROOMS.has(room.name))) {
        const ring = floorPolygon(room)[0], xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
        let total = 0, open = 0;
        for (let x = Math.min(...xs) + 25; x < Math.max(...xs); x += 50) for (let y = Math.min(...ys) + 25; y < Math.max(...ys); y += 50) {
          if (!pointInPolygon(x, y, floorPolygon(room))) continue;
          total += 1;
          if (!covered(x, y)) open += 1;
        }
        assert.ok(open <= total * 0.03, `"${room.name}" on floor ${index} is under a roof (${open} of ${total} points are open)`);
      }
    });
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
