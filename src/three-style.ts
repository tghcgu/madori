// 3Dの絵柄。標準とリアル以外は、3Dを描いたあとに画面全体へ効果をかけて描き直す（色・法線・奥行きから、線・陰・紙の質感などを作る）。
// リアルは、光（トーンマッピングと周りの映り込み）と、家具・設備の材質（木目・布目・金属の筋・石の粒など）を本物らしくする。
// ここは three.js を読み込まない（テストが Node でそのまま読む）。シェーダーの文字列と、材質の分け方だけを持つ

export type ThreeStyle =
  | "standard" | "real" | "model" | "line" | "mono" | "sepia"
  | "pencil" | "watercolor" | "sumie"
  | "anime" | "manga" | "pixel" | "retro"
  | "blueprint" | "neon" | "horror";

export const THREE_STYLES: { value: ThreeStyle; label: string; hint: string; group: string }[] = [
  { value: "standard", label: "標準", hint: "ふつうの3D", group: "写真・模型" },
  { value: "real", label: "リアル", hint: "本物らしい光と材質", group: "写真・模型" },
  { value: "model", label: "白模型", hint: "白い建築模型", group: "写真・模型" },
  { value: "line", label: "線画", hint: "白地に黒い線（下描き・トレース用）", group: "写真・模型" },
  { value: "mono", label: "モノクロ", hint: "白黒の写真", group: "写真・模型" },
  { value: "sepia", label: "古写真", hint: "セピア色の古い写真", group: "写真・模型" },
  { value: "pencil", label: "鉛筆", hint: "鉛筆の線と斜線の陰", group: "手描き" },
  { value: "watercolor", label: "水彩", hint: "にじむ絵の具と紙", group: "手描き" },
  { value: "sumie", label: "墨絵", hint: "和紙に墨の濃淡", group: "手描き" },
  { value: "anime", label: "アニメ", hint: "くっきりした影と輪郭線", group: "マンガ・ゲーム" },
  { value: "manga", label: "マンガ", hint: "白黒とトーン", group: "マンガ・ゲーム" },
  { value: "pixel", label: "ドット", hint: "ドット絵", group: "マンガ・ゲーム" },
  { value: "retro", label: "レトロゲーム", hint: "緑の4色のドット", group: "マンガ・ゲーム" },
  { value: "blueprint", label: "設計図", hint: "青地に白い線", group: "図面・夜" },
  { value: "neon", label: "ネオン", hint: "夜に光る線", group: "図面・夜" },
  { value: "horror", label: "ホラー", hint: "暗がりと血の色", group: "図面・夜" },
];

export const THREE_STYLE_GROUPS = [...new Set(THREE_STYLES.map((style) => style.group))];

export function isThreeStyle(value: unknown): value is ThreeStyle {
  return THREE_STYLES.some((style) => style.value === value);
}

// 画面全体に効果をかける絵柄（標準とリアルは、ふつうに描くだけ）
export function isPostStyle(style: ThreeStyle): boolean {
  return style !== "standard" && style !== "real";
}

// シェーダーの中で絵柄を見分ける番号
export function postStyleId(style: ThreeStyle): number {
  return THREE_STYLES.findIndex((item) => item.value === style);
}

const id = (style: ThreeStyle) => postStyleId(style).toFixed(0);

export const POST_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// tColor: ふつうに描いた色（白模型では白い材質で描いたもの）。tNormal・tDepth: 物の向き（画面から見た法線）と奥行き。
// 色は sRGB に直してから効果をかけ、そのまま画面に出す
export const POST_FRAGMENT_SHADER = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float pixelRatio;
uniform float focusDistance;
uniform int styleId;
varying vec2 vUv;

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

float rawDepth(vec2 uv) { return texture2D(tDepth, uv).x; }
bool isSky(vec2 uv) { return rawDepth(uv) >= 0.99999; }
// 奥行きの逆数（何もない所は0）。平らな面では画面の上で直線的に変わるので、2回差を取ると0になる
float invDepth(vec2 uv) {
  float d = rawDepth(uv);
  return d >= 0.99999 ? 0.0 : -1.0 / perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}
float viewDistance(vec2 uv) {
  float d = rawDepth(uv);
  return d >= 0.99999 ? cameraFar : -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}
vec3 normalAt(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

// 輪郭線の強さ（0〜1）。width は線を探す幅（画面の画素）
float edgeAt(vec2 uv, float width) {
  vec2 dx = vec2(width / resolution.x, 0.0), dy = vec2(0.0, width / resolution.y);
  float c = invDepth(uv);
  float l = invDepth(uv - dx), r = invDepth(uv + dx), t = invDepth(uv + dy), b = invDepth(uv - dy);
  float most = max(max(max(c, l), max(r, t)), b);
  if (most <= 0.0) return 0.0;
  float least = min(min(min(c, l), min(r, t)), b);
  if (least <= 0.0) return 1.0;
  float bend = (abs(l + r - 2.0 * c) + abs(t + b - 2.0 * c)) / c;
  vec3 n = normalAt(uv);
  float turn = max(
    max(1.0 - dot(n, normalAt(uv - dx)), 1.0 - dot(n, normalAt(uv + dx))),
    max(1.0 - dot(n, normalAt(uv + dy)), 1.0 - dot(n, normalAt(uv - dy))));
  return max(smoothstep(0.02, 0.07, bend), smoothstep(0.25, 0.5, turn));
}

// 方眼の線（size 画素ごと）
float gridLine(vec2 p, float size) {
  vec2 f = fract(p / size);
  vec2 d = min(f, 1.0 - f) * size;
  return 1.0 - smoothstep(0.0, 1.0, min(d.x, d.y));
}
// 斜線（dir の向きに並ぶ、spacing 画素ごとの線）
float hatch(vec2 p, vec2 dir, float spacing, float thickness) {
  float d = abs(fract(dot(p, dir) / spacing) - 0.5) * spacing;
  return 1.0 - smoothstep(thickness * 0.5, thickness * 0.5 + 0.9, d);
}
// 2×2 の並びのディザ（-0.375〜0.375）
float bayer2(vec2 cell) {
  vec2 b = mod(cell, 2.0);
  return mix(mix(0.0, 2.0, b.x), mix(3.0, 1.0, b.x), b.y) / 4.0 - 0.375;
}

void main() {
  vec2 uv = vUv;
  // 模様は CSS の画素で数える（高精細な画面でも同じ細かさ）
  vec2 px = uv * resolution / pixelRatio;
  float lw = pixelRatio;
  vec3 col = vec3(1.0);

  if (styleId == ${id("model")}) {
    vec3 c = toSrgb(texture2D(tColor, uv).rgb);
    vec3 bg = mix(vec3(0.84, 0.83, 0.81), vec3(0.95, 0.945, 0.93), uv.y);
    col = isSky(uv) ? bg : mix(c, c * 0.42, edgeAt(uv, lw));
  } else if (styleId == ${id("line")}) {
    vec3 c = toSrgb(texture2D(tColor, uv).rgb);
    float shade = 0.9 + 0.1 * smoothstep(0.12, 0.85, luma(c));
    col = isSky(uv) ? vec3(1.0) : vec3(shade);
    col = mix(col, vec3(0.07), edgeAt(uv, lw * 1.2));
  } else if (styleId == ${id("mono")}) {
    // モノクロ: 明るさだけを残した白黒（空は白）
    vec3 c = toSrgb(texture2D(tColor, uv).rgb);
    col = isSky(uv) ? vec3(0.97) : vec3(luma(c));
  } else if (styleId == ${id("sepia")}) {
    vec3 c = toSrgb(texture2D(tColor, uv).rgb);
    float l = luma(c);
    col = mix(vec3(0.14, 0.1, 0.07), vec3(0.97, 0.9, 0.75), smoothstep(0.02, 0.98, l));
    col = mix(col, vec3(0.84, 0.77, 0.63), 0.14);
    col *= 0.93 + 0.14 * hash(floor(px));
    // 細い傷
    col *= 1.0 - 0.12 * smoothstep(0.985, 1.0, noise(vec2(px.x * 0.6, px.y * 0.004)));
    vec2 v = uv - 0.5;
    col *= 1.0 - 1.1 * dot(v, v);
  } else if (styleId == ${id("pencil")}) {
    vec3 paper = vec3(0.985, 0.98, 0.965) - 0.05 * fbm(px * 0.35);
    vec2 wobble = (vec2(noise(px * 0.05), noise(px * 0.05 + 7.0)) - 0.5) * 3.0;
    vec3 c = toSrgb(texture2D(tColor, uv).rgb);
    float tone = isSky(uv) ? 0.0 : 1.0 - luma(c);
    vec2 hp = px + wobble;
    float h = hatch(hp, vec2(0.7071, 0.7071), 6.0, 1.0) * smoothstep(0.3, 0.5, tone);
    h = max(h, hatch(hp, vec2(0.7071, -0.7071), 6.0, 1.0) * smoothstep(0.5, 0.7, tone));
    h = max(h, hatch(hp, vec2(1.0, 0.0), 4.0, 1.0) * smoothstep(0.72, 0.9, tone));
    h *= 0.55 + 0.45 * noise(px * 0.9);
    float e = edgeAt(uv + wobble * 0.6 * pixelRatio / resolution, lw);
    col = paper * (1.0 - 0.1 * tone);
    col = mix(col, vec3(0.24, 0.24, 0.27), max(h * 0.55, e * 0.85 * (0.75 + 0.25 * noise(px * 0.7))));
  } else if (styleId == ${id("watercolor")}) {
    vec2 wob = (vec2(fbm(px * 0.03), fbm(px * 0.03 + 11.0)) - 0.5) * 6.0 * pixelRatio / resolution;
    vec3 paper = vec3(0.985, 0.97, 0.94) * (0.95 + 0.05 * fbm(px * 0.5));
    if (isSky(uv + wob)) {
      col = paper;
    } else {
      vec3 c = toSrgb(texture2D(tColor, uv + wob).rgb);
      vec3 pigment = mix(vec3(luma(c)), c, 0.88);
      pigment = 1.0 - (1.0 - pigment) * 0.78;
      pigment *= 0.93 + 0.12 * fbm(px * 0.15);
      float e = edgeAt(uv + wob, lw * 1.5);
      pigment = mix(pigment, pigment * pigment * 0.95, e * 0.65);
      col = pigment * paper;
    }
  } else if (styleId == ${id("sumie")}) {
    vec3 washi = vec3(0.96, 0.94, 0.88) * (0.96 + 0.04 * fbm(px * 0.4));
    washi -= 0.035 * smoothstep(0.62, 0.95, noise(px * vec2(0.02, 0.35)));
    vec3 c = toSrgb(texture2D(tColor, uv).rgb);
    float ink = isSky(uv) ? 0.0 : 1.0 - luma(c);
    float wash = smoothstep(0.12, 0.95, ink);
    wash = floor(wash * 3.0 + 0.5) / 3.0 * 0.6 + wash * 0.15;
    float bleed = 0.85 + 0.3 * fbm(px * 0.08);
    vec3 inkColor = vec3(0.07, 0.07, 0.09);
    col = mix(washi, inkColor, clamp(wash * bleed * 0.72, 0.0, 0.85));
    float e = edgeAt(uv, lw * (1.2 + 1.6 * noise(px * 0.04)));
    col = mix(col, inkColor, e * (0.7 + 0.3 * noise(px * 0.3)));
  } else if (styleId == ${id("anime")}) {
    if (isSky(uv)) {
      col = mix(vec3(0.88, 0.95, 1.0), vec3(0.52, 0.77, 0.96), uv.y);
    } else {
      vec3 c = toSrgb(texture2D(tColor, uv).rgb);
      float l = luma(c);
      float band = l < 0.22 ? 0.32 : l < 0.45 ? 0.58 : l < 0.72 ? 0.84 : 1.0;
      vec3 toon = clamp(c / max(l, 0.05) * band * 0.97, 0.0, 1.0);
      col = clamp(mix(vec3(luma(toon)), toon, 1.25), 0.0, 1.0);
    }
    col = mix(col, vec3(0.12, 0.1, 0.15), edgeAt(uv, lw * 1.5) * 0.9);
  } else if (styleId == ${id("manga")}) {
    vec3 c = toSrgb(texture2D(tColor, uv).rgb);
    float l = isSky(uv) ? 1.0 : luma(c);
    vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * px / 5.0;
    vec2 f = fract(q) - 0.5;
    float r = sqrt(clamp((1.0 - l - 0.2) / 0.55, 0.0, 1.0)) * 0.62;
    float dotv = 1.0 - smoothstep(r - 0.07, r + 0.07, length(f));
    col = vec3(1.0);
    if (l < 0.8) col = vec3(1.0 - dotv);
    if (l < 0.2) col = vec3(0.06);
    col = mix(col, vec3(0.0), edgeAt(uv, lw * 1.6));
  } else if (styleId == ${id("pixel")}) {
    float block = 4.0 * pixelRatio;
    vec2 cellIndex = floor(uv * resolution / block);
    vec2 cell = (cellIndex + 0.5) * block / resolution;
    vec3 c = toSrgb(texture2D(tColor, cell).rgb);
    c = isSky(cell) ? floor(c * 8.0 + 0.5) / 8.0 : floor(c * 4.0 + 0.5 + bayer2(cellIndex) * 0.7) / 4.0;
    col = mix(c, c * 0.25, edgeAt(cell, block));
  } else if (styleId == ${id("retro")}) {
    float block = 5.0 * pixelRatio;
    vec2 cellIndex = floor(uv * resolution / block);
    vec2 cell = (cellIndex + 0.5) * block / resolution;
    float l = isSky(cell) ? 0.92 : luma(toSrgb(texture2D(tColor, cell).rgb));
    l = mix(l, 0.0, edgeAt(cell, block));
    float level = floor(clamp(l + bayer2(cellIndex) * 0.25, 0.0, 0.999) * 4.0);
    col = level < 1.0 ? vec3(0.06, 0.22, 0.06) : level < 2.0 ? vec3(0.19, 0.38, 0.19) : level < 3.0 ? vec3(0.55, 0.67, 0.06) : vec3(0.61, 0.74, 0.06);
  } else if (styleId == ${id("blueprint")}) {
    vec3 paper = vec3(0.11, 0.3, 0.55);
    col = paper + 0.05 * gridLine(px, 24.0) + 0.04 * gridLine(px, 120.0);
    if (!isSky(uv)) col = paper * (1.05 + 0.2 * normalAt(uv).z) + vec3(0.02, 0.04, 0.06);
    col = mix(col, vec3(0.88, 0.94, 1.0), edgeAt(uv, lw) * 0.95);
  } else if (styleId == ${id("neon")}) {
    col = vec3(0.02, 0.025, 0.06) + vec3(0.0, 0.07, 0.12) * gridLine(px, 32.0);
    vec3 n = normalAt(uv);
    if (!isSky(uv)) col = vec3(0.03, 0.035, 0.08) + vec3(0.02, 0.0, 0.05) * n.z;
    float glow = edgeAt(uv, lw) * 0.9 + edgeAt(uv, lw * 3.0) * 0.35 + edgeAt(uv, lw * 6.0) * 0.15;
    vec3 tint = mix(vec3(0.0, 0.95, 1.0), vec3(1.0, 0.2, 0.85), smoothstep(-0.2, 0.7, n.y));
    col += tint * glow;
  } else if (styleId == ${id("horror")}) {
    vec3 c = toSrgb(texture2D(tColor, uv).rgb);
    float l = luma(c);
    if (isSky(uv)) {
      col = mix(vec3(0.02, 0.0, 0.0), vec3(0.12, 0.03, 0.03), uv.y);
    } else {
      col = pow(mix(vec3(l), c, 0.25), vec3(1.25)) * 0.88;
      col += vec3(0.22, 0.0, 0.0) * (1.0 - smoothstep(0.05, 0.4, l)) * 0.5;
      col = mix(col, vec3(0.07, 0.015, 0.015), smoothstep(focusDistance * 1.05, focusDistance * 2.6, viewDistance(uv)) * 0.85);
    }
    col = mix(col, vec3(0.02, 0.0, 0.0), edgeAt(uv, lw) * 0.6);
    col *= 0.9 + 0.2 * hash(floor(px));
    vec2 v = uv - 0.5;
    col *= 1.0 - 1.8 * dot(v, v);
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// ---- リアル: 家具・設備の材質 ----
// 材質の名前から、木・布・金属などに分ける。名前で分からない物は、色と光り方から決める
export type RealMaterialKind = "wood" | "lacquer" | "fabric" | "leather" | "metal" | "stone" | "ceramic" | "plastic" | "plant" | "paper" | "soil" | "water" | "glass" | "plaster";

const REAL_MATERIAL_RULES: [RealMaterialKind, RegExp][] = [
  ["glass", /glass|window|lens|bulb|globe/],
  ["plaster", /plaster|snow|surface-plain|ground/],
  ["ceramic", /marble|mosaic|checker|surface-tile/],
  ["water", /water|pond-ripple|ripple|aquatic/],
  ["lacquer", /lacquer|car-paint|piano/],
  ["plant", /leaf|leaves|foliage|needle|frond|grass|stem|flower|petal|moss|hedge|bamboo-leaf|plant/],
  ["wood", /wood|plank|deck|herringbone|bark|timber|bamboo|crib|cat-deck|coat-stand|door-panel|door-inset|fusuma-frame|shed-panel|shed-trim|doghouse|swing-frame|table-frame|bed-runner|tansu|torii|vermilion|barrel|crate|chest|coffin|throne/],
  ["fabric", /fabric|tatami|upholster|cushion|linen|futon|blanket|duvet|lampshade|cloth|curtain|sisal|carpet|rug|towel|mattress|pillow|bedding|sofa|tent|flag|zabuton/],
  ["leather", /leather|saddle/],
  ["metal", /metal|steel|chrome|brass|iron|hardware|pole|rail|frame-metal|dryer|mailbox|grave-metal|handle|faucet|tap|hinge|wire|cage|bike|bicycle|wheel-rim/],
  ["stone", /stone|granite|rock|grave|block|concrete|asphalt|slab|roof|coping|fireplace|firebox|brick|bed-border|ballast|statue|lantern-stone|komainu|torii-base|chozubachi|well/],
  ["ceramic", /ceramic|basin|porcelain|enamel|bath|toilet|sink|tile|pot|vase|cup|plate/],
  ["paper", /paper|shoji|lantern|chalk|label|book|board|sign/],
  ["soil", /soil|gravel|sand|dirt|earth|ash/],
  ["plastic", /plastic|bin|marker|gasket|status|vent|led|screen|keyboard|monitor|tire|rubber|mannequin|toy/],
];

// painted: 利用者が色を決めた材質。金属なら塗った金属（つやのある塗装）にする。金属の映り込みだけだと、選んだ色がほとんど見えない
export function realMaterialKind(name: string, color: number, roughness: number, metalness: number, transparent: boolean, painted = false): RealMaterialKind {
  const kind = materialKindByName(name, color, roughness, metalness, transparent);
  return painted && kind === "metal" ? "lacquer" : kind;
}

function materialKindByName(name: string, color: number, roughness: number, metalness: number, transparent: boolean): RealMaterialKind {
  const key = name.toLowerCase();
  if (transparent && /glass|window|water|surface/.test(key)) return /water|surface/.test(key) ? "water" : "glass";
  for (const [kind, pattern] of REAL_MATERIAL_RULES) if (pattern.test(key)) return kind;
  if (metalness >= 0.4) return "metal";
  if (roughness <= 0.3) return "ceramic";
  // 名前で分からない物: 茶色っぽい物は木、それ以外は少しざらついた樹脂
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  if (r > g && g > b && r - b > 40 && r < 230) return "wood";
  return "plastic";
}

// 材質ごとの番号（シェーダーの中で使う）
export const REAL_MATERIAL_IDS: Record<RealMaterialKind, number> = {
  wood: 1, lacquer: 2, fabric: 3, leather: 4, metal: 5, stone: 6, ceramic: 7, plastic: 8, plant: 9, paper: 10, soil: 11, water: 12, glass: 13, plaster: 14,
};

// 頂点シェーダーに足す: 物の中での位置と向き（木目などを物に貼り付けたように動かすため）
export const REAL_VERTEX_DECLARATIONS = /* glsl */ `
varying vec3 vRealObject;
varying vec3 vRealObjectNormal;
`;
export const REAL_VERTEX_BODY = /* glsl */ `
vRealObject = position;
vRealObjectNormal = normal;
`;

// フラグメントシェーダーに足す: 3Dの粒（ノイズ）と、細かすぎる模様を遠くで消す仕組み
export const REAL_FRAGMENT_DECLARATIONS = /* glsl */ `
varying vec3 vRealObject;
varying vec3 vRealObjectNormal;
float realHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float realNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(realHash(i), realHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(realHash(i + vec3(0.0, 1.0, 0.0)), realHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(realHash(i + vec3(0.0, 0.0, 1.0)), realHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(realHash(i + vec3(0.0, 1.0, 1.0)), realHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float realFbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * realNoise(p); p = p * 2.02 + 3.1; a *= 0.5; }
  return v;
}
// 模様の細かさ scale（1mあたり）が画素より細かくなったら0に近づける（遠くでちらつかない）
float realDetail(vec3 p, float scale) {
  float spread = length(fwidth(p)) * scale;
  return 1.0 - smoothstep(0.35, 1.0, spread);
}
`;

// 色に掛ける模様（diffuseColor を変える）。kind は REAL_MATERIAL_IDS の番号
export function realColorCode(kind: RealMaterialKind): string {
  switch (kind) {
    case "wood":
      // 木目: 物の横の軸のまわりの年輪。上や前の面では縦に流れる縞、端の面では年輪に見える。細い繊維の筋も足す
      return /* glsl */ `{
        vec3 p = vRealObject;
        float rings = length(p.yz) * 55.0 + realFbm(p * vec3(1.5, 7.0, 7.0)) * 5.0;
        float ring = fract(rings);
        float grain = smoothstep(0.0, 0.3, ring) * smoothstep(1.0, 0.55, ring);
        float fiber = realNoise(p * vec3(3.0, 140.0, 140.0)) * realDetail(p, 140.0);
        float patches = realFbm(p * 2.5);
        diffuseColor.rgb *= (0.8 + 0.16 * mix(0.5, grain, realDetail(p, 55.0)) + 0.07 * fiber) * (0.92 + 0.16 * patches);
      }`;
    case "fabric": {
      // 布目: 面の向きに合わせた細かい織り目と、けば
      return /* glsl */ `{
        vec3 p = vRealObject * 700.0;
        vec3 an = abs(vRealObjectNormal);
        vec2 q = an.x > an.y && an.x > an.z ? p.yz : an.y > an.z ? p.xz : p.xy;
        float weave = (0.5 + 0.5 * sin(q.x) * sin(q.y)) * realDetail(vRealObject, 700.0 / 6.283);
        float fuzz = realFbm(vRealObject * 40.0);
        diffuseColor.rgb *= 0.86 + 0.1 * weave + 0.12 * (fuzz - 0.5) + 0.04;
      }`;
    }
    case "leather":
      return /* glsl */ `{
        float wrinkle = realFbm(vRealObject * 90.0) * realDetail(vRealObject, 90.0);
        diffuseColor.rgb *= 0.88 + 0.18 * wrinkle;
      }`;
    case "metal":
      // ヘアライン（一方向の細い筋）
      return /* glsl */ `{
        float brush = realNoise(vRealObject * vec3(2.0, 380.0, 380.0)) * realDetail(vRealObject, 380.0);
        diffuseColor.rgb *= 0.93 + 0.09 * brush;
      }`;
    case "stone":
      return /* glsl */ `{
        float speck = (realNoise(vRealObject * 140.0) - 0.5) * realDetail(vRealObject, 140.0);
        float blot = realFbm(vRealObject * 5.0);
        diffuseColor.rgb *= 0.84 + 0.22 * blot + 0.16 * speck;
      }`;
    case "plant":
      return /* glsl */ `{
        float v = realFbm(vRealObject * 14.0);
        diffuseColor.rgb *= 0.78 + 0.38 * v;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.06, 0.7), 0.35 * smoothstep(0.55, 0.8, v));
      }`;
    case "paper":
      return /* glsl */ `{
        float fiber = realNoise(vRealObject * vec3(60.0, 600.0, 60.0)) * realDetail(vRealObject, 600.0);
        diffuseColor.rgb *= 0.95 + 0.07 * fiber;
      }`;
    case "soil":
      return /* glsl */ `{
        float grains = (realNoise(vRealObject * 220.0) - 0.5) * realDetail(vRealObject, 220.0);
        diffuseColor.rgb *= 0.82 + 0.25 * realFbm(vRealObject * 9.0) + 0.3 * grains;
      }`;
    case "plaster":
      return /* glsl */ `{
        diffuseColor.rgb *= 0.97 + 0.05 * realFbm(vRealObject * 7.0);
      }`;
    case "plastic":
      return /* glsl */ `{
        diffuseColor.rgb *= 0.97 + 0.04 * realFbm(vRealObject * 20.0);
      }`;
    default:
      return "";
  }
}

// 光り方（roughnessFactor・metalnessFactor を変える）
export function realSurfaceCode(kind: RealMaterialKind): string {
  switch (kind) {
    case "wood": return "roughnessFactor = clamp(roughnessFactor * 0.85 + 0.08 * realNoise(vRealObject * vec3(3.0, 90.0, 90.0)), 0.25, 1.0);";
    case "lacquer": return "roughnessFactor = min(roughnessFactor, 0.16);";
    case "fabric": return "roughnessFactor = max(roughnessFactor, 0.92);";
    case "leather": return "roughnessFactor = clamp(roughnessFactor * 0.7, 0.35, 0.7);";
    case "metal": return "roughnessFactor = clamp(roughnessFactor * 0.6 + 0.1 * realNoise(vRealObject * vec3(2.0, 380.0, 380.0)), 0.12, 0.6); metalnessFactor = max(metalnessFactor, 0.85);";
    case "stone": return "roughnessFactor = max(roughnessFactor, 0.78);";
    case "ceramic": return "roughnessFactor = min(roughnessFactor, 0.18);";
    case "plastic": return "roughnessFactor = clamp(roughnessFactor, 0.35, 0.75);";
    case "plant": return "roughnessFactor = clamp(roughnessFactor, 0.55, 0.8);";
    case "paper": return "roughnessFactor = max(roughnessFactor, 0.9);";
    case "soil": return "roughnessFactor = 1.0;";
    case "water": return "roughnessFactor = 0.04;";
    case "glass": return "roughnessFactor = 0.03;";
    case "plaster": return "roughnessFactor = max(roughnessFactor, 0.9);";
    default: return "";
  }
}

// ---- リアル: 物の間の暗がり（アンビエントオクルージョン）と仕上げ ----
// 奥行きと法線から、まわりの物にふさがれている割合を数える（半分の大きさの絵に描く）
export const AO_FRAGMENT_SHADER = /* glsl */ `
#include <packing>
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform vec2 projScale;
uniform float radius;
varying vec2 vUv;

vec3 viewPosition(vec2 uv) {
  float z = perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * -z / projScale.x, ndc.y * -z / projScale.y, z);
}

void main() {
  if (texture2D(tDepth, vUv).x >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 p = viewPosition(vUv);
  vec3 n = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
  // 調べる円の半径（画素）
  float spread = clamp(radius * projScale.y / -p.z * 0.5 * resolution.y, 3.0, 90.0);
  float angle = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float occlusion = 0.0;
  for (int i = 0; i < 14; i++) {
    float t = (float(i) + 0.5) / 14.0;
    float a = angle + float(i) * 2.3999632;
    vec2 suv = vUv + vec2(cos(a), sin(a)) * sqrt(t) * spread / resolution;
    if (texture2D(tDepth, suv).x >= 0.99999) continue;
    vec3 v = viewPosition(suv) - p;
    float distance = length(v);
    float facing = dot(n, v) / max(distance, 1e-4);
    occlusion += max(0.0, facing - 0.12) * (1.0 - smoothstep(radius * 0.4, radius, distance));
  }
  gl_FragColor = vec4(vec3(clamp(1.0 - occlusion / 14.0 * 1.9, 0.0, 1.0)), 1.0);
}
`;

// 色に暗がりを掛けてから、トーンマッピングと色空間の変換（three.js の仕組み）をして画面へ
export const REAL_COMPOSITE_FRAGMENT_SHADER = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tAo;
uniform sampler2D tDepth;
uniform vec2 aoTexel;
uniform float cameraNear;
uniform float cameraFar;
uniform float strength;
varying vec2 vUv;

float viewDepthAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }

void main() {
  vec4 color = texture2D(tColor, vUv);
  float center = viewDepthAt(vUv);
  // 奥行きの近い所だけで平均して、ざらつきをならす（物の縁ではにじませない）
  float sum = 0.0, weight = 0.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 uv = vUv + vec2(float(x), float(y)) * aoTexel;
      float w = 1.0 - smoothstep(0.0, 0.06, abs(viewDepthAt(uv) - center) / max(center, 1e-3));
      sum += texture2D(tAo, uv).r * w;
      weight += w;
    }
  }
  float ao = weight > 0.0 ? sum / weight : 1.0;
  gl_FragColor = vec4(color.rgb * mix(1.0, ao, strength), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
