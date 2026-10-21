// 壁の近くに置いた家具は、背中を壁に向けて壁に付ける（main.ts が使う。テストが読む）。
// 家具の背は、回す前の奥（y の小さい側）。rotation は度で、2Dの画面で時計回り
// このファイルは DOM を触らない

export interface SnapWall { x1: number; y1: number; x2: number; y2: number; thickness: number }
export interface SnapItem { x: number; y: number; w: number; h: number; rotation: number }

// 家具の背が壁の面からこれ以内なら、壁に付ける（cm）
export const WALL_SNAP_GAP = 20;

// 付ける壁がなければ null。付けるときは、背を壁に向けた向きと、背が壁の面にちょうど付く位置を返す
export function snapToWall<T extends SnapItem>(item: T, walls: readonly SnapWall[], gap = WALL_SNAP_GAP): T | null {
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  let best: { px: number; py: number; nx: number; ny: number; distance: number; thickness: number } | null = null;
  for (const wall of walls) {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;
    const ux = dx / length, uy = dy / length;
    // 壁の横にあるときだけ（壁の端より先では付けない）
    const along = (cx - wall.x1) * ux + (cy - wall.y1) * uy;
    if (along < 0 || along > length) continue;
    const px = wall.x1 + ux * along, py = wall.y1 + uy * along;
    // 壁から家具へ向かう向き
    let nx = -uy, ny = ux;
    const side = (cx - px) * nx + (cy - py) * ny;
    if (side < 0) { nx = -nx; ny = -ny; }
    const distance = Math.abs(side);
    if (distance > wall.thickness / 2 + item.h / 2 + gap) continue;
    if (!best || distance < best.distance) best = { px, py, nx, ny, distance, thickness: wall.thickness };
  }
  if (!best) return null;
  // 背（回す前の (0, -1)）が壁へ向く: (sinθ, -cosθ) = (-nx, -ny)
  const degrees = Math.atan2(-best.nx, best.ny) * 180 / Math.PI;
  const rotation = ((Math.round(degrees * 100) / 100) % 360 + 360) % 360;
  const offset = best.thickness / 2 + item.h / 2;
  const centerX = best.px + best.nx * offset, centerY = best.py + best.ny * offset;
  return { ...item, x: Math.round((centerX - item.w / 2) * 100) / 100, y: Math.round((centerY - item.h / 2) * 100) / 100, rotation };
}

// ---- ドア・窓をクリックで壁の上に置く ----

export interface OpeningLine { x1: number; y1: number; x2: number; y2: number }

// point からいちばん近い壁（壁の中心線から reach 以内）の上に、長さ length の開口を置く線。
// 開口は壁の向きにそろえ、壁の端からはみ出さない（壁が短ければ壁いっぱい）。中心は 10cm 刻み。
// side は押した側（壁の向きに対して右なら 1、左なら -1）。開き戸はこの側に開く
export function openingOnWall(point: { x: number; y: number }, walls: readonly SnapWall[], length: number, reach: number): (OpeningLine & { side: 1 | -1 }) | null {
  let best: { wall: SnapWall; along: number; length: number; ux: number; uy: number; distance: number; side: 1 | -1 } | null = null;
  for (const wall of walls) {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    const wallLength = Math.hypot(dx, dy);
    if (wallLength < 1) continue;
    const ux = dx / wallLength, uy = dy / wallLength;
    const along = (point.x - wall.x1) * ux + (point.y - wall.y1) * uy;
    if (along < 0 || along > wallLength) continue;
    const cross = ux * (point.y - wall.y1) - uy * (point.x - wall.x1);
    const distance = Math.abs(cross);
    if (distance > reach) continue;
    if (!best || distance < best.distance) best = { wall, along, length: wallLength, ux, uy, distance, side: cross > 0 ? 1 : -1 };
  }
  if (!best) return null;
  const size = Math.min(length, best.length);
  const center = Math.max(size / 2, Math.min(best.length - size / 2, Math.round(best.along / 10) * 10));
  const round = (value: number) => Math.round(value * 100) / 100;
  const { wall, ux, uy } = best;
  return {
    x1: round(wall.x1 + ux * (center - size / 2)), y1: round(wall.y1 + uy * (center - size / 2)),
    x2: round(wall.x1 + ux * (center + size / 2)), y2: round(wall.y1 + uy * (center + size / 2)),
    side: best.side,
  };
}
