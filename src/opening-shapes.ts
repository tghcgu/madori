// ドアの種類と、2Dの記号・3Dの形で共通に使う板の並び（真上から見た形をそろえる）。
// 長さはすべて cm。位置は開口の中心から、開口の長さに対する割合（-0.5 が始点の側）。
// テストが Node でそのまま読むので、three.js や DOM は使わない

export type DoorStyle = "swing" | "double" | "sliding" | "shoji" | "fusuma" | "koshi" | "itado" | "gate" | "opening";

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
];

// 戸の板の色（色を決めていないとき）。2Dの選択中の欄の「色 3D」の初めの値にも使う
export const DOOR_COLORS: Record<DoorStyle, string> = {
  swing: "#ac8664", double: "#ac8664", sliding: "#ac8664",
  shoji: "#d8bd90", fusuma: "#e5d6b4", koshi: "#75502f", itado: "#8f6b47", gate: "#7c5a3a", opening: "#ac8664",
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
