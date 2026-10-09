import assert from 'node:assert/strict';
import test from 'node:test';
import { FURNITURE_DEFS } from '../src/furniture-catalog.ts';
import { TEMPLATE_GROUPS, hasTemplatePlan, templatePlan } from '../src/templates.ts';

// main.ts で作る雛形（住まいの4種類と作例）
const IN_MAIN = ['studio', 'oneLdk', 'twoLdk', 'twoStory', 'sample'];
const keys = TEMPLATE_GROUPS.flatMap(group => group.templates.map(template => template.key));

function build(key) {
  let counter = 0;
  return templatePlan(key, prefix => `${prefix}-${(counter += 1)}`, FURNITURE_DEFS);
}

// 回したあとの見た目の箱
function visualBox(item) {
  const sideways = item.rotation === 90 || item.rotation === 270;
  const w = sideways ? item.h : item.w, h = sideways ? item.w : item.h;
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

test('there are 50 templates in six groups, each with a plan', () => {
  assert.equal(keys.length, 50);
  assert.equal(TEMPLATE_GROUPS.length, 6);
  assert.equal(new Set(keys).size, 50, 'no key is listed twice');
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
      for (const room of rooms) assert.ok(room.w > 0 && room.h > 0);
      // ドア・窓は、どれかの部屋の縁の上にある
      const edges = rooms.flatMap(room => [
        [room.x, room.y, room.x + room.w, room.y], [room.x, room.y + room.h, room.x + room.w, room.y + room.h],
        [room.x, room.y, room.x, room.y + room.h], [room.x + room.w, room.y, room.x + room.w, room.y + room.h],
      ]);
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
        const inside = (x, y) => rooms.some(room => x >= room.x - 1 && x <= room.x + room.w + 1 && y >= room.y - 1 && y <= room.y + room.h + 1);
        for (const [x, y] of [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]]) assert.ok(inside(x, y), `${label} is inside the plan`);
        // 壁を突き抜けない（壁に沿わせるのはよい）
        for (const wall of walls) {
          if (wall.y1 === wall.y2) {
            const crosses = box.y0 < wall.y1 - 1 && box.y1 > wall.y1 + 1 && box.x0 < Math.max(wall.x1, wall.x2) - 1 && box.x1 > Math.min(wall.x1, wall.x2) + 1;
            assert.ok(!crosses, `${label} does not cut through the wall at y=${wall.y1}`);
          } else {
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
          const overlaps = box.x0 < label.x1 - 2 && box.x1 > label.x0 + 2 && box.y0 < label.y1 - 2 && box.y1 > label.y0 + 2;
          assert.ok(!overlaps, `${name} is not under the ${item.kind} at (${item.x}, ${item.y})`);
        }
      }
    }
  });
}

test('the mansion has a cellar under the ground floor, and opens on the ground floor', () => {
  const plan = build('westernMansion');
  assert.equal(plan.basements, 1);
  assert.equal(plan.floors.length, 3);
  assert.equal(plan.activeFloor, 1);
});
