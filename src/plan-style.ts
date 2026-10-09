// 2Dの絵柄。間取りの形（2Dと3Dで共通の形）はそのままに、描き方だけを変える。
// ドット: いったん細かく描いた絵を、ドット（何pxかの四角）ごとに1色へまとめる。細い線は、ドットのます目に沿わせる
// 筆・和風・古地図・黒板: 線を筆の運び（入り・ゆらぎ・止めや払い・かすれ）で描き、塗りを紙や板になじませる
// 鉛筆: 線を2本の手描きの線に、濃い塗りを斜線（ハッチング）にする
// マンガ: 線を黒にし、塗りを濃さに合わせたスクリーントーンにする
// 設計図・ネオン: 線と塗りの色を置き換える（ネオンは線を光らせる）

export type PlanStyle = "standard" | "pixel" | "brush" | "pencil" | "manga" | "blueprint" | "parchment" | "chalk" | "neon";

export const PLAN_STYLES: { value: PlanStyle; label: string; hint: string }[] = [
  { value: "standard", label: "標準", hint: "くっきりした線画" },
  { value: "pixel", label: "ドット", hint: "ドット絵のマップ" },
  { value: "brush", label: "筆・和風", hint: "和紙に墨と淡い色" },
  { value: "pencil", label: "鉛筆", hint: "手描きの下描き" },
  { value: "manga", label: "マンガ", hint: "白黒とトーン" },
  { value: "blueprint", label: "設計図", hint: "青焼きの図面" },
  { value: "parchment", label: "古地図", hint: "羊皮紙にセピア" },
  { value: "chalk", label: "黒板", hint: "黒板にチョーク" },
  { value: "neon", label: "ネオン", hint: "夜に光る線" },
];

// ドットの大きさ（画面のpx）
export const PIXEL_DOTS: { value: number; label: string }[] = [
  { value: 2, label: "細かい" },
  { value: 3, label: "ふつう" },
  { value: 5, label: "粗い" },
];
export const DEFAULT_PIXEL_DOT = 3;

// 和紙の色と、墨の色
export const PAPER_COLOR = "#f4eee0";
const SUMI: [number, number, number] = [38, 33, 30];

// 絵柄ごとの文字の書体。ドットは画面向けのゴシック、筆は楷書・教科書体（なければ明朝）、鉛筆と黒板は手書きに近い教科書体、古地図は明朝
const HANDWRITING = '"UD デジタル 教科書体 N-R", "UD Digi Kyokasho N-R", YuKyokasho, Klee, "HG正楷書体-PRO", "Yu Mincho", YuMincho, serif';
const FONT_FAMILIES: Record<PlanStyle, string | null> = {
  standard: null,
  pixel: '"MS Gothic", "ＭＳ ゴシック", "Osaka-Mono", Osaka, "BIZ UDGothic", monospace',
  brush: '"HG正楷書体-PRO", "HGSeikaishotaiPRO", "UD デジタル 教科書体 N-R", "UD Digi Kyokasho N-R", YuKyokasho, Klee, "Yu Mincho", YuMincho, "Hiragino Mincho ProN", serif',
  pencil: HANDWRITING,
  manga: null,
  blueprint: '"BIZ UDGothic", "BIZ UDゴシック", "Osaka", "Yu Gothic UI", sans-serif',
  parchment: '"Yu Mincho", YuMincho, "Hiragino Mincho ProN", "MS Mincho", serif',
  chalk: HANDWRITING,
  neon: null,
};

// 絵柄ごとの地の色と方眼の色（細い線・5本ごとの線）。地の色が null なら透明（標準）
export const STYLE_LOOKS: Record<PlanStyle, { background: string | null; grid: [string, string] }> = {
  standard: { background: null, grid: ["#f2f4f7", "#e2e6ec"] },
  pixel: { background: "#ffffff", grid: ["#f5f6f8", "#e9ecf0"] },
  brush: { background: PAPER_COLOR, grid: ["rgba(150, 118, 76, 0.11)", "rgba(150, 118, 76, 0.22)"] },
  pencil: { background: "#fbfaf6", grid: ["rgba(96, 132, 170, 0.12)", "rgba(96, 132, 170, 0.24)"] },
  manga: { background: "#ffffff", grid: ["rgba(0, 0, 0, 0.04)", "rgba(0, 0, 0, 0.08)"] },
  blueprint: { background: "#1d4e89", grid: ["rgba(190, 220, 255, 0.10)", "rgba(190, 220, 255, 0.24)"] },
  parchment: { background: "#ead9b2", grid: ["rgba(110, 76, 34, 0.08)", "rgba(110, 76, 34, 0.17)"] },
  chalk: { background: "#2e4a3b", grid: ["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.11)"] },
  neon: { background: "#090c18", grid: ["rgba(64, 96, 180, 0.16)", "rgba(64, 120, 220, 0.34)"] },
};

// 書体の指定（例 `700 12px "Yu Gothic UI", sans-serif`）の、書体の名前だけを絵柄の書体に替える
export function styledFont(font: string, style: PlanStyle): string {
  const family = FONT_FAMILIES[style];
  if (!family) return font;
  const match = /^(.*?[\d.]+(?:e[-+]?\d+)?px(?:\/\S+)?)\s+(.+)$/i.exec(font);
  return match ? `${match[1]} ${family}` : font;
}

// ---- 決まった並びの乱数となめらかなゆらぎ（同じ線はいつ描いても同じ形になるように） ----

function hash32(value: number): number {
  let n = value | 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

function hashUnit(seed: number, index: number): number {
  return hash32(Math.imul(seed, 0x9e3779b1) ^ Math.imul(index, 0x85ebca6b)) / 4294967296;
}

// -1〜1 のなめらかなゆらぎ。x が1変わるごとに、新しい値へなめらかに移る
function wave(seed: number, x: number): number {
  const i = Math.floor(x), f = x - i;
  const a = hashUnit(seed, i) * 2 - 1, b = hashUnit(seed, i + 1) * 2 - 1;
  return a + (b - a) * f * f * (3 - 2 * f);
}

function seededRandom(seed: number): () => number {
  let state = hash32(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 線の形から決める乱数の種。動かしても形が同じなら同じ種になる（ドラッグ中に筆の形が変わらない）
export function shapeSeed(points: readonly number[], scale: number, salt = 0): number {
  const n = points.length;
  if (n < 4) return hash32(salt + 17);
  let length = 0;
  for (let i = 2; i < n; i += 2) length += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
  const angle = Math.atan2(points[n - 1] - points[1], points[n - 2] - points[0]);
  return hash32(Math.round((length / scale) * 4) * 31 + Math.round(angle * 40) * 7919 + salt * 104729);
}

// ---- 道すじ（x, y の並び）の扱い ----

function dedupe(points: readonly number[], minGap: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const n = out.length;
    if (n && Math.hypot(points[i] - out[n - 2], points[i + 1] - out[n - 1]) < minGap) continue;
    out.push(points[i], points[i + 1]);
  }
  return out;
}

function polylineLength(points: readonly number[]): number {
  let length = 0;
  for (let i = 2; i < points.length; i += 2) length += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
  return length;
}

// 線分を四角の範囲に切り詰める。範囲の外なら null
function clipSegment(x0: number, y0: number, x1: number, y1: number, minX: number, minY: number, maxX: number, maxY: number): [number, number, number, number] | null {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - minX], [dx, maxX - x0], [-dy, y0 - minY], [dy, maxY - y0]]) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1];
}

// 道すじのうち四角の範囲に入る所だけを、つながった道すじごとに返す（大きく拡大して、画面の外へ長く伸びた線を描くときに）。
// starts には、それぞれの道すじが元の道すじのはじめからどれだけ進んだ所で始まるかを入れる（破線の模様がずれないように）
export function clipPolyline(points: readonly number[], minX: number, minY: number, maxX: number, maxY: number, starts: number[] = []): number[][] {
  const runs: number[][] = [];
  let current: number[] | null = null;
  let walked = 0;
  for (let i = 2; i < points.length; i += 2) {
    const x0 = points[i - 2], y0 = points[i - 1];
    const length = Math.hypot(points[i] - x0, points[i + 1] - y0);
    const clipped = clipSegment(x0, y0, points[i], points[i + 1], minX, minY, maxX, maxY);
    if (clipped) {
      const [ax, ay, bx, by] = clipped;
      if (!current || current[current.length - 2] !== ax || current[current.length - 1] !== ay) {
        current = [ax, ay];
        runs.push(current);
        starts.push(walked + Math.hypot(ax - x0, ay - y0));
      }
      current.push(bx, by);
    } else {
      current = null;
    }
    walked += length;
  }
  return runs;
}

// 多角形を四角の範囲に切り詰める（塗りに使う。範囲の縁に沿った辺ができる）
export function clipPolygon(points: readonly number[], minX: number, minY: number, maxX: number, maxY: number): number[] {
  let out = [...points];
  const edges: [(x: number, y: number) => number][] = [[(x) => x - minX], [(x) => maxX - x], [(_, y) => y - minY], [(_, y) => maxY - y]];
  for (const [inside] of edges) {
    const input = out;
    out = [];
    const n = input.length;
    for (let i = 0; i < n; i += 2) {
      const ax = input[(i - 2 + n) % n], ay = input[(i - 1 + n) % n], bx = input[i], by = input[i + 1];
      const da = inside(ax, ay), db = inside(bx, by);
      if (db >= 0) {
        if (da < 0) out.push(ax + ((bx - ax) * da) / (da - db), ay + ((by - ay) * da) / (da - db));
        out.push(bx, by);
      } else if (da >= 0) {
        out.push(ax + ((bx - ax) * da) / (da - db), ay + ((by - ay) * da) / (da - db));
      }
    }
    if (!out.length) return out;
  }
  return out;
}

// 破線の模様（長さの並び。描く・空ける・描く…）で、道すじを描く所だけに切り分ける
export function dashPolyline(points: readonly number[], dashes: readonly number[], offset = 0): number[][] {
  const pattern = dashes.length % 2 ? [...dashes, ...dashes] : [...dashes];
  const period = pattern.reduce((sum, value) => sum + value, 0);
  if (!pattern.length || period <= 0 || pattern.some((value) => value < 0)) return [[...points]];
  let index = 0, left = pattern[0], on = true;
  let skip = ((offset % period) + period) % period;
  while (skip > 0) {
    const used = Math.min(skip, left);
    left -= used;
    skip -= used;
    if (left <= 0) {
      index = (index + 1) % pattern.length;
      left = pattern[index];
      on = index % 2 === 0;
    }
  }
  const pieces: number[][] = [];
  let current: number[] | null = on ? [points[0], points[1]] : null;
  for (let i = 2; i < points.length; i += 2) {
    let x = points[i - 2], y = points[i - 1];
    const ex = points[i], ey = points[i + 1];
    let segment = Math.hypot(ex - x, ey - y);
    while (segment > 0) {
      const used = Math.min(segment, left);
      const t = used / segment;
      x += (ex - x) * t;
      y += (ey - y) * t;
      segment -= used;
      left -= used;
      if (on && current) current.push(x, y);
      if (left <= 1e-9) {
        if (on && current && current.length >= 4) pieces.push(current);
        index = (index + 1) % pattern.length;
        left = pattern[index];
        on = index % 2 === 0;
        current = on ? [x, y] : null;
      }
    }
  }
  if (on && current && current.length >= 4) pieces.push(current);
  return pieces;
}

export interface StrokePiece {
  points: number[];
  closed: boolean;
  // 角で切った端（角で少し突き抜けて、線どうしをつなげる）
  cornerStart: boolean;
  cornerEnd: boolean;
}

// 道すじを、鋭い角で別々の筆の線に分ける（筆で四角を描くときは、辺ごとに筆を運ぶ）。
// sharp は角になってよい点（曲線の途中の点は角にしない）
export function splitStrokes(points: readonly number[], sharp: readonly boolean[] | null, closed: boolean, maxTurn = (50 * Math.PI) / 180): StrokePiece[] {
  const n = points.length / 2;
  if (n < 2) return [];
  const turnAt = (i: number): number => {
    const prev = (i - 1 + n) % n, next = (i + 1) % n;
    const ax = points[i * 2] - points[prev * 2], ay = points[i * 2 + 1] - points[prev * 2 + 1];
    const bx = points[next * 2] - points[i * 2], by = points[next * 2 + 1] - points[i * 2 + 1];
    return Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
  };
  const isCorner = (i: number) => (!sharp || sharp[i]) && turnAt(i) > maxTurn;
  if (!closed) {
    const pieces: StrokePiece[] = [];
    let start = 0;
    for (let i = 1; i < n - 1; i += 1) {
      if (!isCorner(i)) continue;
      pieces.push({ points: points.slice(start * 2, i * 2 + 2), closed: false, cornerStart: start > 0, cornerEnd: true });
      start = i;
    }
    pieces.push({ points: points.slice(start * 2), closed: false, cornerStart: start > 0, cornerEnd: false });
    return pieces;
  }
  const corners: number[] = [];
  for (let i = 0; i < n; i += 1) if (isCorner(i)) corners.push(i);
  if (!corners.length) return [{ points: [...points], closed: true, cornerStart: false, cornerEnd: false }];
  const pieces: StrokePiece[] = [];
  for (let c = 0; c < corners.length; c += 1) {
    const from = corners[c], to = corners[(c + 1) % corners.length];
    const piece: number[] = [];
    for (let i = from; ; i = (i + 1) % n) {
      piece.push(points[i * 2], points[i * 2 + 1]);
      if (i === to && piece.length > 2) break;
    }
    pieces.push({ points: piece, closed: false, cornerStart: true, cornerEnd: true });
  }
  return pieces;
}

// ---- 筆の線 ----

export interface BrushStrokeOptions {
  // 太さ（画素）と、画面の1pxあたりの画素数（ゆらぎの大きさの基準）
  width: number;
  unit: number;
  seed: number;
  // 輪のように閉じた線（はじめの所へ少し重ねて終える）
  closed?: boolean;
  // はじめ・おわりを、線の向きのまま延ばす長さ（画素）。角をつなげたり、角の形の線の端を四角くしたりする
  extendStart?: number;
  extendEnd?: number;
  // 破線の1つなどの短い線。かすれを付けない
  simple?: boolean;
  // 太い線が終わりの方でかすれる確からしさ（0〜1。ふつうは 0.55）
  dry?: number;
  // 線のどこでも、粉のように細かく途切れる割合（チョーク）。0 なら途切れない
  grain?: number;
}

// 筆圧（太さの割合）。入りで少しふくらみ、止めでわずかに細って戻るか、払いで細く抜ける
function pressureAt(s: number, total: number, width: number, unit: number, sweep: boolean): number {
  const entry = Math.min(total * 0.3, width * 2.2 + 3 * unit);
  const exit = Math.min(total * 0.4, width * 3.5 + 6 * unit);
  let p = 1;
  if (s < entry) {
    const t = s / entry;
    p = 0.6 + 0.4 * t + 0.3 * Math.sin(Math.PI * t) * (1 - 0.3 * t);
  }
  if (s > total - exit) {
    const u = (s - (total - exit)) / exit;
    p *= sweep ? 1 - 0.72 * Math.pow(u, 1.6) : 1 - 0.14 * Math.sin(Math.PI * u);
  }
  return p;
}

// 多角形の向きをそろえる（重なった多角形どうしが、塗りで打ち消し合わないように）
function oriented(polygon: number[]): number[] {
  let area = 0;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) area += polygon[j] * polygon[i + 1] - polygon[i] * polygon[j + 1];
  if (area >= 0) return polygon;
  const out: number[] = [];
  for (let i = polygon.length - 2; i >= 0; i -= 2) out.push(polygon[i], polygon[i + 1]);
  return out;
}

function blob(x: number, y: number, r: number, seed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const rr = r * (1 + 0.16 * wave(seed, i * 0.9));
    out.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  return oriented(out);
}

// 筆で引いた1本の線を、塗りつぶす多角形の集まり（画素の座標）にする
export function brushStroke(path: readonly number[], options: BrushStrokeOptions): number[][] {
  const { width, unit, seed } = options;
  let points = dedupe(path, 0.25 * unit);
  if (points.length < 4) return points.length ? [blob(points[0], points[1], width * 0.55, seed)] : [];
  const random = seededRandom(seed);
  if (options.closed) {
    // 輪: はじめの所を通り過ぎるまで描いて、重ねて終える
    const total = polylineLength(points);
    const overlap = Math.min(total * 0.12, width * 3 + 5 * unit);
    let walked = 0;
    const extra: number[] = [];
    for (let i = 2; i < points.length && walked < overlap; i += 2) {
      walked += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
      extra.push(points[i], points[i + 1]);
    }
    points = [...points, points[0], points[1], ...extra];
  }
  const extend = (from: number, to: number, length: number, atStart: boolean) => {
    const dx = points[to] - points[from], dy = points[to + 1] - points[from + 1];
    const d = Math.hypot(dx, dy) || 1;
    const x = points[atStart ? from : to] + (atStart ? -dx : dx) / d * length;
    const y = points[atStart ? from + 1 : to + 1] + (atStart ? -dy : dy) / d * length;
    if (atStart) points.unshift(x, y);
    else points.push(x, y);
  };
  if (options.extendStart) extend(0, 2, options.extendStart, true);
  if (options.extendEnd) extend(points.length - 4, points.length - 2, options.extendEnd, false);

  const total = polylineLength(points);
  if (total < Math.max(width * 0.6, unit)) {
    const half = points.length >> 2 << 1;
    return [blob(points[half], points[half + 1], width * 0.55, seed)];
  }

  // 等しい間隔に並べ直す
  const step = Math.min(4 * unit, Math.max(2 * unit, width * 0.6));
  const count = Math.max(2, Math.ceil(total / step) + 1);
  const cx = new Float64Array(count), cy = new Float64Array(count), nx = new Float64Array(count), ny = new Float64Array(count);
  {
    let seg = 2, segStart = 0, segLength = Math.hypot(points[2] - points[0], points[3] - points[1]);
    for (let k = 0; k < count; k += 1) {
      const s = (k / (count - 1)) * total;
      while (seg < points.length - 2 && segStart + segLength < s) {
        segStart += segLength;
        seg += 2;
        segLength = Math.hypot(points[seg] - points[seg - 2], points[seg + 1] - points[seg - 1]);
      }
      const t = segLength > 0 ? Math.min(1, Math.max(0, (s - segStart) / segLength)) : 0;
      cx[k] = points[seg - 2] + (points[seg] - points[seg - 2]) * t;
      cy[k] = points[seg - 1] + (points[seg + 1] - points[seg - 1]) * t;
    }
  }
  for (let k = 0; k < count; k += 1) {
    const a = Math.max(0, k - 1), b = Math.min(count - 1, k + 1);
    const dx = cx[b] - cx[a], dy = cy[b] - cy[a];
    const d = Math.hypot(dx, dy) || 1;
    nx[k] = -dy / d;
    ny[k] = dx / d;
  }

  // ゆらぎ（手で引いた線の小さな波と、長い線のわずかな反り）と、筆圧による太さ
  const sweep = !options.simple && random() < 0.35;
  const amplitude = (0.35 + (0.05 * width) / unit) * unit;
  const wavelength = (55 + random() * 50) * unit;
  const bow = options.closed ? 0 : Math.min(total * 0.006, 2.5 * unit) * (random() * 2 - 1);
  const pressure = 0.92 + random() * 0.16;
  const half = new Float64Array(count);
  for (let k = 0; k < count; k += 1) {
    const s = (k / (count - 1)) * total;
    const offset = amplitude * wave(seed + 1, s / wavelength) + bow * Math.sin((Math.PI * s) / total);
    cx[k] += nx[k] * offset;
    cy[k] += ny[k] * offset;
    const p = pressureAt(s, total, width, unit, sweep) * pressure * (1 + 0.1 * wave(seed + 2, s / (30 * unit)));
    half[k] = Math.max(0.35 * unit, (width / 2) * p);
  }

  // 1本の帯を多角形にする。lane は帯の中心のずれ（太さに対する割合）、spread は帯の太さの割合
  const band = (from: number, to: number, lane: number, spread: number, roughSeed: number): number[] => {
    const left: number[] = [], right: number[] = [];
    for (let k = from; k <= to; k += 1) {
      const s = (k / (count - 1)) * total;
      const center = lane * half[k] * 2;
      const l = half[k] * spread * (1 + 0.14 * wave(roughSeed, s / (2.5 * unit)));
      const r = half[k] * spread * (1 + 0.14 * wave(roughSeed + 7, s / (2.5 * unit)));
      left.push(cx[k] + nx[k] * (center + l), cy[k] + ny[k] * (center + l));
      right.push(cx[k] + nx[k] * (center - r), cy[k] + ny[k] * (center - r));
    }
    // 端は丸く（線の向きに少し出す）
    const cap = (k: number, sign: number): [number, number] => {
      const tx = ny[k], ty = -nx[k];
      const center = lane * half[k] * 2;
      return [cx[k] + nx[k] * center - tx * sign * half[k] * spread * 0.85, cy[k] + ny[k] * center - ty * sign * half[k] * spread * 0.85];
    };
    const start = cap(from, 1), end = cap(to, -1);
    const polygon: number[] = [...start];
    polygon.push(...left, ...end);
    for (let i = right.length - 2; i >= 0; i -= 2) polygon.push(right[i], right[i + 1]);
    return oriented(polygon);
  };

  const grain = options.grain ?? 0;
  if (options.simple || ((width < 3.2 * unit || total < width * 5) && !grain)) return [band(0, count - 1, 0, 1, seed + 3)];

  // 太い線は、筆の毛の束ごとに描く。墨が少なくなる終わりの方で、外側の毛からかすれる（チョークは細い線も束にして、どこでも途切れさせる）
  const bristles = grain ? Math.min(5, Math.max(2, Math.round(width / (1.2 * unit)))) : Math.min(7, Math.max(3, Math.round(width / (1.5 * unit))));
  const dry = random() < (options.dry ?? 0.55);
  const polygons: number[][] = [];
  for (let j = 0; j < bristles; j += 1) {
    const lane = ((j + 0.5) / bristles - 0.5) * 0.82;
    const edge = Math.abs(lane) / 0.41;
    const spread = (1.55 / bristles) * (1 - 0.25 * edge);
    const dryFrom = dry ? total * ((sweep ? 0.45 : 0.62) + 0.3 * (1 - edge) * random()) : Infinity;
    let runStart = 0, gap = 0;
    for (let k = 0; k < count; k += 1) {
      const s = (k / (count - 1)) * total;
      if (gap > 0) {
        gap -= 1;
        if (gap === 0) runStart = k;
        continue;
      }
      const progress = (s - dryFrom) / Math.max(1, total - dryFrom);
      const chance = (s > dryFrom && k < count - 1 ? (0.03 + 0.22 * progress * progress) * (0.6 + edge) : 0)
        + (grain && k < count - 1 ? grain * (0.6 + edge) : 0);
      if (chance > 0 && random() < chance) {
        if (k - 1 > runStart) polygons.push(band(runStart, k - 1, lane, spread, seed + 11 + j));
        gap = 1 + Math.floor(random() * 4);
      }
    }
    if (gap === 0 && count - 1 > runStart) polygons.push(band(runStart, count - 1, lane, spread, seed + 11 + j));
  }
  return polygons;
}

// 塗りの縁を、筆で塗ったように少し波打たせる（画素の座標の多角形）
export function wobblePolygon(points: readonly number[], unit: number, seed: number): number[] {
  const clean = dedupe(points, 0.25 * unit);
  const n = clean.length / 2;
  if (n < 3) return clean;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < clean.length; i += 2) {
    minX = Math.min(minX, clean[i]);
    maxX = Math.max(maxX, clean[i]);
    minY = Math.min(minY, clean[i + 1]);
    maxY = Math.max(maxY, clean[i + 1]);
  }
  const size = Math.min(maxX - minX, maxY - minY);
  const amplitude = Math.min(1.1 * unit, size * 0.04);
  if (amplitude < 0.05) return clean;
  const spacing = 6 * unit;
  const out: number[] = [];
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    const ax = clean[i * 2], ay = clean[i * 2 + 1];
    const b = ((i + 1) % n) * 2;
    const dx = clean[b] - ax, dy = clean[b + 1] - ay;
    const length = Math.hypot(dx, dy);
    const parts = Math.max(1, Math.ceil(length / spacing));
    const ox = length ? -dy / length : 0, oy = length ? dx / length : 0;
    for (let p = 0; p < parts; p += 1) {
      const t = p / parts;
      const offset = amplitude * wave(seed, (s + t * length) / (14 * unit));
      out.push(ax + dx * t + ox * offset, ay + dy * t + oy * offset);
    }
    s += length;
  }
  return out;
}

// ---- 色 ----

export function parseCssColor(value: string): [number, number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  return null;
}

function cssColor([r, g, b]: readonly number[], alpha: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return alpha >= 1 ? `rgb(${c(r)}, ${c(g)}, ${c(b)})` : `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${Math.round(alpha * 1000) / 1000})`;
}

function mix(a: readonly number[], b: readonly number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const PAPER_RGB = parseCssColor(PAPER_COLOR)!;

const colorCache = new Map<string, string>();

function cachedColor(key: string, make: () => string): string {
  let color = colorCache.get(key);
  if (color === undefined) {
    if (colorCache.size > 2000) colorCache.clear();
    color = make();
    colorCache.set(key, color);
  }
  return color;
}

// 墨の色。黒に近い色は墨に、灰色は少し茶色がかった薄墨に、色のある線は少しくすませる。tone で1本ごとの濃淡を付ける（-1〜1）
export function inkColor(value: string, tone = 0): string {
  return cachedColor(`i${tone}${value}`, () => makeInkColor(value, tone));
}

function makeInkColor(value: string, tone: number): string {
  const parsed = parseCssColor(value);
  if (!parsed) return value;
  const [r, g, b, a] = parsed;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lightness = 0.299 * r + 0.587 * g + 0.114 * b;
  const saturation = max ? (max - min) / max : 0;
  let rgb: number[];
  if (saturation < 0.14) {
    // 黒から灰色: 明るさを保って、墨から和紙の色の間にする
    const t = Math.min(1, Math.max(0, (lightness - SUMI[0]) / (PAPER_RGB[0] - SUMI[0])));
    rgb = mix(SUMI, mix(SUMI, PAPER_RGB, 0.92), t);
  } else {
    const gray = lightness;
    rgb = [r + (gray - r) * 0.15, g + (gray - g) * 0.15, b + (gray - b) * 0.15].map((v) => v * 0.95);
  }
  const shade = 1 + tone * 0.07;
  rgb = rgb.map((v) => (tone >= 0 ? v + (255 - v) * (shade - 1) * 0.6 : v * shade));
  return cssColor(rgb, a);
}

// 塗りの色。白に近い色は和紙の色に、ほかの色も少し和紙になじませる
export function washColor(value: string): string {
  return cachedColor(`w${value}`, () => makeWashColor(value));
}

function makeWashColor(value: string): string {
  const parsed = parseCssColor(value);
  if (!parsed) return value;
  const [r, g, b, a] = parsed;
  if (Math.min(r, g, b) >= 245) return cssColor(PAPER_RGB, a);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const muted = [r + (gray - r) * 0.1, g + (gray - g) * 0.1, b + (gray - b) * 0.1];
  return cssColor(mix(muted, PAPER_RGB, 0.16), a);
}

// ---- ドット ----

// 道すじが通るドット（ます目）を、ドット絵の線のように1ドットずつつなげて並べる。
// 曲線のつなぎ目で L 字に重なった所は1つ減らす（ドット絵の線は、斜めにつながる所を1ドットでつなぐ）。
// ただし、道すじの角（四角の角など）のドットは減らさない
export function lineCells(points: readonly number[], dot: number): [number, number][] {
  const cells: [number, number][] = [];
  const corners = new Set<number>();
  if (points.length < 2) return cells;
  const push = (x: number, y: number) => {
    const last = cells[cells.length - 1];
    if (!last || last[0] !== x || last[1] !== y) cells.push([x, y]);
  };
  let x0 = Math.floor(points[0] / dot), y0 = Math.floor(points[1] / dot);
  push(x0, y0);
  for (let i = 2; i < points.length; i += 2) {
    const x1 = Math.floor(points[i] / dot), y1 = Math.floor(points[i + 1] / dot);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      push(x, y);
    }
    if (i + 2 < points.length) {
      const ax = points[i] - points[i - 2], ay = points[i + 1] - points[i - 1];
      const bx = points[i + 2] - points[i], by = points[i + 3] - points[i + 1];
      if (Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by)) > 0.7) corners.add(cells.length - 1);
    }
    x0 = x1;
    y0 = y1;
  }
  const clean: [number, number][] = [];
  for (let i = 0; i < cells.length; i += 1) {
    const prev = clean[clean.length - 1], next = cells[i + 1];
    if (!corners.has(i) && prev && next && Math.abs(prev[0] - next[0]) === 1 && Math.abs(prev[1] - next[1]) === 1) continue;
    clean.push(cells[i]);
  }
  return clean;
}

// ドットの絵柄で、文字をあとから画面の細かさでくっきり描くための控え
export interface PixelText {
  text: string;
  x: number;
  y: number;
  maxWidth?: number;
  transform: DOMMatrix;
  font: string;
  color: string | CanvasGradient | CanvasPattern;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  alpha: number;
}

// 文字を、ぼかしのない（ドット絵の文字のような）形で target に描く。target の変換は、控えを取った画像の1px = 画面の1px
export function drawPixelTexts(target: CanvasRenderingContext2D, texts: PixelText[], width: number, height: number, layer: HTMLCanvasElement): void {
  if (!texts.length) return;
  const w = Math.max(1, Math.ceil(width)), h = Math.max(1, Math.ceil(height));
  if (layer.width !== w || layer.height !== h) {
    layer.width = w;
    layer.height = h;
  }
  const g = layer.getContext("2d", { willReadFrequently: true });
  if (!g) return;
  // 文字のある所だけを読み戻す（画面全体を読むと重いので）
  let left = w, top = h, right = 0, bottom = 0;
  for (const text of texts) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = text.font;
    const width = text.maxWidth === undefined ? g.measureText(text.text).width : Math.min(text.maxWidth, g.measureText(text.text).width);
    const size = Number(/([\d.]+)px/.exec(text.font)?.[1] ?? 16);
    const x0 = text.align === "center" ? text.x - width / 2 : text.align === "right" || text.align === "end" ? text.x - width : text.x;
    const y0 = text.baseline === "top" || text.baseline === "hanging" ? text.y : text.baseline === "middle" ? text.y - size * 0.7 : text.y - size * 1.1;
    for (const [x, y] of [[x0, y0], [x0 + width, y0], [x0, y0 + size * 1.4], [x0 + width, y0 + size * 1.4]]) {
      const p = text.transform.transformPoint({ x, y });
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y);
    }
  }
  const area = {
    x: Math.max(0, Math.floor(left) - 3),
    y: Math.max(0, Math.floor(top) - 3),
    w: 0,
    h: 0,
  };
  area.w = Math.min(w, Math.ceil(right) + 3) - area.x;
  area.h = Math.min(h, Math.ceil(bottom) + 3) - area.y;
  if (area.w <= 0 || area.h <= 0) return;
  const groups = new Map<number, PixelText[]>();
  for (const text of texts) {
    const alpha = Math.round(text.alpha * 100) / 100;
    if (alpha <= 0) continue;
    const group = groups.get(alpha);
    if (group) group.push(text);
    else groups.set(alpha, [text]);
  }
  groups.forEach((group, alpha) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(area.x, area.y, area.w, area.h);
    for (const text of group) {
      g.setTransform(text.transform);
      g.font = text.font;
      g.fillStyle = text.color;
      g.textAlign = text.align;
      g.textBaseline = text.baseline;
      if (text.maxWidth === undefined) g.fillText(text.text, text.x, text.y);
      else g.fillText(text.text, text.x, text.y, text.maxWidth);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const image = g.getImageData(area.x, area.y, area.w, area.h);
    const data = image.data;
    for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 96 ? 255 : 0;
    g.putImageData(image, area.x, area.y);
    target.save();
    target.imageSmoothingEnabled = false;
    target.globalAlpha *= alpha;
    target.drawImage(layer, area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
    target.restore();
  });
}

// ---- 描き先の差し替え ----
// 間取りを描く関数はそのままで、描き先（キャンバス）の線・塗り・文字の描き方だけを絵柄に合わせて変える

interface SubPath {
  points: number[];
  sharp: boolean[];
  closed: boolean;
}

type AnyFunction = (...args: never[]) => unknown;

function wrapContext(base: CanvasRenderingContext2D, overrides: Map<PropertyKey, unknown>, setFont: (font: string) => string): CanvasRenderingContext2D {
  const bound = new Map<PropertyKey, unknown>();
  return new Proxy(base, {
    get(target, property) {
      if (overrides.has(property)) return overrides.get(property);
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      let fn = bound.get(property);
      if (!fn) {
        fn = (value as AnyFunction).bind(target);
        bound.set(property, fn);
      }
      return fn;
    },
    set(target, property, value) {
      if (property === "font" && typeof value === "string") {
        target.font = setFont(value);
        return true;
      }
      return Reflect.set(target, property, value, target);
    },
  });
}

// 道すじを、描いた時点の変換をかけた画素の座標で控える（曲線は細かい直線にする）
function createPathRecorder(base: CanvasRenderingContext2D) {
  let matrix: DOMMatrix | null = null;
  let subpaths: SubPath[] = [];
  let current: SubPath | null = null;
  const m = () => (matrix ??= base.getTransform());
  const scale = () => {
    const t = m();
    return Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) || 1;
  };
  const add = (x: number, y: number, sharp: boolean) => {
    const t = m();
    const px = t.a * x + t.c * y + t.e, py = t.b * x + t.d * y + t.f;
    if (!current) {
      current = { points: [], sharp: [], closed: false };
      subpaths.push(current);
    }
    current.points.push(px, py);
    current.sharp.push(sharp);
  };
  const lastUserPoint = (): [number, number] | null => {
    if (!current || !current.points.length) return null;
    const p = m().inverse().transformPoint({ x: current.points[current.points.length - 2], y: current.points[current.points.length - 1] });
    return [p.x, p.y];
  };
  // 円弧の細かさ。画面上で 3px ほどの直線に分ける
  const arcSteps = (radius: number, sweep: number) => Math.min(256, Math.max(2, Math.ceil((Math.abs(sweep) * radius * scale()) / 3)));
  const sweepOf = (start: number, end: number, anticlockwise: boolean) => {
    const full = Math.PI * 2;
    if (!anticlockwise) {
      if (end - start >= full) return full;
      const sweep = (end - start) % full;
      return sweep < 0 ? sweep + full : sweep;
    }
    if (start - end >= full) return -full;
    const sweep = (start - end) % full;
    return -(sweep < 0 ? sweep + full : sweep);
  };
  const ellipsePoints = (x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, anticlockwise: boolean) => {
    const sweep = sweepOf(start, end, anticlockwise);
    const steps = arcSteps(Math.max(rx, ry), sweep);
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    for (let i = 0; i <= steps; i += 1) {
      const a = start + (sweep * i) / steps;
      const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
      add(x + ex * cos - ey * sin, y + ex * sin + ey * cos, i === 0 || i === steps);
    }
  };
  return {
    m,
    scale,
    invalidate: () => (matrix = null),
    subpaths: () => subpaths,
    beginPath: () => {
      subpaths = [];
      current = null;
    },
    moveTo: (x: number, y: number) => {
      current = null;
      add(x, y, true);
    },
    lineTo: (x: number, y: number) => add(x, y, true),
    closePath: () => {
      if (!current || !current.points.length) return;
      current.closed = true;
      const [x, y] = [current.points[0], current.points[1]];
      current = { points: [x, y], sharp: [true], closed: false };
      subpaths.push(current);
    },
    rect: (x: number, y: number, w: number, h: number) => {
      current = null;
      add(x, y, true);
      add(x + w, y, true);
      add(x + w, y + h, true);
      add(x, y + h, true);
      if (current) (current as SubPath).closed = true;
      current = null;
      add(x, y, true);
    },
    arc: (x: number, y: number, r: number, start: number, end: number, anticlockwise = false) => ellipsePoints(x, y, r, r, 0, start, end, anticlockwise),
    ellipse: (x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, anticlockwise = false) =>
      ellipsePoints(x, y, rx, ry, rotation, start, end, anticlockwise),
    arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) => {
      const from = lastUserPoint();
      if (!from) {
        add(x1, y1, true);
        return;
      }
      const [x0, y0] = from;
      const ax = x0 - x1, ay = y0 - y1, bx = x2 - x1, by = y2 - y1;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      const cross = ax * by - ay * bx;
      if (r <= 0 || la === 0 || lb === 0 || Math.abs(cross) < 1e-9 * la * lb) {
        add(x1, y1, true);
        return;
      }
      const angle = Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / (la * lb))));
      const tangent = r / Math.tan(angle / 2);
      const t1x = x1 + (ax / la) * tangent, t1y = y1 + (ay / la) * tangent;
      const t2x = x1 + (bx / lb) * tangent, t2y = y1 + (by / lb) * tangent;
      const mx = ax / la + bx / lb, my = ay / la + by / lb;
      const ml = Math.hypot(mx, my) || 1;
      const reach = r / Math.sin(angle / 2);
      const ox = x1 + (mx / ml) * reach, oy = y1 + (my / ml) * reach;
      const start = Math.atan2(t1y - oy, t1x - ox);
      let sweep = Math.atan2(t2y - oy, t2x - ox) - start;
      if (sweep > Math.PI) sweep -= Math.PI * 2;
      if (sweep < -Math.PI) sweep += Math.PI * 2;
      const steps = arcSteps(r, sweep);
      for (let i = 0; i <= steps; i += 1) {
        const a = start + (sweep * i) / steps;
        add(ox + Math.cos(a) * r, oy + Math.sin(a) * r, i === 0 || i === steps);
      }
    },
    quadraticCurveTo: (qx: number, qy: number, x: number, y: number) => {
      const from = lastUserPoint();
      if (!from) {
        add(x, y, true);
        return;
      }
      const [x0, y0] = from;
      const steps = Math.min(64, Math.max(4, Math.ceil(((Math.hypot(qx - x0, qy - y0) + Math.hypot(x - qx, y - qy)) * scale()) / 4)));
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps, u = 1 - t;
        add(u * u * x0 + 2 * u * t * qx + t * t * x, u * u * y0 + 2 * u * t * qy + t * t * y, i === steps);
      }
    },
    bezierCurveTo: (ax: number, ay: number, bx: number, by: number, x: number, y: number) => {
      const from = lastUserPoint();
      if (!from) {
        add(x, y, true);
        return;
      }
      const [x0, y0] = from;
      const steps = Math.min(64, Math.max(4, Math.ceil(((Math.hypot(ax - x0, ay - y0) + Math.hypot(bx - ax, by - ay) + Math.hypot(x - bx, y - by)) * scale()) / 4)));
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps, u = 1 - t;
        add(
          u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x,
          u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y,
          i === steps,
        );
      }
    },
  };
}

type PathRecorder = ReturnType<typeof createPathRecorder>;

const TRANSFORM_METHODS = ["translate", "rotate", "scale", "setTransform", "transform", "resetTransform", "save", "restore"];
const PATH_METHODS = ["beginPath", "moveTo", "lineTo", "closePath", "rect", "arc", "ellipse", "arcTo", "quadraticCurveTo", "bezierCurveTo"] as const;

function recordingOverrides(base: CanvasRenderingContext2D, recorder: PathRecorder): Map<PropertyKey, unknown> {
  const overrides = new Map<PropertyKey, unknown>();
  for (const name of TRANSFORM_METHODS) {
    const native = Reflect.get(base, name) as AnyFunction;
    overrides.set(name, (...args: never[]) => {
      recorder.invalidate();
      return native.apply(base, args);
    });
  }
  for (const name of PATH_METHODS) {
    const native = Reflect.get(base, name) as AnyFunction;
    const record = recorder[name] as AnyFunction;
    overrides.set(name, (...args: never[]) => {
      record(...args);
      return native.apply(base, args);
    });
  }
  return overrides;
}

// 四角（fillRect・strokeRect）を、描いた時点の変換をかけた画素の座標の道すじにする
function rectSubpath(recorder: PathRecorder, x: number, y: number, w: number, h: number): SubPath {
  const t = recorder.m();
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return {
    points: corners.flatMap(([px, py]) => [t.a * px + t.c * py + t.e, t.b * px + t.d * py + t.f]),
    sharp: [true, true, true, true],
    closed: true,
  };
}

// 形の見分け。はじめの点からの相対的な位置で決めるので、場所が違っても同じ形なら同じ値になる
function geometryKey(points: readonly number[], salt: string): string {
  let h1 = 0x811c9dc5, h2 = 0x9e3779b9 ^ points.length;
  const x0 = points[0], y0 = points[1];
  for (let i = 0; i < points.length; i += 1) {
    const v = Math.round((points[i] - (i % 2 ? y0 : x0)) * 10);
    h1 = Math.imul(h1 ^ v, 0x01000193);
    h2 = Math.imul(h2 ^ (v + 0x7f4a7c15), 0x85ebca6b) ^ (h2 >>> 13);
  }
  return `${salt}|${points.length}|${h1 >>> 0}|${h2 >>> 0}`;
}

function relative(points: readonly number[]): number[] {
  const x0 = points[0], y0 = points[1];
  return points.map((value, i) => value - (i % 2 ? y0 : x0));
}

// 画素の座標で描いて、変換と塗りの色を元に戻す
function inPixels(base: CanvasRenderingContext2D, recorder: PathRecorder, draw: () => void): void {
  const transform = recorder.m();
  const fill = base.fillStyle;
  base.setTransform(1, 0, 0, 1, 0, 0);
  try {
    draw();
  } finally {
    base.setTransform(transform);
    base.fillStyle = fill;
  }
}

function polygonsPath(polygons: readonly number[][]): Path2D {
  const path = new Path2D();
  for (const polygon of polygons) {
    if (polygon.length < 6) continue;
    path.moveTo(polygon[0], polygon[1]);
    for (let i = 2; i < polygon.length; i += 2) path.lineTo(polygon[i], polygon[i + 1]);
    path.closePath();
  }
  return path;
}

// 筆の線と塗りの形の控え。同じ形は場所が違っても作り直さない（スクロールや、ほかの物を動かしている間も軽く描ける）
const BRUSH_CACHE_LIMIT = 8000;
const brushStrokeCache = new Map<string, { path: Path2D; tone: number }>();
const brushFillCache = new Map<string, Path2D>();

function remember<T>(cache: Map<string, T>, key: string, value: T): T {
  if (cache.size >= BRUSH_CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

// ---- 筆の色合い（筆・和風、古地図、黒板） ----

export interface BrushPalette {
  // 線・塗り・文字の色。tone は1本ごとの濃淡（-1〜1）
  ink(value: string, tone: number): string;
  wash(value: string): string;
  text(value: string): string;
  // 文字のにじみ（画面のpx。0 ならにじませない）
  bleed: number;
  // 線の太さ（画素）
  width(deviceWidth: number, unit: number): number;
  // 太い線が終わりでかすれる確からしさと、線のどこでも途切れる割合（チョーク）
  dry: number;
  grain: number;
  // 模様（床の柄など）の塗りの上に重ねる、紙や板の色（柄の色が浮かないように）
  patternVeil: string;
  // 文字の書体の絵柄
  font: PlanStyle;
}

// 色に透明度を付ける（rgb(...) を rgba(...) に）
function alphaColor(value: string, alpha: number): string {
  const parsed = parseCssColor(value);
  return parsed ? cssColor(parsed.slice(0, 3), parsed[3] * alpha) : value;
}

function isColorful(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max > 0 && (max - min) / max >= 0.14;
}

const lightnessOf = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

const SUMI_PALETTE: BrushPalette = {
  ink: inkColor,
  wash: washColor,
  text: (value) => inkColor(value),
  bleed: 1.4,
  width: (w, unit) => (w < 3 * unit ? w * 1.45 + 0.6 * unit : w),
  dry: 0.55,
  grain: 0,
  patternVeil: "rgba(244, 238, 224, 0.2)",
  font: "brush",
};

// 古地図: 羊皮紙にセピアのペン。色は褪せて紙になじむ
const SEPIA: [number, number, number] = [72, 48, 28];
const PARCHMENT_RGB: [number, number, number] = [234, 217, 178];

function sepiaInk(value: string, tone: number): string {
  return cachedColor(`s${tone}${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    const lightness = lightnessOf(r, g, b);
    let rgb = isColorful(r, g, b)
      ? mix(mix([r, g, b], [lightness, lightness, lightness], 0.35), SEPIA, 0.45)
      : mix(SEPIA, PARCHMENT_RGB, Math.min(0.85, Math.max(0, (lightness - 30) / 240)));
    rgb = rgb.map((v) => v * (1 - tone * 0.06));
    return cssColor(rgb, a);
  });
}

function sepiaWash(value: string): string {
  return cachedColor(`sw${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (Math.min(r, g, b) >= 245) return cssColor(mix(PARCHMENT_RGB, [250, 240, 214], 0.6), a);
    const gray = lightnessOf(r, g, b);
    return cssColor(mix(mix([r, g, b], [gray, gray, gray], 0.3), PARCHMENT_RGB, 0.45), a);
  });
}

const PARCHMENT_PALETTE: BrushPalette = {
  ink: sepiaInk,
  wash: sepiaWash,
  text: (value) => sepiaInk(value, 0),
  bleed: 0.8,
  width: (w, unit) => (w < 3 * unit ? w * 1.1 + 0.45 * unit : w * 0.92),
  dry: 0.25,
  grain: 0,
  patternVeil: "rgba(226, 204, 158, 0.55)",
  font: "parchment",
};

// 黒板: 濃い緑の板に白いチョーク。黒い線ほどはっきり、薄い線ほど薄く、色はパステルに
const CHALK_RGB: [number, number, number] = [244, 242, 230];

function chalkInk(value: string, tone: number): string {
  return cachedColor(`c${tone}${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (isColorful(r, g, b)) return cssColor(mix([r, g, b], [255, 255, 255], 0.45), a * (0.9 - tone * 0.05));
    return cssColor(CHALK_RGB, a * (0.95 - (lightnessOf(r, g, b) / 255) * 0.5) * (1 - tone * 0.06));
  });
}

function chalkWash(value: string): string {
  return cachedColor(`cw${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (Math.min(r, g, b) >= 240) return cssColor([255, 255, 255], a * 0.05);
    return cssColor(mix([r, g, b], [255, 255, 255], 0.5), a * 0.24);
  });
}

const CHALK_PALETTE: BrushPalette = {
  ink: chalkInk,
  wash: chalkWash,
  text: () => "rgba(246, 244, 234, 0.95)",
  bleed: 0.9,
  width: (w, unit) => (w < 3 * unit ? w * 1.5 + 0.8 * unit : w),
  dry: 1,
  grain: 0.07,
  patternVeil: "rgba(46, 74, 59, 0.72)",
  font: "chalk",
};

export interface BrushContextOptions {
  // 画面の1pxあたりの画素数
  unit: number;
  // 線と塗りの色合い（ふつうは墨と和紙）
  palette?: BrushPalette;
}

// 筆の描き先（筆・和風、古地図、黒板）。線は筆の線に、塗りは縁の波打つ淡い色に、文字は絵柄の書体でにじませる
export function createBrushContext(base: CanvasRenderingContext2D, options: BrushContextOptions): CanvasRenderingContext2D {
  const unit = options.unit;
  const palette = options.palette ?? SUMI_PALETTE;
  const recorder = createPathRecorder(base);
  const overrides = recordingOverrides(base, recorder);

  const strokePaths = (subpaths: SubPath[]) => {
    const style = base.strokeStyle;
    if (typeof style !== "string") return false;
    const scale = recorder.scale();
    const width = palette.width(base.lineWidth * scale, unit);
    const dash = base.getLineDash().map((value) => value * scale);
    const dashed = dash.some((value) => value > 0);
    const capExtend = base.lineCap === "square" ? width / 2 : 0;
    // これより長い線は、画面の近くだけを描く
    const limit = 3 * (base.canvas.width + base.canvas.height);
    const tones = [new Path2D(), new Path2D(), new Path2D()];
    let drawn = false;
    subpaths.forEach((subpath, index) => {
      const points = subpath.points;
      if (points.length < 4) return;
      const n = points.length;
      const loop = subpath.closed || Math.hypot(points[n - 2] - points[0], points[n - 1] - points[1]) < 0.5;
      let pieces: StrokePiece[];
      if (dashed) {
        const closedPoints = subpath.closed ? [...points, points[0], points[1]] : points;
        // 画面の外まで長く伸びた破線は、見える所の近くだけを破線にする（模様の位置はそのまま）
        const starts: number[] = [];
        const margin = Math.max(200 * unit, width * 4);
        const runs = polylineLength(closedPoints) > limit
          ? clipPolyline(closedPoints, -margin, -margin, base.canvas.width + margin, base.canvas.height + margin, starts)
          : [closedPoints];
        pieces = runs.flatMap((run, i) => dashPolyline(run, dash, base.lineDashOffset * scale + (starts[i] ?? 0)))
          .map((piece) => ({ points: piece, closed: false, cornerStart: false, cornerEnd: false }));
      } else {
        const loopPoints = loop && !subpath.closed ? points.slice(0, -2) : points;
        const loopSharp = loop && !subpath.closed ? subpath.sharp.slice(0, -1) : subpath.sharp;
        pieces = splitStrokes(loopPoints, loopSharp, loop);
      }
      pieces.flatMap((piece, pieceIndex) => {
        const seed = shapeSeed(piece.points, scale, index * 131 + pieceIndex);
        if (polylineLength(piece.points) <= limit) return [{ ...piece, seed }];
        // 大きく拡大して画面の外まで長く伸びた線は、見える所の近くだけを描く（画面の外の端は細くなっても見えない）
        const margin = Math.max(200 * unit, width * 4);
        const points = piece.closed ? [...piece.points, piece.points[0], piece.points[1]] : piece.points;
        return clipPolyline(points, -margin, -margin, base.canvas.width + margin, base.canvas.height + margin)
          .map((run, runIndex) => ({ points: run, closed: false, cornerStart: false, cornerEnd: false, seed: seed + runIndex * 7 }));
      }).forEach((piece) => {
        if (piece.points.length < 2) return;
        const seed = piece.seed;
        const flags = `${piece.closed ? 1 : 0}${piece.cornerStart ? 1 : 0}${piece.cornerEnd ? 1 : 0}${dashed ? 1 : 0}`;
        const key = geometryKey(piece.points, `${palette.font}|${Math.round(width * 100)}|${unit}|${seed}|${flags}|${Math.round(capExtend * 10)}`);
        let cached = brushStrokeCache.get(key);
        if (!cached) {
          const overshoot = (corner: boolean) => (corner ? width * 0.5 + (0.5 + hashUnit(seed, 9) * 1.5) * unit : capExtend);
          const polygons = brushStroke(relative(piece.points), {
            width,
            unit,
            seed,
            closed: piece.closed,
            extendStart: piece.closed ? 0 : overshoot(piece.cornerStart),
            extendEnd: piece.closed ? 0 : overshoot(piece.cornerEnd),
            simple: dashed,
            dry: palette.dry,
            grain: palette.grain,
          });
          cached = remember(brushStrokeCache, key, { path: polygonsPath(polygons), tone: seed % 3 });
        }
        tones[cached.tone].addPath(cached.path, { e: piece.points[0], f: piece.points[1] });
        drawn = true;
      });
    });
    if (!drawn) return true;
    inPixels(base, recorder, () => {
      tones.forEach((path, tone) => {
        base.fillStyle = palette.ink(style, tone - 1);
        base.fill(path);
      });
    });
    return true;
  };

  // 大きく拡大して画面よりずっと大きくなった形は、見える所の近くだけを塗る
  const visiblePolygon = (points: number[]): number[] => {
    const width = base.canvas.width, height = base.canvas.height;
    if (points.length < 6 || polylineLength(points) <= 3 * (width + height)) return points;
    const margin = 100 * unit;
    return clipPolygon(points, -margin, -margin, width + margin, height + margin);
  };

  const fillPaths = (subpaths: SubPath[], rule?: CanvasFillRule) => {
    const style = base.fillStyle;
    const scale = recorder.scale();
    if (typeof style === "string") {
      // 色の塗りは画素の座標のまま塗る（形を控えておける）
      const path = new Path2D();
      subpaths.forEach((subpath, index) => {
        const points = visiblePolygon(subpath.points);
        if (points.length < 6) return;
        const seed = shapeSeed(subpath.points, scale, index + 977);
        const key = geometryKey(points, `f|${unit}|${seed}`);
        let cached = brushFillCache.get(key);
        if (!cached) cached = remember(brushFillCache, key, polygonsPath([wobblePolygon(relative(points), unit, seed)]));
        path.addPath(cached, { e: points[0], f: points[1] });
      });
      inPixels(base, recorder, () => {
        base.fillStyle = palette.wash(style);
        base.fill(path, rule);
      });
      return;
    }
    // 模様（床の柄など）の塗りは、模様の向きと大きさが合うように、いまの座標に戻して塗る
    const t = recorder.m();
    const det = t.a * t.d - t.b * t.c || 1;
    const path = new Path2D();
    subpaths.forEach((subpath, index) => {
      const points = visiblePolygon(subpath.points);
      if (points.length < 6) return;
      const polygon = wobblePolygon(points, unit, shapeSeed(subpath.points, scale, index + 977));
      for (let i = 0; i < polygon.length; i += 2) {
        const dx = polygon[i] - t.e, dy = polygon[i + 1] - t.f;
        const x = (t.d * dx - t.c * dy) / det, y = (t.a * dy - t.b * dx) / det;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
    });
    base.fill(path, rule);
    base.fillStyle = palette.patternVeil;
    base.fill(path, rule);
    base.fillStyle = style;
  };

  overrides.set("stroke", (path?: Path2D) => {
    if (path) base.stroke(path);
    else if (!strokePaths(recorder.subpaths())) base.stroke();
  });
  overrides.set("fill", (first?: Path2D | CanvasFillRule, second?: CanvasFillRule) => {
    if (typeof first === "object") base.fill(first, second);
    else fillPaths(recorder.subpaths(), first);
  });
  overrides.set("fillRect", (x: number, y: number, w: number, h: number) => fillPaths([rectSubpath(recorder, x, y, w, h)]));
  overrides.set("strokeRect", (x: number, y: number, w: number, h: number) => {
    if (!strokePaths([rectSubpath(recorder, x, y, w, h)])) base.strokeRect(x, y, w, h);
  });
  overrides.set("fillText", (text: string, x: number, y: number, maxWidth?: number) => {
    const style = base.fillStyle;
    base.save();
    if (typeof style === "string") {
      const color = palette.text(style);
      base.fillStyle = color;
      // 墨やチョークが少しにじんだように
      if (palette.bleed) {
        base.shadowColor = alphaColor(color, 0.45);
        base.shadowBlur = palette.bleed * unit;
      }
    }
    if (maxWidth === undefined) base.fillText(text, x, y);
    else base.fillText(text, x, y, maxWidth);
    base.restore();
  });
  return wrapContext(base, overrides, (font) => styledFont(font, palette.font));
}

export interface PixelContextOptions {
  // ドットの大きさ（描き先の画素）。細い線は、このます目に沿った1ドットの線で描く
  dot: number;
  // 文字を控えるとき true を返す（控えた文字は描かない）。false なら、その場で描く
  text?: (text: PixelText) => boolean;
}

// ドットの絵柄の描き先。細い線はドットのます目に沿った1ドットの線にし、文字はあとからくっきり描くために控える。
// 太い線（壁など）と塗りはそのまま描き、あとでドットごとに1色にまとめる
export function createPixelContext(base: CanvasRenderingContext2D, options: PixelContextOptions): CanvasRenderingContext2D {
  const dot = options.dot;
  const recorder = createPathRecorder(base);
  const overrides = recordingOverrides(base, recorder);
  const strokeCells = (subpaths: SubPath[]): boolean => {
    const style = base.strokeStyle;
    if (typeof style !== "string") return false;
    const scale = recorder.scale();
    if (base.lineWidth * scale > dot * 1.5) return false;
    const dash = base.getLineDash().map((value) => value * scale);
    const dashed = dash.some((value) => value > 0);
    const path = new Path2D();
    // 半透明の色では、同じドットを2度塗って濃くならないようにする
    const seen = style.startsWith("#") ? null : new Set<number>();
    // 横に続くドットは、1つの四角にまとめて塗る
    let runX = 0, runY = 0, runLength = 0;
    const flush = () => {
      if (runLength) path.rect(runX * dot, runY * dot, runLength * dot, dot);
      runLength = 0;
    };
    for (const subpath of subpaths) {
      if (subpath.points.length < 4) continue;
      const points = subpath.closed ? [...subpath.points, subpath.points[0], subpath.points[1]] : subpath.points;
      const starts: number[] = [];
      const visible = clipPolyline(points, -dot, -dot, base.canvas.width + dot, base.canvas.height + dot, starts);
      for (const piece of visible.flatMap((run, i) => (dashed ? dashPolyline(run, dash, base.lineDashOffset * scale + starts[i]) : [run]))) {
        for (const [x, y] of lineCells(piece, dot)) {
          if (seen) {
            const key = (x + 32768) * 65536 + (y + 32768);
            if (seen.has(key)) continue;
            seen.add(key);
          }
          if (runLength && y === runY && x === runX + runLength) runLength += 1;
          else if (runLength && y === runY && x === runX - 1) {
            runX = x;
            runLength += 1;
          } else {
            flush();
            runX = x;
            runY = y;
            runLength = 1;
          }
        }
      }
    }
    flush();
    inPixels(base, recorder, () => {
      base.fillStyle = style;
      base.fill(path);
    });
    return true;
  };
  overrides.set("stroke", (path?: Path2D) => {
    if (path) base.stroke(path);
    else if (!strokeCells(recorder.subpaths())) base.stroke();
  });
  overrides.set("strokeRect", (x: number, y: number, w: number, h: number) => {
    if (!strokeCells([rectSubpath(recorder, x, y, w, h)])) base.strokeRect(x, y, w, h);
  });
  overrides.set("fillText", (text: string, x: number, y: number, maxWidth?: number) => {
    const record: PixelText = {
      text, x, y, maxWidth,
      transform: base.getTransform(),
      font: base.font,
      color: base.fillStyle,
      align: base.textAlign,
      baseline: base.textBaseline,
      alpha: base.globalAlpha,
    };
    if (options.text?.(record)) return;
    if (maxWidth === undefined) base.fillText(text, x, y);
    else base.fillText(text, x, y, maxWidth);
  });
  return wrapContext(base, overrides, (font) => styledFont(font, "pixel"));
}

// ---- 色を置き換える絵柄（設計図・ネオン） ----

interface RecolorPalette {
  stroke(value: string): string;
  fill(value: string): string;
  text: string;
  // 模様（床の柄など）の塗りの代わりの色
  pattern: string;
  // ネオン: 線のまわりの光（色と、太さに足す画面のpx）と、文字の光
  glow?: { color(stroke: string): string; extra: number };
  textGlow?: { color: string; blur: number };
  font: PlanStyle;
}

// 色相はそのままに、あざやかで明るい色にする（ネオンの線）
function neonColor(r: number, g: number, b: number): number[] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  }
  hue = (hue * 60 + 360) % 360;
  const lightness = 0.62, chroma = (1 - Math.abs(2 * lightness - 1)) * 1;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1)), m = lightness - chroma / 2;
  const [rr, gg, bb] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return [(rr + m) * 255, (gg + m) * 255, (bb + m) * 255];
}

const BLUEPRINT: RecolorPalette = {
  stroke: (value) => cachedColor(`b${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (isColorful(r, g, b)) return cssColor(mix([r, g, b], [255, 255, 255], 0.55), a * 0.95);
    return cssColor([236, 246, 255], a * (0.95 - (lightnessOf(r, g, b) / 255) * 0.5));
  }),
  fill: (value) => cachedColor(`bf${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (Math.min(r, g, b) >= 240) return cssColor([255, 255, 255], a * 0.05);
    if (isColorful(r, g, b)) return cssColor(mix([r, g, b], [190, 215, 255], 0.6), a * 0.2);
    return cssColor([255, 255, 255], a * (0.06 + (1 - lightnessOf(r, g, b) / 255) * 0.3));
  }),
  text: "rgba(240, 248, 255, 0.95)",
  pattern: "rgba(255, 255, 255, 0.07)",
  font: "blueprint",
};

const NEON: RecolorPalette = {
  stroke: (value) => cachedColor(`n${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (isColorful(r, g, b)) return cssColor(neonColor(r, g, b), a);
    return lightnessOf(r, g, b) < 140 ? cssColor([90, 240, 255], a) : cssColor([70, 140, 255], a * 0.75);
  }),
  fill: (value) => cachedColor(`nf${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (Math.min(r, g, b) >= 240) return cssColor([16, 22, 44], a * 0.92);
    return cssColor(mix([r, g, b], [9, 12, 24], isColorful(r, g, b) ? 0.8 : 0.86), a * 0.92);
  }),
  text: "#eafcff",
  pattern: "rgba(22, 34, 66, 0.85)",
  glow: { color: (stroke) => alphaColor(stroke, 0.22), extra: 5 },
  textGlow: { color: "rgba(80, 230, 255, 0.85)", blur: 6 },
  font: "neon",
};

// 線・塗り・文字の色だけを置き換える描き先。形はそのまま（ネオンは線のまわりを光らせる）
function createRecolorContext(base: CanvasRenderingContext2D, palette: RecolorPalette, unit: number): CanvasRenderingContext2D {
  const overrides = new Map<PropertyKey, unknown>();
  const withStroke = (draw: () => void) => {
    const style = base.strokeStyle;
    if (typeof style !== "string") {
      draw();
      return;
    }
    const color = palette.stroke(style);
    const width = base.lineWidth;
    if (palette.glow) {
      const t = base.getTransform();
      const scale = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) || 1;
      base.strokeStyle = palette.glow.color(color);
      base.lineWidth = width + (palette.glow.extra * unit) / scale;
      draw();
      base.lineWidth = width;
    }
    base.strokeStyle = color;
    draw();
    base.strokeStyle = style;
  };
  const withFill = (draw: () => void) => {
    const style = base.fillStyle;
    base.fillStyle = typeof style === "string" ? palette.fill(style) : palette.pattern;
    draw();
    base.fillStyle = style;
  };
  overrides.set("stroke", (path?: Path2D) => withStroke(() => (path ? base.stroke(path) : base.stroke())));
  overrides.set("strokeRect", (x: number, y: number, w: number, h: number) => withStroke(() => base.strokeRect(x, y, w, h)));
  overrides.set("fill", (first?: Path2D | CanvasFillRule, second?: CanvasFillRule) =>
    withFill(() => (typeof first === "object" ? base.fill(first, second) : base.fill(first))));
  overrides.set("fillRect", (x: number, y: number, w: number, h: number) => withFill(() => base.fillRect(x, y, w, h)));
  overrides.set("fillText", (text: string, x: number, y: number, maxWidth?: number) => {
    base.save();
    base.fillStyle = palette.text;
    if (palette.textGlow) {
      base.shadowColor = palette.textGlow.color;
      base.shadowBlur = palette.textGlow.blur * unit;
    }
    if (maxWidth === undefined) base.fillText(text, x, y);
    else base.fillText(text, x, y, maxWidth);
    base.restore();
  });
  return wrapContext(base, overrides, (font) => styledFont(font, palette.font));
}

export interface StyleContextOptions {
  // 画面の1pxあたりの画素数と、間取りの原点の画素の位置（トーンや斜線を間取りに合わせて動かす）
  unit: number;
  anchorX: number;
  anchorY: number;
}

// ---- マンガ（白黒とスクリーントーン） ----

// 塗りの色の濃さを、トーンの濃さ（0 は白、1 はベタ）にする。0.1 ずつ
export function toneLevel(value: string): number {
  const parsed = parseCssColor(value);
  if (!parsed) return 0;
  const darkness = 1 - lightnessOf(parsed[0], parsed[1], parsed[2]) / 255;
  if (darkness < 0.05) return 0;
  if (darkness > 0.86) return 1;
  return Math.min(0.8, Math.max(0.1, Math.round(darkness * 10) / 10));
}

const toneTiles = new Map<string, HTMLCanvasElement>();

// トーン1つ分の模様（網点）。薄いトーンは白地に黒い点、濃いトーンは黒地に白い点
function toneTile(level: number, size: number): HTMLCanvasElement {
  const key = `${level}|${size}`;
  const cached = toneTiles.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const dark = level > 0.55;
    g.fillStyle = dark ? "#141414" : "#ffffff";
    g.fillRect(0, 0, size, size);
    g.fillStyle = dark ? "#ffffff" : "#141414";
    const radius = size * Math.sqrt((dark ? 1 - level : level) / Math.PI);
    g.beginPath();
    g.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    g.fill();
  }
  toneTiles.set(key, canvas);
  return canvas;
}

function createMangaContext(base: CanvasRenderingContext2D, options: StyleContextOptions): CanvasRenderingContext2D {
  const unit = options.unit;
  const overrides = new Map<PropertyKey, unknown>();
  const patterns = new Map<number, CanvasPattern | null>();
  // トーンは間取りに貼り付け（スクロールしても網点が動かない）、45度に傾ける
  const anchor = new DOMMatrix().translate(options.anchorX, options.anchorY).rotate(45);
  const tone = (level: number): CanvasPattern | string => {
    if (level <= 0) return "#ffffff";
    if (level >= 1) return "#141414";
    let pattern = patterns.get(level);
    if (pattern === undefined) {
      pattern = base.createPattern(toneTile(level, Math.max(3, Math.round(4.5 * unit))), "repeat");
      patterns.set(level, pattern);
    }
    if (!pattern) return "#9a9a9a";
    pattern.setTransform(base.getTransform().inverse().multiply(anchor));
    return pattern;
  };
  const withFill = (draw: () => void) => {
    const style = base.fillStyle, alpha = base.globalAlpha;
    if (typeof style === "string") {
      const parsed = parseCssColor(style);
      base.fillStyle = tone(toneLevel(style));
      if (parsed && parsed[3] < 1) base.globalAlpha = alpha * parsed[3];
    } else base.fillStyle = tone(0.2);
    draw();
    base.globalAlpha = alpha;
    base.fillStyle = style;
  };
  // 線は黒（薄い灰色の線は、細めの濃い灰色）
  const withStroke = (draw: () => void) => {
    const style = base.strokeStyle, width = base.lineWidth;
    if (typeof style === "string") {
      const parsed = parseCssColor(style);
      const light = parsed ? lightnessOf(parsed[0], parsed[1], parsed[2]) > 170 : false;
      const a = parsed?.[3] ?? 1;
      base.strokeStyle = light ? `rgba(40, 40, 40, ${Math.round(a * 0.75 * 1000) / 1000})` : `rgba(10, 10, 10, ${a})`;
      const t = base.getTransform();
      const scale = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) || 1;
      base.lineWidth = Math.max(width * (light ? 1 : 1.15), unit / scale);
    }
    draw();
    base.strokeStyle = style;
    base.lineWidth = width;
  };
  overrides.set("stroke", (path?: Path2D) => withStroke(() => (path ? base.stroke(path) : base.stroke())));
  overrides.set("strokeRect", (x: number, y: number, w: number, h: number) => withStroke(() => base.strokeRect(x, y, w, h)));
  overrides.set("fill", (first?: Path2D | CanvasFillRule, second?: CanvasFillRule) =>
    withFill(() => (typeof first === "object" ? base.fill(first, second) : base.fill(first))));
  overrides.set("fillRect", (x: number, y: number, w: number, h: number) => withFill(() => base.fillRect(x, y, w, h)));
  overrides.set("fillText", (text: string, x: number, y: number, maxWidth?: number) => {
    const style = base.fillStyle;
    base.fillStyle = "#111111";
    if (maxWidth === undefined) base.fillText(text, x, y);
    else base.fillText(text, x, y, maxWidth);
    base.fillStyle = style;
  });
  return wrapContext(base, overrides, (font) => styledFont(font, "manga"));
}

// ---- 鉛筆（手描きの線と斜線） ----

export interface SketchOptions {
  width: number;
  unit: number;
  seed: number;
  closed?: boolean;
}

// 鉛筆で引いた線を、少しずつずれた何本かの細い線（画素の座標の折れ線）にする。
// 端は少し行き過ぎたり手前で止まったりし、長い線はわずかに反る。太い線（壁など）は、細い線を並べて塗る
export function sketchLines(path: readonly number[], options: SketchOptions): number[][] {
  const { width, unit, seed } = options;
  let points = dedupe(path, 0.25 * unit);
  if (points.length < 4) return [];
  if (options.closed) points = [...points, points[0], points[1], points[2], points[3]];
  const lengths = [0];
  for (let i = 2; i < points.length; i += 2) lengths.push(lengths[lengths.length - 1] + Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]));
  const total = lengths[lengths.length - 1];
  if (total < unit) return [];
  // 道すじの s の所の位置と向き（両端の外は、端の向きのまま延ばす）
  const at = (s: number): [number, number, number, number] => {
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < s) i += 1;
    const span = lengths[i] - lengths[i - 1] || 1;
    const dx = (points[i * 2] - points[i * 2 - 2]) / span, dy = (points[i * 2 + 1] - points[i * 2 - 1]) / span;
    const k = s - lengths[i - 1];
    return [points[i * 2 - 2] + dx * k, points[i * 2 - 1] + dy * k, dx, dy];
  };
  const random = seededRandom(seed);
  const passes = width < 2.6 * unit ? 2 : Math.min(7, Math.max(2, Math.round(width / (1.3 * unit))));
  const step = Math.max(2 * unit, Math.min(6 * unit, total / 6));
  const lines: number[][] = [];
  for (let p = 0; p < passes; p += 1) {
    const lane = width < 2.6 * unit ? (p - 0.5) * 0.8 * unit : ((p + 0.5) / passes - 0.5) * width * 0.85;
    const start = options.closed ? 0 : -(random() * 2 - 0.6) * 2.2 * unit;
    const end = options.closed ? total : total + (random() * 2 - 0.6) * 2.2 * unit;
    const bow = options.closed ? 0 : (random() * 2 - 1) * Math.min(total * 0.012, 2 * unit);
    const wavelength = (40 + random() * 40) * unit;
    const line: number[] = [];
    const count = Math.max(2, Math.ceil((end - start) / step) + 1);
    for (let i = 0; i < count; i += 1) {
      const s = start + ((end - start) * i) / (count - 1);
      const [x, y, dx, dy] = at(s);
      const offset = lane + 0.45 * unit * wave(seed + p * 13, s / wavelength) + bow * Math.sin((Math.PI * Math.min(Math.max(s, 0), total)) / total);
      line.push(x - dy * offset, y + dx * offset);
    }
    lines.push(line);
  }
  return lines;
}

const sketchCache = new Map<string, Path2D>();

// 鉛筆の色。黒は鉛筆の濃い灰色、薄い灰色はかすかな線、色は色鉛筆
function graphite(value: string): string {
  return cachedColor(`g${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (isColorful(r, g, b)) return cssColor(mix([r, g, b], [60, 60, 66], 0.25), a * 0.85);
    return cssColor([52, 52, 58], a * (0.85 - (lightnessOf(r, g, b) / 255) * 0.45));
  });
}

// 塗りは色鉛筆で薄くぬったように（白はほとんど塗らない）
function pencilTint(value: string): string {
  return cachedColor(`gt${value}`, () => {
    const parsed = parseCssColor(value);
    if (!parsed) return value;
    const [r, g, b, a] = parsed;
    if (Math.min(r, g, b) >= 240) return cssColor([251, 250, 246], a * 0.85);
    return cssColor(mix([r, g, b], [251, 250, 246], 0.35), a * 0.55);
  });
}

function createSketchContext(base: CanvasRenderingContext2D, options: StyleContextOptions): CanvasRenderingContext2D {
  const unit = options.unit;
  const recorder = createPathRecorder(base);
  const overrides = recordingOverrides(base, recorder);

  const strokePaths = (subpaths: SubPath[]) => {
    const style = base.strokeStyle;
    if (typeof style !== "string") return false;
    const scale = recorder.scale();
    const width = Math.max(unit, base.lineWidth * scale);
    const dash = base.getLineDash().map((value) => value * scale);
    const dashed = dash.some((value) => value > 0);
    const limit = 3 * (base.canvas.width + base.canvas.height);
    const margin = Math.max(200 * unit, width * 4);
    const path = new Path2D();
    subpaths.forEach((subpath, index) => {
      const points = subpath.points;
      if (points.length < 4) return;
      const n = points.length;
      const loop = subpath.closed || Math.hypot(points[n - 2] - points[0], points[n - 1] - points[1]) < 0.5;
      let pieces: StrokePiece[];
      if (dashed) {
        const closedPoints = subpath.closed ? [...points, points[0], points[1]] : points;
        pieces = dashPolyline(closedPoints, dash, base.lineDashOffset * scale).map((piece) => ({ points: piece, closed: false, cornerStart: false, cornerEnd: false }));
      } else {
        const loopPoints = loop && !subpath.closed ? points.slice(0, -2) : points;
        const loopSharp = loop && !subpath.closed ? subpath.sharp.slice(0, -1) : subpath.sharp;
        pieces = splitStrokes(loopPoints, loopSharp, loop);
      }
      pieces.forEach((piece, pieceIndex) => {
        const runs = polylineLength(piece.points) > limit
          ? clipPolyline(piece.closed ? [...piece.points, piece.points[0], piece.points[1]] : piece.points, -margin, -margin, base.canvas.width + margin, base.canvas.height + margin)
          : [piece.points];
        runs.forEach((run, runIndex) => {
          if (run.length < 4) return;
          const closed = piece.closed && runs.length === 1;
          const seed = shapeSeed(run, scale, index * 131 + pieceIndex * 7 + runIndex);
          const key = geometryKey(run, `${Math.round(width * 100)}|${unit}|${seed}|${closed ? 1 : 0}`);
          let cached = sketchCache.get(key);
          if (!cached) {
            const lines = sketchLines(relative(run), { width, unit, seed, closed });
            const linesPath = new Path2D();
            for (const line of lines) {
              linesPath.moveTo(line[0], line[1]);
              for (let i = 2; i < line.length; i += 2) linesPath.lineTo(line[i], line[i + 1]);
            }
            cached = remember(sketchCache, key, linesPath);
          }
          path.addPath(cached, { e: run[0], f: run[1] });
        });
      });
    });
    base.save();
    base.setTransform(1, 0, 0, 1, 0, 0);
    base.setLineDash([]);
    base.lineCap = "round";
    base.lineJoin = "round";
    base.lineWidth = Math.max(0.9 * unit, Math.min(1.3 * unit, width * 0.55));
    base.strokeStyle = graphite(style);
    base.stroke(path);
    base.restore();
    return true;
  };

  // 斜線（ハッチング）。濃い塗りほど細かく、とても濃い所は交差させる。斜線は間取りに貼り付ける
  const hatch = (clip: () => void, bounds: number[], darkness: number) => {
    if (darkness < 0.12 || bounds.length < 4) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < bounds.length; i += 2) {
      minX = Math.min(minX, bounds[i]);
      maxX = Math.max(maxX, bounds[i]);
      minY = Math.min(minY, bounds[i + 1]);
      maxY = Math.max(maxY, bounds[i + 1]);
    }
    minX = Math.max(minX, -10);
    minY = Math.max(minY, -10);
    maxX = Math.min(maxX, base.canvas.width + 10);
    maxY = Math.min(maxY, base.canvas.height + 10);
    if (maxX <= minX || maxY <= minY) return;
    const spacing = (9 - darkness * 6) * unit;
    const lines = new Path2D();
    const directions = darkness > 0.55 ? [1, -1] : [1];
    for (const direction of directions) {
      // x + direction * y = c の線を、範囲の中だけ引く
      const anchor = options.anchorX + direction * options.anchorY;
      const corners = [minX + direction * minY, maxX + direction * minY, minX + direction * maxY, maxX + direction * maxY];
      const low = Math.min(...corners), high = Math.max(...corners);
      for (let c = Math.ceil((low - anchor) / spacing) * spacing + anchor; c <= high; c += spacing) {
        const jitter = (hashUnit(Math.round(c), direction + 3) - 0.5) * 0.8 * unit;
        const y0 = minY, y1 = maxY;
        lines.moveTo(c + jitter - direction * y0, y0);
        lines.lineTo(c - jitter - direction * y1, y1);
      }
    }
    base.save();
    clip();
    base.setTransform(1, 0, 0, 1, 0, 0);
    base.globalAlpha *= 0.3 + darkness * 0.45;
    base.strokeStyle = "rgb(52, 52, 58)";
    base.lineWidth = 0.8 * unit;
    base.setLineDash([]);
    base.stroke(lines);
    base.restore();
  };

  const fillWith = (fill: () => void, clip: () => void, bounds: number[]) => {
    const style = base.fillStyle;
    let darkness = 0.3;
    if (typeof style === "string") {
      const parsed = parseCssColor(style);
      darkness = parsed ? (1 - lightnessOf(parsed[0], parsed[1], parsed[2]) / 255) * parsed[3] : 0;
      base.fillStyle = pencilTint(style);
    } else base.fillStyle = "rgba(160, 160, 160, 0.12)";
    fill();
    base.fillStyle = style;
    hatch(clip, bounds, darkness);
  };

  overrides.set("stroke", (path?: Path2D) => {
    if (path) base.stroke(path);
    else if (!strokePaths(recorder.subpaths())) base.stroke();
  });
  overrides.set("strokeRect", (x: number, y: number, w: number, h: number) => {
    if (!strokePaths([rectSubpath(recorder, x, y, w, h)])) base.strokeRect(x, y, w, h);
  });
  overrides.set("fill", (first?: Path2D | CanvasFillRule, second?: CanvasFillRule) => {
    if (typeof first === "object") {
      base.fill(first, second);
      return;
    }
    fillWith(() => base.fill(first), () => base.clip(first), recorder.subpaths().flatMap((subpath) => subpath.points));
  });
  overrides.set("fillRect", (x: number, y: number, w: number, h: number) => {
    const rect = new Path2D();
    rect.rect(x, y, w, h);
    fillWith(() => base.fill(rect), () => base.clip(rect), rectSubpath(recorder, x, y, w, h).points);
  });
  overrides.set("fillText", (text: string, x: number, y: number, maxWidth?: number) => {
    const style = base.fillStyle;
    base.fillStyle = typeof style === "string" ? graphite(style) : "rgb(52, 52, 58)";
    if (maxWidth === undefined) base.fillText(text, x, y);
    else base.fillText(text, x, y, maxWidth);
    base.fillStyle = style;
  });
  return wrapContext(base, overrides, (font) => styledFont(font, "pencil"));
}

// ---- 絵柄の入り口（main.ts から使う） ----

// 絵柄の描き先。標準とドット（ドットは別の流れで描く）では null
export function styleContext(style: PlanStyle, raw: CanvasRenderingContext2D, options: StyleContextOptions): CanvasRenderingContext2D | null {
  switch (style) {
    case "brush":
      return createBrushContext(raw, { unit: options.unit, palette: SUMI_PALETTE });
    case "parchment":
      return createBrushContext(raw, { unit: options.unit, palette: PARCHMENT_PALETTE });
    case "chalk":
      return createBrushContext(raw, { unit: options.unit, palette: CHALK_PALETTE });
    case "pencil":
      return createSketchContext(raw, options);
    case "manga":
      return createMangaContext(raw, options);
    case "blueprint":
      return createRecolorContext(raw, BLUEPRINT, options.unit);
    case "neon":
      return createRecolorContext(raw, NEON, options.unit);
    default:
      return null;
  }
}

// 描き終えたあと、全体に重ねる仕上げ（紙の模様や、まわりを少し暗くする）。(anchorX, anchorY) に模様の始まりを合わせる
export function styleFinish(style: PlanStyle, target: CanvasRenderingContext2D, width: number, height: number, anchorX: number, anchorY: number): void {
  const overlay = (kind: PaperKind, composite: GlobalCompositeOperation) => {
    const pattern = target.createPattern(paperTexture(kind), "repeat");
    if (!pattern) return;
    pattern.setTransform(new DOMMatrix().translate(anchorX, anchorY));
    target.save();
    target.globalCompositeOperation = composite;
    target.fillStyle = pattern;
    target.fillRect(0, 0, width, height);
    target.restore();
  };
  const vignette = (rgb: string, strength: number) => {
    const gradient = target.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.hypot(width, height) / 2);
    gradient.addColorStop(0, `rgba(${rgb}, 0)`);
    gradient.addColorStop(1, `rgba(${rgb}, ${strength})`);
    target.save();
    target.fillStyle = gradient;
    target.fillRect(0, 0, width, height);
    target.restore();
  };
  if (style === "brush") overlay("washi", "multiply");
  else if (style === "parchment") {
    overlay("parchment", "multiply");
    vignette("92, 58, 20", 0.38);
  } else if (style === "pencil") overlay("sketch", "multiply");
  else if (style === "chalk") {
    overlay("chalk", "source-over");
    vignette("10, 20, 15", 0.35);
  } else if (style === "neon") vignette("0, 0, 0", 0.55);
  else if (style === "blueprint") vignette("5, 20, 50", 0.3);
}

// ---- 紙の模様 ----

type PaperKind = "washi" | "parchment" | "sketch" | "chalk";

interface PaperRecipe {
  base: string | null;
  blotches: { color: string; count: number; min: number; max: number }[];
  fibers: { color: string; count: number; min: number; max: number; width: [number, number] } | null;
  grain: number;
}

const PAPER_RECIPES: Record<PaperKind, PaperRecipe> = {
  // 和紙: 白地に、ぼんやりしたむらと細長い繊維
  washi: {
    base: "#ffffff",
    blotches: [{ color: "rgba(190, 168, 130, 0.07)", count: 19, min: 0.08, max: 0.28 }, { color: "rgba(255, 255, 255, 0.45)", count: 15, min: 0.08, max: 0.28 }],
    fibers: { color: "rgba(140, 112, 76, A)", count: 230, min: 12, max: 70, width: [0.3, 0.8] },
    grain: 8,
  },
  // 羊皮紙: 濃いしみと、少しの繊維
  parchment: {
    base: "#ffffff",
    blotches: [{ color: "rgba(150, 105, 50, 0.12)", count: 26, min: 0.05, max: 0.22 }, { color: "rgba(255, 252, 240, 0.4)", count: 14, min: 0.08, max: 0.25 }],
    fibers: { color: "rgba(120, 88, 48, A)", count: 70, min: 10, max: 40, width: [0.3, 0.7] },
    grain: 12,
  },
  // スケッチブック: 紙の目のざらつきだけ
  sketch: {
    base: "#ffffff",
    blotches: [{ color: "rgba(200, 200, 205, 0.06)", count: 12, min: 0.1, max: 0.3 }],
    fibers: null,
    grain: 10,
  },
  // 黒板: 消し残りのチョークの粉と、細かいすり傷（透明な地に重ねる）
  chalk: {
    base: null,
    blotches: [{ color: "rgba(255, 255, 255, 0.045)", count: 22, min: 0.1, max: 0.35 }],
    fibers: { color: "rgba(255, 255, 255, A)", count: 90, min: 20, max: 120, width: [0.4, 1.2] },
    grain: 0,
  },
};

const paperTextures = new Map<PaperKind, HTMLCanvasElement>();

function paperTexture(kind: PaperKind): HTMLCanvasElement {
  let canvas = paperTextures.get(kind);
  if (!canvas) {
    canvas = createPaperTexture(PAPER_RECIPES[kind], 512, kind === "washi" ? 1 : kind.length * 7919);
    paperTextures.set(kind, canvas);
  }
  return canvas;
}

// 紙の模様（継ぎ目なく並べられる）。端をまたぐ物は反対側にも描く
function createPaperTexture(recipe: PaperRecipe, size: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  const random = seededRandom(seed);
  if (recipe.base) {
    g.fillStyle = recipe.base;
    g.fillRect(0, 0, size, size);
  }
  const wrapped = (draw: (ox: number, oy: number) => void) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy);
  };
  for (const blotch of recipe.blotches) {
    for (let i = 0; i < blotch.count; i += 1) {
      const x = random() * size, y = random() * size, r = size * (blotch.min + random() * (blotch.max - blotch.min));
      wrapped((ox, oy) => {
        const gradient = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gradient.addColorStop(0, blotch.color);
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        g.fillStyle = gradient;
        g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      });
    }
  }
  const fibers = recipe.fibers;
  if (fibers) {
    g.lineCap = "round";
    for (let i = 0; i < fibers.count; i += 1) {
      const x = random() * size, y = random() * size;
      const angle = random() * Math.PI * 2, length = fibers.min + random() * (fibers.max - fibers.min), bend = (random() - 0.5) * length * 0.5;
      const ex = x + Math.cos(angle) * length, ey = y + Math.sin(angle) * length;
      const qx = (x + ex) / 2 - Math.sin(angle) * bend, qy = (y + ey) / 2 + Math.cos(angle) * bend;
      g.lineWidth = fibers.width[0] + random() * (fibers.width[1] - fibers.width[0]);
      g.strokeStyle = fibers.color.replace("A", String(Math.round((0.05 + random() * 0.08) * 1000) / 1000));
      wrapped((ox, oy) => {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(qx + ox, qy + oy, ex + ox, ey + oy);
        g.stroke();
      });
    }
  }
  if (recipe.grain) {
    // 細かなざらつき
    const image = g.getImageData(0, 0, size, size);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = (random() - 0.5) * recipe.grain;
      data[i] = Math.max(0, Math.min(255, data[i] + grain));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain * 1.2));
    }
    g.putImageData(image, 0, 0);
  }
  return canvas;
}
