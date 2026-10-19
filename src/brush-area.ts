// ペンで塗った形（幅のある線）を、穴のある多角形にする。床・池・芝生などを「ペンで塗る」「けずる」ときに使う。
// 塗った線は、線の区切りごとの四角と、点ごとの丸を合わせた形（角と両端は丸い）。輪のように塗れば、穴のあいた形（ドーナツ）になる。
// 長さの単位は cm
import clipping, { type MultiPolygon, type Pair, type Polygon } from "polygon-clipping";
import { simplifyFreeLine } from "./free-shapes.ts";
import { MAX_FLOOR_VERTICES, normalizeFloorHoles, normalizeOutline, signedArea } from "./floor-outline.ts";

// 塗る幅（cm）
export const BRUSH_WIDTH_RANGE = { min: 10, max: 2000 };
export const DEFAULT_BRUSH_WIDTH = 100;
// 自由な形（池・芝生など）の穴の数と、輪1つの点の数の上限
export const MAX_FREE_HOLES = 32;
export const MAX_FREE_RING_POINTS = 400;

export function clampBrushWidth(value: unknown, fallback = DEFAULT_BRUSH_WIDTH): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(BRUSH_WIDTH_RANGE.max, Math.max(BRUSH_WIDTH_RANGE.min, Math.round(value))) : fallback;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// 中心 c・半径 r の丸（点の数は大きさに合わせる）
function circle([cx, cy]: Pair, r: number): Pair[] {
  const count = Math.min(32, Math.max(12, Math.ceil((Math.PI * 2 * r) / 10)));
  return Array.from({ length: count }, (_, i): Pair => {
    const a = (i / count) * Math.PI * 2;
    return [round2(cx + Math.cos(a) * r), round2(cy + Math.sin(a) * r)];
  });
}

// 線の点（cm）を、幅 width の帯にした形。点が1つなら丸
export function brushStroke(points: Pair[], width: number): MultiPolygon {
  const r = Math.max(1, width / 2);
  const spaced: Pair[] = [];
  for (const point of points) {
    if (!point.every(Number.isFinite)) continue;
    const last = spaced[spaced.length - 1];
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.5) spaced.push([point[0], point[1]]);
  }
  if (!spaced.length) return [];
  // 太い線ほど、細かい手ぶれは形に出ないので、点を減らしてから合わせる（軽くする）
  const line = spaced.length > 2 ? simplifyFreeLine(spaced, Math.max(0.5, r * 0.04)) : spaced;
  const pieces: Polygon[] = line.map((point) => [circle(point, r)]);
  for (let i = 0; i < line.length - 1; i += 1) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const length = Math.hypot(bx - ax, by - ay);
    if (length < 1e-6) continue;
    const nx = (-(by - ay) / length) * r, ny = ((bx - ax) / length) * r;
    pieces.push([[[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]].map(([x, y]): Pair => [round2(x), round2(y)])]);
  }
  try {
    return clipping.union(pieces[0], ...pieces.slice(1));
  } catch {
    return [];
  }
}

// 形を合わせる（重なった所は1つにつながる）
export function unionRegions(...regions: MultiPolygon[]): MultiPolygon {
  const parts = regions.filter((region) => region.length);
  if (!parts.length) return [];
  try {
    return clipping.union(parts[0], ...parts.slice(1));
  } catch {
    return parts[0];
  }
}

// 形から、別の形をけずる
export function subtractRegion(region: MultiPolygon, cut: MultiPolygon): MultiPolygon {
  if (!region.length || !cut.length) return region;
  try {
    return clipping.difference(region, cut);
  } catch {
    return region;
  }
}

// 穴を引いた面積（cm²）
export function regionArea(region: MultiPolygon): number {
  return region.reduce((sum, polygon) => sum + Math.abs(signedArea(polygon[0])) - polygon.slice(1).reduce((holes, ring) => holes + Math.abs(signedArea(ring)), 0), 0);
}

// 2つの形が重なっているか（少しでも面積が重なれば重なっている）
export function regionsOverlap(a: MultiPolygon, b: MultiPolygon, minArea = 1): boolean {
  if (!a.length || !b.length) return false;
  try {
    return regionArea(clipping.intersection(a, b)) >= minArea;
  } catch {
    return false;
  }
}

// 閉じた輪の最後の点（最初と同じ点）を外す
function openRing(ring: Pair[]): Pair[] {
  const last = ring[ring.length - 1], first = ring[0];
  return ring.length > 1 && last[0] === first[0] && last[1] === first[1] ? ring.slice(0, -1) : ring.slice();
}

// 輪の点を減らす: いちばん離れた2点で2本の線に分けて、それぞれ減らす
export function simplifyClosedRing(ring: Pair[], tolerance: number): Pair[] {
  if (ring.length <= 4 || tolerance <= 0) return ring;
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

// 輪を、点の数が上限に収まるまで（許す誤差を広げながら）減らす
function fitRing(ring: Pair[], tolerance: number, maxPoints: number): Pair[] {
  let limit = tolerance, simple = simplifyClosedRing(ring, limit);
  while (simple.length > maxPoints && limit < 1e5) {
    limit *= 1.6;
    simple = simplifyClosedRing(ring, limit);
  }
  return simple;
}

export interface RegionOptions {
  // 点を減らすときに許す誤差（cm）
  tolerance?: number;
  // 輪1つの点の数、穴の数の上限
  maxPoints?: number;
  maxHoles?: number;
  // これより小さい面（cm²）と穴は捨てる
  minArea?: number;
}

// 塗った形を、扱いやすい輪にそろえる: 点を減らし、小さな面と穴を捨て、穴は大きい順に上限まで。大きい面から並べる
export function tidyRegion(region: MultiPolygon, options: RegionOptions = {}): Pair[][][] {
  const tolerance = options.tolerance ?? 1.5, maxPoints = options.maxPoints ?? MAX_FREE_RING_POINTS;
  const maxHoles = options.maxHoles ?? MAX_FREE_HOLES, minArea = options.minArea ?? 25;
  const polygons: { rings: Pair[][]; area: number }[] = [];
  for (const polygon of region) {
    const outer = fitRing(openRing(polygon[0]), tolerance, maxPoints);
    const outerArea = Math.abs(signedArea(outer));
    if (outer.length < 3 || outerArea < minArea) continue;
    const holes = polygon.slice(1)
      .map((ring) => fitRing(openRing(ring), tolerance, maxPoints))
      .map((ring) => ({ ring, area: Math.abs(signedArea(ring)) }))
      .filter(({ ring, area }) => ring.length >= 3 && area >= minArea)
      .sort((a, b) => b.area - a.area)
      .slice(0, maxHoles);
    polygons.push({ rings: [outer, ...holes.map(({ ring }) => ring)], area: outerArea - holes.reduce((sum, { area }) => sum + area, 0) });
  }
  return polygons.sort((a, b) => b.area - a.area).map(({ rings }) => rings);
}

// 床の形（範囲と、範囲に対する割合の輪郭・穴）。床の点の数（MAX_FLOOR_VERTICES）と穴の数（32）に収める。
// 穴が輪郭からはみ出したり重なったりして床にできないときは、点を減らすのを控えめにし、それでもだめな穴は捨てる
export interface FloorRegion { x: number; y: number; w: number; h: number; outline: Pair[]; holes?: Pair[][]; }

export function floorFromRegion(rings: Pair[][], tolerance = 1.5): FloorRegion | null {
  const [outerRing, ...holeRings] = rings;
  if (!outerRing || outerRing.length < 3) return null;
  for (let limit = tolerance; limit < 2000; limit *= 1.6) {
    const outer = fitRing(outerRing, limit, MAX_FLOOR_VERTICES);
    if (outer.length < 3) return null;
    const xs = outer.map((p) => p[0]), ys = outer.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    if (w < 1 || h < 1) return null;
    const fraction = (ring: Pair[]): Pair[] => ring.map(([px, py]): Pair => [Math.min(1, Math.max(0, (px - x) / w)), Math.min(1, Math.max(0, (py - y) / h))]);
    let outline: Pair[] | undefined;
    try { outline = normalizeOutline(fraction(outer)); } catch { continue; }
    if (!outline) continue;
    // 穴は1つずつ確かめ、床にできる物だけを残す
    let holes: Pair[][] = [];
    for (const ring of holeRings.slice(0, 32)) {
      const hole = fitRing(ring, limit, MAX_FLOOR_VERTICES);
      if (hole.length < 3) continue;
      const candidate = [...holes, fraction(hole)];
      try {
        if (normalizeFloorHoles(candidate, outline)) holes = candidate;
      } catch { /* はみ出す・重なる穴は捨てる */ }
    }
    return { x, y, w, h, outline, ...(holes.length ? { holes } : {}) };
  }
  return null;
}
