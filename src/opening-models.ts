import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
// テストでは Node がそのまま読むため、値を読み込むときは拡張子まで書く
import { parseColorCode } from "./colors.ts";
import { applyOpacity } from "./translucency.ts";
import { DOOR_COLORS, doorStyleInfo, doubleLeaves, gateSlats, isDoorStyle, panelBars, panelThickness, slidingPanels, trackOffset, type DoorStyle } from "./opening-shapes.ts";

export interface OpeningModelOptions {
  type: "door" | "window";
  length: number;
  floorTop?: number;
  doorStyle?: DoorStyle;
  mullion?: boolean;
  flip?: boolean;
  color?: string;
  color3d?: string;
}

export function buildOpeningModel(item: OpeningModelOptions): THREE.Group {
  if (!Number.isFinite(item.length) || item.length <= 0) throw new Error("Invalid opening length");
  const group = new THREE.Group();
  const style: DoorStyle = isDoorStyle(item.doorStyle) ? item.doorStyle : "swing";
  group.name = item.type === "window" ? "window" : style === "sliding" ? "sliding-door" : style === "swing" ? "closed-door" : `${style}-door`;
  const w = item.length;
  // カラーコードの末尾に透明度があれば、ドア・窓をまるごと半透明にする
  const parsed = parseColorCode(item.color3d ?? item.color);
  const custom = parsed?.rgb ?? item.color3d ?? item.color;
  const material = (name: string, color: THREE.ColorRepresentation, roughness: number, metalness = 0) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    result.name = name;
    return result;
  };
  const frame = material("frame", item.type === "window" && custom ? custom : 0xdde1df, 0.5, 0.15);
  const metal = material("hardware", 0xb7c1c6, 0.25, 0.5);
  const part = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, mat: THREE.MeshStandardMaterial, radius = 0.004) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 1, Math.min(radius, width / 3, height / 3, depth / 3)), mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = !mat.transparent;
    mesh.receiveShadow = !mat.transparent;
    group.add(mesh);
    return mesh;
  };

  if (item.type === "window") {
    const bottom = 0.84, top = 1.96, height = top - bottom, y = (top + bottom) / 2;
    const edge = Math.min(0.045, w * 0.12), depth = 0.12;
    const rubber = material("gasket", 0x65747a, 0.85);
    const glass = material("glass", 0xb8d7df, 0.1, 0.08);
    glass.transparent = true; glass.opacity = 0.25; glass.depthWrite = false;
    for (const sign of [-1, 1]) {
      part("jamb", edge, height, depth, sign * w / 2, y, 0, frame);
      part("rail", w + edge, edge, depth, 0, sign > 0 ? top - edge / 2 : bottom + edge / 2, 0, frame);
    }
    part("sill", w + edge * 2, 0.025, 0.19, 0, bottom - 0.0125, 0.03, frame);
    const count = item.mullion ? 2 : 1;
    const innerW = w - edge, paneW = innerW / count;
    for (let i = 0; i < count; i += 1) {
      const x = -innerW / 2 + paneW * (i + 0.5), z = count === 1 ? 0 : (i ? 0.018 : -0.018);
      const thin = edge * 0.48;
      part("glass", paneW - thin * 2, height - edge * 2 - thin * 2, 0.006, x, y, z, glass, 0.001);
      for (const sign of [-1, 1]) {
        part("sash", thin, height - edge * 2, 0.028, x + sign * (paneW - thin) / 2, y, z, frame);
        part("gasket", paneW - thin * 2, 0.004, 0.009, x, y + sign * (height / 2 - edge - thin), z, rubber, 0.001);
      }
      const handleX = count === 1 ? w * 0.42 : x + (i ? -1 : 1) * paneW * 0.42;
      part("handle-base", Math.min(w * 0.03, 0.018), 0.1, 0.014, handleX, y - 0.12, z + 0.038, metal);
      part("handle", Math.min(w * 0.025, 0.015), 0.075, 0.014, handleX, y - 0.1, z + 0.052, metal);
    }
  } else if (style !== "swing" && style !== "sliding") {
    buildStyledDoor(style);
  } else {
    const bottom = item.floorTop ?? 0.08, top = 2.1;
    const edge = Math.min(w * 0.09, 0.055), depth = style === "sliding" ? 0.14 : 0.12;
    const height = top - bottom, panelHeight = height - edge - 0.014;
    const wood = material("door-panel", custom ?? 0xac8664, 0.68);
    const inset = material("door-inset", new THREE.Color(custom ?? 0xac8664).multiplyScalar(0.92), 0.74);
    for (const sign of [-1, 1]) part("jamb", edge, height, depth, sign * w / 2, bottom + height / 2, 0, frame);
    part("header", w + edge, edge, depth, 0, top - edge / 2, 0, frame);
    if (style === "sliding") {
      for (const sign of [-1, 1]) part("track", w, 0.009, 0.013, 0, bottom + 0.0045, sign * 0.033, metal);
      const clear = w - edge, paneW = clear / 2 + Math.min(0.025, w * 0.04);
      for (const sign of [-1, 1]) {
        const x = sign * clear / 4, z = sign * (item.flip ? -1 : 1) * 0.033;
        part("sliding-panel", paneW, panelHeight, 0.042, x, bottom + panelHeight / 2 + 0.01, z, wood);
        for (const side of [-1, 1]) {
          part("panel-detail", paneW * 0.77, panelHeight * 0.77, 0.005, x, bottom + panelHeight * 0.51, z + side * 0.024, inset);
          part("recessed-pull", Math.min(w * 0.025, 0.025), 0.14, 0.006, sign * clear * 0.075, bottom + 0.95, z + side * 0.027, metal);
        }
      }
    } else {
      const paneW = w - edge - 0.008, z = 0;
      part("door-panel", paneW, panelHeight, 0.045, 0, bottom + panelHeight / 2 + 0.01, z, wood);
      for (const side of [-1, 1]) {
        for (const [relativeY, relativeHeight] of [[0.27, 0.32], [0.72, 0.41]]) part("panel-detail", paneW * 0.74, panelHeight * relativeHeight, 0.005, 0, bottom + panelHeight * relativeY, side * 0.025, inset);
        const x = paneW * 0.37;
        part("handle-plate", Math.min(w * 0.055, 0.045), 0.13, 0.009, x, bottom + 0.96, side * 0.031, metal);
        part("handle-stem", 0.013, 0.013, 0.04, x, bottom + 0.98, side * 0.053, metal);
        const leverW = Math.min(w * 0.15, 0.115);
        part("handle-lever", leverW, 0.019, 0.019, x - leverW * 0.4, bottom + 0.98, side * 0.073, metal, 0.006);
      }
      for (const y of [0.2, 0.95, 1.73]) part("hinge", 0.014, 0.075, 0.018, -w / 2 + edge * 0.48, bottom + y, item.flip ? -0.032 : 0.032, metal);
    }
  }
  applyOpacity(group, parsed?.alpha ?? 1);
  return group;

  // 両開きドア・門扉と、和風の引き戸（障子・襖・格子戸・板戸）。板の並びと桟の位置は opening-shapes.ts と同じ（2Dの記号と同じ）
  function buildStyledDoor(kind: Exclude<DoorStyle, "swing" | "sliding">): void {
    const info = doorStyleInfo(kind);
    const bottom = item.floorTop ?? 0.08, top = 2.1;
    const edge = Math.min(w * 0.09, info.japanese ? 0.045 : 0.055), depth = info.sliding ? 0.12 : 0.12;
    const height = top - bottom, panelHeight = height - edge - 0.014;
    const color = custom ?? DOOR_COLORS[kind];
    const wood = material("door-panel", color, kind === "fusuma" ? 0.9 : 0.68);
    const inset = material("door-inset", new THREE.Color(color).multiplyScalar(0.82), 0.74);
    // 和風の戸は、木の柱と鴨居・敷居
    const frameMaterial = info.japanese ? material("frame", 0xbf9a6a, 0.62) : frame;
    for (const sign of [-1, 1]) part("jamb", edge, height, depth, sign * w / 2, bottom + height / 2, 0, frameMaterial);
    part("header", w + edge, edge, depth, 0, top - edge / 2, 0, frameMaterial);
    const flip = item.flip ? -1 : 1;

    if (!info.sliding) {
      // 両開き: 2枚の扉を閉じた形で置く。つりもとは両端、取っ手（門扉は掛け金）は真ん中の近く
      const leafW = (w - edge) / 2 - 0.004;
      for (const leaf of doubleLeaves()) {
        const x = -leaf.hinge * leafW / 2;
        if (kind === "gate") {
          // 門扉: 縦の板を間をあけて並べ、上下の横木と、縦の框でとめる
          const gateH = Math.min(panelHeight, 1.75);
          const rail = Math.min(0.07, gateH * 0.06);
          for (const y of [bottom + 0.08 + rail / 2, bottom + gateH - rail / 2]) part("gate-rail", leafW, rail, 0.045, x, y, 0, wood);
          for (const side of [-1, 1]) part("gate-stile", 0.05, gateH - 0.08, 0.05, x + side * (leafW / 2 - 0.025), bottom + 0.08 + (gateH - 0.08) / 2, 0, wood);
          const slats = gateSlats(leafW * 100);
          for (const position of slats.positions) part("gate-slat", leafW * slats.width, gateH - 0.08 - rail * 2, 0.03, x + position * leafW, bottom + 0.08 + (gateH - 0.08) / 2, 0, inset);
          for (const y of [0.35, 1.45].filter((value) => value < gateH)) part("hinge", 0.014, 0.075, 0.06, x - leaf.hinge * (leafW / 2 - 0.007), bottom + y, 0, metal);
          part("gate-latch", 0.09, 0.03, 0.07, x + leaf.hinge * (leafW / 2 - 0.05), bottom + 1.0, 0, metal);
        } else {
          part("door-panel", leafW, panelHeight, 0.045, x, bottom + panelHeight / 2 + 0.01, 0, wood);
          for (const side of [-1, 1]) {
            for (const [relativeY, relativeHeight] of [[0.27, 0.32], [0.72, 0.41]]) part("panel-detail", leafW * 0.7, panelHeight * relativeHeight, 0.005, x, bottom + panelHeight * relativeY, side * 0.025, inset);
            const hx = x + leaf.hinge * leafW * 0.38;
            part("handle-plate", Math.min(leafW * 0.08, 0.04), 0.13, 0.009, hx, bottom + 0.96, side * 0.031, metal);
            part("handle-stem", 0.013, 0.013, 0.04, hx, bottom + 0.98, side * 0.053, metal);
          }
          for (const y of [0.2, 0.95, 1.73]) part("hinge", 0.014, 0.075, 0.018, x - leaf.hinge * (leafW / 2 - 0.007), bottom + y, flip * 0.032, metal);
        }
      }
      return;
    }

    // 引き戸: 敷居の上に、板の並びのとおりに戸を立てる
    part("sill", w, 0.012, depth * 0.9, 0, bottom + 0.006, 0, frameMaterial);
    const clear = w - edge, thickness = panelThickness(kind) / 100, offset = trackOffset(kind) / 100;
    const paper = material("shoji-paper", 0xf8f4e8, 0.95);
    const lacquer = material("fusuma-frame", 0x2b231d, 0.45);
    const pull = material("fusuma-pull", 0x4a3f33, 0.4, 0.35);
    const glass = material("glass", 0xe6eef0, 0.3, 0.05);
    glass.transparent = true; glass.opacity = 0.55; glass.depthWrite = false;
    const panelBottom = bottom + 0.012;
    slidingPanels(kind, w * 100).forEach((panel) => {
      const pw = panel.width * clear, x = panel.center * clear, z = panel.track * flip * offset;
      const y = panelBottom + panelHeight / 2;
      // 引き手は、柱の側（重ならない側）の近く
      const pullX = x + (panel.center < 0 ? -1 : 1) * pw * 0.38;
      if (kind === "shoji") {
        // 障子: 腰板と、細い框・組子の格子に、和紙を張る
        const stile = Math.min(0.03, pw * 0.08), kneeH = Math.min(0.24, panelHeight * 0.14), railH = 0.03;
        for (const side of [-1, 1]) part("shoji-stile", stile, panelHeight, thickness, x + side * (pw - stile) / 2, y, z, wood);
        part("shoji-rail", pw - stile * 2, railH, thickness, x, panelBottom + panelHeight - railH / 2, z, wood);
        part("shoji-knee", pw - stile * 2, kneeH, thickness * 0.8, x, panelBottom + kneeH / 2, z, wood);
        const paperBottom = panelBottom + kneeH, paperTop = panelBottom + panelHeight - railH;
        part("shoji-paper", pw - stile * 2, paperTop - paperBottom, 0.004, x, (paperBottom + paperTop) / 2, z, paper, 0.001);
        for (const position of panelBars(kind, pw * 100)) part("kumiko", 0.012, paperTop - paperBottom, thickness * 0.6, x + position * pw, (paperBottom + paperTop) / 2, z, wood, 0.002);
        for (let i = 1; i < 7; i += 1) part("kumiko", pw - stile * 2, 0.012, thickness * 0.6, x, paperBottom + ((paperTop - paperBottom) * i) / 7, z, wood, 0.002);
      } else if (kind === "fusuma") {
        // 襖: 紙を張った板に、黒い縁と引き手
        part("fusuma-panel", pw, panelHeight, thickness, x, y, z, wood, 0.002);
        const rim = Math.min(0.02, pw * 0.05);
        for (const side of [-1, 1]) part("fusuma-rim", rim, panelHeight, thickness + 0.004, x + side * (pw - rim) / 2, y, z, lacquer, 0.002);
        for (const side of [-1, 1]) part("fusuma-rim", pw, rim, thickness + 0.004, x, y + side * (panelHeight - rim) / 2, z, lacquer, 0.002);
        for (const side of [-1, 1]) part("fusuma-pull", 0.05, 0.065, 0.004, pullX, panelBottom + 0.8, z + side * (thickness / 2 + 0.002), pull, 0.01);
      } else if (kind === "koshi") {
        // 格子戸（玄関戸）: 框の中にすりガラス、その表に細かい縦格子。下は腰板
        const stile = Math.min(0.045, pw * 0.1), railH = 0.045, kneeH = Math.min(0.36, panelHeight * 0.2);
        for (const side of [-1, 1]) part("koshi-stile", stile, panelHeight, thickness, x + side * (pw - stile) / 2, y, z, wood);
        part("koshi-rail", pw - stile * 2, railH, thickness, x, panelBottom + panelHeight - railH / 2, z, wood);
        part("koshi-knee", pw - stile * 2, kneeH, thickness * 0.85, x, panelBottom + kneeH / 2, z, wood);
        const glassBottom = panelBottom + kneeH, glassTop = panelBottom + panelHeight - railH;
        part("glass", pw - stile * 2, glassTop - glassBottom, 0.005, x, (glassBottom + glassTop) / 2, z, glass, 0.001);
        for (const position of panelBars(kind, pw * 100)) part("koshi-bar", 0.014, glassTop - glassBottom, thickness * 0.55, x + position * pw, (glassBottom + glassTop) / 2, z, wood, 0.002);
        part("koshi-pull", 0.02, 0.18, 0.012, pullX, panelBottom + 0.95, z + thickness / 2 + 0.006, metal);
      } else {
        // 板戸: 縦の板を並べた戸に、裏の横桟と引き手
        part("itado-panel", pw, panelHeight, thickness, x, y, z, wood, 0.002);
        const boards = Math.max(2, Math.round(pw / 0.15));
        for (let i = 1; i < boards; i += 1) for (const side of [-1, 1]) part("itado-joint", 0.004, panelHeight * 0.98, 0.003, x - pw / 2 + (pw * i) / boards, y, z + side * (thickness / 2 + 0.001), inset, 0.0005);
        for (const level of [0.15, 0.5, 0.85]) part("itado-batten", pw * 0.92, 0.06, 0.012, x, panelBottom + panelHeight * level, z - panel.track * flip * (thickness / 2 + 0.006), inset);
        part("itado-pull", 0.035, 0.11, 0.006, pullX, panelBottom + 0.95, z + panel.track * flip * (thickness / 2 + 0.003), inset, 0.004);
      }
    });
  }
}
