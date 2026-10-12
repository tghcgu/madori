import { ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, type Material } from "three";

export const ROOF_LABELS = { gable: "切妻", hip: "寄棟", flat: "陸屋根", cone: "円すい", dome: "ドーム", polygon: "正多角形" } as const;
export type RoofKind = keyof typeof ROOF_LABELS;
export interface RoofShape {
  kind: RoofKind;
  x: number;
  y: number;
  w: number;
  h: number;
  sides?: number;
  rotation?: number;
  rise?: number;
}

export function isRoofKind(value: unknown): value is RoofKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ROOF_LABELS, value);
}

export function isRadialRoof(kind: RoofKind): boolean {
  return kind === "cone" || kind === "dome" || kind === "polygon";
}

export function roofSides(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(3, Math.min(12, Math.round(value))) : 6;
}

export function roofRise(roof: RoofShape): number {
  return typeof roof.rise === "number" && Number.isFinite(roof.rise) ? Math.max(10, Math.min(2000, roof.rise)) : Math.min(roof.w, roof.h) * (roof.kind === "cone" ? 0.45 : 0.35);
}

// 正多角形は外接円の直径で管理し、縦横を別々に伸ばして辺の長さが崩れないようにする。
export function regularRoofSize(roof: Pick<RoofShape, "x" | "y" | "w" | "h">, diameter = Math.max(roof.w, roof.h)) {
  return { x: roof.x + (roof.w - diameter) / 2, y: roof.y + (roof.h - diameter) / 2, w: diameter, h: diameter };
}

function radialLayout(roof: RoofShape) {
  const round = roof.kind !== "polygon";
  return {
    rx: (round ? roof.w : Math.min(roof.w, roof.h)) / 2,
    ry: (round ? roof.h : Math.min(roof.w, roof.h)) / 2,
    segments: round ? 64 : roofSides(roof.sides),
    angle: round ? 0 : (Number.isFinite(roof.rotation) ? roof.rotation! : 0) * Math.PI / 180,
  };
}

export function roofOutline(roof: RoofShape): [number, number][] {
  if (!isRadialRoof(roof.kind)) return [[roof.x, roof.y], [roof.x + roof.w, roof.y], [roof.x + roof.w, roof.y + roof.h], [roof.x, roof.y + roof.h]];
  const { rx, ry, segments, angle } = radialLayout(roof), cx = roof.x + roof.w / 2, cy = roof.y + roof.h / 2;
  return Array.from({ length: segments }, (_, i) => {
    const a = angle + i * Math.PI * 2 / segments;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

// 2Dと同じ分割数・角度・半径をThree.jsの標準形状にも使う。単位は間取りと同じcm。
export function radialRoofModel(roof: RoofShape, material: Material): Group {
  const { rx, ry, segments, angle } = radialLayout(roof);
  const geometry = roof.kind === "dome"
    ? new SphereGeometry(1, segments, 24, 0, Math.PI * 2, 0, Math.PI / 2)
    : new ConeGeometry(1, 1, segments, 1).translate(0, 0.5, 0);
  // 球はx=-cos(theta)、円すいはx=sin(theta)。頂点の位置を2Dのcos/sinにそろえる。
  if (roof.kind !== "dome") geometry.rotateY(Math.PI / 2 - angle);
  geometry.scale(rx, roofRise(roof), ry);
  const surface = roof.kind === "polygon" ? geometry.toNonIndexed() : geometry;
  if (surface !== geometry) { geometry.dispose(); surface.computeVertexNormals(); }
  const mesh = new Mesh(surface, material);
  mesh.position.y = 8;
  const rimGeometry = new CylinderGeometry(1, 1, 8, segments).rotateY(Math.PI / 2 - angle).scale(rx, 1, ry);
  const rim = new Mesh(rimGeometry, material);
  rim.position.y = 4;
  const group = new Group();
  group.add(mesh, rim);
  group.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; } });
  return group;
}
