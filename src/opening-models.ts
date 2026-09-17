import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export interface OpeningModelOptions {
  type: "door" | "window";
  length: number;
  floorTop?: number;
  doorStyle?: "swing" | "sliding";
  mullion?: boolean;
  flip?: boolean;
  color?: string;
  color3d?: string;
}

export function buildOpeningModel(item: OpeningModelOptions): THREE.Group {
  if (!Number.isFinite(item.length) || item.length <= 0) throw new Error("Invalid opening length");
  const group = new THREE.Group();
  group.name = item.type === "window" ? "window" : item.doorStyle === "sliding" ? "sliding-door" : "closed-door";
  const w = item.length;
  const custom = item.color3d ?? item.color;
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
  } else {
    const bottom = item.floorTop ?? 0.08, top = 2.1;
    const edge = Math.min(w * 0.09, 0.055), depth = item.doorStyle === "sliding" ? 0.14 : 0.12;
    const height = top - bottom, panelHeight = height - edge - 0.014;
    const wood = material("door-panel", custom ?? 0xac8664, 0.68);
    const inset = material("door-inset", new THREE.Color(custom ?? 0xac8664).multiplyScalar(0.92), 0.74);
    for (const sign of [-1, 1]) part("jamb", edge, height, depth, sign * w / 2, bottom + height / 2, 0, frame);
    part("header", w + edge, edge, depth, 0, top - edge / 2, 0, frame);
    if (item.doorStyle === "sliding") {
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
  return group;
}
