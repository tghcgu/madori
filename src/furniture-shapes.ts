// 2Dの記号と3Dのモデルで共通に使う形のデータ。
// 岩の輪郭や池の石の位置などを両方ともここから作るので、3Dを真上から見た形が2Dの記号とそろう。
// 長さはすべて cm。原点は家具の中心、x は右、y は手前（3Dでは z）。

export type Point2 = [number, number];

// ---- 和風の家具・設備 ----
// 上から見た輪郭と高さを共有し、低い部品から描くと2Dでも手前の部品に隠れる。
export const JAPANESE_KINDS = ["tatami", "zabuton", "chabudai", "byobu", "shojiScreen", "andon", "stepTansu", "irori", "hibachi", "engawa", "hinokiBath", "tsukubai"] as const;
export type JapaneseKind = typeof JAPANESE_KINDS[number];
export const JAPANESE_MATERIALS = {
  wood: { color: "#9b6741", tintable: true },
  paleWood: { color: "#d7b782", tintable: true },
  trim: { color: "#443c34", tintable: false },
  straw: { color: "#b5ba83", tintable: true },
  weave: { color: "#929d70", tintable: false },
  border: { color: "#374d44", tintable: false },
  cloth: { color: "#758aab", tintable: true },
  seam: { color: "#57647a", tintable: false },
  paper: { color: "#f3eedb", tintable: false },
  gold: { color: "#c4aa67", tintable: true },
  iron: { color: "#32383c", tintable: false },
  ash: { color: "#b5b0a7", tintable: false },
  coal: { color: "#6b3d31", tintable: false },
  water: { color: "#83b4bb", tintable: false },
  stone: { color: "#8b9590", tintable: true },
  glaze: { color: "#4d7172", tintable: true },
};
export interface JapanesePart {
  shape: "box" | "ellipse" | "ring";
  x: number; y: number; bottom: number;
  w: number; d: number; height: number;
  material: keyof typeof JAPANESE_MATERIALS;
  radius: number;
  angle?: number;
  inner?: number;
}
export function isJapaneseKind(kind: string): kind is JapaneseKind {
  return (JAPANESE_KINDS as readonly string[]).includes(kind);
}

export function japaneseParts(kind: JapaneseKind, w: number, d: number, height: number): JapanesePart[] {
  const parts: JapanesePart[] = [];
  const box = (x: number, y: number, pw: number, pd: number, bottom: number, ph: number, material: JapanesePart["material"], radius = 0) => {
    parts.push({ shape: "box", x: x * w, y: y * d, w: pw * w, d: pd * d, bottom: bottom * height, height: ph * height, material, radius: radius * Math.min(w, d, height) });
  };
  const ellipse = (x: number, y: number, pw: number, pd: number, bottom: number, ph: number, material: JapanesePart["material"]) => {
    box(x, y, pw, pd, bottom, ph, material);
    parts[parts.length - 1].shape = "ellipse";
  };
  const legs = (bottom: number, top: number, x = 0.39, y = 0.36) => {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * x, sy * y, 0.08, 0.12, bottom, top - bottom, "wood");
  };
  switch (kind) {
    case "tatami":
      box(0, 0, 1, 1, 0, 0.96, "straw");
      for (const x of [-0.47, 0.47]) box(x, 0, 0.06, 1, 0.96, 0.04, "border");
      for (let i = 1; i < 40; i++) box(0, -0.5 + i / 40, 0.87, 0.003, 0.96, 0.03, "weave");
      break;
    case "zabuton":
      box(0, 0, 1, 1, 0, 0.96, "cloth", 0.36);
      box(0, 0, 0.92, 0.92, 0.87, 0.12, "seam", 0.28);
      box(0, 0, 0.88, 0.88, 0.9, 0.1, "cloth", 0.24);
      ellipse(0, 0, 0.025, 0.025, 0.99, 0.01, "seam");
      break;
    case "chabudai":
      legs(0, 0.87, 0.25, 0.25);
      ellipse(0, 0, 1, 1, 0.87, 0.12, "wood");
      ellipse(0, 0, 0.94, 0.94, 0.99, 0.01, "paleWood");
      break;
    case "byobu":
      for (let i = 0; i < 4; i++) {
        const dx = w * 0.24, dy = d * 0.88 * (i % 2 ? -1 : 1);
        const length = Math.hypot(dx, dy), thickness = Math.min(w * 0.012, d * 0.1);
        const angle = Math.atan2(dy, dx), cx = (-0.36 + i * 0.24) * w;
        parts.push({ shape: "box", x: cx, y: 0, w: length - thickness * 2, d: thickness * 0.85, bottom: height * 0.045, height: height * 0.91, material: "gold", radius: 0, angle });
        // 枠を中空にし、内側の金紙を隠さない。
        for (const bottom of [0, 0.955]) parts.push({ shape: "box", x: cx, y: 0, w: length, d: thickness, bottom: bottom * height, height: height * 0.045, material: "trim", radius: 0, angle });
        for (const sign of [-1, 1]) {
          const offset = sign * (length - thickness) / 2;
          parts.push({ shape: "box", x: cx + Math.cos(angle) * offset, y: Math.sin(angle) * offset, w: thickness, d: thickness, bottom: 0, height, material: "trim", radius: 0, angle });
        }
      }
      break;
    case "shojiScreen":
      for (const x of [-0.4, 0.4]) box(x, 0, 0.12, 1, 0, 0.035, "wood");
      box(0, 0, 0.94, 0.09, 0.06, 0.92, "paper");
      for (const x of [-0.47, 0.47]) box(x, 0, 0.06, 0.16, 0.035, 0.965, "wood");
      for (const z of [0.07, 0.99]) box(0, 0, 1, 0.16, z - 0.01, 0.02, "wood");
      for (const x of [-0.28, -0.09, 0.09, 0.28]) box(x, -0.01, 0.014, 0.13, 0.08, 0.9, "paleWood");
      for (let i = 1; i < 7; i++) box(0, -0.01, 0.94, 0.13, 0.08 + i * 0.9 / 7, 0.01, "paleWood");
      break;
    case "andon":
      box(0, 0, 1, 1, 0, 0.08, "trim");
      box(0, 0, 0.82, 0.82, 0.12, 0.82, "paper");
      for (const x of [-0.43, 0.43]) for (const y of [-0.43, 0.43]) box(x, y, 0.08, 0.08, 0.08, 0.92, "wood");
      for (const z of [0.1, 0.48, 0.95]) {
        for (const y of [-0.43, 0.43]) box(0, y, 0.94, 0.05, z, 0.035, "wood");
        for (const x of [-0.43, 0.43]) box(x, 0, 0.05, 0.94, z, 0.035, "wood");
      }
      break;
    case "stepTansu":
      for (let i = 0; i < 3; i++) {
        const x = -1 / 3 + i / 3, top = 1 - i * 0.29;
        box(x, -0.025, 1 / 3, 0.95, 0, top - 0.022, "wood");
        box(x, -0.025, 1 / 3, 0.95, top - 0.022, 0.022, "trim");
        for (let j = 0; j < 3 - i; j++) {
          box(x, 0.46, 0.30, 0.025, 0.04 + j * 0.29, 0.26, "paleWood");
          box(x, 0.4875, 0.08, 0.025, 0.15 + j * 0.29, 0.014, "iron");
        }
      }
      break;
    case "irori":
      box(0, 0, 0.94, 0.94, 0, 0.7, "wood");
      box(0, 0, 0.72, 0.72, 0.69, 0.02, "ash");
      for (const y of [-0.425, 0.425]) box(0, y, 1, 0.15, 0.7, 0.15, "wood");
      for (const x of [-0.425, 0.425]) box(x, 0, 0.15, 0.7, 0.7, 0.15, "wood");
      for (const y of [-0.12, 0.12]) box(0, y, 0.40, 0.055, 0.71, 0.07, "coal");
      ellipse(0, 0, 0.27, 0.27, 0.72, 0.24, "iron");
      ellipse(0, 0, 0.08, 0.08, 0.96, 0.04, "trim");
      break;
    case "hibachi":
    case "tsukubai": {
      const basin = kind === "hibachi", material = basin ? "glaze" : "stone";
      ellipse(0, 0, 0.75, 0.75, 0, 0.2, material);
      ellipse(0, 0, 1, 1, 0.2, 0.6, material);
      ellipse(0, 0, 1, 1, 0.8, 0.2, material);
      parts[parts.length - 1].shape = "ring";
      parts[parts.length - 1].inner = 0.68;
      ellipse(0, 0, 0.69, 0.69, 0.83, 0.01, basin ? "ash" : "water");
      if (basin) for (const x of [-0.14, 0, 0.14]) box(x, 0, 0.09, 0.27, 0.84, 0.08, "coal");
      break;
    }
    case "engawa":
      legs(0, 0.85);
      for (let i = 0; i < 6; i++) box(0, -0.5 + (i + 0.5) / 6, 1, 0.157, 0.85, 0.15, "paleWood");
      break;
    case "hinokiBath":
      box(0, 0, 0.98, 0.98, 0, 0.08, "paleWood");
      box(0, 0, 0.84, 0.75, 0.59, 0.02, "water");
      for (const y of [-0.45, 0.45]) {
        box(0, y, 1, 0.1, 0.08, 0.92, "paleWood");
        for (let i = 1; i < 16; i++) box(-0.5 + i / 16, y, 0.003, 0.101, 0.08, 0.919, "wood");
      }
      for (const x of [-0.465, 0.465]) box(x, 0, 0.07, 0.8, 0.08, 0.92, "paleWood");
      break;
  }
  return parts.sort((a, b) => (a.bottom + a.height) - (b.bottom + b.height));
}

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

// 墓石: 台石（全体）の上に上台と竿石。手前に花立て2つと香炉。
// 中心の位置と大きさは幅・奥行に対する割合（y は手前が正）、高さは m
export const GRAVE_PARTS = {
  base: { height: 0.15 },
  middle: { y: -0.08, w: 0.72, d: 0.6, height: 0.2 },
  stone: { y: -0.12, w: 0.46, d: 0.3, height: 0.62 },
  vases: [[-0.4, 0.34], [0.4, 0.34]] as Point2[],
  vaseRadius: 0.06,
  incense: { y: 0.37, w: 0.24, d: 0.12 },
};

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

// ---- 事件・調査の印（足跡・番号の印・倒れた人・血・破片） ----
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

// ---- 人の模型（関節で体を動かせる。立つ・うつぶせ・あおむけ） ----
// デッサン人形のように、太さのある丸い部品（両端の太さが違ってもよい）と関節の玉でできている。
// 3Dはその部品をそのまま立体にし、2Dは同じ部品を真上から見た形を描くので、2Dと3Dが同じ形になる

export type Vec3 = [number, number, number];
export type Posture = "stand" | "prone" | "supine";
// 腕・脚1本の角度（度）: [開く（体の横へ）, 前後（前が正）, 曲げ（ひじ・ひざ）, 曲げる向き（0がいつもの向き）, 手首・足首]
export type LimbAngles = [number, number, number, number, number];
// 胴（腰）と首の角度（度）: [前へ倒す, 横へ倒す（右へが正）, ねじる・振り向く（右へが正）]
export type TrunkAngles = [number, number, number];
export interface PersonPose {
  posture: Posture;
  // 0: 左、1: 右（その人から見て）
  arms: [LimbAngles, LimbAngles];
  legs: [LimbAngles, LimbAngles];
  waist: TrunkAngles;
  neck: TrunkAngles;
}

export interface PersonPart {
  // 部品の両端（cm）。x は右、y は上、z は手前（2Dの y）。家具の中心の床が原点
  a: Vec3;
  b: Vec3;
  // a の端の太さ。楕円体の3本の半径（向きと長さ, cm）
  axes: [Vec3, Vec3, Vec3];
  // b の端の太さ（a の端に対する割合）
  taper: number;
  // 関節の玉（3Dで少し濃い色にする）
  joint: boolean;
}

export const POSTURES: Posture[] = ["stand", "prone", "supine"];

// つまみ（2Dでつかんで動かす所）: 0 左手首、1 右手首、2 左足首、3 右足首、4 左ひじ、5 右ひじ、6 左ひざ、7 右ひざ、8 頭
export const PERSON_HANDLE_COUNT = 9;

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

const STRAIGHT: TrunkAngles = [0, 0, 0];
const pose = (posture: Posture, arms: [LimbAngles, LimbAngles], legs: [LimbAngles, LimbAngles], waist: TrunkAngles = STRAIGHT, neck: TrunkAngles = STRAIGHT): PersonPose => ({ posture, arms, legs, waist, neck });

// ポーズの見本。座る・ひざをつくは、いちばん低い所が床に着くように体が下がる
export const PERSON_PRESETS: { id: string; label: string; pose: PersonPose }[] = [
  { id: "stand", label: "気をつけ", pose: pose("stand", [[6, 0, 8, 0, 0], [6, 0, 8, 0, 0]], [[3, 0, 0, 0, 0], [3, 0, 0, 0, 0]]) },
  { id: "walk", label: "歩く", pose: pose("stand", [[5, -22, 18, 0, 0], [5, 22, 28, 0, 0]], [[2, 24, 6, 0, 0], [2, -18, 24, 0, 0]], [3, 0, 0]) },
  { id: "handsUp", label: "手を上げる", pose: pose("stand", [[165, 0, 4, 0, 0], [165, 0, 4, 0, 0]], [[3, 0, 0, 0, 0], [3, 0, 0, 0, 0]], STRAIGHT, [-10, 0, 0]) },
  { id: "armsOut", label: "両手を広げる", pose: pose("stand", [[88, 0, 0, 0, 0], [88, 0, 0, 0, 0]], [[7, 0, 0, 0, 0], [7, 0, 0, 0, 0]]) },
  { id: "point", label: "指さす", pose: pose("stand", [[6, 0, 8, 0, 0], [10, 85, 0, 0, 0]], [[3, 0, 0, 0, 0], [3, 0, 0, 0, 0]], [0, 0, 8], [0, 0, 12]) },
  { id: "sit", label: "座る", pose: pose("stand", [[8, 32, 58, 0, 0], [8, 32, 58, 0, 0]], [[5, 88, 88, 0, 0], [5, 88, 88, 0, 0]], [4, 0, 0]) },
  { id: "kneel", label: "ひざをつく", pose: pose("stand", [[6, 12, 20, 0, 0], [6, 12, 20, 0, 0]], [[4, 0, 92, 0, 0], [4, 0, 92, 0, 0]]) },
  { id: "crouch", label: "しゃがむ", pose: pose("stand", [[12, 40, 70, 0, 0], [12, 40, 70, 0, 0]], [[12, 110, 140, 0, 0], [12, 110, 140, 0, 0]], [30, 0, 0], [-15, 0, 0]) },
  { id: "prone", label: "うつぶせ", pose: pose("prone", [[135, 0, 65, 90, 0], [32, 0, 44, -90, 0]], [[6, 0, 0, 0, 0], [40, 0, 52, 90, 0]]) },
  { id: "spread", label: "手足を広げて", pose: pose("supine", [[61, 0, 30, -90, 0], [61, 0, 30, -90, 0]], [[19, 0, 6, 90, 0], [19, 0, 6, 90, 0]]) },
  { id: "supine", label: "あおむけ", pose: pose("supine", [[10, 0, 0, 0, 0], [10, 0, 0, 0, 0]], [[4, 0, 0, 0, 0], [4, 0, 0, 0, 0]]) },
];

export function presetPose(id: string): PersonPose {
  const preset = PERSON_PRESETS.find((item) => item.id === id) ?? PERSON_PRESETS[0];
  return clonePose(preset.pose);
}

export function clonePose(value: PersonPose): PersonPose {
  return {
    posture: value.posture,
    arms: [[...value.arms[0]], [...value.arms[1]]],
    legs: [[...value.legs[0]], [...value.legs[1]]],
    waist: [...value.waist],
    neck: [...value.neck],
  };
}

export function wrapDegrees(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

const roundAngle = (value: number) => Math.round(wrapDegrees(value) * 10) / 10;

// 保存データの姿勢を確かめる。形が違えば undefined。手首・足首、腰・首がない前の形は、まっすぐとして読む
export function normalizePersonPose(value: unknown): PersonPose | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as { posture?: unknown; arms?: unknown; legs?: unknown; waist?: unknown; neck?: unknown };
  if (!POSTURES.includes(data.posture as Posture)) return undefined;
  const numbers = (item: unknown, lengths: number[]): number[] | null =>
    Array.isArray(item) && lengths.includes(item.length) && item.every((angle) => typeof angle === "number" && Number.isFinite(angle)) ? (item as number[]).map(roundAngle) : null;
  const limb = (item: unknown): LimbAngles | null => {
    const angles = numbers(item, [4, 5]);
    return angles ? ([...angles, 0].slice(0, 5) as LimbAngles) : null;
  };
  const pair = (items: unknown): [LimbAngles, LimbAngles] | null => {
    if (!Array.isArray(items) || items.length !== 2) return null;
    const first = limb(items[0]), second = limb(items[1]);
    return first && second ? [first, second] : null;
  };
  const trunk = (item: unknown): TrunkAngles | null => (item === undefined ? [0, 0, 0] : (numbers(item, [3]) as TrunkAngles | null));
  const arms = pair(data.arms), legs = pair(data.legs), waist = trunk(data.waist), neck = trunk(data.neck);
  return arms && legs && waist && neck ? { posture: data.posture as Posture, arms, legs, waist, neck } : undefined;
}

// 人の種類・デザインと、保存した姿勢から決まる描き方。倒れた人は、手足を動かすまでは前からある形のまま
export function personDesign(kind: string, symbol: number, value?: PersonPose): { pose: PersonPose | null; legacy: number; chalk: boolean } {
  if (kind === "fallenPerson") return { pose: value ?? null, legacy: symbol === 1 ? 1 : 0, chalk: symbol === 2 };
  return { pose: value ?? presetPose("stand"), legacy: 0, chalk: false };
}

// 手足を動かし始めるときの姿勢。前からある形に近いポーズの見本から始める
export function editablePersonPose(kind: string, symbol: number, value?: PersonPose): PersonPose {
  if (value) return clonePose(value);
  if (kind === "fallenPerson") return presetPose(symbol === 1 ? "spread" : "prone");
  return presetPose("stand");
}

const DEG = Math.PI / 180;
type Mat3 = [Vec3, Vec3, Vec3];
const v3add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const v3sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const v3scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const v3dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const v3cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const v3unit = (a: Vec3): Vec3 => v3scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const matVec = (m: Mat3, v: Vec3): Vec3 => [v3dot(m[0], v), v3dot(m[1], v), v3dot(m[2], v)];
const matMul = (a: Mat3, b: Mat3): Mat3 => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j])) as Mat3;
const rotX = (t: number): Mat3 => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const rotY = (t: number): Mat3 => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const rotZ = (t: number): Mat3 => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
// 胴・首の回転（体の右・上・前の座標）: 前へ倒す（上が前へ）、横へ倒す（上が右へ）、ねじる（前が右へ）
const trunkRotation = ([forward, side, twist]: TrunkAngles): Mat3 => matMul(rotX(forward * DEG), matMul(rotZ(-side * DEG), rotY(twist * DEG)));

// 体の寸法（cm）。腰の中心を原点に、体の右・上・前の向きで表す。まっすぐ立つと約170cm
const SHOULDER_JOINT: Point2 = [17, 41];
const HIP_JOINT: Point2 = [9, -4];
const WAIST_PIVOT: Vec3 = [0, 12, 0];
const NECK_PIVOT: Vec3 = [0, 45, 0];
const HEAD_CENTER: Vec3 = [0, 63, 0];
const LIMB_LENGTHS = { arm: [28, 24], leg: [43, 42] } as const;
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
  dir: Vec3;
  lower: Vec3;
  front: Vec3;
  front2: Vec3;
  // 手・足先の向きと、その前（手のひら・足の甲）の向き
  tipDir: Vec3;
  tipFront: Vec3;
}

// 腕・脚1本の関節の位置（体の右・上・前の座標）。side は左 -1・右 1
function limbBones(angles: LimbAngles, side: number, leg: boolean, posture: Posture): LimbBones {
  const [spread, swing, bend, twist, tip] = angles.map((value) => value * DEG);
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
  // 曲げたあとの、先の骨の前の向き
  const k = v3dot(front, towards);
  const front2 = v3unit(v3add(front, v3scale(v3add(v3scale(towards, Math.cos(bend) - 1), v3scale(dir, -Math.sin(bend))), k)));
  const [upperLength, lowerLength] = leg ? LIMB_LENGTHS.leg : LIMB_LENGTHS.arm;
  const base = leg ? HIP_JOINT : SHOULDER_JOINT;
  const joint: Vec3 = [side * base[0], base[1], 0];
  const middle = v3add(joint, v3scale(dir, upperLength));
  const end = v3add(middle, v3scale(lower, lowerLength));
  let tipDir: Vec3, tipFront: Vec3;
  if (!leg) {
    // 手首: 前腕の向きから、手のひらの側（前）へ曲げる
    tipDir = v3add(v3scale(lower, Math.cos(tip)), v3scale(front2, Math.sin(tip)));
    tipFront = v3add(v3scale(front2, Math.cos(tip)), v3scale(lower, -Math.sin(tip)));
  } else {
    // 足先: 立っていれば前へ（ひざをついたときのように下を向くなら、すねの向きへ寝かせる）、寝ていれば脚の先へ少し前寄りに
    const sink = Math.max(0, -front2[1]);
    const base0 = posture === "stand" ? v3unit(v3add(front2, v3scale(lower, 2.5 * sink))) : v3unit(v3add(v3scale(lower, 0.85), v3scale(front2, 0.45)));
    // 足首: つま先を下へ（正）・上へ（負）
    tipDir = v3unit(v3add(v3scale(base0, Math.cos(tip)), v3scale(lower, Math.sin(tip))));
    tipFront = v3unit(v3sub(v3scale(lower, -1), v3scale(tipDir, v3dot(v3scale(lower, -1), tipDir))));
  }
  return { joint, middle, end, dir, lower, front, front2, tipDir, tipFront };
}

const limbSide = (index: number) => (index === 0 ? -1 : 1);

interface RigFrame {
  // 体の座標の点・向きを、家具の座標（cm）へ
  point: (p: Vec3) => Vec3;
  vector: (v: Vec3) => Vec3;
}

function bodyFrames(value: PersonPose): { lower: RigFrame; upper: RigFrame; head: RigFrame } {
  const [right, up, front] = POSTURE_AXES[value.posture];
  const toLocal = (v: Vec3): Vec3 => v3add(v3add(v3scale(right, v[0]), v3scale(up, v[1])), v3scale(front, v[2]));
  const waist = trunkRotation(value.waist), neck = trunkRotation(value.neck);
  const upperPoint = (p: Vec3) => v3add(WAIST_PIVOT, matVec(waist, v3sub(p, WAIST_PIVOT)));
  const headPoint = (p: Vec3) => upperPoint(v3add(NECK_PIVOT, matVec(neck, v3sub(p, NECK_PIVOT))));
  return {
    lower: { point: toLocal, vector: toLocal },
    upper: { point: (p) => toLocal(upperPoint(p)), vector: (v) => toLocal(matVec(waist, v)) },
    head: { point: (p) => toLocal(headPoint(p)), vector: (v) => toLocal(matVec(waist, matVec(neck, v))) },
  };
}

interface RigResult {
  parts: PersonPart[];
  // 2Dでつかむ所（真上から見た位置）。並びは PERSON_HANDLE_COUNT の説明のとおり
  handles: Point2[];
  // 胴の部品（寝たときに床に置く）
  torso: number[];
}

// 姿勢から部品とつまみの位置を作る（床に置く前）
function rig(value: PersonPose): RigResult {
  const frames = bodyFrames(value);
  const parts: PersonPart[] = [];
  const torso: number[] = [];
  // a から b へ、a の端の半径 r（3本の向きはその座標の右・上・前）、b の端は r × taper。flat は右・上・前の縮め方
  const add = (frame: RigFrame, a: Vec3, b: Vec3, r: number, taper: number, axes: [Vec3, Vec3, Vec3], flat: Vec3, joint = false) => {
    parts.push({ a: frame.point(a), b: frame.point(b), axes: axes.map((axis, i) => v3scale(frame.vector(v3unit(axis)), r * flat[i])) as [Vec3, Vec3, Vec3], taper, joint });
    return parts.length - 1;
  };
  const R: Vec3 = [1, 0, 0], U: Vec3 = [0, 1, 0], F: Vec3 = [0, 0, 1];
  const body: [Vec3, Vec3, Vec3] = [R, U, F];
  // 腰と、腰の関節の玉
  torso.push(add(frames.lower, [0, -5, 0], [0, 7, 0], 12.5, 0.9, body, [1, 1, 0.72]));
  add(frames.lower, WAIST_PIVOT, WAIST_PIVOT, 10, 1, body, [1, 1, 0.72], true);
  // おなか・胸（上が広い）・肩の玉
  torso.push(add(frames.upper, [0, 14, 0], [0, 22, 0], 10.5, 1.12, body, [1, 1, 0.7]));
  torso.push(add(frames.upper, [0, 24, 0], [0, 36, 0], 12.5, 1.18, body, [1, 1, 0.62]));
  for (const side of [-1, 1]) add(frames.upper, [side * SHOULDER_JOINT[0], SHOULDER_JOINT[1], 0], [side * SHOULDER_JOINT[0], SHOULDER_JOINT[1], 0], 6.3, 1, body, [1, 1, 1], true);
  // 首と頭（卵形。上が少し大きい）
  add(frames.head, [0, 44, 0], [0, 53, 0], 4.6, 0.92, body, [1, 1, 1]);
  add(frames.head, [0, 59.5, 0.6], [0, 66.5, 0], 8.2, 1.16, body, [1, 1, 1.06]);
  const handles: Point2[] = new Array(PERSON_HANDLE_COUNT);
  const flat2 = (p: Vec3): Point2 => [p[0], p[2]];
  value.arms.forEach((angles, index) => {
    const side = limbSide(index);
    const b = limbBones(angles, side, false, value.posture);
    const across = v3cross(b.dir, b.front), across2 = v3cross(b.lower, b.front2);
    add(frames.upper, b.joint, b.middle, 5.2, 0.82, [across, b.dir, b.front], [1, 1, 1]);
    add(frames.upper, b.middle, b.middle, 4.4, 1, body, [1, 1, 1], true);
    add(frames.upper, b.middle, b.end, 4.1, 0.75, [across2, b.lower, b.front2], [1, 1, 1]);
    add(frames.upper, b.end, b.end, 3.2, 1, body, [1, 1, 1], true);
    // 手: 手のひらの厚みの向きに薄い
    const palm = v3cross(b.tipDir, b.tipFront);
    add(frames.upper, v3add(b.end, v3scale(b.tipDir, 1.5)), v3add(b.end, v3scale(b.tipDir, 8.5)), 3.3, 1.05, [palm, b.tipDir, b.tipFront], [0.55, 1, 1]);
    handles[index] = flat2(frames.upper.point(b.end));
    handles[4 + index] = flat2(frames.upper.point(b.middle));
  });
  value.legs.forEach((angles, index) => {
    const side = limbSide(index);
    const b = limbBones(angles, side, true, value.posture);
    const across = v3cross(b.dir, b.front), across2 = v3cross(b.lower, b.front2);
    add(frames.lower, b.joint, b.joint, 7.2, 1, body, [1, 1, 1], true);
    add(frames.lower, b.joint, b.middle, 7.6, 0.74, [across, b.dir, b.front], [1, 1, 1]);
    add(frames.lower, b.middle, b.middle, 5.5, 1, body, [1, 1, 1], true);
    add(frames.lower, b.middle, b.end, 5.3, 0.7, [across2, b.lower, b.front2], [1, 1, 1]);
    add(frames.lower, b.end, b.end, 3.7, 1, body, [1, 1, 1], true);
    // 足: かかとからつま先へ。足の甲の向きに薄く、足首より少し下
    const sole = v3cross(b.tipDir, b.tipFront);
    const down = v3scale(b.tipFront, -2.8);
    add(frames.lower, v3add(v3add(b.end, v3scale(b.tipDir, -2)), down), v3add(v3add(b.end, v3scale(b.tipDir, 12)), down), 3.6, 1.15, [sole, b.tipDir, b.tipFront], [1, 1, 0.6]);
    handles[2 + index] = flat2(frames.lower.point(b.end));
    handles[6 + index] = flat2(frames.lower.point(b.middle));
  });
  handles[8] = flat2(frames.head.point(HEAD_CENTER));
  return { parts, handles, torso };
}

const verticalExtent = (part: PersonPart) => Math.hypot(part.axes[0][1], part.axes[1][1], part.axes[2][1]);
const partBottom = (part: PersonPart) => Math.min(part.a[1] - verticalExtent(part), part.b[1] - verticalExtent(part) * part.taper);
export const partTop = (part: PersonPart) => Math.max(part.a[1] + verticalExtent(part), part.b[1] + verticalExtent(part) * part.taper);
const raise = (part: PersonPart, dy: number): PersonPart => ({ ...part, a: [part.a[0], part.a[1] + dy, part.a[2]], b: [part.b[0], part.b[1] + dy, part.b[2]] });

// 床に置く。立っていればいちばん低い所（ふつうは足の裏）を床に。
// 寝ていれば胴を床に置き、床の近くの頭や手足もそれぞれ床に下ろす（持ち上げた手足はそのまま）
function settle(parts: PersonPart[], posture: Posture, torso: number[]): PersonPart[] {
  if (posture === "stand") {
    const lowest = Math.min(...parts.map(partBottom));
    return parts.map((part) => raise(part, -lowest));
  }
  const base = Math.min(...torso.map((index) => partBottom(parts[index])));
  return parts.map((part) => {
    const lifted = raise(part, -base);
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

// 部品を真上から見た形（両端の楕円をつないだ凸の形）
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
    points.push([part.a[0] + ex, part.a[2] + ez], [part.b[0] + ex * part.taper, part.b[2] + ez * part.taper]);
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
  handles: Point2[];
}

const refCache = new Map<string, RefPerson>();

// 実物大（1倍）の人。腰の真下が原点
function refPerson(value: PersonPose): RefPerson {
  const key = JSON.stringify(value);
  const cached = refCache.get(key);
  if (cached) return cached;
  const result = rig(value);
  const parts = settle(result.parts, value.posture, result.torso);
  const outlines = parts.map((part) => partOutline(part));
  // 3Dの立体の角が2Dの点より少し外へ出ても範囲に収まるよう、0.5cm広げる
  const xs = outlines.flat().map((point) => point[0]), zs = outlines.flat().map((point) => point[1]);
  const bounds: [number, number, number, number] = [Math.min(...xs) - 0.5, Math.min(...zs) - 0.5, Math.max(...xs) + 0.5, Math.max(...zs) + 0.5];
  const ref = { parts, outlines, bounds, handles: result.handles };
  if (refCache.size > 400) refCache.clear();
  refCache.set(key, ref);
  return ref;
}

// 姿勢を実物大で真上から見た大きさと、その中の腰の位置（範囲の中心から）
export function personRefSize(value: PersonPose): { w: number; h: number; pelvis: Point2 } {
  const [x0, z0, x1, z1] = refPerson(value).bounds;
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
  // 2Dでつかむ所。並びは PERSON_HANDLE_COUNT の説明のとおり
  handles: Point2[];
  w: number;
  h: number;
  legacy: boolean;
  chalkOutline?: Point2[];
}

const layoutCache = new Map<string, PersonLayout>();

// 人を家具の範囲（幅 w × 奥行 h）に置いた形。縦横の比は変えずに、範囲に収まる大きさで中央に置く
export function personLayout(w: number, h: number, value: PersonPose | null, legacy = 0): PersonLayout {
  const key = `${w}x${h}:${value ? JSON.stringify(value) : `legacy${legacy}`}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;
  let layout: PersonLayout;
  if (!value) {
    // 前からある倒れた人の形: 幅100 × 奥行180 の形をそのまま縮める
    const scale = Math.min(w / 100, h / 180);
    const parts = (FALLEN_POSES[legacy] ?? FALLEN_POSES[0]).map(([a, b, r, skin]): PersonPart => {
      const flat = a[0] === b[0] && a[1] === b[1] ? 0.85 : 0.68;
      const radius = r * scale, height = radius * flat;
      return { a: [a[0] * scale, height, a[1] * scale], b: [b[0] * scale, height, b[1] * scale], axes: [[radius, 0, 0], [0, height, 0], [0, 0, radius]], taper: 1, joint: skin };
    });
    const end = (index: number): Point2 => [parts[index].b[0], parts[index].b[2]];
    const start = (index: number): Point2 => [parts[index].a[0], parts[index].a[2]];
    layout = {
      parts, outlines: parts.map((part) => partOutline(part)), layers: [parts.map((_, index) => index)], scale, center: [0, 0],
      pelvis: [(parts[2].a[0] + parts[2].b[0]) / 2, (parts[2].a[2] + parts[2].b[2]) / 2],
      handles: [end(4), end(7), end(10), end(13), start(4), start(7), start(10), start(13), start(0)], w, h, legacy: true,
    };
  } else {
    const ref = refPerson(value);
    const [x0, z0, x1, z1] = ref.bounds;
    const scale = Math.min(w / (x1 - x0), h / (z1 - z0));
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const place = ([x, z]: Point2): Point2 => [(x - cx) * scale, (z - cz) * scale];
    const placeVec = (p: Vec3): Vec3 => [(p[0] - cx) * scale, p[1] * scale, (p[2] - cz) * scale];
    const parts = ref.parts.map((part): PersonPart => ({
      ...part, a: placeVec(part.a), b: placeVec(part.b), axes: part.axes.map((axis) => v3scale(axis, scale)) as [Vec3, Vec3, Vec3],
    }));
    layout = {
      parts, outlines: ref.outlines.map((outline) => outline.map(place)), layers: partLayers(parts), scale, center: [cx, cz],
      pelvis: place([0, 0]), handles: ref.handles.map(place), w, h, legacy: false,
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

// つまみ（handle）を、真上から見た target（実物大の座標）へ動かした姿勢。
// 手首・足首: 寝ていれば床の上で、ひじ・ひざの曲げ方と腕・脚の開きを変えて届かせる。立っていれば腕・脚の向きを変える。
// ひじ・ひざ: 腕・脚の付け根を回す（曲げはそのまま）。頭: 腰を曲げる（寝ていれば横へ、立っていれば前と横へ）
export function reachHandle(value: PersonPose, handle: number, target: Point2): PersonPose {
  const lying = value.posture !== "stand";
  const project = (candidate: PersonPose): Point2 => rig(candidate).handles[handle];
  let params: number[];
  let apply: (params: number[]) => PersonPose;
  if (handle === 8) {
    params = lying ? [value.waist[1] * DEG] : [value.waist[0] * DEG, value.waist[1] * DEG];
    apply = (p) => {
      const next = clonePose(value);
      next.waist = lying ? [value.waist[0], p[0] / DEG, value.waist[2]] : [p[0] / DEG, p[1] / DEG, value.waist[2]];
      return next;
    };
  } else {
    const leg = handle % 4 >= 2, index = handle % 2, middle = handle >= 4;
    const limbOf = (candidate: PersonPose) => (leg ? candidate.legs : candidate.arms)[index];
    const angles = limbOf(value);
    const natural = leg ? 180 : 0;
    if (middle) {
      params = lying ? [angles[0] * DEG] : [angles[0] * DEG, angles[1] * DEG];
      apply = (p) => {
        const next = clonePose(value);
        const limb = limbOf(next);
        limb[0] = p[0] / DEG;
        if (!lying) limb[1] = p[1] / DEG;
        return next;
      };
    } else if (lying) {
      // 曲げの向きを床の面（±90°）にそろえ、向きは符号付きの曲げで表す
      const sign = wrapDegrees(angles[3] + natural) < 0 ? -1 : 1;
      params = [angles[0] * DEG, sign * angles[2] * DEG];
      apply = (p) => {
        const next = clonePose(value);
        const limb = limbOf(next);
        limb[0] = p[0] / DEG;
        limb[2] = Math.abs(p[1]) / DEG;
        limb[3] = wrapDegrees((p[1] < 0 ? -90 : 90) - natural);
        return next;
      };
    } else {
      params = [angles[0] * DEG, angles[1] * DEG];
      apply = (p) => {
        const next = clonePose(value);
        const limb = limbOf(next);
        limb[0] = p[0] / DEG;
        limb[1] = p[1] / DEG;
        return next;
      };
    }
  }
  const solved = solveToward(params, (p) => project(apply(p)), target);
  const result = apply(solved);
  for (const limb of [...result.arms, ...result.legs]) limb.forEach((angle, i) => (limb[i] = roundAngle(angle)));
  result.waist = result.waist.map(roundAngle) as TrunkAngles;
  return result;
}

// 真上から見た点 f(p) を target に近づける角度 p（レーベンバーグ・マーカート法。届かない所では、いちばん近い所で止まる）
function solveToward(start: number[], f: (p: number[]) => Point2, target: Point2): number[] {
  let p = [...start];
  const residual = (q: number[]) => {
    const point = f(q);
    return [point[0] - target[0], point[1] - target[1]];
  };
  let r = residual(p);
  let error = r[0] * r[0] + r[1] * r[1];
  let lambda = 10;
  for (let iteration = 0; iteration < 120 && error > 1e-4; iteration += 1) {
    const e = 1e-4;
    const columns = p.map((_, i) => {
      const q = [...p];
      q[i] += e;
      const shifted = residual(q);
      return [(shifted[0] - r[0]) / e, (shifted[1] - r[1]) / e];
    });
    const n = p.length;
    // (JᵀJ + λI) Δ = -Jᵀ r
    const a = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => columns[i][0] * columns[j][0] + columns[i][1] * columns[j][1] + (i === j ? lambda : 0)));
    const g = columns.map((column) => -(column[0] * r[0] + column[1] * r[1]));
    let step: number[];
    if (n === 1) step = [g[0] / a[0][0]];
    else {
      const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
      if (Math.abs(det) < 1e-12) break;
      step = [(g[0] * a[1][1] - g[1] * a[0][1]) / det, (a[0][0] * g[1] - a[1][0] * g[0]) / det];
    }
    const length = Math.hypot(...step);
    if (length > 0.3) step = step.map((value) => (value * 0.3) / length);
    const candidate = p.map((value, i) => value + step[i]);
    const r2 = residual(candidate);
    const error2 = r2[0] * r2[0] + r2[1] * r2[1];
    if (error2 < error) {
      p = candidate;
      r = r2;
      error = error2;
      lambda = Math.max(1e-6, lambda * 0.3);
    } else {
      lambda *= 10;
      if (lambda > 1e9) break;
    }
  }
  return p;
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

// 破片（ひとまとまりの形）: 中央に大きめ、外ほど小さい破片（幅・奥行に対する割合の座標）
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

// 破片をまく幅（cm）の標準と、いちばん大きな破片の半径（標準の幅のとき）
export const SHARD_SPREAD = 40;
const SHARD_SIZE = 12;

// 範囲（幅 w × 奥行 h の内側）からはみ出さないように、破片を中へ寄せて縮める
function fitPolygon(points: Point2[], w: number, h: number): Point2[] {
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length, cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const tx = Math.min(w / 2, Math.max(-w / 2, cx)), ty = Math.min(h / 2, Math.max(-h / 2, cy));
  let k = 1;
  for (const [x, y] of points) {
    const dx = x - cx, dy = y - cy;
    if (dx) k = Math.min(k, Math.max(0, (dx > 0 ? w / 2 - tx : tx + w / 2) / Math.abs(dx)));
    if (dy) k = Math.min(k, Math.max(0, (dy > 0 ? h / 2 - ty : ty + h / 2) / Math.abs(dy)));
  }
  return points.map(([x, y]): Point2 => [tx + (x - cx) * k, ty + (y - cy) * k]);
}

// なぞった道すじ（cm、家具の中心が原点）に沿って、幅 spread の中へ破片をまく。量 density が多いほど細かく並ぶ。
// 小さな破片が多く、大きな破片は少ない。乱数の並びは決まっているので、2Dと3Dで同じ破片になる
export function shardTrail(path: Point2[], w: number, h: number, spread = SHARD_SPREAD, density = 1): Point2[][] {
  const lengths = [0];
  for (let i = 1; i < path.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = lengths[lengths.length - 1] ?? 0;
  if (path.length < 2 || total < 1) return [];
  const at = (s: number): Point2 => {
    const t = Math.min(total, Math.max(0, s));
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < t) i += 1;
    const span = lengths[i] - lengths[i - 1] || 1;
    const k = (t - lengths[i - 1]) / span;
    return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k];
  };
  const random = seeded(52711);
  const scale = Math.min(1.6, Math.max(0.5, spread / SHARD_SPREAD));
  const step = Math.max(1.5, 7 / Math.max(0.2, density));
  const shards: Point2[][] = [];
  for (let s = 0; s <= total; s += step) {
    const [px, py] = at(s);
    const back = at(s - 3), ahead = at(s + 3);
    const heading = Math.atan2(ahead[1] - back[1], ahead[0] - back[0]);
    const across = (random() - 0.5) * spread, along = (random() - 0.5) * step;
    const cx = px - Math.sin(heading) * across + Math.cos(heading) * along;
    const cy = py + Math.cos(heading) * across + Math.sin(heading) * along;
    const size = (2.5 + random() * random() * (SHARD_SIZE - 2.5)) * scale;
    const sides = random() < 0.6 ? 3 : 4;
    const turn = random() * Math.PI * 2;
    const points: Point2[] = [];
    for (let k = 0; k < sides; k += 1) {
      const a = turn + (k / sides) * Math.PI * 2 + (random() - 0.5) * 0.9;
      const r = size * (0.45 + random() * 0.55);
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    shards.push(fitPolygon(points, w, h));
  }
  return shards;
}

// 破片の家具1つ分。道すじ（幅・奥行に対する割合）があればそれに沿ってまき、なければ前からある形（ひとまとまり）
export function shardPieces(w: number, h: number, path?: readonly (readonly number[])[], spread = SHARD_SPREAD, density = 1): Point2[][] {
  if (path && path.length >= 2) return shardTrail(path.map(([u, v]): Point2 => [u * w, v * h]), w, h, spread, density);
  return glassShards(w, h);
}

// 道すじのまわりに足す余白（cm）。いちばん大きな破片と、まく幅の半分
export function shardMargin(spread = SHARD_SPREAD): number {
  return spread / 2 + SHARD_SIZE * Math.min(1.6, Math.max(0.5, spread / SHARD_SPREAD)) + 1;
}
