// 床材（部屋・床の面のつくり）。2Dの模様と3Dの床の模様は、同じ1枚のタイル（surfaceCanvas）から作るので、同じ見た目・同じ大きさになる
export type RoomSurface =
  | "plain" | "wood" | "herringbone" | "deck" | "tatami" | "carpet"
  | "tile" | "mosaic" | "checker" | "marble"
  | "stone" | "cobblestone" | "brick" | "concrete" | "asphalt" | "steelPlate"
  | "grass" | "soil" | "sand" | "gravel" | "snow" | "water";

export interface SurfaceDef {
  label: string;
  // 模様の地の色（部屋の色を変えると、模様はそのままで地の色が変わる）
  color: string;
  roughness: number;
  metalness?: number;
  // 模様1枚が表す大きさ cm（なければ SURFACE_TILE_CM）
  tile?: number;
}

export const SURFACE_DEFS: Record<RoomSurface, SurfaceDef> = {
  plain: { label: "標準", color: "#ffffff", roughness: 0.82 },
  wood: { label: "フローリング", color: "#d6b58a", roughness: 0.68 },
  herringbone: { label: "ヘリンボーン", color: "#c79e6c", roughness: 0.6, tile: 60 * Math.SQRT2 },
  deck: { label: "ウッドデッキ・板張り", color: "#a77a50", roughness: 0.8 },
  tatami: { label: "畳", color: "#cdc68e", roughness: 0.9, tile: 360 },
  carpet: { label: "カーペット", color: "#a99c8e", roughness: 1, tile: 100 },
  tile: { label: "タイル", color: "#dfe7ea", roughness: 0.48 },
  mosaic: { label: "モザイクタイル", color: "#9fc7d1", roughness: 0.35, tile: 50 },
  checker: { label: "市松・チェッカー", color: "#f2f0ea", roughness: 0.4, tile: 60 },
  marble: { label: "大理石", color: "#ece9e3", roughness: 0.25, tile: 120 },
  stone: { label: "石の床", color: "#aeb3b1", roughness: 0.94 },
  cobblestone: { label: "石畳", color: "#a29c92", roughness: 0.95, tile: 100 },
  brick: { label: "レンガ", color: "#b0644a", roughness: 0.95, tile: 100 },
  concrete: { label: "コンクリート", color: "#bdbdb7", roughness: 0.95 },
  asphalt: { label: "アスファルト", color: "#5f6266", roughness: 1, tile: 100 },
  steelPlate: { label: "鉄板（縞鋼板）", color: "#a5abaf", roughness: 0.45, metalness: 0.3, tile: 60 },
  grass: { label: "草地・芝生", color: "#83ab57", roughness: 1 },
  soil: { label: "土・土間", color: "#9c7c58", roughness: 1 },
  sand: { label: "砂・砂浜", color: "#e2cfa0", roughness: 1 },
  gravel: { label: "砂利", color: "#b9b2a6", roughness: 1, tile: 100 },
  snow: { label: "雪", color: "#f3f6f9", roughness: 0.85 },
  water: { label: "水面", color: "#5f9fc6", roughness: 0.1 },
};

export const SURFACE_TILE_CM = 200;
const canvasCache = new Map<string, HTMLCanvasElement>();

export function isRoomSurface(value: unknown): value is RoomSurface {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SURFACE_DEFS, value);
}

// 模様1枚が表す大きさ cm（2Dの模様の拡大率と、3Dの床の模様の繰り返しに使う）
export function surfaceTileCm(surface: RoomSurface): number {
  return SURFACE_DEFS[surface].tile ?? SURFACE_TILE_CM;
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
  // 端にかかる物は反対側にも描き、模様を並べたときに継ぎ目が出ないようにする
  const wrapped = (x: number, y: number, reach: number, draw: (x: number, y: number) => void) => {
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
      if (x + dx > -reach && x + dx < 256 + reach && y + dy > -reach && y + dy < 256 + reach) draw(x + dx, y + dy);
    }
  };
  const speckles = (count: number, light: string, dark: string, size = 1) => {
    for (let i = 0; i < count; i += 1) {
      context.fillStyle = i % 2 ? light : dark;
      context.fillRect(random() * 256, random() * 256, size + random() * size, size);
    }
  };
  // ぼんやりした濃淡（土・コンクリートのむら）
  const blotches = (count: number, radius: number, light: string, dark: string) => {
    for (let i = 0; i < count; i += 1) {
      const r = radius * (0.5 + random()), tone = i % 2 ? light : dark;
      wrapped(random() * 256, random() * 256, r, (x, y) => {
        const gradient = context.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, tone);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = gradient;
        context.fillRect(x - r, y - r, r * 2, r * 2);
      });
    }
  };
  const shade = (strength: number) => `rgba(${random() < 0.5 ? "0,0,0" : "255,255,255"},${(strength * (0.3 + random() * 0.7)).toFixed(3)})`;

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
  } else if (surface === "herringbone") {
    // 長さ60cm・幅12cmの板を直角に組み、45°回した矢筈張り。1枚の模様は横に1周期、縦に5周期ちょうど
    const scale = 256 / surfaceTileCm(surface), length = 60, width = 12;
    context.save();
    context.scale(scale, scale);
    context.rotate(Math.PI / 4);
    const plank = (x: number, y: number, w: number, h: number) => {
      context.fillStyle = shade(0.09);
      context.fillRect(x, y, w, h);
      context.strokeStyle = "rgba(80,55,30,0.12)";
      context.lineWidth = 0.35;
      const along = w > h;
      for (let grain = 1; grain < 3; grain += 1) {
        context.beginPath();
        if (along) { const gy = y + (h * grain) / 3 + (random() - 0.5) * 2; context.moveTo(x + 2, gy); context.lineTo(x + w - 2, gy + (random() - 0.5) * 1.5); }
        else { const gx = x + (w * grain) / 3 + (random() - 0.5) * 2; context.moveTo(gx, y + 2); context.lineTo(gx + (random() - 0.5) * 1.5, y + h - 2); }
        context.stroke();
      }
      context.strokeStyle = "rgba(70,45,20,0.32)";
      context.lineWidth = 0.6;
      context.strokeRect(x, y, w, h);
    };
    for (let b = -4; b <= 4; b += 1) for (let k = -16; k <= 16; k += 1) {
      const x = k * width + b * length, y = k * width - b * length;
      plank(x, y, length, width);
      plank(x, y + width, width, length);
    }
    context.restore();
  } else if (surface === "deck") {
    // 幅12.5cm（すき間を含む）の板。板ごとに色を少し変え、継ぎ目は列ごとに違う所に入れる
    for (let row = 0; row < 16; row += 1) {
      const y = row * 16;
      context.fillStyle = shade(0.1);
      context.fillRect(0, y, 256, 14);
      context.strokeStyle = "rgba(70,40,15,0.14)";
      context.lineWidth = 0.8;
      for (let grain = 0; grain < 3; grain += 1) {
        const gy = y + 3 + random() * 8, phase = random() * Math.PI * 2;
        context.beginPath();
        for (let x = 0; x <= 256; x += 8) context.lineTo(x, gy + Math.sin((x / 256) * Math.PI * 4 + phase) * 0.9);
        context.stroke();
      }
      context.fillStyle = "rgba(35,22,10,0.55)";
      context.fillRect(0, y + 14, 256, 2);
      const joint = Math.floor(random() * 256);
      context.fillRect(joint, y, 1.5, 14);
    }
  } else if (surface === "tatami") {
    // 畳（180×90cm）を横向きにし、列ごとに半畳ずらして敷く。長い辺に畳縁、い草の目は短い辺と平行
    for (let row = 0; row < 4; row += 1) {
      const y = row * 64;
      for (let x = (row % 2) * 64 - 128; x < 256; x += 128) {
        // 畳ごとに、い草の向きで光り方が少し違って見える
        context.fillStyle = Math.round(x / 128 + row) % 2 ? "rgba(255,255,230,0.14)" : "rgba(90,85,30,0.1)";
        context.fillRect(x, y, 128, 64);
        context.fillStyle = "rgba(95,90,40,0.1)";
        for (let i = 1; i < 64; i += 1) context.fillRect(x + i * 2, y + 2, 0.7, 60);
        context.fillStyle = "rgba(40,52,44,0.86)";
        context.fillRect(x, y, 128, 2.2);
        context.fillRect(x, y + 61.8, 128, 2.2);
        context.fillStyle = "rgba(70,62,30,0.6)";
        context.fillRect(x, y, 1.2, 64);
      }
    }
  } else if (surface === "carpet") {
    blotches(30, 40, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.05)");
    speckles(9000, "rgba(255,255,255,0.1)", "rgba(0,0,0,0.1)", 1);
  } else if (surface === "mosaic") {
    // 2.5cm角の小さなタイル。1枚ずつ濃さを変え、白い目地で区切る
    for (let row = 0; row < 20; row += 1) for (let col = 0; col < 20; col += 1) {
      context.fillStyle = shade(0.22);
      context.fillRect(col * 12.8, row * 12.8, 12.8, 12.8);
    }
    context.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 20; i += 1) {
      context.fillRect(i * 12.8, 0, 1.2, 256);
      context.fillRect(0, i * 12.8, 256, 1.2);
    }
  } else if (surface === "checker") {
    // 30cm角の市松。1つおきに暗い色を重ねる（地の色を変えると、明るい側の色が変わる）
    for (const [col, row] of [[0, 0], [1, 1]]) {
      context.fillStyle = "rgba(28,28,32,0.86)";
      context.fillRect(col * 128, row * 128, 128, 128);
    }
    for (const [col, row] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      context.fillStyle = shade(0.04);
      context.fillRect(col * 128, row * 128, 128, 128);
    }
    context.fillStyle = "rgba(140,140,140,0.4)";
    for (const at of [0, 128]) { context.fillRect(at, 0, 1, 256); context.fillRect(0, at, 256, 1); }
  } else if (surface === "marble") {
    // 60cm角の大理石。石目の筋は端で反対側へつなげる
    for (const [col, row] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      context.fillStyle = shade(0.05);
      context.fillRect(col * 128, row * 128, 128, 128);
    }
    for (let i = 0; i < 9; i += 1) {
      const x0 = random() * 256, y0 = random() * 256, angle = random() * Math.PI, span = 90 + random() * 120;
      const x1 = x0 + Math.cos(angle) * span, y1 = y0 + Math.sin(angle) * span;
      const bend = () => (random() - 0.5) * 70;
      const c1 = [x0 + (x1 - x0) / 3 + bend(), y0 + (y1 - y0) / 3 + bend()], c2 = [x0 + (x1 - x0) * 2 / 3 + bend(), y0 + (y1 - y0) * 2 / 3 + bend()];
      const strong = i % 3 === 0;
      wrapped(x0, y0, 256, (x, y) => {
        context.strokeStyle = strong ? "rgba(95,95,105,0.3)" : "rgba(120,120,128,0.16)";
        context.lineWidth = strong ? 1.4 : 0.8;
        context.beginPath();
        context.moveTo(x, y);
        context.bezierCurveTo(c1[0] - x0 + x, c1[1] - y0 + y, c2[0] - x0 + x, c2[1] - y0 + y, x1 - x0 + x, y1 - y0 + y);
        context.stroke();
      });
    }
    context.fillStyle = "rgba(255,255,255,0.85)";
    for (const at of [0, 128]) { context.fillRect(at, 0, 1, 256); context.fillRect(0, at, 256, 1); }
  } else if (surface === "cobblestone") {
    // 12.5cm角ほどの石を並べた石畳。すき間を暗くし、石は1つずつ形と濃さを変える
    context.fillStyle = "rgba(35,32,28,0.5)";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
      const offset = (row % 2) * 16;
      const x = col * 32 + offset + 2 + random() * 2, y = row * 32 + 2 + random() * 2;
      const w = 27 - random() * 3, h = 27 - random() * 3, r = 6 + random() * 5;
      wrapped(x, y, 32, (px, py) => {
        context.beginPath();
        context.roundRect(px, py, w, h, r);
        context.fillStyle = color;
        context.fill();
        context.fillStyle = shade(0.16);
        context.fill();
        context.strokeStyle = "rgba(255,255,255,0.18)";
        context.lineWidth = 1;
        context.stroke();
      });
    }
  } else if (surface === "brick") {
    // 25×12.5cm（目地を含む）のレンガを、段ごとに半分ずらして積む
    for (let row = 0; row < 8; row += 1) {
      for (let x = (row % 2) * -32; x < 256; x += 64) {
        context.fillStyle = shade(0.14);
        context.fillRect(x, row * 32, 64, 32);
        context.fillStyle = "rgba(0,0,0,0.05)";
        for (let i = 0; i < 18; i += 1) context.fillRect(x + random() * 64, row * 32 + random() * 32, 1.5, 1.5);
      }
    }
    context.fillStyle = "rgba(226,214,196,0.88)";
    for (let row = 0; row < 8; row += 1) {
      context.fillRect(0, row * 32, 256, 3);
      for (let x = (row % 2) * -32; x < 256; x += 64) context.fillRect(x, row * 32, 3, 32);
    }
  } else if (surface === "concrete") {
    blotches(40, 46, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.05)");
    speckles(4000, "rgba(255,255,255,0.12)", "rgba(0,0,0,0.1)", 1);
    for (let i = 0; i < 60; i += 1) {
      context.fillStyle = "rgba(0,0,0,0.18)";
      context.beginPath();
      context.arc(random() * 256, random() * 256, 0.6 + random() * 0.8, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "rgba(0,0,0,0.2)";
    context.fillRect(0, 0, 256, 1.2);
    context.fillRect(0, 0, 1.2, 256);
  } else if (surface === "asphalt") {
    blotches(24, 40, "rgba(255,255,255,0.03)", "rgba(0,0,0,0.05)");
    speckles(12000, "rgba(225,225,220,0.22)", "rgba(0,0,0,0.25)", 1);
  } else if (surface === "steelPlate") {
    // 縞鋼板: 細長い突起を、となりどうしで向きを変えて並べる
    for (let row = 0; row < 16; row += 1) for (let col = 0; col < 16; col += 1) {
      const x = col * 16 + 8, y = row * 16 + 8, angle = (row + col) % 2 ? Math.PI / 4 : -Math.PI / 4;
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.fillStyle = "rgba(0,0,0,0.28)";
      context.beginPath();
      context.ellipse(0.8, 0.8, 5.5, 1.6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.42)";
      context.beginPath();
      context.ellipse(0, 0, 5.5, 1.6, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    speckles(1200, "rgba(255,255,255,0.06)", "rgba(0,0,0,0.06)", 1);
  } else if (surface === "soil") {
    blotches(60, 34, "rgba(255,240,210,0.07)", "rgba(40,25,10,0.08)");
    speckles(5000, "rgba(255,245,225,0.12)", "rgba(40,25,10,0.14)", 1);
    for (let i = 0; i < 160; i += 1) {
      const r = 0.8 + random() * 1.6, tone = shade(0.25);
      wrapped(random() * 256, random() * 256, r, (x, y) => {
        context.fillStyle = tone;
        context.beginPath();
        context.ellipse(x, y, r, r * 0.7, random() * Math.PI, 0, Math.PI * 2);
        context.fill();
      });
    }
  } else if (surface === "sand") {
    speckles(9000, "rgba(255,255,240,0.14)", "rgba(110,85,40,0.1)", 1);
    // ゆるい風紋。周期を模様の幅に合わせ、継ぎ目でつながるようにする
    context.strokeStyle = "rgba(255,255,245,0.16)";
    context.lineWidth = 1.4;
    for (let i = 0; i < 12; i += 1) {
      const base = i * 21.33 + random() * 6, phase = random() * Math.PI * 2;
      context.beginPath();
      for (let x = 0; x <= 256; x += 4) context.lineTo(x, base + Math.sin((x / 256) * Math.PI * 4 + phase) * 4);
      context.stroke();
    }
  } else if (surface === "gravel") {
    // 小石を重ねてまく。少し影を付けて粒を立たせる
    for (let i = 0; i < 1100; i += 1) {
      const rx = 1.8 + random() * 2.6, ry = rx * (0.6 + random() * 0.35), angle = random() * Math.PI, tone = shade(0.28);
      wrapped(random() * 256, random() * 256, rx + 1, (x, y) => {
        context.fillStyle = "rgba(0,0,0,0.18)";
        context.beginPath();
        context.ellipse(x + 0.7, y + 0.8, rx, ry, angle, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = color;
        context.beginPath();
        context.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = tone;
        context.fill();
      });
    }
  } else if (surface === "snow") {
    blotches(40, 44, "rgba(255,255,255,0.35)", "rgba(170,190,215,0.05)");
    for (let i = 0; i < 500; i += 1) {
      context.fillStyle = i % 4 ? "rgba(255,255,255,0.9)" : "rgba(170,190,220,0.35)";
      context.fillRect(random() * 256, random() * 256, 1, 1);
    }
  } else if (surface === "water") {
    blotches(30, 50, "rgba(255,255,255,0.06)", "rgba(0,30,70,0.07)");
    // さざ波: 短い弧を散らす（明るい筋と暗い筋）
    for (let i = 0; i < 140; i += 1) {
      const length = 10 + random() * 22, light = i % 3 !== 0;
      wrapped(random() * 256, random() * 256, length, (x, y) => {
        context.strokeStyle = light ? "rgba(255,255,255,0.32)" : "rgba(0,35,80,0.18)";
        context.lineWidth = light ? 1.1 : 1.4;
        context.beginPath();
        context.moveTo(x - length / 2, y);
        context.quadraticCurveTo(x, y - 3, x + length / 2, y);
        context.stroke();
      });
    }
  }

  if (canvasCache.size >= 48) canvasCache.delete(canvasCache.keys().next().value!);
  canvasCache.set(key, canvas);
  return canvas;
}
