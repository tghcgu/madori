import clipping, { type Pair } from "polygon-clipping";
import { floorPolygon, signedArea, type FloorOutline } from "./floor-outline.ts";
import { isStair, type StairPlacement } from "./stairs.ts";

export function stairFootprint(item: StairPlacement): Pair[] {
  const angle = item.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  if (item.kind === "stairsSpiral") return Array.from({ length: 48 }, (_, i) => {
    const a = i * Math.PI / 24, x = Math.cos(a) * item.w / 2, y = Math.sin(a) * item.h / 2;
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const x = sx * item.w / 2, y = sy * item.h / 2;
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
}

// テンプレート生成時だけ開口を作る。利用者の保存済み間取りは変更しない。
export function openTemplateStairwells<T extends { id: string; type: string }>(floors: { entities: T[] }[], newId: () => string): void {
  for (let index = 1; index < floors.length; index++) {
    const cuts = floors[index - 1].entities.filter((item): item is T & StairPlacement => isStair(item)).map(item => [stairFootprint(item)]);
    if (!cuts.length) continue;
    const openings = clipping.union(cuts[0], ...cuts.slice(1));
    floors[index].entities = floors[index].entities.flatMap(entity => {
      if (entity.type !== "room") return [entity];
      const room = entity as T & FloorOutline;
      const source = floorPolygon(room);
      if (!clipping.intersection(source, openings).length) return [entity];
      const pieces = clipping.difference(source, openings).filter(polygon => Math.abs(signedArea(polygon[0])) > 1);
      return pieces.map((polygon, part) => {
        const normalized = polygon.map(ring => ring.slice(0, -1).map(([x, y]): Pair => [Math.max(0, Math.min(1, (x - room.x) / room.w)), Math.max(0, Math.min(1, (y - room.y) / room.h))]));
        return { ...entity, id: part ? newId() : entity.id, ...(part ? { name: "" } : {}), outline: normalized[0], holes: normalized.length > 1 ? normalized.slice(1) : undefined };
      });
    });
  }
}
