export type RoomSurface = "plain" | "wood" | "tile" | "stone" | "grass";

export const SURFACE_DEFS: Record<RoomSurface, { label: string; color: string; roughness: number }> = {
  plain: { label: "標準", color: "#ffffff", roughness: 0.82 },
  wood: { label: "フローリング", color: "#d6b58a", roughness: 0.68 },
  tile: { label: "タイル", color: "#dfe7ea", roughness: 0.48 },
  stone: { label: "石の床", color: "#aeb3b1", roughness: 0.94 },
  grass: { label: "草地・芝生", color: "#83ab57", roughness: 1 },
};

export const SURFACE_TILE_CM = 200;
const canvasCache = new Map<string, HTMLCanvasElement>();

export function isRoomSurface(value: unknown): value is RoomSurface {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SURFACE_DEFS, value);
}

// One repeatable tile is shared by the plan and 3D views, at the same real-world scale.
export function surfaceCanvas(surface: RoomSurface, color: string): HTMLCanvasElement {
  const key = `${surface}:${color}`;
  const cached = canvasCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, 256, 256);
  let seed = 7319;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  if (surface === "grass") {
    for (let i = 0; i < 4200; i += 1) {
      const x = random() * 256;
      const y = random() * 256;
      context.strokeStyle = i % 3 === 0 ? "rgba(255,255,210,0.2)" : "rgba(20,60,10,0.18)";
      context.lineWidth = 0.7 + random();
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + random() * 4 - 2, y - 2 - random() * 4);
      context.stroke();
    }
  } else if (surface === "stone" || surface === "tile" || surface === "wood") {
    const rowHeight = surface === "wood" ? 32 : 64;
    const tileWidth = surface === "tile" ? 64 : 128;
    for (let row = 0; row < 256 / rowHeight; row += 1) {
      const offset = surface === "tile" ? 0 : (row % 2) * tileWidth / 2;
      for (let x = -offset; x < 256; x += tileWidth) {
        const y = row * rowHeight;
        context.fillStyle = `rgba(${row % 2 ? "0,0,0" : "255,255,255"},${0.025 + random() * 0.07})`;
        context.fillRect(x, y, tileWidth, rowHeight);
        context.strokeStyle = surface === "wood" ? "rgba(70,45,20,0.25)" : "rgba(255,255,255,0.6)";
        context.lineWidth = surface === "stone" ? 3 : 1.5;
        context.strokeRect(x, y, tileWidth, rowHeight);
        if (surface === "wood") {
          context.strokeStyle = "rgba(80,55,30,0.12)";
          for (let grain = 0; grain < 6; grain += 1) {
            const gy = y + 4 + random() * (rowHeight - 8);
            context.beginPath();
            context.moveTo(x + 5, gy);
            context.bezierCurveTo(x + 40, gy - 2, x + 85, gy + 3, x + tileWidth - 5, gy);
            context.stroke();
          }
        }
      }
    }
    if (surface === "stone") {
      for (let i = 0; i < 5000; i += 1) {
        context.fillStyle = i % 2 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.09)";
        context.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1);
      }
    }
  }

  if (canvasCache.size >= 32) canvasCache.delete(canvasCache.keys().next().value!);
  canvasCache.set(key, canvas);
  return canvas;
}
