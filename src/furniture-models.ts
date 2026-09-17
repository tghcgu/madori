import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FurnitureKind } from "./furniture-catalog";

type Position = [number, number, number];
type Material = THREE.MeshStandardMaterial;
export interface FurnitureModelOptions {
  kind: FurnitureKind;
  w: number;
  h: number;
  color?: string;
  color3d?: string;
  rise?: number;
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

export function buildFurnitureModel(item: FurnitureModelOptions, optimize = true): THREE.Group {
  if (!Number.isFinite(item.w) || !Number.isFinite(item.h) || item.w <= 0 || item.h <= 0) throw new Error("Invalid furniture dimensions");
  const w = item.w / 100, d = item.h / 100;
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
    case "sideTable":
    case "desk": {
      const height = item.kind === "desk" ? 0.74 : item.kind === "sideTable" ? 0.55 : 0.42;
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
    case "bedDouble": {
      legs(w * 0.88, d * 0.88, 0.14);
      m.box(w, 0.2, d * 0.96, 0, 0.23, d * 0.02, darkWood, 0.018);
      m.box(w, 0.94, d * 0.045, 0, 0.51, -d * 0.475, wood, 0.025);
      m.box(w * 0.9, 0.53, d * 0.027, 0, 0.66, -d * 0.447, cushion, 0.045);
      m.box(w * 0.95, 0.21, d * 0.91, 0, 0.435, d * 0.026, ivory, 0.045);
      m.box(w * 0.965, 0.075, d * 0.66, 0, 0.553, d * 0.15, fabric, 0.035);
      m.box(w * 0.96, 0.04, d * 0.12, 0, 0.61, -d * 0.135, cushion, 0.025);
      const pillows = item.kind === "bed" ? 1 : 2;
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
    case "kitchen": {
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
    case "plant": {
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
    default: {
      const unsupported: never = item.kind;
      throw new Error(`Unsupported furniture: ${unsupported}`);
    }
  }
  m.group.name = item.kind;
  return m.finish(w, d, item.kind === "wallClock", optimize);
}
