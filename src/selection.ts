type Positioned = { x: number; y: number } | { x1: number; y1: number; x2: number; y2: number };

// 全員に同じ移動量を足す。元の位置を丸め直すと、選択した物どうしの間隔が変わってしまう。
export function translateSelection<T extends Positioned & { id: string; locked?: boolean }>(
  origins: readonly T[], find: (id: string) => T | undefined, dx: number, dy: number,
): void {
  for (const origin of origins) {
    const current = find(origin.id);
    if (!current || current.locked || origin.locked) continue;
    if ("x" in origin && "x" in current) {
      current.x = origin.x + dx;
      current.y = origin.y + dy;
    } else if ("x1" in origin && "x1" in current) {
      current.x1 = origin.x1 + dx;
      current.y1 = origin.y1 + dy;
      current.x2 = origin.x2 + dx;
      current.y2 = origin.y2 + dy;
    }
  }
}
