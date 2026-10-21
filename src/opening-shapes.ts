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

// 壁を切り抜く高さ（m）。大穴は床から、崩れ落ちた壁は途中から上まで（壁の上まで切る）
export const BROKEN_CUTS: Record<BrokenStyle, { bottom: number; top: number }> = {
  hole: { bottom: 0, top: 2 },
  broken: { bottom: 0.6, top: Infinity },
};

// 決まった並びの乱数（同じ幅なら、2Dと3Dで同じ形・同じかけらになる）
function seeded(seed: number): () => number {
  let value = (Math.floor(Math.abs(seed)) * 2654435761 + 12345) >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// 壁に残る部分の形（cm）。開口の中心が原点、x は壁に沿って、y は床からの高さ。切り抜いた所（幅は開口と壁の厚み）を、
// 大穴は「穴のまわり」、崩れ落ちた壁は「崩れて残った低い所」で埋める。wallTop は壁の高さ（cm）
export function brokenWallOutline(style: BrokenStyle, lengthCm: number, thicknessCm: number, wallTop: number): [number, number][] {
  const random = seeded(lengthCm * 7 + (style === "hole" ? 1 : 2));
  const half = lengthCm / 2 + thicknessCm / 2;
  if (style === "hole") {
    // 大穴: 床から立ち上がって、ぎざぎざのアーチで閉じる穴。まわり（切り抜いた四角の残り）を壁で埋める
    const top = Math.min(BROKEN_CUTS.hole.top * 100, wallTop), foot = lengthCm * 0.4;
    const rim: [number, number][] = [[foot, 0]];
    const sides = 5;
    for (let i = 1; i <= sides; i += 1) rim.push([lengthCm * (0.42 + random() * 0.06), (top * 0.78 * i) / sides]);
    const arch = Math.max(3, Math.round(lengthCm / 18));
    for (let i = 1; i < arch; i += 1) {
      const t = i / arch;
      const x = lengthCm * 0.46 * Math.cos(Math.PI * t);
      rim.push([x, Math.min(top - 4, top * (0.8 + 0.14 * Math.sin(Math.PI * t)) + (random() - 0.5) * 14)]);
    }
    for (let i = sides; i >= 1; i -= 1) rim.push([-lengthCm * (0.42 + random() * 0.06), (top * 0.78 * i) / sides]);
    rim.push([-foot, 0]);
    // 左下から上・右へ回り、右の足もとから穴のふちをなぞって左の足もとへ
    return [[-half, 0], [-half, top], [half, top], [half, 0], ...rim];
  }
  // 崩れ落ちた壁: 切った所の下（床から BROKEN_CUTS.broken.bottom）から、ぎざぎざに崩れた上の縁まで。両端は元の壁の高さまで
  const bottom = BROKEN_CUTS.broken.bottom * 100;
  const low = Math.min(wallTop, bottom + 25);
  const points: [number, number][] = [[-half, bottom], [-half, wallTop]];
  const steps = Math.max(4, Math.round(lengthCm / 16));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    // 真ん中ほど低く崩れる（両端は元の高さに近い）
    const edge = Math.pow(Math.abs(t - 0.5) * 2, 1.6);
    const y = low + (wallTop - low) * edge + (random() - 0.5) * 22;
    points.push([-half + 2 * half * t, Math.max(bottom + 6, Math.min(wallTop, y))]);
  }
  points.push([half, wallTop], [half, bottom]);
  return points;
}

export interface RubblePiece {
  // 中心（開口の中心から cm。x は壁に沿って、y は壁から離れる向き）、大きさ（cm）、上から見た向き（ラジアン）
  x: number; y: number; w: number; d: number; h: number; angle: number;
}

// 足もとに落ちたかけら。壁の両側に散らばる（2Dの記号と3Dの形は、同じ並びから作る）
export function brokenRubble(style: BrokenStyle, lengthCm: number, thicknessCm: number): RubblePiece[] {
  const random = seeded(lengthCm * 13 + (style === "hole" ? 5 : 9));
  const count = Math.max(4, Math.min(18, Math.round(lengthCm / (style === "hole" ? 12 : 9))));
  const pieces: RubblePiece[] = [];
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 ? 1 : -1;
    const size = 5 + random() * (style === "hole" ? 9 : 13);
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

// 大穴の、ある高さ（cm）での左右のふち（開口の中心から cm）。2Dは床から1mの高さで切った形を描く
export function brokenHoleEdges(lengthCm: number, thicknessCm: number, wallTop: number, height = 100): [number, number] {
  const rim = brokenWallOutline("hole", lengthCm, thicknessCm, wallTop).slice(4);
  const at = (points: [number, number][]) => {
    for (let i = 1; i < points.length; i += 1) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      if ((y0 - height) * (y1 - height) <= 0 && y0 !== y1) return x0 + ((x1 - x0) * (height - y0)) / (y1 - y0);
    }
    return points[0][0];
  };
  // ふちは右の足もとから上り、アーチを通って左の足もとへ下りる。いちばん高い所で左右に分ける
  const top = Math.max(...rim.map(([, y]) => y));
  const middle = rim.findIndex(([, y]) => y === top);
  return [at(rim.slice(middle).reverse()), at(rim.slice(0, middle + 1))];
}
