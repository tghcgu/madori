// 壁の種類。2Dの帯（main.ts の drawWall2d）と3D（main.ts の addWall3d）が、ここの厚み・高さ・色・目地から作る。
// 石垣・生け垣・竹垣・フェンスは、自由な形の線（free-shapes.ts）を壁の線に沿わせて描くので、2Dと3Dの形は自由な形と同じ
import { freeLineWidth, type FreeLineKind } from "./free-shapes.ts";

export type WallStyle = "plain" | "concrete" | "brick" | "block" | "wood" | "earthen" | "glass" | "stoneWall" | "hedge" | "takegaki" | "fence";

export interface WallStyleInfo {
  value: WallStyle;
  label: string;
  // 厚み（cm）。2Dの帯の太さと3Dの厚み。自由な形で作る種類は、その形の幅
  thickness: number;
  // 高さ（cm）。決めていなければ階の高さいっぱい
  height?: number;
  // 色（2Dの塗りと3D）
  color: string;
  // 壁に沿った目地・板の継ぎ目の間隔（cm）。0 ならなし。真上から見た目地を2Dに描く
  joint: number;
  // 瓦の笠（土塀）。3Dでは壁より両側に CAP_OVERHANG ずつ張り出し、2Dでは真上から見た笠と棟を描く
  cap?: boolean;
  // 透ける（ガラス）
  glass?: boolean;
  // 自由な形の線で作る種類
  freeKind?: FreeLineKind;
}

// 瓦の笠の張り出し（cm、片側）と色
export const CAP_OVERHANG = 10;
export const CAP_COLOR = "#4b5157";

export const WALL_STYLES: WallStyleInfo[] = [
  { value: "plain", label: "壁", thickness: 10, color: "#f4f1ec", joint: 0 },
  { value: "concrete", label: "コンクリート", thickness: 15, color: "#b8b7b1", joint: 0 },
  { value: "brick", label: "レンガ", thickness: 20, color: "#a5523a", joint: 22 },
  { value: "block", label: "ブロック塀", thickness: 15, height: 140, color: "#adaca6", joint: 40 },
  { value: "wood", label: "板塀", thickness: 8, height: 180, color: "#8b6a48", joint: 15 },
  { value: "earthen", label: "土塀", thickness: 30, height: 200, color: "#eee7d6", joint: 0, cap: true },
  { value: "glass", label: "ガラス", thickness: 4, color: "#bfe0ee", joint: 0, glass: true },
  { value: "stoneWall", label: "石垣", thickness: freeLineWidth("stoneWall"), height: 100, color: "#8f8b82", joint: 0, freeKind: "stoneWall" },
  { value: "hedge", label: "生け垣", thickness: freeLineWidth("hedge"), height: 120, color: "#4f7f3a", joint: 0, freeKind: "hedge" },
  { value: "takegaki", label: "竹垣", thickness: freeLineWidth("takegaki"), height: 150, color: "#b9a46a", joint: 0, freeKind: "takegaki" },
  { value: "fence", label: "フェンス", thickness: freeLineWidth("fence"), height: 120, color: "#8a9198", joint: 0, freeKind: "fence" },
];

export function isWallStyle(value: unknown): value is WallStyle {
  return typeof value === "string" && WALL_STYLES.some((style) => style.value === value);
}

export function wallStyleInfo(style: WallStyle | undefined): WallStyleInfo {
  return WALL_STYLES.find((item) => item.value === style) ?? WALL_STYLES[0];
}

// 壁の厚みの範囲（cm）
export const WALL_THICKNESS_RANGE = { min: 2, max: 200 };

// 厚みを変えられる種類か（フェンス・竹垣は、決まった細さ）
export function isWallThicknessAdjustable(info: WallStyleInfo): boolean {
  return !info.freeKind || info.freeKind === "stoneWall" || info.freeKind === "hedge";
}

// 壁ごとに変えた厚み（cm）を重ねた、その壁の決まり。厚みを変えられない種類は、そのまま
export function wallStyleWithThickness(info: WallStyleInfo, thickness: number | undefined): WallStyleInfo {
  if (thickness === undefined || !Number.isFinite(thickness) || !isWallThicknessAdjustable(info)) return info;
  return { ...info, thickness: Math.min(WALL_THICKNESS_RANGE.max, Math.max(WALL_THICKNESS_RANGE.min, thickness)) };
}

// 真上から見たときの幅（cm）。瓦の笠があれば笠の幅
export function wallTopWidth(info: WallStyleInfo): number {
  return info.cap ? info.thickness + CAP_OVERHANG * 2 : info.thickness;
}

// 壁に沿った目地の位置（cm、始点から）。両端には置かない
export function wallJoints(info: WallStyleInfo, length: number): number[] {
  if (info.joint <= 0) return [];
  const joints: number[] = [];
  for (let d = info.joint; d < length - 1; d += info.joint) joints.push(d);
  return joints;
}
