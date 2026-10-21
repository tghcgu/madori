import test from 'node:test';
import assert from 'node:assert/strict';
import { roomContents, polygonArea } from '../src/room-contents.ts';
import { openingOnWall, snapToWall } from '../src/wall-snap.ts';

const rect = (id, x, y, w, h) => ({ id, polygon: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]] });
const wall = (id, x1, y1, x2, y2) => ({ id, x1, y1, x2, y2, reach: 7 });

test('a room takes the things inside it, its own walls and the doors in them, but not shared walls', () => {
  const yard = rect('yard', -500, -500, 2000, 1500);
  const living = rect('living', 0, 0, 400, 300);
  const kitchen = rect('kitchen', 400, 0, 300, 300);
  const closet = rect('closet', 20, 20, 100, 80);
  const rooms = [yard, living, kitchen, closet];
  const points = [
    { id: 'sofa', x: 200, y: 200 }, { id: 'chair', x: 550, y: 150 }, { id: 'boxInCloset', x: 60, y: 60 },
    { id: 'tree', x: -200, y: -200 }, { id: 'note', x: 300, y: 100 },
  ];
  const segments = [
    wall('north', 0, 0, 400, 0), wall('west', 0, 0, 0, 300), wall('south', 0, 300, 400, 300),
    wall('shared', 400, 0, 400, 300), wall('kitchenNorth', 400, 0, 700, 0), wall('long', 0, -5, 700, -5),
    wall('door', 150, 300, 230, 300), wall('closetWall', 20, 100, 120, 100),
  ];
  const moved = roomContents(living, rooms, points, segments);
  assert.deepEqual([...moved].sort(), ['door', 'north', 'note', 'sofa', 'south', 'west']);
  // 庭（ほかの部屋を囲む大きな部屋）を動かしても、家の中の物は動かない
  assert.deepEqual([...roomContents(yard, rooms, points, segments)].sort(), ['tree']);
  assert.equal(polygonArea(living.polygon), 120000);
});

test('furniture near a wall turns its back to the wall and touches it', () => {
  const walls = [{ x1: 0, y1: 0, x2: 600, y2: 0, thickness: 12 }, { x1: 0, y1: 0, x2: 0, y2: 400, thickness: 12 }];
  const sofa = { x: 200, y: 20, w: 200, h: 80, rotation: 0 };
  // 上の壁の近く: 背を上（回す前の奥）に向け、背が壁の面（y = 6）に付く
  assert.deepEqual(snapToWall(sofa, walls), { x: 200, y: 6, w: 200, h: 80, rotation: 0 });
  // 左の壁の近く: 背を左に向ける（270°）。中心は壁の面から奥行の半分
  const side = snapToWall({ x: -60, y: 160, w: 200, h: 80, rotation: 0 }, walls);
  assert.equal(side.rotation, 270);
  assert.equal(side.x + side.w / 2, 6 + 40);
  assert.equal(side.y + side.h / 2, 200);
  // 壁の下側（外）にあれば、背を下に向けて外から付く
  assert.equal(snapToWall({ x: 200, y: -100, w: 200, h: 80, rotation: 0 }, walls).rotation, 180);
  // 遠ければ付けない
  assert.equal(snapToWall({ x: 200, y: 200, w: 200, h: 80, rotation: 0 }, walls), null);
  // 斜めの壁
  const diagonal = snapToWall({ x: 140, y: 140, w: 40, h: 40, rotation: 0 }, [{ x1: 0, y1: 300, x2: 300, y2: 0, thickness: 10 }]);
  assert.equal(diagonal.rotation, 315);
});

test('a click near a wall places a door of the usual width on it, opening toward the click', () => {
  const walls = [{ x1: 0, y1: 0, x2: 400, y2: 0, thickness: 10 }];
  // 壁の向き（右）に対して右側（y が正）を押した: side 1
  assert.deepEqual(openingOnWall({ x: 203, y: 20 }, walls, 80, 40), { x1: 160, y1: 0, x2: 240, y2: 0, side: 1 });
  // 壁の端の近くでは、はみ出さない
  assert.deepEqual(openingOnWall({ x: 10, y: -15 }, walls, 80, 40), { x1: 0, y1: 0, x2: 80, y2: 0, side: -1 });
  // 遠い所・壁の先では置かない
  assert.equal(openingOnWall({ x: 200, y: 60 }, walls, 80, 40), null);
  assert.equal(openingOnWall({ x: 500, y: 0 }, walls, 80, 40), null);
  // 短い壁には壁いっぱい
  assert.deepEqual(openingOnWall({ x: 30, y: 5 }, [{ x1: 0, y1: 0, x2: 60, y2: 0, thickness: 10 }], 80, 40), { x1: 0, y1: 0, x2: 60, y2: 0, side: 1 });
});
