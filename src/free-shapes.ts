// 自由な形の家具・設備（なぞって形を作る池・花壇・芝生・ラグ、なぞった道すじに沿う川・小道・生け垣・石垣・柵・竹垣・線路・飛び石）。
// 2D（main.ts）と3D（furniture-models.ts）の両方が、ここで決めた輪郭・帯・石や杭の位置から作るので、3Dを真上から見ると2Dと同じになる。
// 道すじ（path）は、家具の中心を原点に、幅・奥行に対する割合で持つ（足跡・ペンと同じ）。長さの単位は cm
import type { Ellipse, Point2, StoneSlab } from "./furniture-shapes.ts";

// 閉じた形（なぞった線で囲む）
export const FREE_AREA_KINDS = ["pond", "flowerBed", "lawn", "rug"] as const;
// 線の形（なぞった道すじに沿う）
export const FREE_LINE_KINDS = ["river", "pathway", "hedge", "stoneWall", "fence", "takegaki", "railway", "steppingStones"] as const;
// 置いたときから自由な形の種類（クリックで置くと、決まった形の道すじを持つ）。
// ほかの種類（池・花壇・ラグ・柵・竹垣・飛び石）は、なぞったときだけ自由な形になり、クリックならいつもの形
export const ALWAYS_FREE_KINDS = ["lawn", "river", "pathway", "hedge", "stoneWall", "railway"] as const;

export type FreeAreaKind = (typeof FREE_AREA_KINDS)[number];
export type FreeLineKind = (typeof FREE_LINE_KINDS)[number];
export type FreeKind = FreeAreaKind | FreeLineKind;

export function isFreeShapeKind(kind: string): kind is FreeKind {
  return (FREE_AREA_KINDS as readonly string[]).includes(kind) || (FREE_LINE_KINDS as readonly string[]).includes(kind);
}
export function isFreeAreaKind(kind: string): kind is FreeAreaKind {
  return (FREE_AREA_KINDS as readonly string[]).includes(kind);
}
export function isAlwaysFreeKind(kind: string): boolean {
  return (ALWAYS_FREE_KINDS as readonly string[]).includes(kind);
}

// 線の形の幅（cm）。川・小道・生け垣・石垣は変えられる（brush に持つ）
const LINE_WIDTH: Record<FreeLineKind, number> = {
  river: 140, pathway: 90, hedge: 60, stoneWall: 45, fence: 6, takegaki: 8, railway: 300, steppingStones: 44,
};
export const FREE_WIDTH_RANGE = { min: 10, max: 2000 };
export function isFreeWidthAdjustable(kind: string): boolean {
  return kind === "river" || kind === "pathway" || kind === "hedge" || kind === "stoneWall";
}
export function freeLineWidth(kind: FreeLineKind, brush?: number): number {
  return isFreeWidthAdjustable(kind) && typeof brush === "number" && Number.isFinite(brush)
    ? Math.min(FREE_WIDTH_RANGE.max, Math.max(FREE_WIDTH_RANGE.min, brush))
    : LINE_WIDTH[kind];
}

// なぞった道すじのまわりに足す余白（cm）。石や縁がはみ出さない大きさ
export function freeMargin(kind: FreeKind, brush?: number): number {
  if (!isFreeAreaKind(kind)) return freeLineWidth(kind, brush) / 2 + (kind === "river" ? 14 : 6);
  return kind === "pond" ? 20 : kind === "flowerBed" ? 8 : 4;
}

// クリックで置いたときの道すじ（割合）。閉じた形は丸みのある形、線の形はまっすぐ
export function defaultFreePath(kind: FreeKind): number[][] {
  if (isFreeAreaKind(kind)) {
    const radii = [1, 0.92, 0.98, 0.88, 0.96, 1, 0.9, 0.95, 0.99, 0.9];
    return radii.map((k, i) => {
      const a = (i / radii.length) * Math.PI * 2;
      return [round4(Math.cos(a) * 0.46 * k), round4(Math.sin(a) * 0.46 * k)];
    });
  }
  return [[-0.42, 0], [0, 0], [0.42, 0]];
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

// なぞった点（間取りの cm）から、余白を付けた範囲と、範囲に対する割合の道すじを作る（編集画面でなぞったときも、テンプレートでも同じ）
export function freeFrame(points: Point2[], margin: number): { x: number; y: number; w: number; h: number; path: number[][] } {
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const tenth = (value: number) => Math.round(value * 10) / 10;
  const w = tenth(Math.max(20, Math.max(...xs) - Math.min(...xs) + margin * 2));
  const h = tenth(Math.max(20, Math.max(...ys) - Math.min(...ys) + margin * 2));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return {
    x: tenth(cx - w / 2), y: tenth(cy - h / 2), w, h,
    path: points.map(([x, y]) => [round4((x - cx) / w), round4((y - cy) / h)]),
  };
}

// 割合の道すじを cm の点にする
export function freePathPoints(path: number[][], w: number, h: number): Point2[] {
  return path.filter((point) => point.length >= 2 && point.every(Number.isFinite)).map(([x, y]) => [x * w, y * h]);
}

// 角を2回切り落として、なめらかにする（チャイキン法）。線の形は両端を残す。
// 切り落とすのは区切りの1/4まで、ただし長い区切りでも最大 30cm（塀や堀のまっすぐな角が大きく丸まらないように）
const MAX_CORNER_CUT = 30;
export function smoothFreeLine(points: Point2[], closed: boolean, rounds = 2): Point2[] {
  let line = points;
  for (let round = 0; round < rounds && line.length >= 3; round += 1) {
    const next: Point2[] = closed ? [] : [line[0]];
    const count = closed ? line.length : line.length - 1;
    for (let i = 0; i < count; i += 1) {
      const a = line[i], b = line[(i + 1) % line.length];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const t = length > 0 ? Math.min(0.25, MAX_CORNER_CUT / length) : 0.25;
      next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], [b[0] - (b[0] - a[0]) * t, b[1] - (b[1] - a[1]) * t]);
    }
    if (!closed) next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

// 形をほとんど変えずに点を減らす（ダグラス・ポーカー法）。なめらかにした線は点が多いので、2Dと3Dの両方で軽くする
export function simplifyFreeLine(points: Point2[], tolerance: number): Point2[] {
  if (points.length < 3) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = points[first], [bx, by] = points[last];
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
    let farthest = -1, distance = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      // 線分までの距離（始めと終わりが同じ点の、輪になった線でも消えないように）
      const [px, py] = points[i];
      const t = length2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0;
      const d = Math.hypot(px - ax - dx * t, py - ay - dy * t);
      if (d > distance) {
        farthest = i;
        distance = d;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

// 角をとがらせた道すじ。角の点を3つ重ねておくと、なめらかにしても（2Dも3Dも）角が丸まらない。線の両端はそのまま
export function sharpCorners(points: Point2[], closed: boolean): Point2[] {
  return points.flatMap((point, i): Point2[] => (closed || (i > 0 && i < points.length - 1) ? [point, point, point] : [point]));
}

// 点を通るなめらかな曲線（セントリペタル Catmull-Rom）。closed なら輪にする。区切りごとに約 step cm で点を置く
export function curveThrough(points: Point2[], closed: boolean, step = 15): Point2[] {
  const n = points.length;
  if (n < 3) return points.map(([x, y]): Point2 => [x, y]);
  const at = (i: number): Point2 => {
    if (closed) return points[((i % n) + n) % n];
    // 線の両端は、外側へまっすぐのばした点を使う
    if (i < 0) return [2 * points[0][0] - points[1][0], 2 * points[0][1] - points[1][1]];
    if (i > n - 1) return [2 * points[n - 1][0] - points[n - 2][0], 2 * points[n - 1][1] - points[n - 2][1]];
    return points[i];
  };
  const knot = (a: Point2, b: Point2) => Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-3);
  const lerp = (a: Point2, b: Point2, ta: number, tb: number, t: number): Point2 => {
    const k = (t - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const out: Point2[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i += 1) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const count = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < count; k += 1) {
      const t = t1 + ((t2 - t1) * k) / count;
      const a1 = lerp(p0, p1, t0, t1, t), a2 = lerp(p1, p2, t1, t2, t), a3 = lerp(p2, p3, t2, t3, t);
      const b1 = lerp(a1, a2, t0, t2, t), b2 = lerp(a2, a3, t1, t3, t);
      out.push(lerp(b1, b2, t1, t2, t));
    }
  }
  if (!closed) out.push([points[n - 1][0], points[n - 1][1]]);
  return out;
}

// 線の形の中心線（なめらかにして、見た目が変わらない程度に点を減らす）
export function freeCenterLine(points: Point2[]): Point2[] {
  return simplifyFreeLine(smoothFreeLine(points, false), 0.6);
}

export function polygonArea(points: Point2[]): number {
  let area = 0;
  points.forEach(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    area += x * ny - nx * y;
  });
  return area / 2;
}

export function pointInFreePolygon(x: number, y: number, points: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment(x: number, y: number, a: Point2, b: Point2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

// 点から線（折れ線）までの近さ
export function distanceToFreeLine(x: number, y: number, points: Point2[], closed: boolean): number {
  let best = Infinity;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i += 1) best = Math.min(best, distanceToSegment(x, y, points[i], points[(i + 1) % points.length]));
  return points.length === 1 ? Math.hypot(x - points[0][0], y - points[0][1]) : best;
}

// 折れ線を、左（進む向きに対して）へ distance だけずらした線。角では、ずらす量を少し増やして幅をそろえる
export function offsetFreeLine(points: Point2[], distance: number, closed: boolean): Point2[] {
  const count = points.length;
  return points.map((point, i) => {
    const prev = closed ? points[(i - 1 + count) % count] : points[Math.max(0, i - 1)];
    const next = closed ? points[(i + 1) % count] : points[Math.min(count - 1, i + 1)];
    const normal = (a: Point2, b: Point2): Point2 => {
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
      return [-dy / length, dx / length];
    };
    const n1 = i > 0 || closed ? normal(prev, point) : normal(point, next);
    const n2 = i < count - 1 || closed ? normal(point, next) : normal(prev, point);
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1];
    const length = Math.hypot(nx, ny);
    if (length < 1e-6) { nx = n1[0]; ny = n1[1]; } else { nx /= length; ny /= length; }
    const miter = Math.min(2, 1 / Math.max(0.5, nx * n1[0] + ny * n1[1]));
    return [point[0] + nx * distance * miter, point[1] + ny * distance * miter];
  });
}

export interface FreeSample { x: number; y: number; angle: number; }

// 折れ線に沿って、spacing ごとの位置と向き（進む向きの角度）。最初は start の所から
export function samplesAlong(points: Point2[], spacing: number, closed: boolean, start = spacing / 2): FreeSample[] {
  const segments: { a: Point2; b: Point2; length: number }[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length > 1e-6) segments.push({ a, b, length });
  }
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const samples: FreeSample[] = [];
  if (total <= 0 || spacing <= 0) return samples;
  let index = 0, before = 0;
  for (let at = start; at <= total + 1e-6 && samples.length < 4000; at += spacing) {
    while (index < segments.length - 1 && before + segments[index].length < at) before += segments[index++].length;
    const { a, b, length } = segments[index];
    const t = Math.min(1, Math.max(0, (at - before) / length));
    samples.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) });
  }
  return samples;
}

export function freeLineLength(points: Point2[], closed = false): number {
  let total = 0;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

// 0〜1 の決まった乱数（同じ番号なら、2Dと3Dで同じ値）
export function freeRandom(index: number, salt = 0): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

// ---- 閉じた形 ----

// 輪郭（なめらかにしたもの）。向きは時計回りにそろえる（2Dの画面の向き。外側を求めやすくする）
export function freeOutline(points: Point2[]): Point2[] {
  const outline = simplifyFreeLine(smoothFreeLine(points, true), 0.6);
  return polygonArea(outline) < 0 ? [...outline].reverse() : outline;
}

// 輪郭の内側に、間隔 spacing で並べた点（少しずらして自然に）。縁から inset より内側だけ。数が多すぎるときは間隔を広げる
export function pointsInside(outline: Point2[], spacing: number, inset: number, limit = 1500): Point2[] {
  const xs = outline.map((point) => point[0]), ys = outline.map((point) => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const area = Math.abs(polygonArea(outline));
  const step = Math.max(spacing, Math.sqrt(area / limit));
  const points: Point2[] = [];
  let index = 0;
  for (let y = minY + step / 2; y < maxY; y += step) {
    for (let x = minX + step / 2; x < maxX; x += step) {
      index += 1;
      const px = x + (freeRandom(index, 1) - 0.5) * step * 0.6, py = y + (freeRandom(index, 2) - 0.5) * step * 0.6;
      if (!pointInFreePolygon(px, py, outline) || distanceToFreeLine(px, py, outline, true) < inset) continue;
      points.push([px, py]);
    }
  }
  return points;
}

export interface FreePond { water: Point2[]; stones: StoneSlab[]; ripples: Ellipse[]; }

// 池: 水面の輪郭と、縁に並ぶ石、水面の波紋
export function freePond(points: Point2[]): FreePond {
  const water = freeOutline(points);
  const rim = offsetFreeLine(water, -5, true);
  const stones = samplesAlong(rim, 24, true, 0).map((sample, i): StoneSlab => ({
    x: sample.x, y: sample.y, rx: 13 * (0.85 + 0.3 * freeRandom(i, 3)), ry: 9 * (0.85 + 0.3 * freeRandom(i, 4)), angle: sample.angle,
  }));
  const inside = pointsInside(water, 40, 30, 60);
  const size = Math.sqrt(Math.abs(polygonArea(water)));
  const ripples = inside.length
    ? [inside[Math.floor(inside.length / 3)], inside[Math.floor((inside.length * 2) / 3)]].map(([x, y], i): Ellipse => ({ x, y, rx: size * (0.12 - i * 0.03), ry: size * (0.05 - i * 0.012) }))
    : [];
  return { water, stones, ripples };
}

export interface FreeFlower { x: number; y: number; r: number; color: string; }
export const FREE_FLOWER_COLORS = ["#e04f5f", "#f2c14e", "#f7f3ea", "#b06fd8", "#ef8bb7", "#ff8a3d"];

// 花壇: 縁（レンガ）の輪郭と、土の上の株（葉と花）
export function freeFlowerBed(points: Point2[]): { outline: Point2[]; plants: FreeFlower[] } {
  const outline = freeOutline(points);
  const plants = pointsInside(outline, 30, 12, 400).map(([x, y], i) => ({
    x, y, r: 5 + freeRandom(i, 5) * 2.5, color: FREE_FLOWER_COLORS[Math.floor(freeRandom(i, 6) * FREE_FLOWER_COLORS.length)],
  }));
  return { outline, plants };
}

// 芝生: 輪郭と、草の株の位置
export function freeLawn(points: Point2[]): { outline: Point2[]; tufts: Point2[] } {
  const outline = freeOutline(points);
  return { outline, tufts: pointsInside(outline, 18, 4, 1500) };
}

// ---- 線の形 ----

export interface FreeBand { left: Point2[]; right: Point2[]; }

// 道すじ（中心線）を、幅 width の帯にする
export function freeBand(line: Point2[], width: number): FreeBand {
  return { left: offsetFreeLine(line, width / 2, false), right: offsetFreeLine(line, -width / 2, false) };
}

// 帯を1つの輪郭（左の線 → 右の線を逆向き）にする。2Dで塗るときに使う
export function bandOutline(band: FreeBand): Point2[] {
  return [...band.left, ...[...band.right].reverse()];
}

// 石垣の継ぎ目・線路の枕木・柵の杭などの位置（両端から少し内側）
export function freePosts(line: Point2[], spacing: number): FreeSample[] {
  const length = freeLineLength(line);
  if (length <= 0) return [];
  const count = Math.max(1, Math.round(length / spacing));
  const step = length / count;
  return samplesAlong(line, step, false, 0);
}

export interface FreeRipple { x: number; y: number; angle: number; length: number; }

// 川の水面の小さな波の印。流れに沿って、左右に少しずつずらして置く（2Dの線と3Dの細い筋が同じ所）
export function freeRiverRipples(line: Point2[], width: number): FreeRipple[] {
  return samplesAlong(line, 110, false, 55).map((sample, i) => {
    const side = (i % 3 === 0 ? -0.24 : i % 3 === 1 ? 0.18 : -0.02) * width;
    const nx = -Math.sin(sample.angle), ny = Math.cos(sample.angle);
    return { x: sample.x + nx * side, y: sample.y + ny * side, angle: sample.angle, length: Math.min(60, Math.max(18, width * 0.28)) * (0.8 + 0.4 * freeRandom(i, 9)) };
  });
}

// 飛び石: 道すじに沿って、少し左右にずらした楕円の石
export function freeSteppingStones(line: Point2[]): StoneSlab[] {
  return samplesAlong(line, 55, false, 22).map((sample, i) => {
    const side = (i % 2 === 0 ? 1 : -1) * 8 * (0.6 + 0.4 * freeRandom(i, 7));
    return {
      x: sample.x - Math.sin(sample.angle) * side, y: sample.y + Math.cos(sample.angle) * side,
      rx: 21 * (0.9 + 0.2 * freeRandom(i, 8)), ry: 16 * (0.9 + 0.2 * freeRandom(i, 9)), angle: sample.angle + (freeRandom(i, 10) - 0.5) * 0.5,
    };
  });
}

// 線路の寸法（cm）: 線路の幅（レールの間）1067mm、枕木 210×22cm を 60cm ごと
export const RAILWAY = { gauge: 107, sleeperLength: 210, sleeperWidth: 22, sleeperSpacing: 60, railWidth: 7, ballastHeight: 10, sleeperHeight: 8, railHeight: 14 };

// 道すじを持つ家具の、なめらかにした中心線または輪郭（cm）
export function freeShapeLine(kind: FreeKind, path: number[][], w: number, h: number): Point2[] {
  const points = freePathPoints(path, w, h);
  return isFreeAreaKind(kind) ? freeOutline(points) : freeCenterLine(points);
}

