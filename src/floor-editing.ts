import { type FloorOutline, RECT_OUTLINE } from "./floor-outline.ts";

export type FloorPreset = "rectangle" | "circle" | "l";

export function presetOutline(preset: FloorPreset): [number, number][] | undefined {
  if (preset === "rectangle") return undefined;
  if (preset === "l") return [[0, 0], [1, 0], [1, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]];
  return Array.from({ length: 64 }, (_, i) => [0.5 + 0.5 * Math.cos(i * Math.PI / 32), 0.5 + 0.5 * Math.sin(i * Math.PI / 32)]);
}

// 保存済みの円や、回転して始点が変わった円も、頂点ではなく全体の寸法で扱う。
export function isEllipseFloor(floor: FloorOutline): boolean {
  return Boolean(floor.outline && floor.outline.length >= 16
    && floor.outline.every(([x, y]) => Math.abs((x - 0.5) ** 2 + (y - 0.5) ** 2 - 0.25) < 1e-6));
}

export function floorPreset(floor: FloorOutline): FloorPreset | "free" {
  if (isEllipseFloor(floor)) return "circle";
  const points = floor.outline ?? RECT_OUTLINE;
  for (const preset of ["rectangle", "l"] as const) {
    const sample = presetOutline(preset) ?? RECT_OUTLINE;
    if (points.length === sample.length && points.every(([x, y], i) => Math.abs(x - sample[i][0]) < 1e-6 && Math.abs(y - sample[i][1]) < 1e-6)) return preset;
  }
  return "free";
}

export function centeredFloorSize(floor: FloorOutline, w: number, h: number): Pick<FloorOutline, "x" | "y" | "w" | "h"> {
  return { x: floor.x + (floor.w - w) / 2, y: floor.y + (floor.h - h) / 2, w, h };
}
