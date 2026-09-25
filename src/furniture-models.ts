import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
// テストでは Node がそのまま読むため、値を読み込むときは拡張子まで書く
import { FURNITURE_DEFS, type FurnitureKind } from "./furniture-catalog.ts";

type Position = [number, number, number];
type Material = THREE.MeshStandardMaterial;
export interface FurnitureModelOptions {
  kind: FurnitureKind;
  w: number;
  h: number;
  color?: string;
  color3d?: string;
  rise?: number;
  // 高さを変えられる種類（木・フェンスなど）の高さ cm。省略時は種類ごとの標準
  height?: number;
}

const clamp = THREE.MathUtils.clamp;

// Materials are shared within one model, not across disposable scene rebuilds.
class Model {
  readonly group = new THREE.Group();
  private readonly materials = new Map<string, Material>();
  private readonly tint: string | undefined;

  constructor(tint?: string) { this.tint = tint; }

  material(name: string, color: number, roughness = 0.7, metalness = 0, tintable = false): Material {
    let material = this.materials.get(name);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: tintable && this.tint ? this.tint : color, roughness, metalness });
      material.name = name;
      material.userData.tintable = tintable;
      this.materials.set(name, material);
    }
    return material;
  }

  glass(name: string, color = 0xc0dde4, opacity = 0.2): Material {
    const material = this.material(name, color, 0.12, 0.05);
    material.transparent = true;
    material.opacity = opacity;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;
    return material;
  }

  mesh(geometry: THREE.BufferGeometry, position: Position, material: Material, name = material.name): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = !material.transparent;
    this.group.add(mesh);
    return mesh;
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, material: Material, radius = 0.008): THREE.Mesh {
    const geometry = radius > 0
      ? new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 3, h / 3, d / 3))
      : new THREE.BoxGeometry(w, h, d);
    return this.mesh(geometry, [x, y, z], material);
  }

  cylinder(top: number, bottom: number, height: number, position: Position, material: Material, segments = 24): THREE.Mesh {
    return this.mesh(new THREE.CylinderGeometry(top, bottom, height, segments), position, material);
  }

  ellipsoid(w: number, h: number, d: number, position: Position, material: Material): THREE.Mesh {
    const mesh = this.mesh(new THREE.SphereGeometry(0.5, 16, 10), position, material);
    mesh.scale.set(w, h, d);
    return mesh;
  }

  rod(from: Position, to: Position, radius: number, material: Material, name = material.name): THREE.Mesh {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const mesh = this.cylinder(radius, radius, direction.length(), a.add(b).multiplyScalar(0.5).toArray() as Position, material, 10);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.name = name;
    return mesh;
  }

  ring(radius: number, tube: number, position: Position, material: Material): THREE.Mesh {
    return this.mesh(new THREE.TorusGeometry(radius, tube, 8, 40), position, material);
  }

  vessel(profile: [number, number][], w: number, d: number, position: Position, material: Material): THREE.Mesh {
    const mesh = this.mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 40), position, material);
    mesh.scale.set(w, 1, d);
    return mesh;
  }

  finish(w: number, d: number, mounted: boolean, optimize: boolean): THREE.Group {
    this.group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.group, true);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    for (const object of this.group.children) {
      object.position.x -= center.x;
      object.position.z -= center.z;
      if (!mounted) object.position.y -= bounds.min.y;
    }
    this.group.scale.set(w / size.x, 1, d / size.z);
    if (optimize) this.mergeOpaqueParts();
    return this.group;
  }

  private mergeOpaqueParts(): void {
    const batches = new Map<Material, THREE.BufferGeometry[]>();
    for (const object of [...this.group.children]) {
      const mesh = object as THREE.Mesh<THREE.BufferGeometry, Material>;
      if (mesh.material.transparent) continue;
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      const batch = batches.get(mesh.material) ?? [];
      batch.push(geometry);
      batches.set(mesh.material, batch);
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      if (!merged) throw new Error("Cannot merge furniture geometry");
      this.mesh(merged, [0, 0, 0], material);
      geometries.forEach(geometry => geometry.dispose());
    }
  }
}

// 頂点を少しずつ押し引きした多面体（岩や石）。同じ位置の頂点は同じだけ動かし、面の間にすき間を作らない
function rockGeometry(seed: number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(0.5, 1);
  const positions = geometry.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    v.fromBufferAttribute(positions, i);
    const noise = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719 + seed) * 43758.5453;
    v.multiplyScalar(0.8 + (noise - Math.floor(noise)) * 0.32);
    v.y = Math.max(v.y, -0.22);
    positions.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

// 岩を、底が床に着き、いちばん高い所が height になるように置く
function placeRock(m: Model, material: Material, seed: number, x: number, z: number, sx: number, height: number, sz: number, turn = 0): void {
  const geometry = rockGeometry(seed);
  const box = geometry.boundingBox!;
  const scaleY = height / (box.max.y - box.min.y);
  const mesh = m.mesh(geometry, [x, -box.min.y * scaleY, z], material);
  mesh.scale.set(sx, scaleY, sz);
  mesh.rotation.y = turn;
}

export function buildFurnitureModel(item: FurnitureModelOptions, optimize = true): THREE.Group {
  if (!Number.isFinite(item.w) || !Number.isFinite(item.h) || item.w <= 0 || item.h <= 0) throw new Error("Invalid furniture dimensions");
  const w = item.w / 100, d = item.h / 100;
  // 高さを指定できる種類では、いちばん高い所がちょうどこの高さになるように作る
  const tall = clamp((item.height ?? FURNITURE_DEFS[item.kind].height ?? 100) / 100, 0.1, 30);
  const m = new Model(item.color3d ?? item.color);
  const wood = m.material("wood", 0xb59b76, 0.6, 0, true);
  const darkWood = m.material("wood-endgrain", 0x76604c, 0.7);
  const fabric = m.material("upholstery", 0x668e94, 0.94, 0, true);
  const cushion = m.material("cushion", 0xa1b9b5, 0.98);
  const ivory = m.material("linen", 0xf3f1e9, 0.97);
  const metal = m.material("brushed-metal", 0xc2ccd0, 0.28, 0.48);
  const black = m.material("dark-trim", 0x282e33, 0.48);
  const white = m.material("enamel", 0xe9edef, 0.32, 0.05, true);
  const ceramic = m.material("ceramic", 0xf4f5f1, 0.23, 0, true);
  const basinInterior = m.material("basin-interior", 0xcbd9d9, 0.32);
  const gold = m.material("brass", 0xc2a766, 0.28, 0.5);

  const legs = (width: number, depth: number, height: number, y = 0, x = 0, z = 0, material = darkWood) => {
    const thickness = Math.min(width, depth, 0.65) * 0.1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      m.rod([x + sx * width * 0.41, y, z + sz * depth * 0.4], [x + sx * width * 0.36, y + height, z + sz * depth * 0.35], thickness / 2, material, "leg");
    }
  };
  const handle = (x: number, y: number, z: number, width: number) => {
    m.rod([x - width / 2, y, z], [x + width / 2, y, z], 0.009, metal, "handle");
    for (const sign of [-1, 1]) m.rod([x + sign * width / 2, y, z], [x + sign * width / 2, y, z - 0.025], 0.007, metal);
  };
  const drawer = (x: number, y: number, z: number, width: number, height: number, material = wood) => {
    m.box(width * 0.96, height * 0.9, 0.025, x, y, z, material);
    handle(x, y + height * 0.18, z + 0.03, width * 0.3);
  };
  const chair = (cw: number, cd: number, x: number, z: number, facing = 1) => {
    legs(cw, cd, 0.425, 0, x, z);
    m.box(cw * 0.95, 0.055, cd * 0.9, x, 0.447, z, wood, 0.02);
    m.box(cw * 0.82, 0.035, cd * 0.73, x, 0.484, z + facing * cd * 0.025, cushion, 0.015);
    for (const sx of [-1, 1]) m.rod([x + sx * cw * 0.36, 0.43, z - facing * cd * 0.35], [x + sx * cw * 0.36, 0.91, z - facing * cd * 0.43], Math.min(cw, cd) * 0.038, darkWood);
    const back = m.box(cw * 0.83, 0.24, cd * 0.085, x, 0.79, z - facing * cd * 0.4, wood, 0.028);
    back.rotation.x = -facing * 0.09;
  };
  const faucet = (x: number, y: number, z: number, size: number) => {
    m.cylinder(size * 0.18, size * 0.2, 0.016, [x, y, z], metal);
    m.rod([x, y, z], [x, y + size, z], size * 0.055, metal);
    m.rod([x, y + size, z], [x, y + size, z + size * 0.65], size * 0.055, metal);
    m.rod([x, y + size, z + size * 0.65], [x, y + size * 0.85, z + size * 0.65], size * 0.055, metal);
    m.box(size * 0.5, 0.015, size * 0.11, x + size * 0.23, y + size * 0.46, z, metal);
  };
  const dial = (radius: number, y: number, z: number) => {
    const face = m.cylinder(radius, radius, 0.025, [0, y, z], ivory, 48);
    face.rotation.x = Math.PI / 2;
    m.ring(radius * 1.035, radius * 0.055, [0, y, z], gold);
    for (let i = 0; i < 12; i += 1) {
      const a = i * Math.PI / 6;
      const tick = m.box(radius * 0.04, radius * (i % 3 ? 0.12 : 0.2), 0.008, Math.sin(a) * radius * 0.8, y + Math.cos(a) * radius * 0.8, z + 0.017, black, 0);
      tick.rotation.z = -a;
    }
    for (const [a, length, thickness] of [[-Math.PI / 3, radius * 0.5, radius * 0.05], [Math.PI / 3, radius * 0.69, radius * 0.035]]) {
      m.rod([0, y, z + 0.028], [Math.sin(a) * length, y + Math.cos(a) * length, z + 0.028], thickness / 2, black, "clock-hand");
    }
    m.ellipsoid(radius * 0.1, radius * 0.1, 0.02, [0, y, z + 0.032], gold);
  };

  switch (item.kind) {
    case "sofa":
    case "sofa2":
    case "armchair":
    case "sofaCorner": {
      const corner = item.kind === "sofaCorner";
      const seatD = corner ? d * 0.52 : d;
      const z = corner ? -d * 0.24 : 0;
      legs(w * 0.91, seatD * 0.88, 0.13, 0, 0, z, black);
      m.box(w * 0.96, 0.2, seatD * 0.94, 0, 0.22, z, fabric, 0.045);
      m.box(w * 0.96, 0.6, seatD * 0.18, 0, 0.53, z - seatD * 0.39, fabric, 0.055);
      const count = item.kind === "armchair" ? 1 : Math.max(2, Math.min(4, Math.round(w / 0.65)));
      const usable = w * 0.78, cw = usable / count;
      for (let i = 0; i < count; i += 1) {
        const x = -usable / 2 + cw * (i + 0.5);
        m.box(cw * 0.96, 0.14, seatD * 0.69, x, 0.39, z + seatD * 0.055, fabric, 0.045);
        const back = m.box(cw * 0.94, 0.34, seatD * 0.16, x, 0.635, z - seatD * 0.28, fabric, 0.045);
        back.rotation.x = -0.09;
      }
      for (const sx of [-1, 1]) m.box(w * 0.105, 0.4, seatD * 0.96, sx * w * 0.447, 0.4, z, fabric, 0.045);
      if (corner) {
        m.box(w * 0.34, 0.2, d * 0.47, w * 0.28, 0.22, d * 0.265, fabric, 0.045);
        m.box(w * 0.335, 0.14, d * 0.45, w * 0.28, 0.39, d * 0.255, fabric, 0.045);
        m.box(w * 0.1, 0.4, d * 0.48, w * 0.45, 0.4, d * 0.26, fabric, 0.045);
        legs(w * 0.3, d * 0.42, 0.13, 0, w * 0.28, d * 0.27, black);
      }
      const pillow = m.box(Math.min(w * 0.24, 0.33), 0.3, seatD * 0.19, -w * 0.27, 0.6, z - seatD * 0.14, cushion, 0.065);
      pillow.rotation.z = 0.17;
      break;
    }
    case "table":
    case "longTable":
    case "sideTable":
    case "desk": {
      const height = item.kind === "desk" ? 0.74 : item.kind === "longTable" ? 0.72 : item.kind === "sideTable" ? 0.55 : 0.42;
      m.box(w, 0.045, d, 0, height - 0.0225, 0, wood, 0.018);
      legs(w, d, height - 0.045);
      m.box(w * 0.77, 0.07, d * 0.06, 0, height - 0.08, -d * 0.36, darkWood);
      if (item.kind === "sideTable") m.box(w * 0.79, 0.025, d * 0.76, 0, 0.14, 0, wood);
      if (item.kind === "desk") {
        m.box(w * 0.27, 0.3, d * 0.77, w * 0.29, height - 0.2, 0, darkWood);
        for (let i = 0; i < 2; i += 1) drawer(w * 0.29, height - 0.12 - i * 0.145, d * 0.395, w * 0.26, 0.145);
        const grommet = m.cylinder(Math.min(w, d) * 0.025, Math.min(w, d) * 0.025, 0.003, [-w * 0.3, height + 0.002, -d * 0.32], black);
        grommet.name = "cable-grommet";
      }
      break;
    }
    case "roundTable":
    case "stool": {
      const stool = item.kind === "stool", height = stool ? 0.47 : 0.75;
      const top = m.cylinder(0.5, 0.48, 0.055, [0, height - 0.0275, 0], stool ? fabric : wood, 48);
      top.scale.set(w, 1, d);
      legs(w * 0.7, d * 0.7, height - 0.055);
      if (stool) {
        for (const sign of [-1, 1]) {
          m.rod([-w * 0.26, 0.19, sign * d * 0.27], [w * 0.26, 0.19, sign * d * 0.27], Math.min(w, d) * 0.023, darkWood);
          m.rod([sign * w * 0.27, 0.19, -d * 0.26], [sign * w * 0.27, 0.19, d * 0.26], Math.min(w, d) * 0.023, darkWood);
        }
      }
      break;
    }
    case "chair": chair(w, d, 0, 0); break;
    case "diningTable": {
      m.box(w * 0.74, 0.045, d * 0.43, 0, 0.7275, 0, wood, 0.024);
      legs(w * 0.7, d * 0.39, 0.705);
      for (const x of [-1, 1]) for (const z of [-1, 1]) chair(w * 0.255, d * 0.26, x * w * 0.205, z * d * 0.365, -z);
      break;
    }
    case "bed":
    case "bedSemiDouble":
    case "bedDouble": {
      legs(w * 0.88, d * 0.88, 0.14);
      m.box(w, 0.2, d * 0.96, 0, 0.23, d * 0.02, darkWood, 0.018);
      m.box(w, 0.94, d * 0.045, 0, 0.51, -d * 0.475, wood, 0.025);
      m.box(w * 0.9, 0.53, d * 0.027, 0, 0.66, -d * 0.447, cushion, 0.045);
      m.box(w * 0.95, 0.21, d * 0.91, 0, 0.435, d * 0.026, ivory, 0.045);
      m.box(w * 0.965, 0.075, d * 0.66, 0, 0.553, d * 0.15, fabric, 0.035);
      m.box(w * 0.96, 0.04, d * 0.12, 0, 0.61, -d * 0.135, cushion, 0.025);
      const pillows = item.kind === "bedDouble" ? 2 : 1;
      for (let i = 0; i < pillows; i += 1) m.box(w * (pillows === 1 ? 0.62 : 0.38), 0.13, d * 0.18, (i - (pillows - 1) / 2) * w * 0.46, 0.597, -d * 0.31, ivory, 0.06);
      break;
    }
    case "tv": {
      const height = clamp(d * 0.9, 0.32, 0.56);
      legs(w * 0.92, d * 0.84, 0.08, 0, 0, 0, black);
      m.box(w, height - 0.08, d, 0, (height + 0.08) / 2, 0, wood, 0.015);
      for (const sign of [-1, 1]) drawer(sign * w * 0.325, height * 0.58, d * 0.505, w * 0.3, height * 0.71);
      m.box(w * 0.29, height * 0.56, 0.012, 0, height * 0.55, d * 0.509, black);
      m.box(w * 0.27, 0.018, d * 0.1, 0, height * 0.44, d * 0.46, darkWood);
      const screenW = w * 0.86, screenH = screenW * 9 / 16;
      const screenY = height + 0.11 + screenH / 2;
      m.box(screenW + 0.026, screenH + 0.026, 0.045, 0, screenY, -d * 0.13, black, 0.01);
      const screen = m.material("screen", 0x172b36, 0.18, 0.12);
      m.box(screenW, screenH, 0.005, 0, screenY, -d * 0.13 + 0.026, screen, 0.002).name = "screen";
      for (const sign of [-1, 1]) m.rod([sign * screenW * 0.29, height + 0.14, -d * 0.13], [sign * screenW * 0.35, height + 0.01, d * 0.13], 0.015, black);
      m.ellipsoid(0.008, 0.008, 0.003, [screenW * 0.43, screenY - screenH * 0.48, -d * 0.13 + 0.03], m.material("status-led", 0x75c9b1));
      break;
    }
    case "shelf": {
      const height = 1.8, t = Math.min(w, d, 0.6) * 0.07;
      m.box(w, height, t, 0, height / 2, -d / 2 + t / 2, darkWood);
      for (const sign of [-1, 1]) m.box(t, height, d, sign * (w - t) / 2, height / 2, 0, wood);
      for (let i = 0; i <= 4; i += 1) m.box(w - t * 2, t, d, 0, t / 2 + i * (height - t) / 4, 0, wood);
      const bookColors = [0x668b91, 0xbd806b, 0xc8ba8f, 0x687783, 0x8b9874];
      for (let row = 0; row < 4; row += 1) {
        for (let i = 0; i < 6; i += 1) {
          const bh = 0.22 + ((i + row * 2) % 4) * 0.027;
          const x = -w * 0.4 + i * w * 0.085;
          const book = m.material(`book-${i % 5}`, bookColors[i % 5], 0.85);
          m.box(w * 0.07, bh, d * 0.62, x, t + row * (height - t) / 4 + bh / 2, d * 0.07, book, 0.003);
          m.box(w * 0.052, 0.009, 0.002, x, t + row * (height - t) / 4 + bh * 0.75, d * 0.383, ivory, 0);
        }
        m.box(w * 0.23, 0.16, d * 0.73, w * 0.28, t + row * (height - t) / 4 + 0.08, 0, cushion);
      }
      break;
    }
    case "closet":
    case "wardrobe": {
      const closet = item.kind === "closet", height = closet ? 2.3 : 1.2;
      m.box(w * 0.9, 0.09, d * 0.86, 0, 0.045, 0, darkWood);
      m.box(w, height - 0.09, d * 0.94, 0, (height + 0.09) / 2, -d * 0.03, wood);
      if (closet) {
        const count = Math.max(2, Math.min(4, Math.round(w / 0.6)));
        for (let i = 0; i < count; i += 1) {
          const x = -w / 2 + w / count * (i + 0.5);
          m.box(w / count * 0.97, height - 0.14, d * 0.035, x, height / 2 + 0.025, d * 0.473, wood);
          m.rod([x + w / count * 0.31, 0.96, d * 0.52], [x + w / count * 0.31, 1.21, d * 0.52], 0.008, metal, "handle");
        }
      } else {
        for (let row = 0; row < 4; row += 1) {
          const count = row === 3 ? 2 : 1;
          for (let i = 0; i < count; i += 1) drawer((i - (count - 1) / 2) * w * 0.49, 0.22 + row * 0.268, d * 0.465, w * 0.97 / count, 0.254);
        }
      }
      break;
    }
    case "kitchen":
    case "kitchenIsland": {
      m.box(w * 0.94, 0.1, d * 0.83, 0, 0.05, -d * 0.04, black);
      m.box(w, 0.73, d * 0.94, 0, 0.465, -d * 0.025, white);
      const count = Math.max(2, Math.min(8, Math.round(w / 0.6)));
      for (let i = 0; i < count; i += 1) drawer(-w / 2 + w / count * (i + 0.5), 0.47, d * 0.46, w / count, 0.7, white);
      // Countertop strips leave a real sink opening instead of a painted rectangle.
      const sx = -w * 0.26, sw = w * 0.24, sd = d * 0.54;
      const counter = m.material("countertop", 0xb8bdbc, 0.34);
      const left = sx - sw / 2, right = sx + sw / 2;
      m.box(left + w / 2, 0.04, d, (-w / 2 + left) / 2, 0.85, 0, counter);
      m.box(w / 2 - right, 0.04, d, (w / 2 + right) / 2, 0.85, 0, counter);
      for (const sign of [-1, 1]) m.box(sw, 0.04, (d - sd) / 2, sx, 0.85, sign * (d + sd) / 4, counter);
      m.box(sw, 0.015, sd, sx, 0.72, 0, metal);
      for (const sign of [-1, 1]) {
        m.box(sw, 0.14, 0.012, sx, 0.785, sign * sd / 2, metal);
        m.box(0.012, 0.14, sd, sx + sign * sw / 2, 0.785, 0, metal);
      }
      m.cylinder(Math.min(sw, sd) * 0.045, Math.min(sw, sd) * 0.045, 0.004, [sx, 0.732, 0], black);
      faucet(sx, 0.87, -d * 0.38, 0.2);
      m.box(w * 0.29, 0.016, d * 0.71, w * 0.27, 0.879, 0, black);
      for (const [x, z] of [[0.2, -0.19], [0.34, -0.19], [0.2, 0.19], [0.34, 0.19]]) {
        const ring = m.ring(Math.min(w * 0.05, d * 0.13), 0.004, [w * x, 0.89, d * z], metal);
        ring.rotation.x = -Math.PI / 2;
      }
      break;
    }
    case "fridge": {
      m.box(w, 1.82, d * 0.91, 0, 0.94, -d * 0.045, white, 0.022);
      m.box(w * 0.9, 0.05, d * 0.82, 0, 0.025, 0, black);
      for (const [y, h] of [[1.245, 1.13], [0.33, 0.58]]) {
        m.box(w * 0.98, h, d * 0.065, 0, y, d * 0.45, white, 0.016);
        m.rod([-w * 0.32, y - h * 0.23, d * 0.515], [-w * 0.32, y + h * 0.23, d * 0.515], 0.012, metal, "handle");
      }
      m.box(w * 0.16, 0.12, 0.005, w * 0.24, 1.48, d * 0.487, black);
      break;
    }
    case "bath": {
      m.vessel([[0, 0], [0.3, 0], [0.43, 0.08], [0.5, 0.5], [0.49, 0.57], [0.43, 0.57]], w, d, [0, 0, 0], ceramic);
      m.vessel([[0.43, 0.57], [0.36, 0.16], [0, 0.14]], w, d, [0, 0, 0], basinInterior);
      m.cylinder(Math.min(w, d) * 0.026, Math.min(w, d) * 0.026, 0.006, [-w * 0.25, 0.147, 0], metal);
      faucet(-w * 0.3, 0.53, -d * 0.3, 0.18);
      break;
    }
    case "toilet": {
      m.ellipsoid(w * 0.52, 0.32, d * 0.55, [0, 0.16, d * 0.075], ceramic);
      m.box(w * 0.85, 0.71, d * 0.25, 0, 0.355, -d * 0.365, ceramic, 0.055);
      m.box(w * 0.9, 0.04, d * 0.28, 0, 0.725, -d * 0.365, ceramic, 0.018);
      m.cylinder(w * 0.055, w * 0.055, 0.008, [w * 0.15, 0.75, -d * 0.365], metal);
      m.vessel([[0, 0], [0.3, 0.01], [0.47, 0.15], [0.5, 0.25], [0.37, 0.25]], w * 0.96, d * 0.7, [0, 0.15, d * 0.12], ceramic);
      m.vessel([[0.37, 0.25], [0.2, 0.1], [0, 0.08]], w * 0.96, d * 0.7, [0, 0.15, d * 0.12], basinInterior);
      const seat = m.ring(0.5, 0.055, [0, 0.422, d * 0.12], ivory);
      seat.rotation.x = -Math.PI / 2;
      seat.scale.set(w * 0.85, d * 0.62, 0.6);
      break;
    }
    case "washbasin": {
      m.box(w * 0.89, 0.12, d * 0.83, 0, 0.06, 0, darkWood);
      m.box(w, 0.55, d * 0.93, 0, 0.395, -d * 0.02, wood);
      for (const sign of [-1, 1]) drawer(sign * w * 0.245, 0.4, d * 0.466, w * 0.49, 0.51);
      m.vessel([[0, 0], [0.33, 0], [0.5, 0.18], [0.48, 0.2], [0.41, 0.2]], w, d, [0, 0.66, 0], ceramic);
      m.vessel([[0.41, 0.2], [0.27, 0.055], [0, 0.035]], w, d, [0, 0.66, 0], basinInterior);
      m.cylinder(w * 0.027, w * 0.027, 0.008, [0, 0.702, 0], metal);
      faucet(0, 0.79, -d * 0.36, 0.2);
      break;
    }
    case "washer": {
      m.box(w, 0.88, d * 0.92, 0, 0.47, -d * 0.04, white, 0.02);
      legs(w * 0.84, d * 0.83, 0.04, 0, 0, 0, black);
      m.box(w * 1.01, 0.025, d, 0, 0.925, 0, white);
      const radius = Math.min(w * 0.31, 0.23), z = d * 0.45;
      const cavity = m.cylinder(radius * 0.93, radius * 0.93, 0.018, [0, 0.47, z + 0.02], black);
      cavity.rotation.x = Math.PI / 2;
      m.ring(radius, radius * 0.12, [0, 0.47, z + 0.026], metal);
      const glass = m.cylinder(radius * 0.84, radius * 0.84, 0.008, [0, 0.47, z + 0.04], m.glass("washer-glass", 0x587481, 0.5));
      glass.rotation.x = Math.PI / 2;
      const knob = m.cylinder(w * 0.045, w * 0.045, 0.018, [w * 0.24, 0.8, z + 0.02], metal);
      knob.rotation.x = Math.PI / 2;
      m.box(w * 0.25, 0.062, 0.008, -w * 0.02, 0.8, z + 0.019, black);
      m.box(w * 0.21, 0.087, 0.008, -w * 0.33, 0.8, z + 0.014, white);
      break;
    }
    case "rug": {
      m.box(w, 0.012, d, 0, 0.006, 0, fabric, 0.006);
      m.box(w * 0.91, 0.003, d * 0.87, 0, 0.0135, 0, ivory, 0.002);
      m.box(w * 0.87, 0.003, d * 0.82, 0, 0.0165, 0, fabric, 0.002);
      for (const sign of [-1, 1]) for (let i = 0; i < 18; i += 1) m.rod([-w * 0.45 + i * w * 0.9 / 17, 0.006, sign * d * 0.49], [-w * 0.45 + i * w * 0.9 / 17, 0.006, sign * d * 0.515], 0.003, ivory);
      break;
    }
    case "floorLamp": {
      const base = m.cylinder(0.5, 0.5, 0.035, [0, 0.0175, 0], black, 40);
      base.scale.set(w * 0.65, 1, d * 0.65);
      m.rod([0, 0.035, 0], [0, 1.52, 0], 0.014, metal);
      const shadeMat = m.material("lampshade", 0xf4e9d3, 0.96, 0, true);
      shadeMat.side = THREE.DoubleSide;
      const shade = m.mesh(new THREE.CylinderGeometry(0.32, 0.5, 0.35, 40, 1, true), [0, 1.5, 0], shadeMat);
      shade.scale.set(w, 1, d);
      const bulbMat = m.material("bulb", 0xffe8b4, 0.4);
      bulbMat.emissive.setHex(0xffdca0); bulbMat.emissiveIntensity = 0.25;
      m.ellipsoid(0.07, 0.095, 0.07, [0, 1.43, 0], bulbMat);
      for (const sign of [-1, 1]) m.rod([0, 1.37, 0], [sign * w * 0.39, 1.37, 0], 0.004, metal);
      break;
    }
    case "plant":
    case "plantLarge": {
      const height = clamp(Math.sqrt(w * d) * 2.7, 0.65, 2.6), potH = height * 0.24;
      const pot = m.material("planter", 0xd3cec1, 0.78, 0, true);
      m.vessel([[0, 0], [0.3, 0], [0.4, potH * 0.94], [0.4, potH], [0.35, potH], [0.27, 0.04], [0, 0.04]], w * 0.75, d * 0.75, [0, 0, 0], pot);
      const soil = m.cylinder(0.35, 0.35, 0.02, [0, potH * 0.87, 0], m.material("soil", 0x443d31, 1));
      soil.scale.set(w * 0.75, 1, d * 0.75);
      const stemMat = m.material("stem", 0x66724b, 0.9);
      m.rod([0, potH * 0.9, 0], [0, height * 0.94, 0], Math.min(w, d) * 0.022, stemMat);
      for (let i = 0; i < 13; i += 1) {
        const a = i * 2.4, y = potH + height * (0.19 + i * 0.038);
        const length = 0.32 - i * 0.009;
        const end: Position = [Math.cos(a) * w * length * 0.75, y + height * 0.07, Math.sin(a) * d * length * 0.75];
        m.rod([0, y, 0], end, Math.min(w, d) * 0.008, stemMat);
        const leafMaterial = m.material(`leaf-${i % 3}`, [0x42775a, 0x62956b, 0x7ba773][i % 3], 0.87);
        const leaf = new THREE.Shape();
        leaf.moveTo(0, 0); leaf.bezierCurveTo(0.22, 0.17, 0.15, 0.75, 0, 1); leaf.bezierCurveTo(-0.15, 0.75, -0.22, 0.17, 0, 0);
        const geometry = new THREE.ShapeGeometry(leaf, 7);
        const positions = geometry.getAttribute("position");
        for (let p = 0; p < positions.count; p += 1) positions.setZ(p, Math.sin(positions.getY(p) * Math.PI) * 0.14);
        geometry.computeVertexNormals();
        leafMaterial.side = THREE.DoubleSide;
        const mesh = m.mesh(geometry, end, leafMaterial, "leaf");
        mesh.scale.set(w * 0.8, Math.max(w, d) * length, Math.min(w, d));
        mesh.rotation.set(0.75, -a, -0.5);
      }
      break;
    }
    case "wallClock": {
      const radius = w * 0.46, y = Math.max(1.55, radius + 0.1);
      const frame = m.cylinder(radius * 1.08, radius * 1.08, d * 0.55, [0, y, 0], wood, 48);
      frame.rotation.x = Math.PI / 2;
      dial(radius, y, d * 0.29);
      break;
    }
    case "grandfatherClock": {
      const height = clamp(w * 3.4, 1.8, 2.55), r = Math.min(w * 0.33, height * 0.115);
      m.box(w, 0.14, d, 0, 0.07, 0, darkWood, 0.018);
      m.box(w * 0.82, height * 0.83, d * 0.06, 0, height * 0.5, -d * 0.44, darkWood);
      for (const sign of [-1, 1]) m.box(w * 0.12, height * 0.84, d * 0.86, sign * w * 0.36, height * 0.49, 0, wood);
      m.box(w * 0.83, height * 0.3, d * 0.85, 0, height * 0.81, 0, wood);
      m.box(w, 0.085, d, 0, height * 0.98, 0, darkWood, 0.014);
      m.box(w * 0.94, 0.06, d * 0.96, 0, height * 0.64, 0, darkWood);
      dial(r, height * 0.81, d * 0.45);
      m.rod([0, height * 0.65, d * 0.12], [0, height * 0.22, d * 0.12], 0.011, gold);
      const bob = m.cylinder(w * 0.13, w * 0.13, 0.025, [0, height * 0.24, d * 0.12], gold);
      bob.rotation.x = Math.PI / 2;
      for (const x of [-1, 1]) m.rod([x * w * 0.16, height * 0.61, 0], [x * w * 0.16, height * 0.42, 0], w * 0.043, gold);
      m.box(w * 0.57, height * 0.48, 0.006, 0, height * 0.38, d * 0.44, m.glass("clock-glass"), 0);
      break;
    }
    case "aquarium": {
      const stand = 0.66, tank = clamp(w * 0.5, 0.4, 1.3);
      m.box(w, stand, d, 0, stand / 2, 0, wood);
      for (const sign of [-1, 1]) drawer(sign * w * 0.245, stand * 0.52, d * 0.502, w * 0.49, stand * 0.86);
      const gravel = m.material("aquarium-gravel", 0xcac2a5, 0.95);
      m.box(w * 0.96, 0.038, d * 0.91, 0, stand + 0.03, 0, gravel);
      for (const y of [stand + 0.01, stand + tank]) {
        for (const sign of [-1, 1]) {
          m.box(w, 0.04, d * 0.055, 0, y, sign * d * 0.475, black);
          m.box(w * 0.025, 0.04, d, sign * w * 0.486, y, 0, black);
        }
      }
      const glass = m.glass("tank-glass", 0xc6e4e8, 0.12);
      for (const sign of [-1, 1]) {
        m.box(w * 0.98, tank, 0.004, 0, stand + tank / 2, sign * d * 0.47, glass, 0);
        m.box(0.004, tank, d * 0.94, sign * w * 0.49, stand + tank / 2, 0, glass, 0);
      }
      const water = m.mesh(new THREE.PlaneGeometry(w * 0.96, d * 0.91), [0, stand + tank * 0.87, 0], m.glass("water-surface", 0x7ac3d5, 0.25));
      water.rotation.x = -Math.PI / 2;
      for (let i = 0; i < 3; i += 1) {
        const color = m.material(`fish-${i}`, [0xd89947, 0xcc735e, 0xa3bdcb][i], 0.57);
        const x = w * (-0.23 + i * 0.22), y = stand + tank * (0.39 + (i % 2) * 0.23), z = d * (i % 2 ? -0.12 : 0.1);
        const fw = w * 0.12;
        m.ellipsoid(fw, tank * 0.095, d * 0.08, [x, y, z], color);
        const tail = m.mesh(new THREE.ConeGeometry(tank * 0.072, fw * 0.4, 3), [x - fw * 0.6, y, z], color);
        tail.rotation.z = -Math.PI / 2; tail.scale.z = 0.35;
        m.ellipsoid(fw * 0.05, fw * 0.05, fw * 0.025, [x + fw * 0.27, y + tank * 0.014, z + d * 0.038], black);
      }
      const green = m.material("aquatic-leaves", 0x52866c, 0.87);
      for (let i = 0; i < 7; i += 1) {
        const x = w * (0.25 + (i % 3) * 0.05), h = tank * (0.23 + i * 0.025);
        const leaf = m.ellipsoid(w * 0.025, h, d * 0.018, [x, stand + 0.045 + h / 2, -d * 0.25], green);
        leaf.rotation.z = (i - 3) * 0.1;
      }
      break;
    }
    case "piano": {
      const piano = m.material("piano-lacquer", 0x303537, 0.24, 0.06, true);
      m.box(w, 1.18, d * 0.61, 0, 0.62, -d * 0.195, piano, 0.015);
      m.box(w * 1.01, 0.035, d * 0.64, 0, 1.23, -d * 0.18, piano);
      m.box(w, 0.075, d, 0, 0.71, 0, piano);
      for (const sign of [-1, 1]) {
        m.box(w * 0.06, 0.73, d * 0.1, sign * w * 0.455, 0.365, d * 0.4, piano);
        m.box(w * 0.065, 0.04, d * 0.13, sign * w * 0.455, 0.025, d * 0.4, gold);
      }
      for (let i = 0; i < 35; i += 1) {
        const kw = w * 0.87 / 35, x = -w * 0.435 + (i + 0.5) * kw;
        m.box(kw * 0.95, 0.022, d * 0.3, x, 0.763, d * 0.29, ivory, 0.002);
        if (![2, 6].includes(i % 7) && i < 34) m.box(kw * 0.56, 0.022, d * 0.18, x + kw / 2, 0.785, d * 0.225, black, 0.002);
      }
      for (const x of [-1, 0, 1]) m.box(w * 0.03, 0.025, d * 0.16, x * w * 0.06, 0.1, d * 0.25, gold);
      m.box(w * 0.46, 0.018, d * 0.16, 0, 0.925, -d * 0.06, piano);
      break;
    }
    case "bench": {
      legs(w * 0.85, d * 0.82, 0.43, 0, 0, 0, black);
      for (let i = 0; i < 4; i += 1) m.box(w, 0.044, d * 0.17, 0, 0.452, -d * 0.24 + i * d * 0.19, wood);
      for (const sign of [-1, 1]) {
        m.rod([sign * w * 0.34, 0.38, -d * 0.3], [sign * w * 0.34, 0.87, -d * 0.45], 0.021, black);
        m.rod([sign * w * 0.45, 0.64, -d * 0.37], [sign * w * 0.45, 0.64, d * 0.29], 0.018, black);
      }
      for (let i = 0; i < 3; i += 1) {
        const slat = m.box(w, 0.09, d * 0.06, 0, 0.61 + i * 0.115, -d * (0.35 + i * 0.045), wood);
        slat.rotation.x = -0.12;
      }
      break;
    }
    case "stairs":
    case "stairsU":
    case "stairsSpiral": {
      const rise = item.rise ?? 2.67;
      if (item.kind === "stairs") {
        const horizontal = w > d, count = 14, run = horizontal ? w : d, width = horizontal ? d : w;
        for (let i = 0; i < count; i += 1) {
          const y = rise * (i + 1) / count, p = -run / 2 + (i + 0.5) * run / count;
          const x = horizontal ? p : 0, z = horizontal ? 0 : -p;
          m.box(horizontal ? run / count : width, y - 0.025, horizontal ? width : run / count, x, (y - 0.025) / 2, z, white, 0);
          m.box(horizontal ? run / count : width, 0.025, horizontal ? width : run / count, x, y - 0.0125, z, wood, 0.004);
          for (const sign of [-1, 1]) if (i % 2 === 0 || i === count - 1) {
            const pos: Position = horizontal ? [p, y, sign * width * 0.45] : [sign * width * 0.45, y, -p];
            m.rod(pos, [pos[0], y + 0.87, pos[2]], 0.012, metal);
          }
        }
        for (const sign of [-1, 1]) m.rod(horizontal ? [-run * 0.47, rise / count + 0.87, sign * width * 0.45] : [sign * width * 0.45, rise / count + 0.87, run * 0.47], horizontal ? [run * 0.47, rise + 0.87, sign * width * 0.45] : [sign * width * 0.45, rise + 0.87, -run * 0.47], 0.025, darkWood);
      } else if (item.kind === "stairsU") {
        const landing = d * 0.3, run = d - landing, count = 7;
        for (let flight = 0; flight < 2; flight += 1) for (let i = 0; i < count; i += 1) {
          const y = rise * (flight + (i + 1) / count) / 2;
          const z = flight ? -d / 2 + landing + run * (i + 0.5) / count : d / 2 - run * (i + 0.5) / count;
          m.box(w * 0.47, y - 0.025, run / count, flight ? -w * 0.265 : w * 0.265, (y - 0.025) / 2, z, white, 0);
          m.box(w * 0.47, 0.025, run / count, flight ? -w * 0.265 : w * 0.265, y - 0.0125, z, wood, 0.004);
          if (i % 2 === 0) m.rod([flight ? -w * 0.47 : w * 0.47, y, z], [flight ? -w * 0.47 : w * 0.47, y + 0.85, z], 0.012, metal);
        }
        m.box(w, rise / 2 - 0.025, landing, 0, (rise / 2 - 0.025) / 2, -d / 2 + landing / 2, white, 0);
        m.box(w, 0.025, landing, 0, rise / 2 - 0.0125, -d / 2 + landing / 2, wood);
        for (const sign of [-1, 1]) m.rod([sign * w * 0.47, (sign > 0 ? rise / 14 : rise) + 0.85, d / 2 - run / 14], [sign * w * 0.47, rise / 2 + 0.85, -d / 2 + landing], 0.024, darkWood);
        m.rod([-w * 0.47, rise / 2 + 0.85, -d / 2 + 0.025], [w * 0.47, rise / 2 + 0.85, -d / 2 + 0.025], 0.024, darkWood);
        for (const sign of [-1, 1]) m.rod([sign * w * 0.47, rise / 2, -d / 2 + 0.025], [sign * w * 0.47, rise / 2 + 0.85, -d / 2 + 0.025], 0.012, metal);
        for (const sign of [-1, 1]) m.rod([sign * w * 0.47, rise / 2 + 0.85, -d / 2 + 0.025], [sign * w * 0.47, rise / 2 + 0.85, -d / 2 + landing], 0.024, darkWood);
      } else {
        const radius = 0.5, count = 15;
        m.cylinder(0.035, 0.035, rise + 0.1, [0, (rise + 0.1) / 2, 0], metal);
        let previous: Position | undefined;
        for (let i = 0; i < count; i += 1) {
          const a = -Math.PI / 2 + i / (count - 1) * Math.PI * 1.82, y = rise * (i + 1) / count;
          const shape = new THREE.Shape();
          shape.absarc(0, 0, radius, a, a + 0.38, false);
          shape.absarc(0, 0, 0.04, a + 0.38, a, true); shape.closePath();
          const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false, curveSegments: 5 });
          geo.rotateX(-Math.PI / 2); geo.scale(w * 0.96, 1, d * 0.96);
          m.mesh(geo, [0, y - 0.045, 0], wood);
          const x = Math.cos(a + 0.18) * w * 0.46, z = -Math.sin(a + 0.18) * d * 0.46;
          m.rod([x, y, z], [x, y + 0.87, z], 0.009, metal);
          const current: Position = [x, y + 0.87, z];
          if (previous) m.rod(previous, current, 0.018, darkWood);
          previous = current;
        }
        m.cylinder(0.08, 0.1, 0.03, [0, 0.015, 0], metal);
      }
      break;
    }
    case "car": {
      const paint = m.material("car-paint", 0x8faaa9, 0.25, 0.22, true);
      const glass = m.material("car-windows", 0x354f5b, 0.16, 0.1);
      m.box(w * 0.95, 0.5, d * 0.94, 0, 0.65, 0, paint, 0.15);
      m.box(w * 0.88, 0.1, d * 0.89, 0, 0.365, 0, black, 0.035);
      // A tapered cabin gives the windshield and rear glass their own sloped faces.
      const cabin = new THREE.BufferGeometry();
      cabin.setAttribute("position", new THREE.Float32BufferAttribute([
        -w * 0.41, 0.87, -d * 0.23, w * 0.41, 0.87, -d * 0.23,
        w * 0.41, 0.87, d * 0.30, -w * 0.41, 0.87, d * 0.30,
        -w * 0.34, 1.31, -d * 0.12, w * 0.34, 1.31, -d * 0.12,
        w * 0.34, 1.31, d * 0.21, -w * 0.34, 1.31, d * 0.21,
      ], 3));
      cabin.setIndex([0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0, 4, 7, 6, 4, 6, 5, 0, 1, 2, 0, 2, 3]);
      const cabinFaces = cabin.toNonIndexed();
      cabinFaces.computeVertexNormals();
      cabin.dispose();
      m.mesh(cabinFaces, [0, 0, 0], glass);
      m.box(w * 0.71, 0.035, d * 0.34, 0, 1.325, d * 0.045, paint, 0.018);
      for (const sign of [-1, 1]) {
        for (const [lowerZ, upperZ] of [[-0.23, -0.12], [0.065, 0.065], [0.30, 0.21]]) {
          m.rod([sign * w * 0.411, 0.87, d * lowerZ], [sign * w * 0.341, 1.31, d * upperZ], Math.min(w * 0.018, 0.035), paint);
        }
        m.box(w * 0.08, 0.07, d * 0.038, sign * w * 0.48, 0.94, -d * 0.17, paint, 0.018);
        for (const z of [-1, 1]) {
          const wheel = m.cylinder(0.31, 0.31, w * 0.09, [sign * w * 0.46, 0.31, z * d * 0.3], black, 32);
          wheel.rotation.z = Math.PI / 2;
          const hub = m.cylinder(0.2, 0.2, 0.012, [sign * w * 0.511, 0.31, z * d * 0.3], metal, 32);
          hub.rotation.z = Math.PI / 2;
          for (let i = 0; i < 5; i += 1) {
            const a = i * Math.PI * 2 / 5;
            m.rod([sign * w * 0.52, 0.31, z * d * 0.3], [sign * w * 0.52, 0.31 + Math.sin(a) * 0.17, z * d * 0.3 + Math.cos(a) * 0.17], 0.016, black);
          }
        }
        m.box(w * 0.21, 0.105, 0.016, sign * w * 0.31, 0.76, -d * 0.47, ivory, 0.018);
        m.box(w * 0.21, 0.095, 0.016, sign * w * 0.31, 0.76, d * 0.47, m.material("tail-light", 0xa34445, 0.25), 0.018);
        for (const z of [-d * 0.05, d * 0.2]) m.box(0.009, 0.026, d * 0.048, sign * w * 0.482, 0.84, z, metal);
      }
      m.box(w * 0.37, 0.14, 0.018, 0, 0.55, -d * 0.475, black);
      m.box(w * 0.25, 0.085, 0.022, 0, 0.57, d * 0.475, ivory);
      break;
    }
    case "officeChair": {
      // 5本脚のキャスター台、昇降の支柱、座面、背もたれ、肘掛け
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        const end: Position = [Math.cos(a) * w * 0.44, 0.06, Math.sin(a) * d * 0.44];
        m.rod([0, 0.09, 0], end, 0.018, black);
        m.ellipsoid(0.05, 0.05, 0.05, [end[0], 0.025, end[2]], black);
      }
      m.cylinder(0.025, 0.03, 0.34, [0, 0.27, 0], metal);
      m.box(w * 0.78, 0.08, d * 0.72, 0, 0.47, d * 0.05, fabric, 0.03);
      const back = m.box(w * 0.72, 0.5, 0.06, 0, 0.8, -d * 0.36, fabric, 0.03);
      back.rotation.x = -0.12;
      m.rod([0, 0.45, -d * 0.18], [0, 0.62, -d * 0.35], 0.02, black);
      for (const sign of [-1, 1]) {
        m.rod([sign * w * 0.37, 0.47, 0], [sign * w * 0.37, 0.63, 0], 0.012, black);
        m.box(0.05, 0.03, d * 0.34, sign * w * 0.37, 0.645, d * 0.02, black, 0.01);
      }
      break;
    }
    case "zaisu": {
      // 床に置く座面と、後ろへ倒れた背もたれ
      m.box(w, 0.1, d * 0.6, 0, 0.05, d * 0.2, fabric, 0.04);
      const back = m.box(w * 0.96, 0.08, d * 0.62, 0, 0.3, -d * 0.24, fabric, 0.04);
      back.rotation.x = 1.0;
      m.rod([-w * 0.45, 0.07, -d * 0.1], [w * 0.45, 0.07, -d * 0.1], 0.012, black);
      break;
    }
    case "kotatsu": {
      // 床に広がるこたつ布団と、その上の天板
      const futon = m.material("kotatsu-futon", 0xc98a6d, 0.97, 0, true);
      m.box(w, 0.05, d, 0, 0.025, 0, futon, 0.025);
      // 天板の縁からほぼ垂直に垂れる布団。面ごとに陰影が付くよう法線を面単位にする
      const indexedSkirt = new THREE.CylinderGeometry(0.3 * Math.SQRT2, 0.36 * Math.SQRT2, 0.34, 4, 1);
      indexedSkirt.rotateY(Math.PI / 4);
      const skirt = indexedSkirt.toNonIndexed();
      indexedSkirt.dispose();
      skirt.computeVertexNormals();
      m.mesh(skirt, [0, 0.21, 0], futon).scale.set(w, 1, d);
      m.box(w * 0.64, 0.035, d * 0.64, 0, 0.395, 0, wood, 0.012);
      m.box(w * 0.3, 0.02, d * 0.18, w * 0.05, 0.418, -d * 0.04, m.material("kotatsu-cloth", 0xe7dfcf, 0.9));
      break;
    }
    case "deskL": {
      // 奥の天板を全幅に、左の天板を手前へ伸ばしたL字。右奥に引き出し
      const height = 0.74, arm = Math.min(w, d) * 0.43;
      m.box(w, 0.035, arm, 0, height - 0.0175, -d / 2 + arm / 2, wood, 0.012);
      m.box(arm, 0.035, d - arm, -w / 2 + arm / 2, height - 0.0175, arm / 2, wood, 0.012);
      for (const [x, z] of [[-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + arm - 0.04], [-w / 2 + 0.04, d / 2 - 0.04], [-w / 2 + arm - 0.04, d / 2 - 0.04]]) {
        m.rod([x, 0, z], [x, height - 0.035, z], 0.02, darkWood, "leg");
      }
      m.box(w * 0.26, height - 0.1, arm * 0.9, w / 2 - w * 0.14, (height - 0.1) / 2 + 0.03, -d / 2 + arm / 2, darkWood);
      for (let i = 0; i < 3; i += 1) drawer(w / 2 - w * 0.14, height - 0.16 - i * 0.2, -d / 2 + arm * 0.96, w * 0.24, 0.19);
      break;
    }
    case "bunkBed": {
      // 上下2段の寝台、四隅の柱、上段の柵、足元のはしご
      for (const y of [0.28, 1.2]) {
        m.box(w, 0.12, d, 0, y, 0, wood, 0.012);
        m.box(w * 0.92, 0.14, d * 0.93, 0, y + 0.13, 0, ivory, 0.03);
        m.box(w * 0.93, 0.05, d * 0.6, 0, y + 0.225, d * 0.15, fabric, 0.02);
        m.box(w * 0.55, 0.1, d * 0.14, 0, y + 0.25, -d * 0.36, ivory, 0.04);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.06, 1.72, 0.06, sx * (w / 2 - 0.03), 0.86, sz * (d / 2 - 0.03), wood, 0.01);
      m.box(0.04, 0.18, d * 0.62, -(w / 2 - 0.02), 1.55, -d * 0.1, wood, 0.01);
      m.box(0.04, 0.18, d * 0.4, w / 2 - 0.02, 1.55, -d * 0.2, wood, 0.01);
      for (const z of [d * 0.22, d * 0.42]) m.rod([w / 2 - 0.02, 0.2, z], [w / 2 - 0.02, 1.62, z], 0.018, wood);
      for (let i = 0; i < 5; i += 1) m.rod([w / 2 - 0.02, 0.45 + i * 0.25, d * 0.22], [w / 2 - 0.02, 0.45 + i * 0.25, d * 0.42], 0.014, darkWood);
      break;
    }
    case "futon": {
      // 敷布団・掛け布団・枕。脚や枠はなく床に直接置く
      m.box(w, 0.09, d, 0, 0.045, 0, ivory, 0.04);
      m.box(w * 0.98, 0.07, d * 0.7, 0, 0.12, d * 0.14, fabric, 0.05);
      m.box(w * 0.98, 0.05, d * 0.08, 0, 0.13, -d * 0.2, fabric, 0.03);
      m.box(w * 0.55, 0.09, d * 0.15, 0, 0.135, -d * 0.36, ivory, 0.045);
      break;
    }
    case "cupboard": {
      // 下は扉付きの収納、上はガラス戸越しに皿が見える棚
      m.box(w * 0.9, 0.08, d * 0.86, 0, 0.04, 0, darkWood);
      m.box(w, 0.8, d, 0, 0.48, 0, wood);
      for (const sign of [-1, 1]) drawer(sign * w * 0.245, 0.5, d * 0.505, w * 0.49, 0.74);
      m.box(w, 0.03, d, 0, 0.895, 0, darkWood);
      const upperD = d * 0.62, upperZ = -d / 2 + upperD / 2;
      m.box(w, 0.86, 0.02, 0, 1.34, -d / 2 + 0.01, darkWood);
      for (const sign of [-1, 1]) m.box(0.025, 0.86, upperD, sign * (w / 2 - 0.0125), 1.34, upperZ, wood);
      for (const y of [1.2, 1.48, 1.765]) m.box(w - 0.05, 0.025, upperD, 0, y, upperZ, wood);
      for (const y of [1.2, 1.48]) for (let i = 0; i < 3; i += 1) {
        const plate = m.cylinder(Math.min(w, upperD) * 0.16, Math.min(w, upperD) * 0.13, 0.03, [-w * 0.28 + i * w * 0.28, y + 0.03, upperZ], ceramic);
        plate.scale.z = 0.7;
      }
      m.box(w * 0.96, 0.84, 0.006, 0, 1.34, upperZ + upperD / 2, m.glass("cupboard-glass"), 0);
      break;
    }
    case "shoeCabinet": {
      const height = 1.0;
      m.box(w * 0.9, 0.06, d * 0.86, 0, 0.03, 0, darkWood);
      m.box(w, height - 0.06, d, 0, (height + 0.06) / 2, 0, wood);
      for (const sign of [-1, 1]) drawer(sign * w * 0.245, height / 2 + 0.03, d * 0.505, w * 0.49, height - 0.12);
      m.box(w * 1.02, 0.03, d * 1.03, 0, height + 0.015, 0, darkWood);
      break;
    }
    case "airConditioner": {
      // 壁の高い位置に付く室内機。本体・吹き出し口・ルーバー
      const y = 2.15, height = 0.29;
      m.box(w, height, d, 0, y, 0, white, 0.03);
      m.box(w * 0.86, 0.035, d * 0.25, 0, y - height * 0.32, d * 0.4, black, 0.01);
      m.box(w * 0.86, 0.02, d * 0.3, 0, y - height * 0.44, d * 0.42, white, 0.008);
      const vent = m.material("vent", 0xb7c0c5, 0.5);
      for (let i = 0; i < 3; i += 1) m.box(w * 0.8, 0.006, 0.004, 0, y + height * (0.05 + i * 0.1), d / 2 + 0.002, vent, 0);
      m.ellipsoid(0.01, 0.01, 0.004, [w * 0.38, y - height * 0.12, d / 2 + 0.003], m.material("status-led", 0x75c9b1));
      break;
    }
    case "kitchenL": {
      // 奥の辺に流し台、左の辺にコンロを置いたL型
      const depth = Math.min(w, d) * 0.36, counter = m.material("countertop", 0xb8bdbc, 0.34);
      m.box(w * 0.98, 0.1, depth * 0.85, 0, 0.05, -d / 2 + depth / 2, black);
      m.box(depth * 0.85, 0.1, (d - depth) * 0.98, -w / 2 + depth / 2, 0.05, depth / 2, black);
      m.box(w, 0.73, depth, 0, 0.465, -d / 2 + depth / 2, white);
      m.box(depth, 0.73, d - depth, -w / 2 + depth / 2, 0.465, depth / 2, white);
      m.box(w, 0.04, depth, 0, 0.85, -d / 2 + depth / 2, counter);
      m.box(depth, 0.04, d - depth, -w / 2 + depth / 2, 0.85, depth / 2, counter);
      const doors = Math.max(2, Math.min(6, Math.round((w - depth) / 0.6)));
      for (let i = 0; i < doors; i += 1) drawer(-w / 2 + depth + (w - depth) / doors * (i + 0.5), 0.47, -d / 2 + depth + 0.013, (w - depth) / doors, 0.7, white);
      m.box(w * 0.2, 0.012, depth * 0.6, w * 0.18, 0.874, -d / 2 + depth / 2, metal);
      m.box(w * 0.18, 0.01, depth * 0.5, w * 0.18, 0.875, -d / 2 + depth / 2, basinInterior);
      faucet(w * 0.18, 0.87, -d / 2 + depth * 0.12, 0.2);
      m.box(depth * 0.75, 0.016, (d - depth) * 0.5, -w / 2 + depth / 2, 0.879, depth / 2 + (d - depth) * 0.05, black);
      for (const z of [-0.12, 0.12]) {
        const ring = m.ring(Math.min(depth * 0.18, 0.12), 0.004, [-w / 2 + depth / 2, 0.89, depth / 2 + (d - depth) * (0.05 + z)], metal);
        ring.rotation.x = -Math.PI / 2;
      }
      break;
    }
    case "unitBath": {
      // 一体成型の床、奥の浴槽、洗い場の排水口と風呂椅子、壁側のシャワー
      m.box(w, 0.1, d, 0, 0.05, 0, m.material("bath-floor", 0xdfe6e4, 0.55, 0, true), 0.01);
      const tubD = d * 0.45, tubZ = -d / 2 + tubD / 2;
      m.box(w, 0.5, tubD, 0, 0.35, tubZ, ceramic, 0.03);
      m.box(w * 0.88, 0.012, tubD * 0.76, 0, 0.6, tubZ, basinInterior, 0.004);
      faucet(w * 0.32, 0.6, -d / 2 + 0.05, 0.16);
      m.cylinder(0.04, 0.04, 0.004, [w * 0.28, 0.102, d * 0.3], metal);
      m.box(0.3, 0.22, 0.22, -w * 0.18, 0.21, d * 0.24, m.material("bath-stool", 0xcfd9dc, 0.4));
      m.rod([w / 2 - 0.05, 0.1, d * 0.05], [w / 2 - 0.05, 1.8, d * 0.05], 0.012, metal);
      const head = m.cylinder(0.05, 0.04, 0.03, [w / 2 - 0.1, 1.72, d * 0.05], metal);
      head.rotation.z = Math.PI / 2;
      break;
    }
    case "shower": {
      // 床の受け皿、中央の排水口、2面のガラス、奥のシャワー
      m.box(w, 0.06, d, 0, 0.03, 0, ceramic, 0.012);
      m.cylinder(0.035, 0.035, 0.004, [0, 0.062, 0], metal);
      const glass = m.glass("shower-glass", 0xcfe3e8, 0.18);
      m.box(w, 1.9, 0.008, 0, 1.01, d / 2 - 0.004, glass, 0);
      m.box(0.008, 1.9, d, w / 2 - 0.004, 1.01, 0, glass, 0);
      m.rod([-w / 2, 1.96, d / 2 - 0.01], [w / 2, 1.96, d / 2 - 0.01], 0.012, metal);
      m.rod([w / 2 - 0.01, 1.96, -d / 2], [w / 2 - 0.01, 1.96, d / 2], 0.012, metal);
      m.rod([-w / 2 + 0.06, 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, 1.95, -d / 2 + 0.06], 0.012, metal);
      m.rod([-w / 2 + 0.06, 1.92, -d / 2 + 0.06], [-w / 2 + 0.2, 1.92, -d / 2 + 0.2], 0.01, metal);
      m.cylinder(0.08, 0.07, 0.02, [-w / 2 + 0.2, 1.91, -d / 2 + 0.2], metal);
      break;
    }
    case "fireplace": {
      // 石積みの本体と炉、上のマントル、薪と炎
      const stone = m.material("fireplace-stone", 0xb7ab98, 0.92, 0, true);
      const soot = m.material("firebox", 0x2a2522, 0.95);
      const height = 1.1;
      m.box(w, 0.08, d, 0, 0.04, 0, stone, 0.01);
      for (const sign of [-1, 1]) m.box(w * 0.2, height - 0.08, d * 0.8, sign * w * 0.4, (height + 0.08) / 2, -d * 0.1, stone);
      m.box(w * 0.6, 0.3, d * 0.8, 0, height - 0.15, -d * 0.1, stone);
      m.box(w * 0.6, height - 0.38, d * 0.08, 0, (height - 0.38) / 2 + 0.08, -d * 0.46, soot);
      m.box(w * 0.6, 0.01, d * 0.7, 0, 0.085, -d * 0.12, soot);
      m.box(w, 0.05, d * 0.9, 0, height + 0.025, -d * 0.05, wood, 0.01);
      m.rod([-w * 0.17, 0.12, -d * 0.18], [w * 0.17, 0.12, -d * 0.06], 0.035, darkWood);
      m.rod([-w * 0.17, 0.12, -d * 0.06], [w * 0.17, 0.12, -d * 0.18], 0.035, darkWood);
      const flame = m.material("flame", 0xffa04a, 0.6);
      flame.emissive.setHex(0xff7a1a);
      flame.emissiveIntensity = 0.9;
      for (const [x, size] of [[-0.09, 0.8], [0, 1], [0.09, 0.75]]) {
        m.mesh(new THREE.ConeGeometry(0.05 * size, 0.24 * size, 8), [w * x, 0.15 + 0.12 * size, -d * 0.12], flame);
      }
      break;
    }
    case "bicycle":
    case "motorcycle": {
      // 前を奥（-z）に向ける。車輪は縦向き、車体は中心線に沿って置く
      const moto = item.kind === "motorcycle", r = moto ? 0.3 : 0.33, tube = moto ? 0.065 : 0.022;
      const hub = r + tube, front = -d * 0.31, rear = d * 0.31;
      const tire = m.material("tire", 0x23282b, 0.8);
      const paint = m.material(moto ? "bike-body" : "bike-frame", moto ? 0xa34445 : 0x3f7f8f, 0.35, 0.2, true);
      for (const z of [front, rear]) {
        m.ring(r, tube, [0, hub, z], tire).rotation.y = Math.PI / 2;
        if (moto) {
          m.cylinder(r * 0.55, r * 0.55, 0.05, [0, hub, z], metal).rotation.z = Math.PI / 2;
        } else {
          for (let i = 0; i < 6; i += 1) {
            const a = i * Math.PI / 3;
            m.rod([0, hub, z], [0, hub + Math.sin(a) * r * 0.95, z + Math.cos(a) * r * 0.95], 0.004, metal);
          }
        }
      }
      if (moto) {
        m.box(0.28, 0.34, d * 0.34, 0, hub + 0.1, d * 0.02, black, 0.05);
        m.ellipsoid(0.32, 0.2, d * 0.2, [0, 0.85, -d * 0.08], paint);
        m.box(0.26, 0.08, d * 0.3, 0, 0.82, d * 0.16, black, 0.03);
        m.box(0.2, 0.05, d * 0.22, 0, 0.72, rear - r * 0.2, paint, 0.02);
        m.rod([0.15, 0.36, d * 0.06], [0.15, 0.42, rear + r * 0.1], 0.035, metal);
        const light = m.cylinder(0.07, 0.07, 0.05, [0, 0.9, front + r * 0.35], ivory);
        light.rotation.x = Math.PI / 2;
      } else {
        const crank: Position = [0, hub * 0.95, d * 0.02], seatTop: Position = [0, 0.92, d * 0.1];
        const headTop: Position = [0, 0.95, -d * 0.2], headLow: Position = [0, 0.7, -d * 0.22];
        m.rod([0, hub, rear], crank, 0.017, paint);
        m.rod(crank, seatTop, 0.019, paint);
        m.rod([0, hub, rear], seatTop, 0.015, paint);
        m.rod(seatTop, headTop, 0.019, paint);
        m.rod(crank, headLow, 0.021, paint);
        m.box(0.12, 0.05, 0.25, 0, 0.99, d * 0.12, black, 0.02);
        m.rod([0, 0.92, d * 0.1], [0, 0.97, d * 0.12], 0.013, metal);
      }
      m.rod([0, hub, front], [0, moto ? 0.95 : 0.98, front + r * 0.35], moto ? 0.024 : 0.016, metal);
      m.rod([-w * 0.45, moto ? 1.0 : 1.02, front + r * 0.4], [w * 0.45, moto ? 1.0 : 1.02, front + r * 0.4], 0.015, black);
      break;
    }
    case "tree":
    case "shrub": {
      // 葉の塊をいくつか重ねた樹冠。木には幹と枝を付け、低木は地面から茂らせる
      const isTree = item.kind === "tree";
      const foliage = m.material("foliage", 0x5f9150, 0.92, 0, true);
      const shade = m.material("foliage-shade", 0x4b7a43, 0.95, 0, true);
      const crownBottom = isTree ? tall * 0.38 : 0;
      const crownH = tall - crownBottom;
      if (isTree) {
        const bark = m.material("bark", 0x6d5844, 0.95);
        const trunkR = Math.min(clamp(tall * 0.028, 0.04, 0.3), Math.min(w, d) * 0.1);
        const trunkTop = crownBottom + crownH * 0.3;
        m.cylinder(trunkR * 0.65, trunkR, trunkTop, [0, trunkTop / 2, 0], bark, 10);
        for (let i = 0; i < 3; i += 1) {
          const a = i * 2.1 + 0.5;
          m.rod([0, crownBottom * 0.85, 0], [Math.cos(a) * w * 0.2, crownBottom + crownH * 0.25, Math.sin(a) * d * 0.2], trunkR * 0.35, bark);
        }
      }
      const mainY = isTree ? 0.42 : 0.36;
      m.ellipsoid(w * 0.8, crownH * 0.72, d * 0.8, [0, crownBottom + crownH * mainY, 0], foliage);
      m.ellipsoid(w * 0.5, crownH * 0.46, d * 0.5, [0, tall - crownH * 0.23, 0], foliage);
      const lumps: Position[] = [[0.26, 0.4, 0.05], [-0.25, 0.46, 0.14], [0.04, 0.38, -0.27], [-0.1, 0.52, 0.24], [0.2, 0.5, -0.18], [-0.22, 0.35, -0.16]];
      lumps.forEach(([x, y, z], i) => m.ellipsoid(w * 0.46, crownH * 0.44, d * 0.46, [x * w, crownBottom + crownH * y, z * d], i % 2 ? shade : foliage));
      break;
    }
    case "conifer": {
      // 細い幹と、上ほど小さくなる円すいを4段重ねる
      const needles = m.material("needles", 0x3f6f47, 0.92, 0, true);
      const bark = m.material("bark", 0x6d5844, 0.95);
      const trunkR = Math.min(clamp(tall * 0.025, 0.03, 0.25), Math.min(w, d) * 0.08);
      m.cylinder(trunkR * 0.7, trunkR, tall * 0.2, [0, tall * 0.1, 0], bark, 8);
      const tiers: [number, number, number][] = [[0.12, 0.55, 0.5], [0.34, 0.74, 0.4], [0.53, 0.9, 0.3], [0.7, 1, 0.2]];
      for (const [from, to, radius] of tiers) {
        const cone = m.cylinder(0, 1, tall * (to - from), [0, tall * (from + to) / 2, 0], needles, 14);
        cone.scale.set(w * radius, 1, d * radius);
      }
      break;
    }
    case "palmTree": {
      // 少し反った幹の先に、四方へ垂れる長い葉とヤシの実
      const bark = m.material("palm-bark", 0x8a7456, 0.95);
      const frond = m.material("palm-frond", 0x4f8a46, 0.88, 0, true);
      const nut = m.material("coconut", 0x6b4f2e, 0.8);
      const reach = Math.min(Math.min(w, d) * 0.5, tall * 0.45);
      const up = 0.35;
      // 上向きの葉の先がちょうど指定の高さになるよう、幹を低くしておく
      const topY = tall - Math.sin(up) * reach;
      // 低いヤシでも幹が寝すぎたり太すぎたりしないよう、反りと太さは高さにも合わせる
      const lean = Math.min(Math.min(w, d) * 0.12, tall * 0.08);
      const radius = Math.max(0.012, Math.min(Math.min(w, d) * 0.035, tall * 0.025));
      let previous: Position = [0, 0, 0];
      for (let i = 1; i <= 6; i += 1) {
        const t = i / 6;
        const next: Position = [lean * t * t, topY * t, 0];
        m.rod(previous, next, radius * (1.15 - t * 0.35), bark);
        previous = next;
      }
      const [tx, ty, tz] = previous;
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2 + (i % 2) * 0.12;
        const droop = i % 3 === 0 ? -up : 0.28 + (i % 2) * 0.3;
        const dx = Math.cos(droop) * Math.cos(a), dy = -Math.sin(droop), dz = -Math.cos(droop) * Math.sin(a);
        const leaf = m.ellipsoid(reach, 0.035, reach * 0.3, [tx + dx * reach / 2, ty + dy * reach / 2, tz + dz * reach / 2], frond);
        leaf.rotation.set(0, a, -droop);
      }
      for (let i = 0; i < 3; i += 1) {
        const a = i * 2.1;
        m.ellipsoid(0.12, 0.13, 0.12, [tx + Math.cos(a) * 0.08, ty - 0.1, tz + Math.sin(a) * 0.08], nut);
      }
      break;
    }
    case "rock": {
      // 頂点を少しずつ押し引きした多面体。角ばって見えるよう面ごとに陰を付ける
      const stone = m.material("rock", 0x8e8b83, 0.96, 0, true);
      stone.flatShading = true;
      placeRock(m, stone, 0, 0, 0, w * 0.85, tall, d * 0.9);
      placeRock(m, stone, 3.1, w * 0.4, d * 0.28, w * 0.3, tall * 0.35, d * 0.3);
      break;
    }
    case "steppingStones": {
      // 歩く向きに並べた、角の取れた平たい石。左右に少しずらし、向きも変える
      const stone = m.material("stepping-stone", 0x9c998f, 0.93, 0, true);
      stone.flatShading = true;
      const along = d >= w;
      const length = along ? d : w, span = along ? w : d;
      const count = Math.max(2, Math.round(length / 0.55));
      for (let i = 0; i < count; i += 1) {
        const t = -length / 2 + (length * (i + 0.5)) / count;
        const side = (i % 2 ? 1 : -1) * span * 0.12;
        const rx = Math.min(span * 0.72, (length / count) * 0.84), rz = Math.min(span * 0.6, (length / count) * 0.72);
        placeRock(m, stone, i * 1.7, along ? side : t, along ? t : side, along ? rx : rz, 0.07, along ? rz : rx, i * 0.7);
      }
      break;
    }
    case "flowerBed": {
      // れんがの縁、土、茎の先に色とりどりの花
      const border = m.material("bed-border", 0xa86f4c, 0.85, 0, true);
      const soil = m.material("soil", 0x4a3b2c, 1);
      const stem = m.material("stem", 0x4f7a3d, 0.9);
      const blooms = [0xe8506a, 0xf2c14e, 0xf4f1ea, 0xb07cd8].map((color, i) => m.material(`flower-${i}`, color, 0.7));
      const edgeH = 0.25, t = Math.min(0.08, w * 0.12, d * 0.2);
      for (const side of [-1, 1]) {
        m.box(w, edgeH, t, 0, edgeH / 2, side * (d / 2 - t / 2), border, 0.004);
        m.box(t, edgeH, d - t * 2, side * (w / 2 - t / 2), edgeH / 2, 0, border, 0.004);
      }
      const innerW = w - t * 2, innerD = d - t * 2, soilTop = edgeH * 0.8;
      m.box(innerW, soilTop, innerD, 0, soilTop / 2, 0, soil, 0);
      const cols = clamp(Math.round(innerW / 0.2), 1, 12), rows = clamp(Math.round(innerD / 0.2), 1, 4);
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = -innerW / 2 + (innerW * (col + 0.5)) / cols, z = -innerD / 2 + (innerD * (row + 0.5)) / rows;
          const top = soilTop + 0.14 + ((row * 3 + col * 7) % 4) * 0.03;
          m.rod([x, soilTop, z], [x, top, z], 0.006, stem);
          m.ellipsoid(0.08, 0.045, 0.08, [x, top + 0.015, z], blooms[(row + col * 3) % blooms.length]);
        }
      }
      break;
    }
    case "pond": {
      // つやのある水面と、ふちを囲む石
      const rim = m.material("pond-stone", 0x9a968c, 0.95);
      const water = m.material("water", 0x4a8aa3, 0.06, 0.15, true);
      const surface = m.cylinder(0.5, 0.5, 0.04, [0, 0.03, 0], water, 40);
      surface.scale.set(w * 0.88, 1, d * 0.88);
      const count = clamp(Math.round((Math.PI * (w + d)) / 2 / 0.32), 10, 28);
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        const size = 0.16 + (i * 37 % 5) * 0.02;
        const rock = m.ellipsoid(size * 1.3, size * 0.7, size, [Math.cos(a) * w * 0.45, size * 0.35, Math.sin(a) * d * 0.45], rim);
        rock.rotation.y = -a;
      }
      break;
    }
    case "fence": {
      // 長い辺に沿って、支柱・横木・縦板を並べる。いちばん高い支柱が指定の高さ
      const boards = m.material("fence", 0xc8b08a, 0.8, 0, true);
      const along = w >= d;
      const length = along ? w : d;
      const place = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
        along ? m.box(sx, sy, sz, x, y, z, boards, 0) : m.box(sz, sy, sx, z, y, x, boards, 0);
      const posts = Math.max(2, Math.round(length / 0.9) + 1);
      const post = Math.min(0.08, (length / posts) * 0.5);
      for (let i = 0; i < posts; i += 1) place(-length / 2 + post / 2 + ((length - post) * i) / (posts - 1), tall / 2, 0, post, tall, post);
      for (const y of [0.22, 0.78]) place(0, tall * y, 0.03, length, 0.05, 0.025);
      const slats = clamp(Math.floor(length / 0.12), 1, 80);
      for (let i = 0; i < slats; i += 1) place(-length / 2 + (length * (i + 0.5)) / slats, tall * 0.47, 0.05, Math.min(0.085, length / slats * 0.7), tall * 0.86, 0.016);
      break;
    }
    case "gardenLight": {
      // 台座、細い柱、光る灯り、笠
      const pole = m.material("lamp-pole", 0x30353a, 0.5, 0.2, true);
      const glow = m.material("lamp-glow", 0xfff1c6, 0.35);
      glow.emissive.set(0xffdf8a);
      glow.emissiveIntensity = 0.55;
      const poleTop = tall * 0.84, lampH = tall * 0.11;
      m.cylinder(0.11, 0.13, 0.08, [0, 0.04, 0], pole, 20);
      m.cylinder(0.03, 0.04, poleTop, [0, poleTop / 2, 0], pole, 12);
      m.cylinder(0.1, 0.075, lampH, [0, poleTop + lampH / 2, 0], glow, 20);
      m.cylinder(0.02, 0.15, tall - poleTop - lampH, [0, (tall + poleTop + lampH) / 2, 0], pole, 20);
      break;
    }
    case "stoneLantern": {
      // 石灯籠: 基礎、竿、中台、火袋（窓は暗く）、六角の笠、宝珠
      const granite = m.material("granite", 0xaaa79e, 0.93, 0, true);
      const opening = m.material("lantern-opening", 0x2e2b27, 0.9);
      const part = (top: number, bottom: number, height: number, y: number, scale: number, segments: number) => {
        const mesh = m.cylinder(top, bottom, height, [0, y + height / 2, 0], granite, segments);
        mesh.scale.set(w * scale, 1, d * scale);
      };
      part(0.5, 0.5, 0.1, 0, 0.8, 6);
      part(0.5, 0.5, 0.4, 0.1, 0.28, 12);
      part(0.5, 0.36, 0.1, 0.5, 0.66, 6);
      m.box(w * 0.42, 0.22, d * 0.42, 0, 0.71, 0, granite, 0.01);
      m.box(w * 0.2, 0.12, d * 0.44, 0, 0.72, 0, opening, 0);
      m.box(w * 0.44, 0.12, d * 0.2, 0, 0.72, 0, opening, 0);
      part(0.1, 0.5, 0.18, 0.82, 1, 6);
      m.ellipsoid(w * 0.14, 0.14, d * 0.14, [0, 1.05, 0], granite);
      break;
    }
    case "mailbox": {
      // 柱の上に、丸いふたの箱と投函口
      const paint = m.material("mailbox", 0x3d4448, 0.45, 0.25, true);
      m.box(w * 0.18, 0.85, d * 0.22, 0, 0.425, 0, black, 0.01);
      m.box(w, 0.34, d, 0, 1.0, 0, paint, 0.025);
      const lid = m.cylinder(d / 2, d / 2, w, [0, 1.17, 0], paint, 20);
      lid.rotation.z = Math.PI / 2;
      m.box(w * 0.5, 0.025, 0.012, 0, 1.08, d / 2 + 0.004, black, 0);
      break;
    }
    case "shed": {
      // 金属の物置: 土台、本体、前へ少し高い片流れの屋根、2枚の引き戸と取っ手
      const panel = m.material("shed-panel", 0xc6cbc4, 0.55, 0.2, true);
      const trim = m.material("shed-trim", 0x575d63, 0.5, 0.3);
      m.box(w, 0.08, d, 0, 0.04, 0, trim, 0.005);
      m.box(w * 0.96, 1.78, d * 0.9, 0, 0.97, 0, panel, 0.01);
      const roof = m.box(w, 0.05, d, 0, 1.9, 0, trim, 0.008);
      roof.rotation.x = -0.07;
      for (const side of [-1, 1]) {
        m.box(w * 0.47, 1.62, 0.02, side * w * 0.235, 0.9, d * 0.45 + (side > 0 ? 0.012 : 0.024), panel, 0.004);
        m.box(0.02, 0.18, 0.02, side * w * 0.04, 0.95, d * 0.45 + 0.04, trim, 0);
      }
      break;
    }
    case "dogHouse": {
      // 箱形の本体に三角の妻壁と切妻屋根、手前にアーチ形の出入口
      const wallMat = m.material("doghouse-wall", 0xd9b98c, 0.75, 0, true);
      const roofMat = m.material("doghouse-roof", 0x9a4a3a, 0.7);
      const hole = m.material("doghouse-opening", 0x2a2521, 0.9);
      const bw = w * 0.84, bd = d * 0.9, wallH = 0.45, gable = Math.min(bw * 0.45, 0.3);
      m.box(bw, wallH, bd, 0, wallH / 2, 0, wallMat, 0.01);
      const shape = new THREE.Shape();
      shape.moveTo(-bw / 2, 0);
      shape.lineTo(bw / 2, 0);
      shape.lineTo(0, gable);
      shape.closePath();
      const gableGeometry = new THREE.ExtrudeGeometry(shape, { depth: bd, bevelEnabled: false });
      gableGeometry.translate(0, 0, -bd / 2);
      m.mesh(gableGeometry, [0, wallH, 0], wallMat);
      const slope = Math.atan2(gable, bw / 2), length = Math.hypot(bw / 2, gable) + 0.06;
      for (const side of [-1, 1]) {
        const plank = m.box(length, 0.03, d, side * (bw / 4 + 0.012), wallH + gable / 2 + 0.02, 0, roofMat, 0.006);
        plank.rotation.z = -side * slope;
      }
      m.box(bw * 0.34, 0.26, 0.02, 0, 0.15, bd / 2 + 0.006, hole, 0);
      const arch = m.cylinder(bw * 0.17, bw * 0.17, 0.02, [0, 0.28, bd / 2 + 0.006], hole, 20);
      arch.rotation.x = Math.PI / 2;
      break;
    }
    default: {
      const unsupported: never = item.kind;
      throw new Error(`Unsupported furniture: ${unsupported}`);
    }
  }
  m.group.name = item.kind;
  return m.finish(w, d, item.kind === "wallClock" || item.kind === "airConditioner", optimize);
}
