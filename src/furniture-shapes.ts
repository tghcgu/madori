// 2Dの記号と3Dのモデルで共通に使う形のデータ。
// 岩の輪郭や池の石の位置などを両方ともここから作るので、3Dを真上から見た形が2Dの記号とそろう。
// 長さはすべて cm。原点は家具の中心、x は右、y は手前（3Dでは z）。

export type Point2 = [number, number];

// ---- 岩 ----

export interface RockShape {
  // 上から見た輪郭（角の点）
  outline: Point2[];
  // いちばん高い所
  peak: Point2;
  // 頂上から稜線が下りていく輪郭の点の番号。稜線と稜線の間が1枚の平らな面になる
  ridges: number[];
  // 頂上の高さ（岩全体の高さに対する割合）
  height: number;
  // 輪郭の各点の高さ（頂上を1とした割合）。稜線と稜線の間の点は、その面の平面の上にある
  heights: number[];
}

// 頂上と稜線の端から、輪郭の各点の高さを求める。どこかが地面近くまで下がるときは null
function faceHeights(outline: Point2[], peak: Point2, ridges: number[], edge: number): number[] | null {
  const n = outline.length;
  const heights = new Array<number>(n).fill(edge);
  for (const [k, start] of ridges.entries()) {
    const end = ridges[(k + 1) % ridges.length];
    const [ax, ay] = outline[start], [bx, by] = outline[end], [px, py] = peak;
    // 平面 h = α x + β y + γ を、頂上(1)と両端(edge)から求める
    const det = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
    if (Math.abs(det) < 1e-9) return null;
    const alpha = ((1 - edge) * (by - ay)) / det;
    const beta = (-(1 - edge) * (bx - ax)) / det;
    const gamma = edge - alpha * ax - beta * ay;
    for (let i = (start + 1) % n; i !== end; i = (i + 1) % n) heights[i] = alpha * outline[i][0] + beta * outline[i][1] + gamma;
  }
  return Math.min(...heights) >= 0.12 && Math.max(...heights) <= 0.95 ? heights : null;
}

function rock(cx: number, cy: number, sx: number, sy: number, radii: number[], turn: number, peak: Point2, ridges: number[], height: number): RockShape {
  const outline = radii.map((k, i): Point2 => {
    const a = (i / radii.length) * Math.PI * 2 + turn;
    return [cx + Math.cos(a) * sx * k, cy + Math.sin(a) * sy * k];
  });
  // 平らな面が作れるまで、稜線の端を高くし、それでも無理なら頂上を少しずつ中心へ寄せる（2Dもこの頂上を使う）
  for (const pull of [1, 0.75, 0.5, 0.25, 0]) {
    const top: Point2 = [cx + peak[0] * sx * pull, cy + peak[1] * sy * pull];
    for (const edge of [0.45, 0.55, 0.65, 0.75, 0.85]) {
      const heights = faceHeights(outline, top, ridges, edge);
      if (heights) return { outline, peak: top, ridges, height, heights };
    }
  }
  return { outline, peak: [cx, cy], ridges, height, heights: new Array<number>(outline.length).fill(0.75) };
}

// 標準は大きな岩が1つ。デザイン1は大小2つの岩が寄り添う形
export function rockShapes(w: number, h: number, variant = 0): RockShape[] {
  if (variant === 1) {
    return [
      rock(-w * 0.12, -h * 0.08, w * 0.36, h * 0.4, [0.95, 0.84, 1, 0.9, 0.97, 0.8, 0.92, 0.86], 0.4, [-0.2, -0.25], [1, 4, 6], 1),
      rock(w * 0.3, h * 0.3, w * 0.18, h * 0.18, [0.9, 1, 0.82, 0.95, 0.86, 0.98, 0.84], 0.9, [-0.15, -0.2], [0, 3, 5], 0.45),
    ];
  }
  return [rock(0, 0, w / 2, h / 2, [0.96, 0.8, 1, 0.86, 0.97, 0.78, 0.93, 0.84, 0.9], 0.2, [-0.24, -0.16], [1, 4, 7], 1)];
}

export function rockVertexHeights(shape: RockShape): number[] {
  return shape.heights;
}

// ---- 池 ----

export interface Ellipse {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface PondShape {
  // なめらかな輪郭の元になる点。隣り合う点の中点を通る2次曲線でつなぐ
  points: Point2[];
  stones: Ellipse[];
  // 水面のさざ波（楕円の上側の弧）
  ripples: Ellipse[];
}

export const RIPPLE_START = Math.PI * 1.1;
export const RIPPLE_END = Math.PI * 1.9;

export function pondShape(w: number, h: number): PondShape {
  const radii = [1, 0.9, 0.97, 0.86, 0.95, 1, 0.88, 0.93];
  const points = radii.map((k, i): Point2 => {
    const a = (i / radii.length) * Math.PI * 2;
    return [Math.cos(a) * (w / 2) * 0.86 * k, Math.sin(a) * (h / 2) * 0.86 * k];
  });
  const stone = Math.min(w, h) * 0.055;
  const stones: Ellipse[] = [];
  points.forEach((point, i) => {
    const before = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    const start: Point2 = [(before[0] + point[0]) / 2, (before[1] + point[1]) / 2];
    const end: Point2 = [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
    stones.push({ x: end[0], y: end[1], rx: stone * 1.2, ry: stone });
    stones.push({ x: start[0] * 0.25 + point[0] * 0.5 + end[0] * 0.25, y: start[1] * 0.25 + point[1] * 0.5 + end[1] * 0.25, rx: stone, ry: stone * 0.85 });
  });
  const ripples = [
    { x: -w * 0.1, y: -h * 0.04, rx: w * 0.16, ry: h * 0.07 },
    { x: w * 0.14, y: h * 0.14, rx: w * 0.1, ry: h * 0.05 },
  ];
  return { points, stones, ripples };
}

// ---- 飛び石 ----

export interface StoneSlab extends Ellipse {
  // 2Dでの回転（右から手前へ回る向きが正）
  angle: number;
}

export function steppingStoneLayout(w: number, h: number): StoneSlab[] {
  const along = h >= w;
  const length = along ? h : w, span = along ? w : h;
  const count = Math.max(2, Math.round(length / 55));
  return Array.from({ length: count }, (_, i) => {
    const t = -length / 2 + (length * (i + 0.5)) / count;
    const side = (i % 2 ? 1 : -1) * span * 0.12;
    return {
      x: along ? side : t,
      y: along ? t : side,
      rx: Math.min(span * 0.36, (length / count) * 0.42),
      ry: Math.min(span * 0.3, (length / count) * 0.36),
      angle: i * 0.7,
    };
  });
}

// ---- 花壇 ----

export interface FlowerBedLayout {
  edge: number;
  innerW: number;
  innerH: number;
  // 花1つの直径
  size: number;
  flowers: Point2[];
}

export function flowerBedLayout(w: number, h: number): FlowerBedLayout {
  const edge = Math.min(w, h) * 0.12;
  const innerW = w - edge * 2, innerH = h - edge * 2;
  const size = Math.min(innerH * 0.72, innerW * 0.72, 26);
  const cols = Math.max(1, Math.floor(innerW / (size * 1.25)));
  const rows = Math.max(1, Math.floor(innerH / (size * 1.25)));
  const flowers: Point2[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) flowers.push([-innerW / 2 + (innerW * (col + 0.5)) / cols, -innerH / 2 + (innerH * (row + 0.5)) / rows]);
  }
  return { edge, innerW, innerH, size, flowers };
}

// 花びら5枚の中心の向き（上から時計回り）
export const PETAL_ANGLES = Array.from({ length: 5 }, (_, i) => (i / 5) * Math.PI * 2 - Math.PI / 2);

// ---- 木目 ----

export interface WoodGrain {
  // 3次ベジェ曲線（始点・制御点1・制御点2・終点）
  lines: [Point2, Point2, Point2, Point2][];
  knot: Ellipse;
}

export function woodGrain(w: number, h: number): WoodGrain {
  const hw = w / 2, hh = h / 2;
  const along = w >= h;
  const span = along ? h : w;
  const lines: [Point2, Point2, Point2, Point2][] = [];
  for (let i = 1; i <= 4; i += 1) {
    const offset = -span / 2 + (span * i) / 5 + (i % 2 ? span * 0.03 : -span * 0.02);
    const wave = span * (i % 2 ? 0.05 : -0.04);
    lines.push(along
      ? [[-hw, offset], [-w * 0.2, offset + wave], [w * 0.2, offset - wave], [hw, offset + wave * 0.5]]
      : [[offset, -hh], [offset + wave, -h * 0.2], [offset - wave, h * 0.2], [offset + wave * 0.5, hh]]);
  }
  const knot = along
    ? { x: w * 0.22, y: h * 0.1, rx: span * 0.1, ry: span * 0.05 }
    : { x: w * 0.1, y: h * 0.22, rx: span * 0.05, ry: span * 0.1 };
  return { lines, knot };
}

export function bezierPoint([p0, c1, c2, p1]: [Point2, Point2, Point2, Point2], t: number): Point2 {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
  ];
}

// ---- ラグのひし形の柄 ----

export interface RugDiamonds {
  inset: number;
  step: number;
  // 縁の内側に収まるよう切り取った、ひし形1つずつの輪郭
  cells: Point2[][];
}

// 多角形を、中心が原点の長方形（幅 w・奥行 h）の内側に切り取る
function clipToRect(polygon: Point2[], w: number, h: number): Point2[] {
  const edges: [(p: Point2) => number, number][] = [[(p) => p[0], -w / 2], [(p) => -p[0], -w / 2], [(p) => p[1], -h / 2], [(p) => -p[1], -h / 2]];
  let result = polygon;
  for (const [value, limit] of edges) {
    const next: Point2[] = [];
    result.forEach((point, i) => {
      const prev = result[(i + result.length - 1) % result.length];
      const inside = value(point) >= limit, prevInside = value(prev) >= limit;
      if (inside !== prevInside) {
        const t = (limit - value(prev)) / (value(point) - value(prev));
        next.push([prev[0] + (point[0] - prev[0]) * t, prev[1] + (point[1] - prev[1]) * t]);
      }
      if (inside) next.push(point);
    });
    result = next;
    if (!result.length) break;
  }
  return result;
}

export function rugDiamonds(w: number, h: number): RugDiamonds {
  const m = Math.min(w, h);
  const inset = m * 0.08;
  const step = Math.max(12, m * 0.2);
  const fieldW = w - inset * 2, fieldH = h - inset * 2;
  const half = (step / 2) * 0.86;
  const cells: Point2[][] = [];
  const reach = Math.ceil((Math.max(fieldW, fieldH) / step) * 2) + 2;
  // 斜めの線 x±y = step の整数倍 で区切られた升目の中心は、step/2 刻みで i+j が奇数の点
  for (let i = -reach; i <= reach; i += 1) {
    for (let j = -reach; j <= reach; j += 1) {
      if ((((i + j) % 2) + 2) % 2 !== 1) continue;
      const cx = (i * step) / 2, cy = (j * step) / 2;
      if (Math.abs(cx) > fieldW / 2 + half || Math.abs(cy) > fieldH / 2 + half) continue;
      const cell = clipToRect([[cx, cy - half], [cx + half, cy], [cx, cy + half], [cx - half, cy]], fieldW, fieldH);
      if (cell.length >= 3) cells.push(cell);
    }
  }
  return { inset, step, cells };
}

// ---- 植物・木の葉の向き ----

// 観葉植物（標準）の葉8枚の向き
export const PLANT_LEAF_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
// ヤシの木の葉8枚の向き
export const PALM_FROND_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + 0.2);

// 観葉植物「丸い葉」: 外側9つ・内側5つの丸い葉の塊（半径 r に対する割合）
export const ROUND_LEAF_CLUMPS: { angle: number; distance: number; size: number }[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ angle: (i / 9) * Math.PI * 2, distance: 0.58, size: 0.4 })),
  ...Array.from({ length: 5 }, (_, i) => ({ angle: (i / 5) * Math.PI * 2 + 0.3, distance: 0.24, size: 0.3 })),
];

// 観葉植物「細い葉」: 7本の葉軸と、その両側の小葉（葉軸の向きを +x とした座標、半径 r に対する割合）
export interface Fern {
  angle: number;
  spine: [Point2, Point2, Point2];
  leaflets: [Point2, Point2][];
}

export function fernFronds(): Fern[] {
  const x0 = 0.12, cx = 0.55, cy = -0.12, x1 = 0.95, y1 = 0.06;
  return Array.from({ length: 7 }, (_, i) => {
    const leaflets: [Point2, Point2][] = [];
    for (let t = 0.3; t < 0.95; t += 0.13) {
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = 2 * (1 - t) * t * cy + t * t * y1;
      const leaf = 0.15 * (1.1 - t * 0.5);
      leaflets.push([[x, y], [x - leaf * 0.45, y - leaf]]);
      leaflets.push([[x, y], [x - leaf * 0.45, y + leaf]]);
    }
    return { angle: (i / 7) * Math.PI * 2 - Math.PI / 2, spine: [[x0, 0], [cx, cy], [x1, y1]], leaflets };
  });
}

// 針葉樹: 上から見える2段の星形（外の段と内の段）。半径は幅の半分に対する割合
export const CONIFER_TIERS = [
  { radius: 1, points: 18, inner: 0.8 },
  { radius: 0.6, points: 12, inner: 0.72 },
];

// ---- クローゼットの扉の枚数 ----

export function closetDoorCount(w: number): number {
  return Math.max(2, Math.min(4, Math.round(w / 60)));
}

// ---- 新しい家具・デザインの形 ----

// パラソル: 8角形の傘。角の向き（右から時計回り）
export const PARASOL_CORNERS = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

// コートハンガー: 6本のフックの向きと、柱からの長さ（半径に対する割合）
export const COAT_HOOK_ANGLES = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 - Math.PI / 2);
export const COAT_HOOK_REACH = 0.45;

// 物干し台: 2本の竿の位置（奥行に対する割合）と、両端の台の幅
export const DRYER_POLES = [-0.3, 0.3];
export function dryerFootWidth(w: number): number {
  return Math.min(w * 0.08, 25);
}

// キャットタワー: 板の中心・大きさ（幅と奥行に対する割合）と高さ（全体に対する割合）。高い板ほど上に重なる
export interface TowerDeck {
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
  round: boolean;
}
export const CAT_TOWER_DECKS: TowerDeck[] = [
  { x: -0.2, y: 0.2, w: 0.56, h: 0.56, height: 0.35, round: false },
  { x: 0.22, y: -0.22, w: 0.52, h: 0.52, height: 0.62, round: true },
  { x: -0.18, y: -0.2, w: 0.5, h: 0.5, height: 0.82, round: false },
  { x: 0.16, y: 0.18, w: 0.48, h: 0.48, height: 1, round: true },
];

// ベビーベッド: 手すりの太さ（cm）と、縦の桟の本数
export function cribRail(w: number, h: number): number {
  return Math.min(w, h) * 0.07;
}
export function cribBars(lengthCm: number): number {
  return Math.max(3, Math.round(lengthCm / 9));
}

// ブロック塀: 上の笠木の数（40cmごとに目地）
export function blockWallCaps(lengthCm: number): number {
  return Math.max(1, Math.round(lengthCm / 40));
}

// 丸い花壇: 縁の幅、花の直径、花の位置
export function roundFlowerBedLayout(w: number, h: number): FlowerBedLayout {
  const edge = Math.min(w, h) * 0.1;
  const innerW = w - edge * 2, innerH = h - edge * 2;
  const size = Math.min(26, Math.min(w, h) * 0.22);
  const count = Math.max(5, Math.min(12, Math.round((Math.PI * Math.min(innerW, innerH) * 0.55) / (size * 1.25))));
  const flowers: Point2[] = Array.from({ length: count }, (_, i): Point2 => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * (innerW / 2) * 0.62, Math.sin(a) * (innerH / 2) * 0.62];
  });
  if (Math.min(innerW, innerH) > size * 3.2) flowers.push([0, 0]);
  return { edge, innerW, innerH, size, flowers };
}
