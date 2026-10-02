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

// 足跡1歩の歩幅（cm）の標準
export const FOOTPRINT_STRIDE = 42;

// 足1つ分の楕円。(cx, cy) が足の中心、heading がつま先の向き（ラジアン、2Dの右が0・手前が正）、side は左 -1・右 1。
// 靴は前と踵の2つの楕円、素足は足の裏・踵・5本の指
function addFootprint(pieces: StoneSlab[], cx: number, cy: number, heading: number, side: number, length: number, bare: boolean, w: number, h: number): void {
  const width = length * 0.4;
  // つま先が少し外を向く
  const angle = heading + side * 0.12;
  const ax = Math.cos(angle), ay = Math.sin(angle);
  // along: つま先の向き、across: 足の外側の向き
  const bx = -ay * side, by = ax * side;
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

// 足跡: 奥（-y）へ向かって左右交互に続く
export function footprintTrail(w: number, h: number, bare = false, stride = FOOTPRINT_STRIDE): StoneSlab[] {
  const steps = Math.max(2, Math.round(h / stride));
  const pitch = h / steps;
  const length = Math.min(pitch * 0.82, 28, w * 0.7);
  const width = length * 0.4;
  const offset = Math.min(Math.max(0, w / 2 - width * 0.7), Math.max(width * 0.75, w * 0.18));
  const pieces: StoneSlab[] = [];
  for (let i = 0; i < steps; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    addFootprint(pieces, side * offset, h / 2 - pitch * (i + 0.5), -Math.PI / 2, side, length, bare, w, h);
  }
  return pieces;
}

// なぞった道すじ（cm、家具の中心が原点）に沿って、歩く向きへつま先を向けた足跡を左右交互に置く。
// 道すじの始まりから終わりへ歩いた跡になる
export function footprintPathTrail(path: Point2[], w: number, h: number, bare = false, stride = FOOTPRINT_STRIDE): StoneSlab[] {
  const lengths = [0];
  for (let i = 1; i < path.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = lengths[lengths.length - 1] ?? 0;
  if (path.length < 2 || total < 1) return [];
  // 道すじの始まりから s cm 進んだ所
  const at = (s: number): Point2 => {
    const t = Math.min(total, Math.max(0, s));
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < t) i += 1;
    const span = lengths[i] - lengths[i - 1] || 1;
    const k = (t - lengths[i - 1]) / span;
    return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k];
  };
  const length = Math.min(stride * 0.82, 28);
  const offset = length * 0.34;
  const steps = Math.max(1, Math.floor(total / stride) + 1);
  const start = (total - (steps - 1) * stride) / 2;
  const pieces: StoneSlab[] = [];
  let heading = Math.atan2(path[1][1] - path[0][1], path[1][0] - path[0][0]);
  for (let i = 0; i < steps; i += 1) {
    const s = start + i * stride;
    // 向きは前後の少し離れた2点から決める（なぞった線の細かい揺れを拾わないように）
    const back = at(s - length * 0.5), ahead = at(s + length * 0.5);
    if (Math.hypot(ahead[0] - back[0], ahead[1] - back[1]) > 1e-6) heading = Math.atan2(ahead[1] - back[1], ahead[0] - back[0]);
    const [px, py] = at(s);
    const side = i % 2 === 0 ? -1 : 1;
    // 歩く向きの右は (-sin, cos)
    addFootprint(pieces, px - Math.sin(heading) * offset * side, py + Math.cos(heading) * offset * side, heading, side, length, bare, w, h);
  }
  return pieces;
}

// 足跡の家具1つ分。道すじ（幅・奥行に対する割合）があればそれに沿って、なければまっすぐに並べる
export function footprintPieces(w: number, h: number, bare: boolean, path?: readonly (readonly number[])[], stride = FOOTPRINT_STRIDE): StoneSlab[] {
  if (path && path.length >= 2) return footprintPathTrail(path.map(([u, v]): Point2 => [u * w, v * h]), w, h, bare, stride);
  return footprintTrail(w, h, bare, stride);
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

// ---- 人の模型（関節で手足を動かせる。立つ・うつぶせ・あおむけ） ----
// 体を、太さのある丸い棒（骨の両端と太さ）の集まりで表す。3Dはその棒をそのまま立体にし、
// 2Dは同じ棒を真上から見た形を描くので、2Dと3Dが同じ形になる

export type Vec3 = [number, number, number];
export type Posture = "stand" | "prone" | "supine";
// 腕・脚1本の角度（度）: [開く（体の横へ）, 前後（前が正）, 曲げ（ひじ・ひざ）, 曲げる向き（0がいつもの向き）]
export type LimbAngles = [number, number, number, number];
export interface PersonPose {
  posture: Posture;
  // 0: 左、1: 右（その人から見て）
  arms: [LimbAngles, LimbAngles];
  legs: [LimbAngles, LimbAngles];
}

export interface PersonPart {
  // 骨の両端（cm）。x は右、y は上、z は手前（2Dの y）。家具の中心の床が原点
  a: Vec3;
  b: Vec3;
  // 太さ。楕円体の3本の半径（向きと長さ, cm）
  axes: [Vec3, Vec3, Vec3];
  // 3Dで肌（頭・手・足）と服を分ける
  skin: boolean;
}

export const POSTURES: Posture[] = ["stand", "prone", "supine"];

// 前からある倒れた人の形（幅100cm × 奥行180cm のとき）。0: うつぶせに倒れた形、1: 手足を広げてあおむけ。
// 手足を動かすまでは、このままの形で描く（並びは 頭・胴・腰・左上腕・左前腕・左手・右上腕…、左は -x 側）
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

// ポーズの見本。座る・ひざをつくは、いちばん低い所が床に着くように体が下がる
export const PERSON_PRESETS: { id: string; label: string; pose: PersonPose }[] = [
  { id: "stand", label: "気をつけ", pose: { posture: "stand", arms: [[6, 0, 8, 0], [6, 0, 8, 0]], legs: [[3, 0, 0, 0], [3, 0, 0, 0]] } },
  { id: "walk", label: "歩く", pose: { posture: "stand", arms: [[5, -22, 18, 0], [5, 22, 28, 0]], legs: [[2, 24, 6, 0], [2, -18, 24, 0]] } },
  { id: "handsUp", label: "手を上げる", pose: { posture: "stand", arms: [[165, 0, 4, 0], [165, 0, 4, 0]], legs: [[3, 0, 0, 0], [3, 0, 0, 0]] } },
  { id: "armsOut", label: "両手を広げる", pose: { posture: "stand", arms: [[88, 0, 0, 0], [88, 0, 0, 0]], legs: [[7, 0, 0, 0], [7, 0, 0, 0]] } },
  { id: "point", label: "指さす", pose: { posture: "stand", arms: [[6, 0, 8, 0], [10, 85, 0, 0]], legs: [[3, 0, 0, 0], [3, 0, 0, 0]] } },
  { id: "sit", label: "座る", pose: { posture: "stand", arms: [[8, 32, 58, 0], [8, 32, 58, 0]], legs: [[5, 88, 88, 0], [5, 88, 88, 0]] } },
  { id: "kneel", label: "ひざをつく", pose: { posture: "stand", arms: [[6, 12, 20, 0], [6, 12, 20, 0]], legs: [[4, 0, 92, 0], [4, 0, 92, 0]] } },
  { id: "prone", label: "うつぶせ", pose: { posture: "prone", arms: [[135, 0, 65, 90], [32, 0, 44, -90]], legs: [[6, 0, 0, 0], [40, 0, 52, 90]] } },
  { id: "spread", label: "手足を広げて", pose: { posture: "supine", arms: [[61, 0, 30, -90], [61, 0, 30, -90]], legs: [[19, 0, 6, 90], [19, 0, 6, 90]] } },
  { id: "supine", label: "あおむけ", pose: { posture: "supine", arms: [[10, 0, 0, 0], [10, 0, 0, 0]], legs: [[4, 0, 0, 0], [4, 0, 0, 0]] } },
];

export function presetPose(id: string): PersonPose {
  const preset = PERSON_PRESETS.find((item) => item.id === id) ?? PERSON_PRESETS[0];
  return clonePose(preset.pose);
}

export function clonePose(pose: PersonPose): PersonPose {
  return {
    posture: pose.posture,
    arms: [[...pose.arms[0]], [...pose.arms[1]]],
    legs: [[...pose.legs[0]], [...pose.legs[1]]],
  };
}

// 保存データの姿勢を確かめる。形が違えば undefined
export function normalizePersonPose(value: unknown): PersonPose | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as { posture?: unknown; arms?: unknown; legs?: unknown };
  if (!POSTURES.includes(data.posture as Posture)) return undefined;
  const limb = (item: unknown): LimbAngles | null =>
    Array.isArray(item) && item.length === 4 && item.every((angle) => typeof angle === "number" && Number.isFinite(angle))
      ? (item.map((angle: number) => Math.round(wrapDegrees(angle) * 10) / 10) as LimbAngles)
      : null;
  const pair = (items: unknown): [LimbAngles, LimbAngles] | null => {
    if (!Array.isArray(items) || items.length !== 2) return null;
    const first = limb(items[0]), second = limb(items[1]);
    return first && second ? [first, second] : null;
  };
  const arms = pair(data.arms), legs = pair(data.legs);
  return arms && legs ? { posture: data.posture as Posture, arms, legs } : undefined;
}

export function wrapDegrees(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

// 人の種類・デザインと、保存した姿勢から決まる描き方。倒れた人は、手足を動かすまでは前からある形のまま
export function personDesign(kind: string, symbol: number, pose?: PersonPose): { pose: PersonPose | null; legacy: number; chalk: boolean } {
  if (kind === "fallenPerson") return { pose: pose ?? null, legacy: symbol === 1 ? 1 : 0, chalk: symbol === 2 };
  return { pose: pose ?? presetPose("stand"), legacy: 0, chalk: false };
}

// 手足を動かし始めるときの姿勢。前からある形に近いポーズの見本から始める
export function editablePersonPose(kind: string, symbol: number, pose?: PersonPose): PersonPose {
  if (pose) return clonePose(pose);
  if (kind === "fallenPerson") return presetPose(symbol === 1 ? "spread" : "prone");
  return presetPose("stand");
}

const DEG = Math.PI / 180;
const v3add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const v3scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const v3dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const v3unit = (a: Vec3): Vec3 => v3scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

// 体の寸法（cm）。腰の中心を原点に、体の右・上・前の向きで表す。まっすぐ立つと約170cm
const SHOULDER_JOINT: Point2 = [18, 44];
const HIP_JOINT: Point2 = [9, -4];
const LIMB_LENGTHS = { arm: [28, 24], leg: [43, 42] } as const;
const HAND_LENGTH = 7;
const FOOT_FRONT = 11;
const FOOT_BACK = 3;
// 真上から見て重なり方を分けるときの、高さの差（cm）。寝た人の体はひとまとまりの形、立った人の頭や肩は輪郭を分ける
const LAYER_GAP = 20;

// 姿勢ごとの体の右・上・前の向き（x 右、y 上、z 手前）。どれも 右 = 前 × 上 になる
const POSTURE_AXES: Record<Posture, [Vec3, Vec3, Vec3]> = {
  // 立つ: 手前を向く
  stand: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]],
  // うつぶせ: 頭が奥、顔が下
  prone: [[1, 0, 0], [0, 0, -1], [0, -1, 0]],
  // あおむけ: 頭が奥、顔が上
  supine: [[-1, 0, 0], [0, 0, -1], [0, 1, 0]],
};

interface LimbBones {
  joint: Vec3;
  middle: Vec3;
  end: Vec3;
  tipDir: Vec3;
}

// 腕・脚1本の関節の位置（体の右・上・前の座標）。side は左 -1・右 1
function limbBones(angles: LimbAngles, side: number, leg: boolean, posture: Posture): LimbBones {
  const [spread, swing, bend, twist] = angles.map((value) => value * DEG);
  // 開く: 体の面の中で、下向きから外へ回す（90°で真横、180°で真上）
  const d1: Vec3 = [side * Math.sin(spread), -Math.cos(spread), 0];
  // 前後: 前へ倒す
  const dir: Vec3 = [d1[0] * Math.cos(swing), d1[1] * Math.cos(swing), Math.sin(swing)];
  const front: Vec3 = [-d1[0] * Math.sin(swing), -d1[1] * Math.sin(swing), Math.cos(swing)];
  const outward: Vec3 = [side * Math.cos(spread), Math.sin(spread), 0];
  // 曲げる向き: ひじはふだん前へ、ひざは後ろへ曲がる。±90°で体の面の中で曲がる
  const delta = twist + (leg ? Math.PI : 0);
  const towards = v3add(v3scale(front, Math.cos(delta)), v3scale(outward, Math.sin(delta)));
  const lower = v3add(v3scale(dir, Math.cos(bend)), v3scale(towards, Math.sin(bend)));
  // 曲げたあとの、先の骨の前の向き（足先の向きに使う）
  const k = v3dot(front, towards);
  const front2 = v3add(front, v3scale(v3add(v3scale(towards, Math.cos(bend) - 1), v3scale(dir, -Math.sin(bend))), k));
  const [upperLength, lowerLength] = leg ? LIMB_LENGTHS.leg : LIMB_LENGTHS.arm;
  const base = leg ? HIP_JOINT : SHOULDER_JOINT;
  const joint: Vec3 = [side * base[0], base[1], 0];
  const middle = v3add(joint, v3scale(dir, upperLength));
  const end = v3add(middle, v3scale(lower, lowerLength));
  // 手は前腕の先へ。足先は、立っていれば前へ（ひざをついたときのように下を向くなら、すねの向きへ寝かせる）、
  // 寝ていれば脚の先へ少し前寄りに
  const sink = Math.max(0, -front2[1]);
  const tipDir = !leg ? lower
    : posture === "stand" ? v3unit(v3add(front2, v3scale(lower, 2.5 * sink)))
    : v3unit(v3add(v3scale(lower, 0.85), v3scale(front2, 0.45)));
  return { joint, middle, end, tipDir };
}

const limbSide = (index: number) => (index === 0 ? -1 : 1);

function toLocal(posture: Posture, point: Vec3): Vec3 {
  const [right, up, front] = POSTURE_AXES[posture];
  return v3add(v3add(v3scale(right, point[0]), v3scale(up, point[1])), v3scale(front, point[2]));
}

// 体の部品（体の座標）と、太さ（半径と、右・上・前の向きの縮め方）
function riggedParts(pose: PersonPose): { parts: PersonPart[]; ends: Point2[] } {
  const [right, up, front] = POSTURE_AXES[pose.posture];
  const parts: PersonPart[] = [];
  const add = (a: Vec3, b: Vec3, r: number, flat: Vec3, skin: boolean) =>
    parts.push({ a: toLocal(pose.posture, a), b: toLocal(pose.posture, b), axes: [v3scale(right, r * flat[0]), v3scale(up, r * flat[1]), v3scale(front, r * flat[2])], skin });
  // 腰・胸・肩・首・頭と、顔の向きが分かる鼻
  add([0, -3, 0], [0, 8, 0], 14, [1, 1, 0.66], false);
  add([0, 14, 0], [0, 34, 0], 15, [1, 1, 0.6], false);
  add([-16, 43, 0], [16, 43, 0], 7, [1, 1, 0.85], false);
  add([0, 45, 0], [0, 55, 0], 5, [1, 1, 1], true);
  add([0, 65, 0], [0, 65, 0], 11, [1, 1, 1], true);
  add([0, 65, 10.5], [0, 65, 10.5], 2.6, [1, 1, 1], true);
  const ends: Point2[] = [];
  pose.arms.forEach((angles, index) => {
    const bones = limbBones(angles, limbSide(index), false, pose.posture);
    add(bones.joint, bones.middle, 5, [1, 1, 0.78], false);
    add(bones.middle, bones.end, 4.2, [1, 1, 0.78], false);
    add(bones.end, v3add(bones.end, v3scale(bones.tipDir, HAND_LENGTH)), 3.8, [1, 1, 0.7], true);
    const end = toLocal(pose.posture, bones.end);
    ends[index] = [end[0], end[2]];
  });
  pose.legs.forEach((angles, index) => {
    const bones = limbBones(angles, limbSide(index), true, pose.posture);
    add(bones.joint, bones.middle, 7.4, [1, 1, 0.82], false);
    add(bones.middle, bones.end, 5.6, [1, 1, 0.82], false);
    add(v3add(bones.end, v3scale(bones.tipDir, -FOOT_BACK)), v3add(bones.end, v3scale(bones.tipDir, FOOT_FRONT)), 4.2, [1, 0.6, 1], true);
    const end = toLocal(pose.posture, bones.end);
    ends[2 + index] = [end[0], end[2]];
  });
  return { parts: settle(parts, pose.posture), ends };
}

const verticalExtent = (part: PersonPart) => Math.hypot(part.axes[0][1], part.axes[1][1], part.axes[2][1]);
const partBottom = (part: PersonPart) => Math.min(part.a[1], part.b[1]) - verticalExtent(part);
export const partTop = (part: PersonPart) => Math.max(part.a[1], part.b[1]) + verticalExtent(part);
const raise = (part: PersonPart, dy: number): PersonPart => ({ ...part, a: [part.a[0], part.a[1] + dy, part.a[2]], b: [part.b[0], part.b[1] + dy, part.b[2]] });

// 床に置く。立っていればいちばん低い所（ふつうは足の裏）を床に。
// 寝ていれば胴を床に置き、床の近くの頭や手足もそれぞれ床に下ろす（持ち上げた手足はそのまま）
function settle(parts: PersonPart[], posture: Posture): PersonPart[] {
  if (posture === "stand") {
    const lowest = Math.min(...parts.map(partBottom));
    return parts.map((part) => raise(part, -lowest));
  }
  const torso = Math.min(partBottom(parts[0]), partBottom(parts[1]));
  return parts.map((part) => {
    const lifted = raise(part, -torso);
    const bottom = partBottom(lifted);
    return bottom < 15 ? raise(lifted, -bottom) : lifted;
  });
}

function convexHull(points: Point2[]): Point2[] {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: Point2, a: Point2, b: Point2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point2[] = [], upper: Point2[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// 部品を真上から見た形（棒の両端の楕円をつないだ凸の形）
function partOutline(part: PersonPart, samples = 20): Point2[] {
  // 楕円体を床へ映した楕円: Q = Σ a aᵀ（x, z）。Q = L Lᵀ の L で円を写す
  let q11 = 0, q12 = 0, q22 = 0;
  for (const axis of part.axes) {
    q11 += axis[0] * axis[0];
    q12 += axis[0] * axis[2];
    q22 += axis[2] * axis[2];
  }
  const l11 = Math.sqrt(Math.max(q11, 1e-9));
  const l21 = q12 / l11;
  const l22 = Math.sqrt(Math.max(q22 - l21 * l21, 1e-9));
  const points: Point2[] = [];
  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const ex = l11 * Math.cos(t), ez = l21 * Math.cos(t) + l22 * Math.sin(t);
    points.push([part.a[0] + ex, part.a[2] + ez], [part.b[0] + ex, part.b[2] + ez]);
  }
  return convexHull(points);
}

// 高さの近い部品をひとまとまりにする（低い順）。2Dでは、まとまりごとに外側の輪郭を描き、上のまとまりを後から重ねる
function partLayers(parts: PersonPart[]): number[][] {
  const order = parts.map((part, index): [number, number] => [partTop(part), index]).sort((p, q) => p[0] - q[0]);
  const layers: number[][] = [];
  let start = -Infinity;
  for (const [top, index] of order) {
    if (!layers.length || top - start > LAYER_GAP) {
      layers.push([]);
      start = top;
    }
    layers[layers.length - 1].push(index);
  }
  return layers;
}

interface RefPerson {
  parts: PersonPart[];
  outlines: Point2[][];
  bounds: [number, number, number, number];
  ends: Point2[];
}

const refCache = new Map<string, RefPerson>();

// 実物大（1倍）の人。骨盤の真下が原点
function refPerson(pose: PersonPose): RefPerson {
  const key = JSON.stringify(pose);
  const cached = refCache.get(key);
  if (cached) return cached;
  const { parts, ends } = riggedParts(pose);
  const outlines = parts.map((part) => partOutline(part));
  // 3Dの立体の角が2Dの点より少し外へ出ても範囲に収まるよう、0.5cm広げる
  const xs = outlines.flat().map((point) => point[0]), zs = outlines.flat().map((point) => point[1]);
  const bounds: [number, number, number, number] = [Math.min(...xs) - 0.5, Math.min(...zs) - 0.5, Math.max(...xs) + 0.5, Math.max(...zs) + 0.5];
  const result = { parts, outlines, bounds, ends };
  if (refCache.size > 400) refCache.clear();
  refCache.set(key, result);
  return result;
}

// 姿勢を実物大で真上から見た大きさと、その中の腰の位置（範囲の中心から）
export function personRefSize(pose: PersonPose): { w: number; h: number; pelvis: Point2 } {
  const [x0, z0, x1, z1] = refPerson(pose).bounds;
  return { w: x1 - x0, h: z1 - z0, pelvis: [-(x0 + x1) / 2, -(z0 + z1) / 2] };
}

export interface PersonLayout {
  // 家具の中心の床が原点（cm）
  parts: PersonPart[];
  outlines: Point2[][];
  layers: number[][];
  // 実物大に対する大きさ。実物大の点 p は (p - center) × scale に置く
  scale: number;
  center: Point2;
  pelvis: Point2;
  // 手首（左・右）と足首（左・右）。2Dでつかんで動かす所
  ends: Point2[];
  w: number;
  h: number;
  legacy: boolean;
  chalkOutline?: Point2[];
}

const layoutCache = new Map<string, PersonLayout>();

// 人を家具の範囲（幅 w × 奥行 h）に置いた形。縦横の比は変えずに、範囲に収まる大きさで中央に置く
export function personLayout(w: number, h: number, pose: PersonPose | null, legacy = 0): PersonLayout {
  const key = `${w}x${h}:${pose ? JSON.stringify(pose) : `legacy${legacy}`}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;
  let layout: PersonLayout;
  if (!pose) {
    // 前からある倒れた人の形: 幅100 × 奥行180 の形をそのまま縮める
    const scale = Math.min(w / 100, h / 180);
    const parts = (FALLEN_POSES[legacy] ?? FALLEN_POSES[0]).map(([a, b, r, skin]): PersonPart => {
      const flat = a[0] === b[0] && a[1] === b[1] ? 0.85 : 0.68;
      const radius = r * scale, height = radius * flat;
      return { a: [a[0] * scale, height, a[1] * scale], b: [b[0] * scale, height, b[1] * scale], axes: [[radius, 0, 0], [0, height, 0], [0, 0, radius]], skin };
    });
    const at = (index: number): Point2 => [parts[index].b[0], parts[index].b[2]];
    layout = {
      parts, outlines: parts.map((part) => partOutline(part)), layers: [parts.map((_, index) => index)], scale, center: [0, 0],
      pelvis: [(parts[2].a[0] + parts[2].b[0]) / 2, (parts[2].a[2] + parts[2].b[2]) / 2],
      ends: [at(4), at(7), at(10), at(13)], w, h, legacy: true,
    };
  } else {
    const ref = refPerson(pose);
    const [x0, z0, x1, z1] = ref.bounds;
    const scale = Math.min(w / (x1 - x0), h / (z1 - z0));
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const place = ([x, z]: Point2): Point2 => [(x - cx) * scale, (z - cz) * scale];
    const placeVec = (p: Vec3): Vec3 => [(p[0] - cx) * scale, p[1] * scale, (p[2] - cz) * scale];
    const parts = ref.parts.map((part): PersonPart => ({
      a: placeVec(part.a), b: placeVec(part.b), axes: part.axes.map((axis) => v3scale(axis, scale)) as [Vec3, Vec3, Vec3], skin: part.skin,
    }));
    layout = {
      parts, outlines: ref.outlines.map((outline) => outline.map(place)), layers: partLayers(parts), scale, center: [cx, cz],
      pelvis: place([0, 0]), ends: ref.ends.map(place), w, h, legacy: false,
    };
  }
  if (layoutCache.size > 400) layoutCache.clear();
  layoutCache.set(key, layout);
  return layout;
}

// まっすぐ立ったときの背の高さ（実物大, cm）
export const PERSON_HEIGHT = (() => {
  const parts = refPerson(presetPose("stand")).parts;
  return Math.round(Math.max(...parts.map(partTop)) - Math.min(...parts.map(partBottom)));
})();

// 手首・足首（limb: 0 左手、1 右手、2 左足、3 右足）を、真上から見た target（実物大の座標）へ動かした姿勢。
// 寝ているときは体の面（床）の中で、ひじ・ひざの曲げ方を変えて届かせる。立っているときは、腕・脚の向きを変えて届かせる
export function reachLimb(pose: PersonPose, limb: number, target: Point2): PersonPose {
  const leg = limb >= 2, index = limb % 2, side = limbSide(index);
  const angles = (leg ? pose.legs : pose.arms)[index];
  const next = pose.posture === "stand" ? reachStanding(pose, angles, side, leg, target) : reachLying(pose, angles, side, leg, target);
  const result = clonePose(pose);
  (leg ? result.legs : result.arms)[index] = next.map((value) => Math.round(wrapDegrees(value) * 10) / 10) as LimbAngles;
  return result;
}

function reachLying(pose: PersonPose, angles: LimbAngles, side: number, leg: boolean, target: Point2): LimbAngles {
  const [right, up] = POSTURE_AXES[pose.posture];
  const [upperLength, lowerLength] = leg ? LIMB_LENGTHS.leg : LIMB_LENGTHS.arm;
  const bones = limbBones(angles, side, leg, pose.posture);
  const joint = toLocal(pose.posture, bones.joint);
  // 体の面（右・上）の座標
  const vx = target[0] - joint[0], vz = target[1] - joint[2];
  const vr = vx * right[0] + vz * right[2], vu = vx * up[0] + vz * up[2];
  const reach = Math.hypot(vr, vu);
  if (reach < 1e-6) return angles;
  const distance = Math.min(Math.max(reach, Math.abs(upperLength - lowerLength) + 0.5), upperLength + lowerLength - 0.01);
  const phi = Math.atan2(vu, vr);
  const theta = Math.acos(Math.min(1, Math.max(-1, (upperLength ** 2 + distance ** 2 - lowerLength ** 2) / (2 * upperLength * distance))));
  // いま曲がっている側へ曲げる（まっすぐなら外側へ）
  const mr = bones.middle[0] - bones.joint[0], mu = bones.middle[1] - bones.joint[1];
  const er = bones.end[0] - bones.joint[0], eu = bones.end[1] - bones.joint[1];
  const turn = mr * eu - mu * er;
  const sigma = Math.abs(turn) > 1e-3 ? -Math.sign(turn) : -side;
  const psi = phi + sigma * theta;
  const d: Point2 = [Math.cos(psi), Math.sin(psi)];
  const spread = Math.atan2(side * d[0], -d[1]);
  const elbow: Point2 = [d[0] * upperLength, d[1] * upperLength];
  const wrist: Point2 = [Math.cos(phi) * distance, Math.sin(phi) * distance];
  const lowerLen = Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]) || 1;
  const d2: Point2 = [(wrist[0] - elbow[0]) / lowerLen, (wrist[1] - elbow[1]) / lowerLen];
  const cosine = Math.min(1, Math.max(-1, d[0] * d2[0] + d[1] * d2[1]));
  const bend = Math.acos(cosine);
  const b: Point2 = [d2[0] - cosine * d[0], d2[1] - cosine * d[1]];
  const outward: Point2 = [side * Math.cos(spread), Math.sin(spread)];
  const delta = b[0] * outward[0] + b[1] * outward[1] >= 0 ? 90 : -90;
  return [spread / DEG, 0, bend / DEG, delta - (leg ? 180 : 0)];
}

function reachStanding(pose: PersonPose, angles: LimbAngles, side: number, leg: boolean, target: Point2): LimbAngles {
  const project = (spread: number, swing: number): Point2 => {
    const end = toLocal(pose.posture, limbBones([spread / DEG, swing / DEG, angles[2], angles[3]], side, leg, pose.posture).end);
    return [end[0], end[2]];
  };
  let spread = angles[0] * DEG, swing = angles[1] * DEG;
  for (let i = 0; i < 60; i += 1) {
    const point = project(spread, swing);
    const rx = point[0] - target[0], rz = point[1] - target[1];
    if (Math.hypot(rx, rz) < 0.05) break;
    const e = 1e-4;
    const pa = project(spread + e, swing), ps = project(spread, swing + e);
    const j11 = (pa[0] - point[0]) / e, j12 = (ps[0] - point[0]) / e, j21 = (pa[1] - point[1]) / e, j22 = (ps[1] - point[1]) / e;
    // (JᵀJ + λI) Δ = -Jᵀ r（届かない所では、いちばん近い向きで止まる）
    const lambda = 25;
    const a11 = j11 * j11 + j21 * j21 + lambda, a12 = j11 * j12 + j21 * j22, a22 = j12 * j12 + j22 * j22 + lambda;
    const g1 = -(j11 * rx + j21 * rz), g2 = -(j12 * rx + j22 * rz);
    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-12) break;
    let da = (g1 * a22 - g2 * a12) / det, ds = (a11 * g2 - a12 * g1) / det;
    const step = Math.hypot(da, ds);
    if (step > 0.25) {
      da *= 0.25 / step;
      ds *= 0.25 / step;
    }
    spread += da;
    swing += ds;
  }
  return [spread / DEG, swing / DEG, angles[2], angles[3]];
}

// 体の外側の輪郭（チョークの線）。2Dの線と3Dの床の白い線の両方がこの点を通る
export function personOutline(layout: PersonLayout): Point2[] {
  if (layout.chalkOutline) return layout.chalkOutline;
  // 部品の形（凸）ごとに、辺の外向きの距離のいちばん大きいもの（中で負）。全体はその最小
  const shapes = layout.outlines.map((outline) => {
    const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length, cy = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
    return outline.map((p, i) => {
      const q = outline[(i + 1) % outline.length];
      const ex = q[0] - p[0], ey = q[1] - p[1], length = Math.hypot(ex, ey) || 1;
      let nx = ey / length, ny = -ex / length;
      if (nx * (cx - p[0]) + ny * (cy - p[1]) > 0) {
        nx = -nx;
        ny = -ny;
      }
      return [p[0], p[1], nx, ny];
    });
  });
  const field = (x: number, y: number) => {
    let best = Infinity;
    for (const edges of shapes) {
      let inside = -Infinity;
      for (const [px, py, nx, ny] of edges) inside = Math.max(inside, nx * (x - px) + ny * (y - py));
      best = Math.min(best, inside);
    }
    return best;
  };
  layout.chalkOutline = contourLoop(field, layout.w, layout.h);
  return layout.chalkOutline;
}

// 範囲（幅 w × 奥行 h）の中で、field が0になるいちばん長い輪郭
function contourLoop(field: (x: number, y: number) => number, w: number, h: number): Point2[] {
  const cell = Math.max(0.4, Math.min(w, h) / 70);
  const cols = Math.ceil(w / cell) + 2, rows = Math.ceil(h / cell) + 2;
  const x0 = -w / 2 - cell, y0 = -h / 2 - cell;
  const values: number[] = [];
  for (let j = 0; j <= rows; j += 1) for (let i = 0; i <= cols; i += 1) values.push(field(x0 + i * cell, y0 + j * cell));
  const at = (i: number, j: number) => values[j * (cols + 1) + i];
  // マス目の辺の上で、値が0になる所。辺は「横: h,i,j」「縦: v,i,j」の名前で呼ぶ
  const cross = (edge: string): Point2 => {
    const [kind, si, sj] = edge.split(",");
    const i = Number(si), j = Number(sj);
    const [i2, j2] = kind === "h" ? [i + 1, j] : [i, j + 1];
    const v1 = at(i, j), v2 = at(i2, j2), t = v1 / (v1 - v2);
    return [x0 + (i + (i2 - i) * t) * cell, y0 + (j + (j2 - j) * t) * cell];
  };
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
  return longest.map(cross);
}

// チョークの線の太さ（cm）
export const CHALK_WIDTH = 2.4;

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
