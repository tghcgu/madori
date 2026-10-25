export const STAIR_KINDS = ["stairs", "stairsU", "stairsSpiral"] as const;

// 下を床まで埋めた形にもできる階段（らせん階段は柱で支えるので、ない）
export function hasStairBase(kind: string): boolean {
  return kind === "stairs" || kind === "stairsU";
}

export interface StairPlacement {
  id: string;
  type: "furniture";
  kind: (typeof STAIR_KINDS)[number];
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flip?: boolean;
}

export function isStair(value: unknown): value is StairPlacement {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.type === "furniture" && typeof item.id === "string"
    && STAIR_KINDS.some((kind) => kind === item.kind)
    && [item.x, item.y, item.w, item.h, item.rotation].every((n) => typeof n === "number" && Number.isFinite(n));
}

export function sameStairPlacement(a: StairPlacement, b: StairPlacement): boolean {
  const angle = ((a.rotation - b.rotation) % 360 + 360) % 360;
  return a.kind === b.kind && Boolean(a.flip) === Boolean(b.flip)
    && Math.min(angle, 360 - angle) < 0.01
    && (["x", "y", "w", "h"] as const).every((key) => Math.abs(a[key] - b[key]) < 0.01);
}

export function stairsBelow<T>(floors: readonly { entities: readonly T[] }[], floorIndex: number): (T & StairPlacement)[] {
  if (floorIndex <= 0 || floorIndex >= floors.length) return [];
  return floors[floorIndex - 1].entities.filter((item): item is T & StairPlacement => isStair(item));
}

// 下階の実物を参照するだけで、保存データや3Dの部材は増やさない。
export function incomingStairs<T>(floors: readonly { entities: readonly T[] }[], floorIndex: number): (T & StairPlacement)[] {
  const current = floors[floorIndex]?.entities.filter((item): item is T & StairPlacement => isStair(item));
  return stairsBelow(floors, floorIndex).filter((item) => !current?.some((other) => sameStairPlacement(item, other)));
}
