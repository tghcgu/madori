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

// ---- 観葉植物「らせんの葉」（ひとつ前の標準の3Dの形） ----
// 1本の茎から、らせん状に13枚の葉が斜めに出る。3Dの葉と同じ大きさ・向き・傾きをここで計算し、
// 2Dでは3Dを真上から見た葉の形をそのまま描く

// 鉢の口の大きさ（幅に対する割合）
export const SPIRAL_POT_SCALE = 0.75;

// 葉の輪郭（付け根が原点、先が (0, 1)）。3Dの ShapeGeometry と同じ2本の3次ベジェ曲線を、同じ7分割で取る
const SPIRAL_LEAF_CURVES: [Point2, Point2, Point2, Point2][] = [
  [[0, 0], [0.22, 0.17], [0.15, 0.75], [0, 1]],
  [[0, 1], [-0.15, 0.75], [-0.22, 0.17], [0, 0]],
];
export const SPIRAL_LEAF_OUTLINE: Point2[] = SPIRAL_LEAF_CURVES.flatMap((curve) => Array.from({ length: 7 }, (_, k) => bezierPoint(curve, k / 7)));

// 観葉植物の高さ（m）。設置範囲の広さから決まる
export function plantHeight(wM: number, dM: number): number {
  return Math.min(2.6, Math.max(0.65, Math.sqrt(wM * dM) * 2.7));
}

export interface SpiralLeaf {
  // 茎から葉へ伸びる軸の付け根の高さ
  stemY: number;
  // 葉の付け根の位置（m）
  end: [number, number, number];
  scale: [number, number, number];
  // three.js の XYZ 順の回転
  rotation: [number, number, number];
}

export function spiralLeaves(wM: number, dM: number): SpiralLeaf[] {
  const height = plantHeight(wM, dM), potH = height * 0.24;
  return Array.from({ length: 13 }, (_, i) => {
    const a = i * 2.4, stemY = potH + height * (0.19 + i * 0.038);
    const length = 0.32 - i * 0.009;
    return {
      stemY,
      end: [Math.cos(a) * wM * length * 0.75, stemY + height * 0.07, Math.sin(a) * dM * length * 0.75],
      scale: [wM * 0.8, Math.max(wM, dM) * length, Math.min(wM, dM)],
      rotation: [0.75, -a, -0.5],
    };
  });
}

// 葉の中の点（葉の座標と、ふくらみ z = sin(yπ)×0.14）を、3Dと同じ拡大・回転・移動で置いた位置（m）
export function placeLeafPoint(leaf: SpiralLeaf, [px, py]: Point2): [number, number, number] {
  let x = px * leaf.scale[0], y = py * leaf.scale[1], z = Math.sin(py * Math.PI) * 0.14 * leaf.scale[2];
  const [ax, ay, az] = leaf.rotation;
  // XYZ 順の回転は、z軸 → y軸 → x軸 の順に当てる
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x + leaf.end[0], y + leaf.end[1], z + leaf.end[2]];
}

export interface SpiralPlantTopView {
  pot: Ellipse;
  soil: Ellipse;
  // 下の葉から順に。上の葉ほど後に描いて重ねる
  leaves: { stem: [Point2, Point2]; outline: Point2[]; midrib: [Point2, Point2] }[];
}

// 3Dを真上から見た形（cm）。3Dは全体を設置範囲いっぱいに合わせて広げるので、2Dも同じ広げ方をする
export function spiralPlantTopView(w: number, h: number): SpiralPlantTopView {
  const wM = w / 100, dM = h / 100;
  const leaves = spiralLeaves(wM, dM).map((leaf) => ({ leaf, outline: SPIRAL_LEAF_OUTLINE.map((point) => placeLeafPoint(leaf, point)) }));
  const potR = 0.4 * SPIRAL_POT_SCALE;
  let minX = -potR * wM, maxX = potR * wM, minZ = -potR * dM, maxZ = potR * dM;
  for (const { outline } of leaves) {
    for (const [x, , z] of outline) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
  }
  const sx = w / (maxX - minX), sz = h / (maxZ - minZ), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const map = (x: number, z: number): Point2 => [(x - cx) * sx, (z - cz) * sz];
  const [ox, oy] = map(0, 0);
  const ring = (k: number): Ellipse => ({ x: ox, y: oy, rx: k * wM * sx, ry: k * dM * sz });
  return {
    pot: ring(potR),
    soil: ring(0.35 * SPIRAL_POT_SCALE),
    leaves: leaves.map(({ leaf, outline }) => {
      const tip = placeLeafPoint(leaf, [0, 1]);
      return {
        stem: [[ox, oy], map(leaf.end[0], leaf.end[2])],
        outline: outline.map(([x, , z]) => map(x, z)),
        midrib: [map(leaf.end[0], leaf.end[2]), map(tip[0], tip[2])],
      };
    }),
  };
}

// ---- 事件・調査の印（足跡・番号の印・倒れた人・血・割れたガラス） ----
// どれも床に置く平らな物か低い物なので、上から見た形をここで決め、2Dはそのまま描き、3Dはその形で薄い板や立体を作る

// 決まった並びの乱数（描き直しても形が変わらないように）
function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// 範囲（幅 w × 奥行 h の内側）からはみ出さないように楕円を縮める
function fitEllipse(piece: StoneSlab, w: number, h: number): StoneSlab {
  const c = Math.cos(piece.angle), s = Math.sin(piece.angle);
  const reachX = Math.hypot(piece.rx * c, piece.ry * s), reachY = Math.hypot(piece.rx * s, piece.ry * c);
  const k = Math.min(1, (w / 2 - Math.abs(piece.x)) / reachX, (h / 2 - Math.abs(piece.y)) / reachY);
  return k >= 1 ? piece : { ...piece, rx: piece.rx * Math.max(0.05, k), ry: piece.ry * Math.max(0.05, k) };
}

// 足跡: 奥（-y）へ向かって左右交互に続く。靴は前と踵の2つの楕円、素足は足の裏・踵・5本の指
export function footprintTrail(w: number, h: number, bare = false): StoneSlab[] {
  const steps = Math.max(2, Math.round(h / 42));
  const pitch = h / steps;
  const length = Math.min(pitch * 0.82, 28, w * 0.7);
  const width = length * 0.4;
  const offset = Math.min(Math.max(0, w / 2 - width * 0.7), Math.max(width * 0.75, w * 0.18));
  const pieces: StoneSlab[] = [];
  for (let i = 0; i < steps; i += 1) {
    const left = i % 2 === 0;
    const side = left ? -1 : 1;
    const cx = side * offset, cy = h / 2 - pitch * (i + 0.5);
    // つま先が少し外を向く
    const turn = side * 0.12;
    const ax = Math.sin(turn), ay = -Math.cos(turn);
    const bx = -ay * side, by = ax * side;
    // along: つま先の向き、across: 足の外側の向き
    const put = (along: number, across: number, rx: number, ry: number) =>
      pieces.push(fitEllipse({ x: cx + ax * along + bx * across, y: cy + ay * along + by * across, rx, ry, angle: Math.atan2(ay, ax) }, w, h));
    if (bare) {
      put(length * 0.06, width * 0.04, length * 0.28, width * 0.44);
      put(-length * 0.31, 0, length * 0.18, width * 0.34);
      const toes: [number, number, number][] = [[-0.3, 0.44, 0.22], [-0.04, 0.45, 0.15], [0.16, 0.42, 0.14], [0.33, 0.38, 0.12], [0.47, 0.32, 0.11]];
      for (const [across, along, size] of toes) put(length * along, width * across, width * size, width * size);
    } else {
      put(length * 0.16, 0, length * 0.33, width * 0.5);
      put(-length * 0.34, 0, length * 0.15, width * 0.42);
    }
  }
  return pieces;
}

// 番号の印: 三角の札（外の三角が床、内の三角が上の面）か、丸い札。番号は上の面の中央に書く
export interface MarkerShape {
  outer: Point2[];
  inner: Point2[];
  // 番号の中心と、1〜2文字のときの文字の大きさ（cm）
  label: { x: number; y: number; size: number };
}

export function evidenceMarkerShape(w: number, h: number, variant = 0): MarkerShape {
  if (variant === 1) {
    const ring = (k: number) => Array.from({ length: 32 }, (_, i): Point2 => {
      const a = (i / 32) * Math.PI * 2;
      return [Math.cos(a) * (w / 2) * k, Math.sin(a) * (h / 2) * k];
    });
    return { outer: ring(1), inner: ring(0.82), label: { x: 0, y: 0, size: Math.min(w, h) * 0.46 } };
  }
  const outer: Point2[] = [[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  // 三角の重心へ向かってすぼめた上の面
  const cy = h / 6;
  const inner = outer.map(([x, y]): Point2 => [x * 0.46, cy + (y - cy) * 0.46]);
  return { outer, inner, label: { x: 0, y: cy, size: Math.min(w, h) * 0.26 } };
}

// 番号の文字の大きさ（cm）。文字が多いときは上の面に収まるよう小さくする
export function markerTextSize(shape: MarkerShape, text: string): number {
  const chars = Math.max(1, [...text].length);
  return chars <= 2 ? shape.label.size : shape.label.size * (2 / chars) * 1.15;
}

// 3Dの上の面の模様（番号の画像）が覆う正方形の一辺（cm）。番号の画像の中央が上の面の中央に来る
export function markerTextureSpan(shape: MarkerShape): number {
  return shape.label.size * 2.6;
}

// 倒れた人: 体を、太さのある線（両端が丸い棒）の集まりで表す。頭が奥（-y）
export interface BodyPart {
  a: Point2;
  b: Point2;
  r: number;
  // 3Dで肌（頭・手・足先）と服を分ける
  skin: boolean;
}

// 幅100cm × 奥行180cm のときの形。0: うつぶせに倒れた形、1: 手足を広げてあおむけ
const FALLEN_POSES: [Point2, Point2, number, boolean][][] = [
  [
    [[6, -73], [6, -73], 11, true],
    [[3, -54], [-1, 2], 17, false],
    [[-1, 2], [0, 12], 15, false],
    [[-14, -48], [-30, -64], 6.5, false],
    [[-30, -64], [-24, -80], 5.5, false],
    [[-23, -83], [-23, -83], 5, true],
    [[19, -46], [33, -24], 6.5, false],
    [[33, -24], [28, 1], 5.5, false],
    [[27, 6], [27, 6], 5, true],
    [[-8, 14], [-12, 50], 8.5, false],
    [[-12, 50], [-14, 78], 6.5, false],
    [[-14, 79], [-18, 84], 4.5, true],
    [[8, 14], [30, 40], 8.5, false],
    [[30, 40], [24, 70], 6.5, false],
    [[25, 72], [31, 77], 4.5, true],
  ],
  [
    [[0, -73], [0, -73], 11, true],
    [[0, -54], [0, 0], 17, false],
    [[0, 0], [0, 10], 15, false],
    [[-15, -48], [-33, -38], 6.5, false],
    [[-33, -38], [-42, -23], 5.5, false],
    [[-43, -19], [-43, -19], 5, true],
    [[15, -48], [33, -38], 6.5, false],
    [[33, -38], [42, -23], 5.5, false],
    [[43, -19], [43, -19], 5, true],
    [[-8, 12], [-20, 46], 8.5, false],
    [[-20, 46], [-27, 76], 6.5, false],
    [[-28, 79], [-31, 84], 4.5, true],
    [[8, 12], [20, 46], 8.5, false],
    [[20, 46], [27, 76], 6.5, false],
    [[28, 79], [31, 84], 4.5, true],
  ],
];

// 人の形は縦横の比を変えずに、範囲に収まる大きさで中央に置く（引き伸ばすと腕や脚が体から離れてしまうため）
export function fallenPersonParts(w: number, h: number, pose = 0): BodyPart[] {
  const scale = Math.min(w / 100, h / 180);
  return (FALLEN_POSES[pose] ?? FALLEN_POSES[0]).map(([a, b, r, skin]) => ({ a: [a[0] * scale, a[1] * scale], b: [b[0] * scale, b[1] * scale], r: r * scale, skin }));
}

// チョークの線の太さ（cm）
export const CHALK_WIDTH = 2.4;

const outlineCache = new Map<string, Point2[]>();

// 体の部品を合わせた形の外側の輪郭（cm）。2Dの線と3Dのチョークの線の両方がこの点を通る
export function fallenPersonOutline(w: number, h: number, pose = 0): Point2[] {
  const key = `${w}x${h}:${pose}`;
  const cached = outlineCache.get(key);
  if (cached) return cached;
  const parts = fallenPersonParts(w, h, pose);
  // 体からの距離（中で負）。部品ごとの距離のうち最小
  const field = (x: number, y: number) => {
    let best = Infinity;
    for (const { a, b, r } of parts) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = dx || dy ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
      best = Math.min(best, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) - r);
    }
    return best;
  };
  const cell = Math.max(0.6, Math.min(w, h) / 70);
  const cols = Math.ceil(w / cell) + 2, rows = Math.ceil(h / cell) + 2;
  const x0 = -w / 2 - cell, y0 = -h / 2 - cell;
  const values: number[] = [];
  for (let j = 0; j <= rows; j += 1) for (let i = 0; i <= cols; i += 1) values.push(field(x0 + i * cell, y0 + j * cell));
  const at = (i: number, j: number) => values[j * (cols + 1) + i];
  // マス目の辺の上で、距離が0になる所。辺は「横: h,i,j」「縦: v,i,j」の名前で呼ぶ
  const cross = (edge: string): Point2 => {
    const [kind, si, sj] = edge.split(",");
    const i = Number(si), j = Number(sj);
    const [i2, j2] = kind === "h" ? [i + 1, j] : [i, j + 1];
    const v1 = at(i, j), v2 = at(i2, j2), t = v1 / (v1 - v2);
    return [x0 + (i + (i2 - i) * t) * cell, y0 + (j + (j2 - j) * t) * cell];
  };
  // 輪郭の線分（辺から辺へ）。外側を左に見て一周する向きにつなぐ
  const next = new Map<string, string>();
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const top = `h,${i},${j}`, right = `v,${i + 1},${j}`, bottom = `h,${i},${j + 1}`, left = `v,${i},${j}`;
      const code = (at(i, j) < 0 ? 1 : 0) | (at(i + 1, j) < 0 ? 2 : 0) | (at(i + 1, j + 1) < 0 ? 4 : 0) | (at(i, j + 1) < 0 ? 8 : 0);
      const segments: [string, string][] = ({
        1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]],
        5: [[left, top], [right, bottom]], 6: [[top, bottom]], 7: [[left, bottom]], 8: [[bottom, left]],
        9: [[bottom, top]], 10: [[top, right], [bottom, left]], 11: [[bottom, right]], 12: [[right, left]],
        13: [[right, top]], 14: [[top, left]],
      } as Record<number, [string, string][]>)[code] ?? [];
      for (const [from, to] of segments) next.set(from, to);
    }
  }
  // いちばん長くつながった輪（体の外側の輪郭）を取る
  let longest: string[] = [];
  const used = new Set<string>();
  for (const start of next.keys()) {
    if (used.has(start)) continue;
    const loop: string[] = [];
    for (let edge: string | undefined = start; edge && !used.has(edge); edge = next.get(edge)) {
      used.add(edge);
      loop.push(edge);
    }
    if (loop.length > longest.length) longest = loop;
  }
  const outline = longest.map(cross);
  outlineCache.set(key, outline);
  return outline;
}

// 血: なめらかな形（池と同じく、隣り合う点の中点を通る2次曲線でつなぐ）と、小さな滴（楕円）
export interface BloodShape {
  blobs: Point2[][];
  drops: StoneSlab[];
}

function blob(cx: number, cy: number, rx: number, ry: number, radii: number[], turn = 0): Point2[] {
  return radii.map((k, i): Point2 => {
    const a = (i / radii.length) * Math.PI * 2 + turn;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
}

// 0: 血だまり、1: 飛び散った血、2: 引きずった跡（手前のたまりから奥へ伸びる）
export function bloodShape(w: number, h: number, variant = 0): BloodShape {
  const random = seeded(variant === 1 ? 4021 : variant === 2 ? 977 : 1318);
  const drops: StoneSlab[] = [];
  const drop = (x: number, y: number, rx: number, ry: number, angle = 0) => drops.push(fitEllipse({ x, y, rx, ry, angle }, w, h));
  if (variant === 1) {
    const core = blob(0, 0, w * 0.17, h * 0.17, [1, 0.8, 0.95, 0.72, 1, 0.84, 0.9, 0.76, 0.98, 0.82]);
    for (let i = 0; i < 18; i += 1) {
      const a = (i / 18) * Math.PI * 2 + random() * 0.3;
      const reach = 0.24 + random() * 0.22;
      const size = Math.min(w, h) * (0.05 - reach * 0.06 + random() * 0.012);
      // 外へ飛んだ向きに細長い滴
      drop(Math.cos(a) * w * reach, Math.sin(a) * h * reach, size * 1.7, size * 0.8, a);
    }
    return { blobs: [core], drops };
  }
  if (variant === 2) {
    // 手前のたまりから、奥へ向かって細くなりながら左右に揺れて伸びる跡
    const points: Point2[] = [];
    const steps = 9;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps, y = h * (0.28 - t * 0.74), half = w * (0.2 - t * 0.12) * (0.85 + random() * 0.3);
      points.push([Math.sin(t * 5) * w * 0.06 + half, y]);
    }
    for (let i = steps; i >= 0; i -= 1) {
      const t = i / steps, y = h * (0.28 - t * 0.74) + h * 0.02, half = w * (0.2 - t * 0.12) * (0.85 + random() * 0.3);
      points.push([Math.sin(t * 5) * w * 0.06 - half, y]);
    }
    const pool = blob(w * 0.02, h * 0.3, w * 0.3, h * 0.15, [1, 0.86, 0.96, 0.8, 1, 0.9, 0.84, 0.97]);
    for (let i = 0; i < 6; i += 1) drop((random() - 0.5) * w * 0.6, h * (0.2 - random() * 0.6), Math.min(w, h) * 0.025, Math.min(w, h) * 0.02, random() * Math.PI);
    return { blobs: [pool, points], drops };
  }
  const main = blob(-w * 0.04, -h * 0.02, w * 0.38, h * 0.38, [1, 0.86, 0.95, 0.78, 0.92, 1.02, 0.84, 0.97, 0.8, 0.93, 1, 0.82, 0.9, 0.96], 0.3);
  const small = blob(w * 0.33, h * 0.31, w * 0.1, h * 0.09, [1, 0.8, 0.95, 0.85, 1, 0.78]);
  drop(-w * 0.4, h * 0.3, Math.min(w, h) * 0.035, Math.min(w, h) * 0.03);
  drop(w * 0.4, -h * 0.34, Math.min(w, h) * 0.03, Math.min(w, h) * 0.026);
  drop(-w * 0.18, -h * 0.44, Math.min(w, h) * 0.028, Math.min(w, h) * 0.022, 0.6);
  drop(w * 0.12, h * 0.44, Math.min(w, h) * 0.022, Math.min(w, h) * 0.02);
  return { blobs: [main, small], drops };
}

// 割れたガラス: 中央に大きめ、外ほど小さい破片（幅・奥行に対する割合の座標）
const GLASS_SHARDS: Point2[][] = [
  [[-0.08, -0.06], [0.12, -0.13], [0.05, 0.09]],
  [[0.13, -0.02], [0.31, 0.04], [0.17, 0.15]],
  [[-0.29, -0.1], [-0.12, -0.21], [-0.16, 0.01]],
  [[-0.31, 0.12], [-0.14, 0.06], [-0.2, 0.27]],
  [[0.02, 0.17], [0.19, 0.23], [0.07, 0.35], [-0.05, 0.27]],
  [[0.28, -0.31], [0.39, -0.23], [0.31, -0.16]],
  [[-0.41, -0.35], [-0.3, -0.37], [-0.34, -0.26]],
  [[0.36, 0.26], [0.45, 0.31], [0.38, 0.4]],
  [[-0.07, -0.37], [0.04, -0.42], [0.01, -0.3]],
  [[-0.45, 0.36], [-0.38, 0.29], [-0.36, 0.41]],
  [[0.2, -0.45], [0.27, -0.41], [0.18, -0.38]],
];

export function glassShards(w: number, h: number): Point2[][] {
  return GLASS_SHARDS.map((shard) => shard.map(([x, y]): Point2 => [x * w, y * h]));
}
