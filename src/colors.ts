// カラーコードの読み取り。#RGB / #RGBA / #RRGGBB / #RRGGBBAA（# は省略可）に対応し、
// 末尾の桁を透明度として扱う（00 で透明、FF で不透明）。2D・3D・保存データで共通に使う

export interface ParsedColor {
  // 保存用の形。不透明なら #rrggbb、透明度があれば #rrggbbaa（小文字）
  code: string;
  // 透明度を除いた色 #rrggbb
  rgb: string;
  // 不透明度 0〜1
  alpha: number;
}

export function parseColorCode(value: unknown): ParsedColor | null {
  if (typeof value !== "string") return null;
  const match = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (!match) return null;
  let digits = match[1].toLowerCase();
  if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join("");
  const rgb = `#${digits.slice(0, 6)}`;
  const alpha = digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1;
  return { code: alpha < 1 ? `#${digits}` : rgb, rgb, alpha };
}

// 色と不透明度から、保存用のカラーコードを作る
export function withAlpha(rgb: string, alpha: number): string {
  const base = parseColorCode(rgb)?.rgb ?? "#000000";
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return value >= 255 ? base : `${base}${value.toString(16).padStart(2, "0")}`;
}
