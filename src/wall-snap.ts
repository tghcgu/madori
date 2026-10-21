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
