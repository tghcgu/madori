// ドアの種類と、2Dの記号・3Dの形で共通に使う板の並び（真上から見た形をそろえる）。
// 長さはすべて cm。位置は開口の中心から、開口の長さに対する割合（-0.5 が始点の側）。
// テストが Node でそのまま読むので、three.js や DOM は使わない

export type DoorStyle = "swing" | "double" | "sliding" | "shoji" | "fusuma" | "koshi" | "itado" | "gate" | "opening" | "hole" | "broken";

export interface DoorStyleInfo {
  value: DoorStyle;
  // 一覧と「扉の種類」の名前
  label: string;
  // 検索の別名
  keywords: string;
  // 引き戸の仲間（板がレールの上をすべる）。ちがうものは開き戸の仲間（つりもとを軸に回る）
  sliding: boolean;
  // 和風の欄にも出す
  japanese: boolean;
}

export const DOOR_STYLES: DoorStyleInfo[] = [
  { value: "swing", label: "ドア", keywords: "とびら 扉 開き戸 ひらきど ドア", sliding: false, japanese: false },
  { value: "double", label: "両開きドア", keywords: "りょうびらき 両開き 観音開き かんのん 扉 とびら", sliding: false, japanese: false },
  { value: "sliding", label: "引き戸", keywords: "ひきど 扉 とびら スライド", sliding: true, japanese: false },
  { value: "shoji", label: "障子", keywords: "しょうじ 和室 和風 引き戸 紙", sliding: true, japanese: true },
  { value: "fusuma", label: "襖", keywords: "ふすま 和室 和風 引き戸 押入れ おしいれ", sliding: true, japanese: true },
  { value: "koshi", label: "格子戸（玄関戸）", keywords: "こうしど 格子 こうし 玄関 げんかん 玄関戸 和風 引き戸", sliding: true, japanese: true },
  { value: "itado", label: "板戸", keywords: "いたど 木戸 きど 蔵 くら 納屋 和風 引き戸", sliding: true, japanese: true },
  { value: "gate", label: "門扉（門戸）", keywords: "もんぴ もんこ 門 もん 門戸 両開き 外構 庭 にわ 木戸", sliding: false, japanese: true },
  // 戸のない開口: 壁を切るだけ（2Dは壁の切れ目、3Dは戸のない出入口）
  { value: "opening", label: "開口（壁の切れ目）", keywords: "かいこう 開口 出入口 でいりぐち 入口 いりぐち 通路 つうろ 壁の穴 あな 切れ目 きれめ 戸なし", sliding: false, japanese: false },
  // 壊れた壁: 壁をぎざぎざに切り抜き、足もとにかけらを落とす。大穴は床から通り抜けられ、崩れ落ちた壁は上が崩れて低くなる
  { value: "hole", label: "壁の大穴", keywords: "かべのおおあな 穴 あな 壁の穴 壊れた こわれた 崩れた くずれた 抜け穴 ぬけあな 廃墟 はいきょ 破壊 はかい", sliding: false, japanese: false },
  { value: "broken", label: "崩れ落ちた壁", keywords: "くずれおちたかべ 崩れた くずれた 壊れた こわれた 半壊 はんかい 廃墟 はいきょ 瓦礫 がれき", sliding: false, japanese: false },
];

// 戸の板の色（色を決めていないとき）。2Dの選択中の欄の「色 3D」の初めの値にも使う
export const DOOR_COLORS: Record<DoorStyle, string> = {
  swing: "#ac8664", double: "#ac8664", sliding: "#ac8664",
  shoji: "#d8bd90", fusuma: "#e5d6b4", koshi: "#75502f", itado: "#8f6b47", gate: "#7c5a3a", opening: "#ac8664",
  // 壊れた壁は、色を決めていなければ壁の色
  hole: "#f4f1ec", broken: "#f4f1ec",
};

export function isDoorStyle(value: unknown): value is DoorStyle {
  return DOOR_STYLES.some((style) => style.value === value);
}

export function doorStyleInfo(style: DoorStyle | undefined): DoorStyleInfo {
  return DOOR_STYLES.find((item) => item.value === (style ?? "swing")) ?? DOOR_STYLES[0];
}

export interface SlidingPanel {
  // 板の中心と幅（開口の長さに対する割合）
  center: number;
  width: number;
  // どちらのレールか。-1 と 1（「重なりを反転」で手前と奥を入れ替える）
  track: -1 | 1;
}

// 引き戸の板の並び。2枚が基本で、広い開口の障子・襖（2.4m 以上）は引き違いの4枚建て。
// 4枚のときは、外の2枚が奥、中の2枚が手前のレール
export function slidingPanels(style: DoorStyle, lengthCm: number): SlidingPanel[] {
  const count = (style === "shoji" || style === "fusuma") && lengthCm >= 240 ? 4 : 2;
  // 板どうしは少し重ねる（閉めたときにすき間ができないように）
  const overlap = Math.min(0.04, 3 / Math.max(lengthCm, 1));
  const tracks: (-1 | 1)[] = count === 4 ? [-1, 1, 1, -1] : [-1, 1];
  return tracks.map((track, i) => ({ center: -0.5 + (i + 0.5) / count, width: 1 / count + overlap, track }));
}

// 板の縦の桟（障子の組子・格子戸の格子）の位置。板の中心から、板の幅に対する割合。真上から見ると、板の厚みを横切る短い線に見える
export function panelBars(style: DoorStyle, panelWidthCm: number): number[] {
  const spacing = style === "shoji" ? 20 : style === "koshi" ? 5 : 0;
  if (!spacing || panelWidthCm <= 0) return [];
  const count = Math.max(1, Math.round(panelWidthCm / spacing) - 1);
  return Array.from({ length: count }, (_, i) => -0.5 + (i + 1) / (count + 1));
}

// 引き戸の板の厚み（cm）と、レールの間隔（壁の中心から、cm）
export function panelThickness(style: DoorStyle): number {
  return style === "shoji" ? 3 : style === "fusuma" ? 2.4 : style === "koshi" ? 4 : style === "itado" ? 3.6 : 4.2;
}

export function trackOffset(style: DoorStyle): number {
  return style === "shoji" || style === "fusuma" ? 2.4 : 3.3;
}

// 両開きの戸（両開きドア・門扉）の2枚の扉。それぞれ開口の半分の幅で、両端のつりもとを軸に同じ側へ開く
export function doubleLeaves(): { hinge: -1 | 1; width: number }[] {
  return [{ hinge: -1, width: 0.5 }, { hinge: 1, width: 0.5 }];
}

// 門扉の縦の板の位置（扉の中心から、扉の幅に対する割合）と、板の幅（割合）
export function gateSlats(leafWidthCm: number): { positions: number[]; width: number } {
  const count = Math.max(3, Math.round(leafWidthCm / 12));
  const width = 0.62 / count;
  return { positions: Array.from({ length: count }, (_, i) => -0.5 + (i + 0.5) / count), width };
}

// ---- 壊れた壁（壁の大穴・崩れ落ちた壁） ----
export type BrokenStyle = "hole" | "broken";
export function isBrokenStyle(style: unknown): style is BrokenStyle {
  return style === "hole" || style === "broken";
}

// 開口の両端で、壁を余分に切る幅の合計（cm）。main.ts の wallSections が壁を切る幅（WALL_THICKNESS_2D）と同じ
export const BROKEN_CUT_MARGIN = 10;
// 大穴を切る高さ（cm）
const HOLE_TOP = 200;

// 壁を切り抜く高さ（m。壁の高さ wallTop は cm）。大穴は床から2mまで、崩れ落ちた壁は途中から上まで。
// 低い壁（ブロック塀・石垣・生け垣など）も崩れて見えるよう、残す高さは壁の高さの半分ほどまでにする
export function brokenCutRange(style: BrokenStyle, wallTop: number): [number, number] {
  return style === "hole" ? [0, HOLE_TOP / 100] : [Math.min(0.6, (wallTop * 0.45) / 100), Infinity];
}

// 決まった並びの乱数（同じ幅なら、2Dと3Dで同じ形・同じかけらになる）
function seeded(seed: number): () => number {
  let value = (Math.floor(Math.abs(seed)) * 2654435761 + 12345) >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// 壁に残る部分の形（cm）。開口の中心が原点、x は壁に沿って、y は床からの高さ。切り抜いた所（幅は開口と BROKEN_CUT_MARGIN）を、
// 大穴は「穴のまわり」（この四角から brokenHolePolygon の穴を抜く）、崩れ落ちた壁は「崩れて残った低い所」で埋める。wallTop は壁の高さ（cm）
export function brokenWallOutline(style: BrokenStyle, lengthCm: number, wallTop: number): [number, number][] {
  const random = seeded(lengthCm * 7 + 2);
  const half = lengthCm / 2 + BROKEN_CUT_MARGIN / 2;
  if (style === "hole") {
    const top = Math.min(HOLE_TOP, wallTop);
    return [[-half, 0], [-half, top], [half, top], [half, 0]];
  }
  // 崩れ落ちた壁: 切った所の下から、ぎざぎざに崩れた上の縁まで。両端は元の壁の高さまで
  const bottom = brokenCutRange("broken", wallTop)[0] * 100;
  const low = Math.min(wallTop, bottom + Math.max(6, (wallTop - bottom) * 0.12));
  const points: [number, number][] = [[-half, bottom], [-half, wallTop]];
  const steps = Math.max(4, Math.round(lengthCm / 16));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    // 真ん中ほど低く崩れる（両端は元の高さに近い）
    const edge = Math.pow(Math.abs(t - 0.5) * 2, 1.6);
    const y = low + (wallTop - low) * edge + (random() - 0.5) * (wallTop - bottom) * 0.12;
    points.push([-half + 2 * half * t, Math.max(bottom + 3, Math.min(wallTop, y))]);
  }
  points.push([half, wallTop], [half, bottom]);
  return points;
}

// 崩れ落ちた壁の、x（開口の中心から cm）での崩れたふちの高さ（cm）。石垣・生け垣など自由な形の壁を、段々に作るのに使う
export function brokenTopAt(lengthCm: number, wallTop: number, x: number): number {
  const edge = brokenWallOutline("broken", lengthCm, wallTop).slice(1, -1);
  if (x <= edge[0][0]) return edge[0][1];
  for (let i = 1; i < edge.length; i += 1) {
    const [x0, y0] = edge[i - 1], [x1, y1] = edge[i];
    if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return edge[edge.length - 1][1];
}

export interface RubblePiece {
  // 中心（開口の中心から cm。x は壁に沿って、y は壁から離れる向き）、大きさ（cm）、上から見た向き（ラジアン）
  x: number; y: number; w: number; d: number; h: number; angle: number;
}

// 足もとに落ちたかけら。壁の両側に散らばる（2Dの記号と3Dの形は、同じ並びから作る）
export function brokenRubble(style: BrokenStyle, lengthCm: number, thicknessCm: number): RubblePiece[] {
  const random = seeded(lengthCm * 13 + (style === "hole" ? 5 : 9));
  const count = Math.max(4, Math.min(20, Math.round(lengthCm / 9)));
  const pieces: RubblePiece[] = [];
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 ? 1 : -1;
    const size = 5 + random() * 13;
    pieces.push({
      x: (random() - 0.5) * lengthCm * 0.85,
      y: side * (thicknessCm / 2 + 3 + random() * 32),
      w: size,
      d: size * (0.55 + random() * 0.45),
      h: size * (0.35 + random() * 0.4),
      angle: random() * Math.PI,
    });
  }
  return pieces;
}

// 大穴の、ある高さ（cm）での左右のふち（開口の中心から cm）。2Dは床から1mの高さ（低い壁は穴の真ん中の高さ）で切った形を描く
export function brokenHoleEdges(lengthCm: number, wallTop: number, height = 100): [number, number] {
  const hole = brokenHolePolygon(lengthCm, wallTop);
  const ys = hole.map(([, y]) => y);
  const level = Math.min(height, (Math.min(...ys) + Math.max(...ys)) / 2);
  const crossings: number[] = [];
  for (let i = 0; i < hole.length; i += 1) {
    const [x0, y0] = hole[i], [x1, y1] = hole[(i + 1) % hole.length];
    if ((y0 - level) * (y1 - level) <= 0 && y0 !== y1) crossings.push(x0 + ((x1 - x0) * (level - y0)) / (y1 - y0));
  }
  return [Math.min(...crossings), Math.max(...crossings)];
}

// 大穴の形（cm。開口の中心が原点）。壁を突き破ったような、ふちのぎざぎざな丸い穴。とがった所とへこんだ所が交互に並び、
// ところどころ外へ深く割れる。下には低いふちが少し残り、上にも壁が残る。切り抜いた所の中に収まる（割れの先も含めて）
export function brokenHolePolygon(lengthCm: number, wallTop: number): [number, number][] {
  const random = seeded(lengthCm * 7 + 1);
  const half = lengthCm / 2 + BROKEN_CUT_MARGIN / 2;
  const cutTop = Math.min(HOLE_TOP, wallTop);
  const bottom = Math.min(6, cutTop * 0.05);
  const top = cutTop - Math.max(12, cutTop * 0.15);
  const reach = 1.16;
  const rx = Math.min(lengthCm * 0.5, half - 3) / reach, ry = (top - bottom) / 2 / reach, cy = (top + bottom) / 2;
  const count = Math.max(32, Math.round((rx + ry) / 3));
  // 外へ深く割れる所（4〜6か所。となり合わないように）
  const cracks = new Set<number>();
  const crackCount = 4 + Math.floor(random() * 3);
  for (let i = 0; i < crackCount; i += 1) cracks.add((Math.floor((i + random() * 0.6) * count / crackCount) * 2 + 1) % count);
  const points: [number, number][] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const scale = cracks.has(i) ? 1.07 + random() * 0.09 : i % 2 ? 0.78 + random() * 0.12 : 0.93 + random() * 0.09;
    points.push([Math.cos(angle) * rx * scale, cy + Math.sin(angle) * ry * scale]);
  }
  return points;
}

// 大穴のまわりのひび（壁の両面に描く折れ線。cm）。穴の割れの先から、外へ向かって折れながらのびる。切り抜いた所からはみ出さない
export function brokenHoleCracks(lengthCm: number, wallTop: number): [number, number][][] {
  const random = seeded(lengthCm * 11 + 3);
  const half = lengthCm / 2 + BROKEN_CUT_MARGIN / 2;
  const cutTop = Math.min(HOLE_TOP, wallTop);
  const hole = brokenHolePolygon(lengthCm, wallTop);
  const cy = hole.reduce((sum, [, y]) => sum + y, 0) / hole.length;
  // 中心からいちばん遠い（割れの）点と、そのほかの何か所か
  const tips = hole.map((point, index) => ({ point, index, far: Math.hypot(point[0], (point[1] - cy) * (lengthCm / Math.max(cutTop, 1))) }))
    .sort((a, b) => b.far - a.far).slice(0, 6);
  const inside = ([x, y]: [number, number]): [number, number] => [Math.max(-half + 1, Math.min(half - 1, x)), Math.max(1, Math.min(cutTop - 1, y))];
  return tips.map(({ point: [x, y] }) => {
    const angle = Math.atan2(y - cy, x);
    const line: [number, number][] = [[x, y]];
    let px = x, py = y, heading = angle;
    for (let step = 0; step < 3; step += 1) {
      heading += (random() - 0.5) * 0.9;
      const length = 6 + random() * 12;
      [px, py] = inside([px + Math.cos(heading) * length, py + Math.sin(heading) * length]);
      line.push([px, py]);
    }
    return line;
  });
}

// 大穴が、x（開口の中心から cm）の所で切る高さの範囲（cm）。穴の外なら null。石垣・竹垣など自由な形の壁は、
// この下と上に、短い区切りで壁を残して穴にする
export function brokenHoleSpan(lengthCm: number, wallTop: number, x: number): [number, number] | null {
  const hole = brokenHolePolygon(lengthCm, wallTop);
  const crossings: number[] = [];
  for (let i = 0; i < hole.length; i += 1) {
    const [x0, y0] = hole[i], [x1, y1] = hole[(i + 1) % hole.length];
    if ((x0 - x) * (x1 - x) <= 0 && x0 !== x1) crossings.push(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
  }
  return crossings.length >= 2 ? [Math.min(...crossings), Math.max(...crossings)] : null;
}
