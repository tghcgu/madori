// 部屋を動かす・消すときに一緒に扱う「部屋の中身」を決める（main.ts が使う。テストが読む）。
// - 家具・文字・図形（点で表す物）: その点を含む部屋のうち、いちばん小さい部屋がその部屋なら中身
//   （部屋の中の部屋の家具は、内側の部屋の物。庭の上に家がある間取りで庭を動かしても、家の中の家具は動かない）
// - 壁・ドア・窓（線で表す物）: 両端と真ん中がその部屋の中か縁にあり、真ん中がほかの部屋（その部屋を囲む大きな部屋は除く）の
//   中や縁にかからなければ中身（隣の部屋との境の壁は、隣の部屋の縁にもかかるので動かさない）
// このファイルは DOM を触らない
import { pointInPolygon } from "./floor-outline.ts";

type Pair = [number, number];
export interface ContentRoom { id: string; polygon: Pair[][] }
export interface ContentPoint { id: string; x: number; y: number }
// reach: 縁に「かかる」とみなす距離（壁の厚みの半分など）
export interface ContentSegment { id: string; x1: number; y1: number; x2: number; y2: number; reach: number }

function ringArea(ring: Pair[]): number {
  let sum = 0;
  ring.forEach(([x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length];
    sum += x * ny - nx * y;
  });
  return Math.abs(sum) / 2;
}

export function polygonArea(polygon: Pair[][]): number {
  return Math.max(0, ringArea(polygon[0]) - polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0));
}

function distanceToSegment(x: number, y: number, [ax, ay]: Pair, [bx, by]: Pair): number {
  const dx = bx - ax, dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

function distanceToRing(x: number, y: number, ring: Pair[]): number {
  let best = Infinity;
  ring.forEach((point, i) => { best = Math.min(best, distanceToSegment(x, y, point, ring[(i + 1) % ring.length])); });
  return best;
}

// 部屋の中か、縁から reach 以内か
export function onOrInside(room: ContentRoom, x: number, y: number, reach: number): boolean {
  return pointInPolygon(x, y, room.polygon) || room.polygon.some((ring) => distanceToRing(x, y, ring) <= reach);
}

export function roomContents(target: ContentRoom, rooms: readonly ContentRoom[], points: readonly ContentPoint[], segments: readonly ContentSegment[]): Set<string> {
  const area = new Map(rooms.map((room) => [room.id, polygonArea(room.polygon)]));
  const targetArea = polygonArea(target.polygon);
  // その部屋を囲む部屋（外の床・庭など）は数えない
  const outer = new Set(rooms.filter((room) => room.id !== target.id && (area.get(room.id) ?? 0) > targetArea
    && target.polygon[0].every(([x, y]) => onOrInside(room, x, y, 1))).map((room) => room.id));
  const others = rooms.filter((room) => room.id !== target.id && !outer.has(room.id));
  const result = new Set<string>();
  for (const point of points) {
    let best: ContentRoom | null = null, bestArea = Infinity;
    for (const room of rooms) {
      if (!pointInPolygon(point.x, point.y, room.polygon)) continue;
      const roomArea = area.get(room.id) ?? Infinity;
      if (roomArea < bestArea) { best = room; bestArea = roomArea; }
    }
    if (best?.id === target.id) result.add(point.id);
  }
  for (const segment of segments) {
    const middle: Pair = [(segment.x1 + segment.x2) / 2, (segment.y1 + segment.y2) / 2];
    const ends: Pair[] = [[segment.x1, segment.y1], [segment.x2, segment.y2], middle];
    if (!ends.every(([x, y]) => onOrInside(target, x, y, segment.reach))) continue;
    if (others.some((room) => onOrInside(room, middle[0], middle[1], segment.reach))) continue;
    result.add(segment.id);
  }
  return result;
}
