export type WritingMode = "horizontal" | "vertical";
export interface TextRun { text: string; x: number; y: number; rotate?: boolean }
export interface TextLayout { w: number; h: number; runs: TextRun[] }
const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
export const TEXT_LINE_SPACING = 1.25;

// 描画・選択・書き出しで同じ寸法を使う。縦書きの改行は右から左へ列を増やす。
export function layoutText(text: string, size: number, mode: WritingMode, measure: (text: string) => number): TextLayout {
  const lines = text.replace(/\r\n?/g, "\n").split("\n"), step = size * TEXT_LINE_SPACING;
  if (mode === "horizontal") {
    const w = Math.max(size * 0.6, ...lines.map(measure)), h = lines.length * step;
    return { w, h, runs: lines.map((text, i) => ({ text, x: w / 2, y: (i + 0.5) * step })) };
  }
  const columns = lines.map(line => Array.from(segmenter.segment(line), part => part.segment));
  const w = columns.length * step, h = Math.max(1, ...columns.map(column => column.length)) * size;
  const runs: TextRun[] = [];
  columns.forEach((column, c) => column.forEach((text, r) => {
    let x = w - (c + 0.5) * step, y = (r + 0.5) * size;
    if (/[、。，．]/u.test(text)) { x += size * 0.55; y -= size * 0.55; }
    const rotate = /^[ー―－…‥「」『』（）()［］\[\]｛｝{}〈〉《》【】]$/u.test(text);
    runs.push({ text, x, y, rotate });
  }));
  return { w, h, runs };
}
