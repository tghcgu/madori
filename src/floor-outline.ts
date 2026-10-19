import clipping, { type Pair, type Polygon, type MultiPolygon } from "polygon-clipping";
import { simplifyFreeLine, smoothFreeLine } from "./free-shapes.ts";

export interface FloorOutline { x: number; y: number; w: number; h: number; outline?: Pair[]; holes?: Pair[][] }
export const MAX_FLOOR_VERTICES = 128;
export const RECT_OUTLINE: Pair[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

export function signedArea(points: Pair[]): number {
  return points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
}

export function normalizeOutline(value: unknown): Pair[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 3 || value.length > MAX_FLOOR_VERTICES
    || value.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1))) throw new Error("Invalid floor outline");
  const points = value.map(p => [p[0], p[1]] as Pair);
  const area = Math.abs(signedArea(points));
  const repaired = clipping.union([points]);
  if (area < 1e-8 || repaired.length !== 1 || repaired[0].length !== 1
    || Math.abs(Math.abs(signedArea(repaired[0][0])) - area) > 1e-8) throw new Error("Self-intersecting floor outline");
  return points;
}

export function floorPoints(floor: FloorOutline): Pair[] {
  return (floor.outline ?? RECT_OUTLINE).map(([x, y]) => [floor.x + x * floor.w, floor.y + y * floor.h]);
}

export function floorPolygon(floor: FloorOutline): Polygon {
  return [floorPoints(floor), ...(floor.holes ?? []).map(ring => ring.map(([x, y]): Pair => [floor.x + x * floor.w, floor.y + y * floor.h]))];
}

export function normalizeFloorHoles(value: unknown, outline?: Pair[]): Pair[][] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 32) throw new Error("Invalid floor holes");
  const holes = value.map(ring => normalizeOutline(ring));
  if (holes.some(ring => !ring)) throw new Error("Invalid floor hole");
  const rings = holes as Pair[][];
  if (!rings.length) return undefined;
  const outer = outline ?? RECT_OUTLINE;
  const area = (polygons: MultiPolygon) => polygons.reduce((sum, polygon) => sum + Math.abs(signedArea(polygon[0])) - polygon.slice(1).reduce((s, ring) => s + Math.abs(signedArea(ring)), 0), 0);
  const expected = rings.reduce((sum, ring) => sum + Math.abs(signedArea(ring)), 0);
  const merged = clipping.union(...rings.map(ring => [ring]) as [Polygon, ...Polygon[]]);
  if (Math.abs(area(merged) - expected) > 1e-8 || Math.abs(area(clipping.intersection([outer], merged)) - expected) > 1e-8) throw new Error("Overlapping or external floor holes");
  return rings;
}

export function outlineFromPoints(points: Pair[]): FloorOutline | null {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  if (w < 1 || h < 1) return null;
  try { return { x, y, w, h, outline: normalizeOutline(points.map(p => [(p[0] - x) / w, (p[1] - y) / h])) }; }
  catch { return null; }
}

// なぞった線（cm）から床の輪郭の点を作る。手の揺れをならして点を減らし、線が交わった所はほどいて、いちばん大きい面の外側を使う。
// 点が多すぎるとき（床の点は MAX_FLOOR_VERTICES まで）は、許す誤差を広げて減らす
export function tracedFloorPoints(path: Pair[], tolerance = 3): Pair[] | null {
  const points = path.filter((p, i) => i === 0 || Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) > 0.5);
  if (points.length < 3) return null;
  let pieces: MultiPolygon;
  try { pieces = clipping.union([smoothFreeLine(points, true)]); } catch { return null; }
  const largest = pieces.map(polygon => polygon[0]).sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))[0];
  if (!largest) return null;
  const ring = largest.slice(0, -1);
  for (let limit = tolerance; limit < 500; limit *= 1.6) {
    const simple = simplifyRing(ring, limit);
    if (simple.length < 3) return null;
    if (simple.length <= MAX_FLOOR_VERTICES && outlineFromPoints(simple)) return simple;
  }
  return null;
}

// 輪の点を減らす: いちばん離れた2点で2本の線に分けて、それぞれ減らす
function simplifyRing(ring: Pair[], tolerance: number): Pair[] {
  let far = 0, best = -1;
  ring.forEach(([x, y], i) => {
    const d = Math.hypot(x - ring[0][0], y - ring[0][1]);
    if (d > best) { best = d; far = i; }
  });
  if (far === 0) return ring;
  const first = simplifyFreeLine(ring.slice(0, far + 1), tolerance);
  const second = simplifyFreeLine([...ring.slice(far), ring[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

export function pointInRing(x: number, y: number, points: Pair[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(x: number, y: number, polygon: Polygon): boolean {
  return pointInRing(x, y, polygon[0]) && !polygon.slice(1).some(ring => pointInRing(x, y, ring));
}

// 穴のある多角形（いくつか）の内側かを調べる関数。たくさんの点を調べるときのために、輪ごとの外枠で遠い輪をすぐに外す
export function multiPolygonTester(polygons: MultiPolygon): (x: number, y: number) => boolean {
  const boxed = polygons.map(polygon => polygon.map(ring => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    return { ring, minX, minY, maxX, maxY };
  }));
  type Boxed = (typeof boxed)[number][number];
  const inside = (x: number, y: number, box: Boxed) => x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY && pointInRing(x, y, box.ring);
  return (x, y) => boxed.some(([outer, ...holes]) => inside(x, y, outer) && !holes.some(hole => inside(x, y, hole)));
}

// 後から置いた床を差し引き、凹形や穴のある床でも面がちらつかないようにする。
export function visibleFloorPolygons(floor: FloorOutline, later: FloorOutline[]): MultiPolygon {
  const shape = floorPolygon(floor);
  return later.length ? clipping.difference(shape, ...later.map(floorPolygon)) : [shape];
}
