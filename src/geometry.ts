export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface WallOpening {
  from: number;
  to: number;
  kind: "door" | "window";
}

export interface Rectangle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function openingIntervals(wall: Segment, openings: (Segment & { type: "door" | "window" })[], thickness: number): WallOpening[] {
  const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  if (length < 0.001) return [];
  const ux = (wall.x2 - wall.x1) / length;
  const uy = (wall.y2 - wall.y1) / length;
  const project = (x: number, y: number) => (x - wall.x1) * ux + (y - wall.y1) * uy;
  const perpendicular = (x: number, y: number) => Math.abs((x - wall.x1) * uy - (y - wall.y1) * ux);
  return openings.flatMap((opening) => {
    const dx = opening.x2 - opening.x1;
    const dy = opening.y2 - opening.y1;
    const openingLength = Math.hypot(dx, dy);
    if (openingLength < 0.001 || Math.abs(dx * uy - dy * ux) / openingLength > 0.06) return [];
    if (Math.max(perpendicular(opening.x1, opening.y1), perpendicular(opening.x2, opening.y2)) > thickness * 1.4) return [];
    const start = project(opening.x1, opening.y1);
    const end = project(opening.x2, opening.y2);
    const from = Math.max(0, Math.min(start, end) - thickness / 2);
    const to = Math.min(length, Math.max(start, end) + thickness / 2);
    return to > from ? [{ from, to, kind: opening.type }] : [];
  });
}

export function segmentInterval<T extends Segment>(wall: T, from: number, to: number): T {
  const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  if (length < 0.001) return { ...wall };
  const ux = (wall.x2 - wall.x1) / length;
  const uy = (wall.y2 - wall.y1) / length;
  return { ...wall, x1: wall.x1 + ux * from, y1: wall.y1 + uy * from, x2: wall.x1 + ux * to, y2: wall.y1 + uy * to };
}

export function solidWallSections(length: number, openings: WallOpening[], height: number, doorHead: number, windowSill: number, windowHead: number): { from: number; to: number; bottom: number; top: number }[] {
  const breaks = [...new Set([0, length, ...openings.flatMap(({ from, to }) => [from, to])])].sort((a, b) => a - b);
  const sections: { from: number; to: number; bottom: number; top: number }[] = [];
  for (let index = 0; index < breaks.length - 1; index += 1) {
    const from = breaks[index];
    const to = breaks[index + 1];
    if (to - from < 0.001) continue;
    const middle = (from + to) / 2;
    const holes = openings.filter((opening) => opening.from < middle && opening.to > middle)
      .map((opening) => opening.kind === "door" ? [0, doorHead] : [windowSill, windowHead])
      .sort((a, b) => a[0] - b[0]);
    let bottom = 0;
    for (const [low, high] of [...holes, [height, height]]) {
      if (low > bottom) sections.push({ from, to, bottom, top: Math.min(low, height) });
      bottom = Math.max(bottom, high);
    }
  }
  return sections;
}

// Rooms are axis-aligned. Subtract later footprints so no coplanar floor faces overlap.
export function visibleRectangles(source: Rectangle, covers: Rectangle[]): Rectangle[] {
  return covers.reduce<Rectangle[]>((pieces, cover) => pieces.flatMap((piece) => {
    const left = Math.max(piece.x, cover.x);
    const top = Math.max(piece.y, cover.y);
    const right = Math.min(piece.x + piece.w, cover.x + cover.w);
    const bottom = Math.min(piece.y + piece.h, cover.y + cover.h);
    if (left >= right || top >= bottom) return [piece];
    return [
      { x: piece.x, y: piece.y, w: left - piece.x, h: piece.h },
      { x: right, y: piece.y, w: piece.x + piece.w - right, h: piece.h },
      { x: left, y: piece.y, w: right - left, h: top - piece.y },
      { x: left, y: bottom, w: right - left, h: piece.y + piece.h - bottom },
    ].filter((rect) => rect.w > 0.001 && rect.h > 0.001);
  }), [source]);
}
