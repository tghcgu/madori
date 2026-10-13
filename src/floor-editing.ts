import { floorPoints, type FloorOutline, RECT_OUTLINE } from "./floor-outline.ts";

export type FloorPreset = "rectangle" | "circle" | "ellipse" | "polygon" | "l";

export function presetOutline(preset: FloorPreset): [number, number][] | undefined {
  if (preset === "rectangle") return undefined;
  if (preset === "l") return [[0, 0], [1, 0], [1, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]];
  if (preset === "polygon") return regularFloorOutline(6, 0);
  return Array.from({ length: 64 }, (_, i) => [0.5 + 0.5 * Math.cos(i * Math.PI / 32), 0.5 + 0.5 * Math.sin(i * Math.PI / 32)]);
}

// 保存済みの円や、回転して始点が変わった円も、頂点ではなく全体の寸法で扱う。
export function isEllipseFloor(floor: FloorOutline): boolean {
  return Boolean(floor.outline && floor.outline.length >= 16
    && floor.outline.every(([x, y]) => Math.abs((x - 0.5) ** 2 + (y - 0.5) ** 2 - 0.25) < 1e-6));
}

export function floorPreset(floor: FloorOutline): FloorPreset | "free" {
  if (isEllipseFloor(floor)) return Math.abs(floor.w - floor.h) < 0.01 ? "circle" : "ellipse";
  const points = floor.outline ?? RECT_OUTLINE;
  for (const preset of ["rectangle", "l"] as const) {
    const sample = presetOutline(preset) ?? RECT_OUTLINE;
    if (points.length === sample.length && points.every(([x, y], i) => Math.abs(x - sample[i][0]) < 1e-6 && Math.abs(y - sample[i][1]) < 1e-6)) return preset;
  }
  if (regularFloor(floor)) return "polygon";
  return "free";
}

export function regularFloorSides(value: number): number {
  return Number.isFinite(value) ? Math.max(3, Math.min(12, Math.round(value))) : 6;
}

export function regularFloorOutline(sides: number, rotation: number): [number, number][] {
  const count = regularFloorSides(sides), angle = (Number.isFinite(rotation) ? rotation % 360 : 0) * Math.PI / 180;
  return Array.from({ length: count }, (_, i) => [0.5 + 0.5 * Math.cos(angle + i * Math.PI * 2 / count), 0.5 + 0.5 * Math.sin(angle + i * Math.PI * 2 / count)]);
}

// 輪郭を正として判定するため、旧データや頂点編集後も種類の情報が食い違わない。
export function regularFloor(floor: FloorOutline): { x: number; y: number; w: number; h: number; diameter: number; sides: number; rotation: number } | null {
  if (!floor.outline || floor.outline.length < 3 || floor.outline.length > 12) return null;
  if (floor.outline.length === 4 && floor.outline.every(([x, y]) => (x === 0 || x === 1) && (y === 0 || y === 1))) return null;
  const points = floorPoints(floor), sides = points.length;
  const x = points.reduce((sum, p) => sum + p[0], 0) / sides, y = points.reduce((sum, p) => sum + p[1], 0) / sides;
  const radius = Math.hypot(points[0][0] - x, points[0][1] - y), angle = Math.atan2(points[0][1] - y, points[0][0] - x);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  const tolerance = Math.max(radius * 1e-6, 1e-7);
  const ordered = [1, -1].some(direction => points.every(([px, py], i) => Math.hypot(px - x - radius * Math.cos(angle + direction * i * Math.PI * 2 / sides), py - y - radius * Math.sin(angle + direction * i * Math.PI * 2 / sides)) <= tolerance));
  if (!ordered) return null;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return { x, y, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), diameter: radius * 2, sides, rotation: ((angle * 180 / Math.PI) % 360 + 360) % 360 };
}

export function regularFloorSize(floor: FloorOutline, diameter: number): Pick<FloorOutline, "x" | "y" | "w" | "h"> {
  const polygon = regularFloor(floor);
  if (!polygon) return { x: floor.x, y: floor.y, w: floor.w, h: floor.h };
  const scale = Math.max(40, diameter) / polygon.diameter;
  return { x: polygon.x + (floor.x - polygon.x) * scale, y: polygon.y + (floor.y - polygon.y) * scale, w: floor.w * scale, h: floor.h * scale };
}

export function centeredFloorSize(floor: FloorOutline, w: number, h: number): Pick<FloorOutline, "x" | "y" | "w" | "h"> {
  return { x: floor.x + (floor.w - w) / 2, y: floor.y + (floor.h - h) / 2, w, h };
}
