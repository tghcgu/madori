import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
// テストでは Node がそのまま読むため、値を読み込むときは拡張子まで書く
import { FURNITURE_DEFS, FURNITURE_VARIANTS, FURNITURE_VARIANTS_2D_ONLY, type FurnitureKind } from "./furniture-catalog.ts";
import {
  CONIFER_TIERS, PALM_FROND_ANGLES, PETAL_ANGLES, PLANT_LEAF_ANGLES, RIPPLE_END, RIPPLE_START, ROUND_LEAF_CLUMPS,
  bezierPoint, closetDoorCount, fernFronds, flowerBedLayout, pondShape, rockShapes, rockVertexHeights, rugDiamonds,
  steppingStoneLayout, woodGrain, type Point2, type RockShape,
  CAT_TOWER_DECKS, COAT_HOOK_ANGLES, COAT_HOOK_REACH, DRYER_POLES, PARASOL_CORNERS,
  blockWallCaps, cribBars, cribRail, dryerFootWidth, roundFlowerBedLayout, type FlowerBedLayout,
} from "./furniture-shapes.ts";

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
  // 別デザインの番号（1から）。2Dの記号と同じ番号で、3Dも同じデザインになる
  symbol?: number;
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

  // 形の外側に余白があっても、上から見た大きさを設置範囲（w×d）ちょうどに保つための見えない板。
  // これがないと、余白のぶん形が引き伸ばされ、2Dの記号と大きさがずれる
  reserveFootprint(w: number, d: number): void {
    const material = this.material("footprint", 0xffffff);
    material.transparent = true;
    material.opacity = 0;
    material.visible = false;
    material.depthWrite = false;
    const mesh = this.mesh(new THREE.BoxGeometry(w, 0.001, d), [0, 0.0005, 0], material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
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

// 2Dの記号と同じ輪郭・頂上・稜線から、頂上へ向かう平らな面でできた岩を作る。
// 稜線と稜線の間を1枚の平面にするので、上から見ると2Dの記号と同じ面の分かれ方になる。側面は垂直
function rockSolidGeometry(shape: RockShape, height: number): THREE.BufferGeometry {
  const heights = rockVertexHeights(shape).map((k) => k * height * shape.height);
  const peak = new THREE.Vector3(shape.peak[0] / 100, height * shape.height, shape.peak[1] / 100);
  const top = shape.outline.map(([x, y], i) => new THREE.Vector3(x / 100, heights[i], y / 100));
  const bottom = shape.outline.map(([x, y]) => new THREE.Vector3(x / 100, 0, y / 100));
  const center = bottom.reduce((sum, v) => sum.add(v), new THREE.Vector3()).multiplyScalar(1 / bottom.length);
  const positions: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, outward: THREE.Vector3) => {
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const [p, q] = normal.dot(outward) >= 0 ? [b, c] : [c, b];
    positions.push(a.x, a.y, a.z, p.x, p.y, p.z, q.x, q.y, q.z);
  };
  const up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0);
  top.forEach((vertex, i) => {
    const next = (i + 1) % top.length;
    triangle(peak, vertex, top[next], up);
    const outward = new THREE.Vector3().addVectors(bottom[i], bottom[next]).multiplyScalar(0.5).sub(center).setY(0);
    triangle(vertex, bottom[i], bottom[next], outward);
    triangle(vertex, bottom[next], top[next], outward);
    triangle(center, bottom[next], bottom[i], down);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// 上から見た輪郭（cm）を、上面が top・厚み thickness の板にする
function shapeSlab(shape: THREE.Shape, thickness: number, top: number, m: Model, material: Material, segments = 12): THREE.Mesh {
  const mesh = m.mesh(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: segments }), [0, top, 0], material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

// 2Dの記号と同じ木目の曲線と節を、天板の上に細い溝として付ける（丸い天板では縁の内側だけ）
function addWoodGrain(m: Model, wCm: number, hCm: number, top: number, round: boolean, material: Material): void {
  const grain = woodGrain(wCm, hCm);
  const inside = ([x, y]: Point2) => !round || (x / (wCm / 2)) ** 2 + (y / (hCm / 2)) ** 2 <= 0.94;
  const tube = (points: Point2[], closed: boolean) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x / 100, top, y / 100)), closed);
    m.mesh(new THREE.TubeGeometry(curve, closed ? 24 : 32, 0.0018, 4, closed), [0, 0, 0], material);
  };
  for (const line of grain.lines) {
    const points = Array.from({ length: 25 }, (_, i) => bezierPoint(line, i / 24)).filter(inside);
    if (points.length >= 2) tube(points, false);
  }
  const { x, y, rx, ry } = grain.knot;
  tube(Array.from({ length: 16 }, (_, i): Point2 => [x + Math.cos((i / 16) * Math.PI * 2) * rx, y + Math.sin((i / 16) * Math.PI * 2) * ry]), true);
}

// 花壇の花: 2Dと同じ位置に、茎の先の5枚の花びらと花芯
function plantFlowers(m: Model, layout: FlowerBedLayout, soilTop: number, stem: Material, petals: Material[], center: Material): void {
  const r = layout.size / 200;
  layout.flowers.forEach(([fx, fy], i) => {
    const x = fx / 100, z = fy / 100, top = soilTop + 0.12 + (i % 3) * 0.03;
    m.rod([x, soilTop, z], [x, top, z], 0.006, stem);
    for (const a of PETAL_ANGLES) m.ellipsoid(r * 0.84, 0.02, r * 0.84, [x + Math.cos(a) * r * 0.5, top, z + Math.sin(a) * r * 0.5], petals[i % petals.length]);
    m.ellipsoid(r * 0.52, 0.03, r * 0.52, [x, top + 0.012, z], center);
  });
}

// 中心の頂点と周りの点から、傘や円すいの面を作る（周りの点は上から見て時計回り）
function fanGeometry(apex: THREE.Vector3, ring: THREE.Vector3[]): THREE.BufferGeometry {
  const positions: number[] = [];
  ring.forEach((vertex, i) => {
    const next = ring[(i + 1) % ring.length];
    positions.push(apex.x, apex.y, apex.z, next.x, next.y, next.z, vertex.x, vertex.y, vertex.z);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function polygonShape(points: Point2[]): THREE.Shape {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x / 100, y / 100)));
}

export function buildFurnitureModel(item: FurnitureModelOptions, optimize = true): THREE.Group {
  if (!Number.isFinite(item.w) || !Number.isFinite(item.h) || item.w <= 0 || item.h <= 0) throw new Error("Invalid furniture dimensions");
  const w = item.w / 100, d = item.h / 100;
  // 高さを指定できる種類では、いちばん高い所がちょうどこの高さになるように作る
  const tall = clamp((item.height ?? FURNITURE_DEFS[item.kind].height ?? 100) / 100, 0.1, 30);
  const m = new Model(item.color3d ?? item.color);
  // 別デザインの番号。0は標準。範囲外の番号は標準として作る
  const variantCount = FURNITURE_VARIANTS[item.kind]?.length ?? 0;
  const only2d = FURNITURE_VARIANTS_2D_ONLY[item.kind] ?? [];
  const variant = typeof item.symbol === "number" && Number.isInteger(item.symbol) && item.symbol >= 1 && item.symbol <= variantCount && !only2d.includes(item.symbol) ? item.symbol : 0;
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
  // 椅子（ダイニングセットの椅子も共通）。facing は座る人が向く側（1なら手前）。
  // style 0: 標準（座布団と板の背もたれ）、1: 四隅のまっすぐな脚と横桟の背もたれ、2: 丸い座面と曲げ木の背もたれ
  const chair = (cw: number, cd: number, x: number, z: number, facing = 1, style = 0) => {
    if (style === 1) {
      const lx = cw * 0.4, lz = cd * 0.4, r = Math.min(cw, cd) * 0.032;
      const backZ = (y: number) => z - facing * lz * (1 + ((y - 0.43) / 0.49) * 0.1);
      for (const sx of [-1, 1]) {
        m.rod([x + sx * lx, 0, z + facing * lz], [x + sx * lx, 0.43, z + facing * lz], r, darkWood, "leg");
        m.rod([x + sx * lx, 0, z - facing * lz], [x + sx * lx, 0.92, backZ(0.92)], r, darkWood, "leg");
        m.rod([x + sx * lx, 0.16, z - facing * lz], [x + sx * lx, 0.16, z + facing * lz], r * 0.6, darkWood);
      }
      m.box(cw * 0.92, 0.04, cd * 0.92, x, 0.45, z, wood, 0.012);
      for (const y of [0.63, 0.76, 0.89]) m.box(cw * 0.8, 0.05, cd * 0.05, x, y, backZ(y), wood, 0.01);
      return;
    }
    if (style === 2) {
      const r = Math.min(cw, cd) * 0.42, cz = z + facing * cd * 0.04;
      m.cylinder(r, r * 0.95, 0.06, [x, 0.45, cz], fabric, 32);
      for (let i = 0; i < 4; i += 1) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        m.rod([x + Math.cos(a) * r * 0.62, 0.43, cz + Math.sin(a) * r * 0.62], [x + Math.cos(a) * r * 0.86, 0, cz + Math.sin(a) * r * 0.86], r * 0.06, darkWood, "leg");
      }
      const ring = m.ring(r * 0.74, r * 0.035, [x, 0.2, cz], darkWood);
      ring.rotation.x = Math.PI / 2;
      // 背もたれは座面の後ろ半分を囲む曲げ木。2Dの弓形の背もたれと同じ形
      const arc = 2.3, railR = r * 0.95;
      const rail = m.mesh(new THREE.TorusGeometry(railR, r * 0.055, 8, 28, arc), [x, 0.84, cz], darkWood);
      rail.rotation.set(-Math.PI / 2, 0, (facing * Math.PI) / 2 - arc / 2);
      for (const offset of [-arc / 2, -arc / 4, 0, arc / 4, arc / 2]) {
        const a = -facing * (Math.PI / 2) - offset;
        m.rod([x + Math.cos(a) * r * 0.88, 0.47, cz + Math.sin(a) * r * 0.88], [x + Math.cos(a) * railR, 0.84, cz + Math.sin(a) * railR], r * (offset === 0 || Math.abs(offset) === arc / 2 ? 0.045 : 0.03), darkWood);
      }
      return;
    }
    legs(cw, cd, 0.425, 0, x, z);
    m.box(cw * 0.95, 0.055, cd * 0.9, x, 0.447, z, wood, 0.02);
    m.box(cw * 0.82, 0.035, cd * 0.73, x, 0.484, z + facing * cd * 0.025, cushion, 0.015);
    for (const sx of [-1, 1]) m.rod([x + sx * cw * 0.36, 0.43, z - facing * cd * 0.35], [x + sx * cw * 0.36, 0.91, z - facing * cd * 0.43], Math.min(cw, cd) * 0.038, darkWood);
    const back = m.box(cw * 0.83, 0.24, cd * 0.085, x, 0.79, z - facing * cd * 0.4, wood, 0.028);
    back.rotation.x = -facing * 0.09;
  };
  // 上から見た多角形（[x, z] の並び）を、厚み thickness の板にして上面が top になるように置く
  const slab = (points: [number, number][], thickness: number, top: number, material: Material) => {
    const shape = new THREE.Shape(points.map(([px, pz]) => new THREE.Vector2(px, pz)));
    const mesh = m.mesh(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }), [0, top, 0], material);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  // 布団の角を斜めに折り返した形。本体は角を切った板、折り返しは裏地の色の三角の板
  const foldedCover = (left: number, right: number, top: number, bottom: number, fold: number, thickness: number, surface: number, cover: Material, lining: Material, foldZ = fold) => {
    slab([[left, top], [right - fold, top], [right, top + foldZ], [right, bottom], [left, bottom]], thickness, surface, cover);
    slab([[right - fold, top], [right, top + foldZ], [right - fold, top + foldZ]], 0.018, surface + 0.018, lining);
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
      if (variant) {
        const count = item.kind === "armchair" ? 1 : Math.max(2, Math.min(4, Math.round(w / 0.65)));
        legs(w * 0.91, d * 0.88, 0.1, 0, 0, 0, black);
        if (variant === 1) {
          // 丸く巻いた肘、丸みのある背、座面は一枚の長いクッション
          const arm = Math.min(w, d) * 0.2;
          m.box(w * 0.96, 0.22, d * 0.94, 0, 0.21, 0, fabric, 0.06);
          m.box(w - arm * 1.2, 0.46, d * 0.22, 0, 0.5, -d * 0.36, fabric, 0.09);
          m.box(w - arm * 2, 0.15, d * 0.68, 0, 0.395, d * 0.1, fabric, 0.06);
          for (const sx of [-1, 1]) {
            const ax = sx * (w / 2 - arm / 2);
            m.box(arm, 0.36, d * 0.94, ax, 0.32, 0, fabric, 0.05);
            const roll = m.cylinder(arm * 0.55, arm * 0.55, d * 0.94, [ax, 0.5, 0], fabric, 20);
            roll.rotation.x = Math.PI / 2;
          }
        } else {
          // 細い肘と、座る人数分の背クッション（明るい色）・座面クッション
          const arm = Math.min(w, d) * 0.1;
          m.box(w * 0.96, 0.2, d * 0.94, 0, 0.2, 0, fabric, 0.03);
          m.box(w * 0.96, 0.4, d * 0.16, 0, 0.5, -d * 0.39, fabric, 0.03);
          for (const sx of [-1, 1]) m.box(arm, 0.5, d * 0.94, sx * (w / 2 - arm / 2), 0.35, 0, fabric, 0.025);
          const usable = w - arm * 2, cw = usable / count;
          for (let i = 0; i < count; i += 1) {
            const x = -usable / 2 + cw * (i + 0.5);
            m.box(cw * 0.96, 0.14, d * 0.62, x, 0.37, d * 0.13, fabric, 0.05);
            const back = m.box(cw * 0.9, 0.42, d * 0.2, x, 0.62, -d * 0.24, cushion, 0.09);
            back.rotation.x = -0.18;
          }
        }
        break;
      }
      if (corner) {
        // 2Dの記号と同じ区切り: 奥の背もたれ、右の肘、座面3つ（左・中・右）と、右手前へ伸びる寝椅子、左端のクッション
        const back = d * 0.14, arm = w * 0.1, seatFront = 0;
        legs(w * 0.95, d * 0.46, 0.13, 0, 0, -d * 0.25, black);
        legs(w * 0.34, d * 0.46, 0.13, 0, w * 0.31, d * 0.25, black);
        m.box(w, 0.2, d * 0.5, 0, 0.22, -d * 0.25, fabric, 0.045);
        m.box(w * 0.38, 0.2, d * 0.5, w * 0.31, 0.22, d * 0.25, fabric, 0.045);
        m.box(w - arm, 0.6, back, -arm / 2, 0.53, -d / 2 + back / 2, fabric, 0.055);
        m.box(arm, 0.45, d, w / 2 - arm / 2, 0.4, 0, fabric, 0.045);
        for (const [x0, x1] of [[-0.5, -0.18], [-0.18, 0.12], [0.12, 0.4]]) {
          m.box((x1 - x0) * w * 0.97, 0.14, (seatFront + d * 0.36) * 0.97, ((x0 + x1) / 2) * w, 0.39, (seatFront - d * 0.36) / 2, fabric, 0.045);
        }
        m.box(w * 0.22, 0.14, d * 0.41, w * 0.26, 0.39, d * 0.245, fabric, 0.045);
        const cornerPillow = m.box(w * 0.16, 0.26, d * 0.1, -w * 0.33, 0.58, -d * 0.22, cushion, 0.06);
        cornerPillow.rotation.x = -0.35;
        break;
      }
      const seatD = d;
      const z = 0;
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
      break;
    }
    case "table":
    case "longTable":
    case "sideTable":
    case "desk": {
      const height = item.kind === "desk" ? 0.74 : item.kind === "longTable" ? 0.72 : item.kind === "sideTable" ? 0.55 : 0.42;
      const grommet = () => {
        const hole = m.cylinder(Math.min(w, d) * 0.025, Math.min(w, d) * 0.025, 0.003, [-w * 0.3, height + 0.002, -d * 0.32], black);
        hole.name = "cable-grommet";
      };
      if (item.kind === "sideTable" && variant === 1) {
        // 丸いサイドテーブル: 丸い天板と縁の溝、3本脚、丸い棚板
        const top = m.cylinder(0.5, 0.48, 0.035, [0, height - 0.0175, 0], wood, 40);
        top.scale.set(w, 1, d);
        const groove = m.ring(0.46, 0.003, [0, height + 0.0005, 0], darkWood);
        groove.rotation.x = Math.PI / 2;
        groove.scale.set(w, d, 1);
        for (let i = 0; i < 3; i += 1) {
          const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
          m.rod([Math.cos(a) * w * 0.28, height - 0.035, Math.sin(a) * d * 0.28], [Math.cos(a) * w * 0.4, 0, Math.sin(a) * d * 0.4], Math.min(w, d) * 0.03, darkWood, "leg");
        }
        const shelf = m.cylinder(0.5, 0.5, 0.02, [0, 0.16, 0], wood, 32);
        shelf.scale.set(w * 0.7, 1, d * 0.7);
        break;
      }
      if (item.kind === "table" && variant === 1) {
        // 細い金属の枠にガラスの天板。ガラス越しに下の木の棚が見える
        const frame = m.material("table-frame", 0x3a3f44, 0.4, 0.5, true);
        const t = Math.min(w, d) * 0.07;
        for (const sz of [-1, 1]) m.box(w, 0.03, t, 0, height - 0.015, sz * (d / 2 - t / 2), frame, 0.004);
        for (const sx of [-1, 1]) m.box(t, 0.03, d - t * 2, sx * (w / 2 - t / 2), height - 0.015, 0, frame, 0.004);
        m.box(w - t * 2, 0.012, d - t * 2, 0, height - 0.012, 0, m.glass("table-glass", 0xbfe0e6, 0.35), 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.rod([sx * (w / 2 - t / 2), 0, sz * (d / 2 - t / 2)], [sx * (w / 2 - t / 2), height - 0.03, sz * (d / 2 - t / 2)], 0.012, frame, "leg");
        m.box(w - t * 2, 0.022, d - t * 2, 0, 0.12, 0, wood, 0.006);
        break;
      }
      if (item.kind === "table" && variant === 2) {
        // 厚い無垢板の天板に、2Dの記号と同じ木目と節。太い角脚
        m.box(w, 0.05, d, 0, height - 0.025, 0, wood, 0.008);
        addWoodGrain(m, item.w, item.h, height + 0.001, false, darkWood);
        const leg = Math.min(w, d) * 0.12;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(leg, height - 0.05, leg, sx * (w / 2 - leg * 0.8), (height - 0.05) / 2, sz * (d / 2 - leg * 0.8), darkWood, 0.006);
        break;
      }
      if (item.kind === "desk" && variant === 2) {
        // 両袖机: 左右の袖に引き出し3段ずつ、中央に浅い引き出し、奥に幕板
        m.box(w, 0.045, d, 0, height - 0.0225, 0, wood, 0.018);
        const pw = w * 0.26, ph = height - 0.045;
        for (const sx of [-1, 1]) {
          const px = sx * (w / 2 - pw / 2);
          m.box(pw, ph, d * 0.92, px, ph / 2, 0, darkWood, 0.008);
          for (let i = 0; i < 3; i += 1) drawer(px, 0.04 + ((ph - 0.04) * (i + 0.5)) / 3, d * 0.465, pw * 0.96, (ph - 0.04) / 3);
        }
        m.box(w - pw * 2, 0.08, d * 0.85, 0, height - 0.085, 0, wood, 0.006);
        drawer(0, height - 0.085, d * 0.43, (w - pw * 2) * 0.9, 0.075);
        m.box(w - pw * 2, 0.4, 0.02, 0, height - 0.25, -d * 0.44, darkWood);
        grommet();
        break;
      }
      m.box(w, 0.045, d, 0, height - 0.0225, 0, wood, 0.018);
      legs(w, d, height - 0.045);
      m.box(w * 0.77, 0.07, d * 0.06, 0, height - 0.08, -d * 0.36, darkWood);
      if (item.kind === "sideTable") {
        m.box(w * 0.79, 0.025, d * 0.76, 0, 0.14, 0, wood);
        // 天板の内側の段と、天板から少し出た四隅の脚の頭（2Dの内側の四角と四隅の丸）
        m.box(w * 0.8, 0.004, d * 0.8, 0, height + 0.002, 0, m.material("wood-inlay", 0xc9b18d, 0.6, 0, true), 0.001);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.cylinder(Math.min(w, d) * 0.025, Math.min(w, d) * 0.025, 0.006, [sx * w * 0.36, height + 0.003, sz * d * 0.36], darkWood, 12);
      }
      if (item.kind === "table") {
        // 天板の縁に沿った溝（2Dの内側の四角）
        for (const sz of [-1, 1]) m.box(w * 0.92, 0.003, 0.004, 0, height + 0.0015, sz * d * 0.44, darkWood, 0);
        for (const sx of [-1, 1]) m.box(0.004, 0.003, d * 0.88, sx * w * 0.46, height + 0.0015, 0, darkWood, 0);
      }
      if (item.kind === "desk") {
        if (variant === 1) {
          // シンプルな机: 天板の下の右に浅い引き出しが一つだけ
          m.box(w * 0.3, 0.1, d * 0.8, w * 0.29, height - 0.095, 0, darkWood);
          drawer(w * 0.29, height - 0.095, d * 0.41, w * 0.28, 0.09);
        } else {
          m.box(w * 0.27, 0.3, d * 0.77, w * 0.29, height - 0.2, 0, darkWood);
          for (let i = 0; i < 2; i += 1) drawer(w * 0.29, height - 0.12 - i * 0.145, d * 0.395, w * 0.26, 0.145);
        }
        grommet();
      }
      break;
    }
    case "roundTable":
    case "stool": {
      const stool = item.kind === "stool", height = stool ? 0.47 : 0.75;
      if (stool && variant === 1) {
        // 四角いスツール: 角の丸い四角の座面と、内側のクッション、4本脚と貫
        m.box(w, 0.05, d, 0, height - 0.025, 0, fabric, 0.03);
        m.box(w * 0.8, 0.02, d * 0.8, 0, height + 0.01, 0, cushion, 0.01);
        legs(w, d, height - 0.05);
        for (const sign of [-1, 1]) {
          m.rod([-w * 0.36, 0.19, sign * d * 0.36], [w * 0.36, 0.19, sign * d * 0.36], Math.min(w, d) * 0.02, darkWood);
          m.rod([sign * w * 0.37, 0.19, -d * 0.35], [sign * w * 0.37, 0.19, d * 0.35], Math.min(w, d) * 0.02, darkWood);
        }
        break;
      }
      if (!stool && variant === 1) {
        // ガラスの丸い天板と金属の縁、1本の支柱から天板を支える3本の腕、丸い台座
        const frame = m.material("table-frame", 0x3a3f44, 0.4, 0.5, true);
        const glassTop = m.cylinder(0.5, 0.5, 0.012, [0, height - 0.006, 0], m.glass("table-glass", 0xbfe0e6, 0.35), 48);
        glassTop.scale.set(w, 1, d);
        const rim = m.ring(0.5, 0.012, [0, height - 0.012, 0], frame);
        rim.rotation.x = Math.PI / 2;
        rim.scale.set(w, d, 1);
        m.cylinder(0.03, 0.035, height - 0.06, [0, (height - 0.06) / 2 + 0.02, 0], frame, 16);
        const base = m.cylinder(0.5, 0.5, 0.02, [0, 0.01, 0], frame, 32);
        base.scale.set(w * 0.45, 1, d * 0.45);
        for (let i = 0; i < 3; i += 1) {
          const a = (i * Math.PI * 2) / 3;
          m.rod([0, height - 0.05, 0], [Math.cos(a) * w * 0.44, height - 0.016, Math.sin(a) * d * 0.44], 0.009, frame);
        }
        break;
      }
      if (!stool && variant === 2) {
        // 厚い無垢板の天板（板の継ぎ目の溝）、太い支柱と十字の脚
        const top = m.cylinder(0.5, 0.49, 0.05, [0, height - 0.025, 0], wood, 48);
        top.scale.set(w, 1, d);
        addWoodGrain(m, item.w, item.h, height + 0.001, true, darkWood);
        m.cylinder(0.05, 0.06, height - 0.05, [0, (height - 0.05) / 2, 0], darkWood, 16);
        m.box(w * 0.7, 0.05, 0.08, 0, 0.025, 0, darkWood, 0.01);
        m.box(0.08, 0.05, d * 0.7, 0, 0.025, 0, darkWood, 0.01);
        break;
      }
      const top = m.cylinder(0.5, 0.48, 0.055, [0, height - 0.0275, 0], stool ? fabric : wood, 48);
      top.scale.set(w, 1, d);
      if (stool) {
        // 座面の上の丸いクッション（2Dの内側の円）
        const pad = m.cylinder(0.4, 0.4, 0.02, [0, height + 0.01, 0], cushion, 40);
        pad.scale.set(w, 1, d);
      } else {
        // 天板の縁に沿った溝（2Dの内側の円）
        const groove = m.ring(0.46, 0.003, [0, height + 0.0005, 0], darkWood);
        groove.rotation.x = Math.PI / 2;
        groove.scale.set(w, d, 1);
      }
      legs(w * 0.7, d * 0.7, height - 0.055);
      if (stool) {
        for (const sign of [-1, 1]) {
          m.rod([-w * 0.26, 0.19, sign * d * 0.27], [w * 0.26, 0.19, sign * d * 0.27], Math.min(w, d) * 0.023, darkWood);
          m.rod([sign * w * 0.27, 0.19, -d * 0.26], [sign * w * 0.27, 0.19, d * 0.26], Math.min(w, d) * 0.023, darkWood);
        }
      }
      break;
    }
    case "chair": chair(w, d, 0, 0, 1, variant); break;
    case "diningTable": {
      m.box(w * 0.74, 0.045, d * 0.43, 0, 0.7275, 0, wood, 0.024);
      legs(w * 0.7, d * 0.39, 0.705);
      for (const x of [-1, 1]) for (const z of [-1, 1]) chair(w * 0.255, d * 0.26, x * w * 0.205, z * d * 0.365, -z, variant);
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
      // 掛け布団の頭側の端は、2Dの記号の横線（頭から全長の24%）の位置
      const coverTop = -d * 0.26;
      if (variant === 1) {
        // 2Dと同じく、掛け布団の頭側・右の角を斜めに折り返して裏地を見せる
        foldedCover(-w * 0.4825, w * 0.4825, coverTop, d * 0.48, Math.min(w * 0.5, d * 0.36), 0.075, 0.5905, fabric, ivory);
      } else if (variant === 2) {
        m.box(w * 0.965, 0.075, d * 0.74, 0, 0.553, (coverTop + d * 0.48) / 2, fabric, 0.035);
      } else {
        // 標準: 足元の手前（2Dの足元の線）で終わる掛け布団と、右の角の小さな折り返し（2Dの短い斜線）
        foldedCover(-w * 0.4825, w * 0.4825, coverTop, d * 0.38, w * 0.3, 0.075, 0.5905, fabric, fabric, d * 0.12);
      }
      if (variant === 2) {
        // 足元に掛けた帯（ベッドスロー）。両脇へ垂らす
        m.box(w * 0.985, 0.09, d * 0.14, 0, 0.555, d * 0.27, m.material("bed-runner", 0x8c6f5a, 0.9), 0.02);
      }
      // 枕は2Dの記号と同じ位置と大きさ（頭側の板のすぐ手前）
      const pillows = item.kind === "bedDouble" ? 2 : 1;
      for (let i = 0; i < pillows; i += 1) m.box(w * (pillows === 1 ? 0.56 : 0.37), 0.13, d * 0.1, (i - (pillows - 1) / 2) * w * 0.49, 0.6, -d * 0.41, ivory, 0.045);
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
      if (variant === 1) {
        // 画面の両端近くから前後に開いた2本の脚
        for (const sign of [-1, 1]) m.rod([sign * screenW * 0.29, height + 0.14, -d * 0.13], [sign * screenW * 0.35, height + 0.01, d * 0.13], 0.015, black);
      } else {
        // 2Dの記号と同じく、画面の真ん中を1本の支柱と台座で支える
        m.box(screenW * 0.06, 0.13, 0.03, 0, height + 0.065, -d * 0.13, black, 0.006);
        m.box(screenW * 0.26, 0.012, d * 0.34, 0, height + 0.006, -d * 0.08, black, 0.004);
      }
      m.ellipsoid(0.008, 0.008, 0.003, [screenW * 0.43, screenY - screenH * 0.48, -d * 0.13 + 0.03], m.material("status-led", 0x75c9b1));
      break;
    }
    case "shelf": {
      if (variant === 1) {
        // 本を入れていない、縦の仕切りで区切ったオープン棚。下の段にだけ布のかご
        const height = 1.46, t = Math.min(w, d, 0.6) * 0.07, rows = 4;
        const cells = Math.max(2, Math.round(w / 0.35));
        m.box(w, height, t, 0, height / 2, -d / 2 + t / 2, darkWood);
        for (const sign of [-1, 1]) m.box(t, height, d, sign * (w - t) / 2, height / 2, 0, wood);
        for (let i = 0; i <= rows; i += 1) m.box(w - t * 2, t, d, 0, t / 2 + (i * (height - t)) / rows, 0, wood);
        for (let i = 1; i < cells; i += 1) m.box(t * 0.8, height - t, d * 0.96, -w / 2 + (w * i) / cells, height / 2, d * 0.02, wood);
        const basket = m.material("storage-basket", 0xcdb892, 0.95);
        const cellW = (w - t * 2) / cells, rowH = (height - t) / rows;
        for (let i = 0; i < cells; i += 2) m.box(cellW * 0.78, rowH * 0.62, d * 0.8, -w / 2 + t + cellW * (i + 0.5), t + rowH * 0.31, d * 0.05, basket, 0.02);
        break;
      }
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
      const foldingDoors = closet && variant === 0;
      const bodyD = foldingDoors ? d * 0.78 : d * 0.94;
      m.box(w, height - 0.09, bodyD, 0, (height + 0.09) / 2, foldingDoors ? -d * 0.11 : -d * 0.03, wood);
      if (closet && variant === 1) {
        // 引き戸: 前後2本のレールに交互に並べ、少し重ねた扉と、扉の端の縦長の引き手
        const count = Math.max(2, Math.min(4, Math.round(w / 0.9)));
        const panel = (w / count) * 1.06;
        for (let i = 0; i < count; i += 1) {
          const x = -w / 2 + panel / 2 + (i * (w - panel)) / (count - 1);
          const z = d * (i % 2 ? 0.5 : 0.465);
          m.box(panel, height - 0.14, 0.03, x, height / 2 + 0.025, z, wood, 0.006);
          const pullX = x + (x < 0 ? 1 : -1) * panel * 0.4;
          m.box(0.022, 0.24, 0.006, pullX, 1.05, z + 0.016, black, 0);
        }
        m.box(w, 0.035, d * 0.1, 0, height - 0.0175, d * 0.48, darkWood);
      } else if (closet && variant === 2) {
        // ルーバー扉: 枠の中に斜めの羽根板を並べた扉（2Dの斜線に呼応）
        const count = Math.max(2, Math.min(4, Math.round(w / 0.6)));
        const doorW = (w / count) * 0.97, doorH = height - 0.14, frameW = Math.min(0.06, doorW * 0.12);
        for (let i = 0; i < count; i += 1) {
          const x = -w / 2 + (w / count) * (i + 0.5), y0 = 0.095;
          for (const sx of [-1, 1]) m.box(frameW, doorH, 0.035, x + sx * (doorW / 2 - frameW / 2), y0 + doorH / 2, d * 0.473, wood, 0.004);
          for (const y of [y0 + frameW / 2, y0 + doorH - frameW / 2, y0 + doorH * 0.48]) m.box(doorW, frameW, 0.035, x, y, d * 0.473, wood, 0.004);
          for (const [from, to] of [[y0 + frameW, y0 + doorH * 0.48 - frameW / 2], [y0 + doorH * 0.48 + frameW / 2, y0 + doorH - frameW]]) {
            const slats = Math.max(1, Math.floor((to - from) / 0.055));
            for (let k = 0; k < slats; k += 1) {
              const slat = m.box(doorW - frameW * 2, 0.012, 0.04, x, from + ((to - from) * (k + 0.5)) / slats, d * 0.47, wood, 0);
              slat.rotation.x = -0.6;
            }
          }
          m.rod([x + doorW * 0.32, 0.96, d * 0.52], [x + doorW * 0.32, 1.21, d * 0.52], 0.008, metal, "handle");
        }
      } else if (closet) {
        // 折れ戸: 2Dの記号と同じく、扉1枚ごとに4枚の板がW字に折れて奥へ引っ込む
        const doors = closetDoorCount(item.w);
        const doorH = height - 0.14, fold = d * 0.2;
        for (let i = 0; i < doors; i += 1) {
          const x0 = -w / 2 + (w * i) / doors, span = w / doors;
          const points: [number, number][] = [[x0, d / 2], [x0 + span * 0.25, d / 2 - fold], [x0 + span * 0.5, d / 2], [x0 + span * 0.75, d / 2 - fold], [x0 + span, d / 2]];
          for (let k = 0; k < 4; k += 1) {
            const [ax, az] = points[k], [bx, bz] = points[k + 1];
            const leaf = m.box(Math.hypot(bx - ax, bz - az), doorH, 0.018, (ax + bx) / 2, doorH / 2 + 0.095, (az + bz) / 2 - 0.009, wood, 0.003);
            leaf.rotation.y = -Math.atan2(bz - az, bx - ax);
          }
          m.rod([x0 + span * 0.5, 0.96, d / 2 + 0.012], [x0 + span * 0.5, 1.21, d / 2 + 0.012], 0.008, metal, "handle");
        }
      } else if (variant === 1) {
        // 両開きのタンス: 中央で分かれる2枚の扉と、合わせ目の両側の取っ手
        for (const sign of [-1, 1]) {
          m.box(w * 0.485, height - 0.14, d * 0.035, sign * w * 0.2475, height / 2 + 0.025, d * 0.473, wood);
          m.rod([sign * w * 0.05, height * 0.42, d * 0.52], [sign * w * 0.05, height * 0.66, d * 0.52], 0.008, metal, "handle");
        }
        m.box(w * 1.02, 0.035, d * 0.98, 0, height, -d * 0.03, darkWood, 0.006);
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
      // コンロは2Dの記号と同じく、右に2口・その左に少し小さな1口
      const burners: [number, number, number][] = [[0.34, -0.2, 1], [0.34, 0.2, 1], [0.2, 0, 0.8]];
      const burnerR = Math.min(w * 0.05, d * 0.14);
      if (variant === 1) {
        // ガスコンロ: ステンレスの天板、バーナー、五徳、手前のつまみ
        m.box(w * 0.29, 0.016, d * 0.71, w * 0.27, 0.879, 0, metal);
        for (const [x, z, size] of burners) {
          const r = burnerR * size, bx = w * x, bz = d * z;
          m.cylinder(r * 0.45, r * 0.52, 0.02, [bx, 0.897, bz], black, 20);
          m.cylinder(r * 0.28, r * 0.28, 0.012, [bx, 0.912, bz], metal, 20);
          const trivet = m.ring(r * 0.95, 0.005, [bx, 0.905, bz], black);
          trivet.rotation.x = -Math.PI / 2;
          for (let i = 0; i < 4; i += 1) {
            const a = Math.PI / 4 + (i * Math.PI) / 2;
            m.rod([bx + Math.cos(a) * r * 0.55, 0.915, bz + Math.sin(a) * r * 0.55], [bx + Math.cos(a) * r * 0.97, 0.905, bz + Math.sin(a) * r * 0.97], 0.006, black);
          }
          const knob = m.cylinder(0.018, 0.018, 0.02, [bx, 0.8, d / 2 + 0.01], black, 16);
          knob.rotation.x = Math.PI / 2;
        }
      } else {
        m.box(w * 0.29, 0.016, d * 0.71, w * 0.27, 0.879, 0, black);
        for (const [x, z, size] of burners) {
          const ring = m.ring(burnerR * size, 0.004, [w * x, 0.89, d * z], metal);
          ring.rotation.x = -Math.PI / 2;
        }
      }
      break;
    }
    case "fridge": {
      m.box(w, 1.82, d * 0.91, 0, 0.94, -d * 0.045, white, 0.022);
      m.box(w * 0.9, 0.05, d * 0.82, 0, 0.025, 0, black);
      if (variant === 1) {
        // 観音開き: 上は左右2枚の扉（合わせ目の両側に縦の取っ手）、下は引き出し2段
        for (const sign of [-1, 1]) {
          m.box(w * 0.488, 1.13, d * 0.065, sign * w * 0.246, 1.245, d * 0.45, white, 0.016);
          m.rod([sign * w * 0.045, 1.0, d * 0.515], [sign * w * 0.045, 1.48, d * 0.515], 0.012, metal, "handle");
        }
        for (const y of [0.475, 0.185]) {
          m.box(w * 0.98, 0.28, d * 0.065, 0, y, d * 0.45, white, 0.016);
          m.rod([-w * 0.25, y + 0.09, d * 0.515], [w * 0.25, y + 0.09, d * 0.515], 0.011, metal, "handle");
        }
        m.box(w * 0.16, 0.12, 0.005, w * 0.24, 1.6, d * 0.487, black);
      } else if (variant === 2) {
        // シンプル: 背丈いっぱいの扉が1枚、取っ手は左に1本
        m.box(w * 0.98, 1.74, d * 0.065, 0, 0.92, d * 0.45, white, 0.016);
        m.rod([-w * 0.36, 0.72, d * 0.515], [-w * 0.36, 1.32, d * 0.515], 0.012, metal, "handle");
      } else {
        for (const [y, h] of [[1.245, 1.13], [0.33, 0.58]]) {
          m.box(w * 0.98, h, d * 0.065, 0, y, d * 0.45, white, 0.016);
          m.rod([-w * 0.32, y - h * 0.23, d * 0.515], [-w * 0.32, y + h * 0.23, d * 0.515], 0.012, metal, "handle");
        }
        m.box(w * 0.16, 0.12, 0.005, w * 0.24, 1.48, d * 0.487, black);
      }
      break;
    }
    case "bath": {
      if (variant === 1) {
        // 四角い浴槽: 厚い縁で囲み、水栓のある左の縁を広くする。底は明るい色
        const height = 0.57, t = Math.min(w, d) * 0.08, left = t * 1.6;
        m.box(w, 0.14, d, 0, 0.07, 0, ceramic, 0.01);
        for (const sz of [-1, 1]) m.box(w, height, t, 0, height / 2, sz * (d / 2 - t / 2), ceramic, 0.012);
        m.box(left, height, d - t * 2, -w / 2 + left / 2, height / 2, 0, ceramic, 0.012);
        m.box(t, height, d - t * 2, w / 2 - t / 2, height / 2, 0, ceramic, 0.012);
        m.box(w - left - t, 0.02, d - t * 2, (left - t) / 2, 0.15, 0, basinInterior, 0);
        m.cylinder(Math.min(w, d) * 0.026, Math.min(w, d) * 0.026, 0.006, [-w * 0.3, 0.163, 0], metal);
        faucet(-w / 2 + left / 2, height, -d * 0.12, 0.16);
        break;
      }
      m.vessel([[0, 0], [0.3, 0], [0.43, 0.08], [0.5, 0.5], [0.49, 0.57], [0.43, 0.57]], w, d, [0, 0, 0], ceramic);
      m.vessel([[0.43, 0.57], [0.36, 0.16], [0, 0.14]], w, d, [0, 0, 0], basinInterior);
      m.cylinder(Math.min(w, d) * 0.026, Math.min(w, d) * 0.026, 0.006, [-w * 0.25, 0.147, 0], metal);
      faucet(-w * 0.3, 0.53, -d * 0.3, 0.18);
      break;
    }
    case "toilet": {
      if (variant === 1) {
        // タンクレス: 背の低い本体と、大きめの便器・便座
        m.ellipsoid(w * 0.54, 0.32, d * 0.66, [0, 0.16, d * 0.04], ceramic);
        m.box(w * 0.7, 0.42, d * 0.2, 0, 0.21, -d * 0.39, ceramic, 0.06);
        m.box(w * 0.72, 0.03, d * 0.22, 0, 0.435, -d * 0.39, ceramic, 0.015);
        m.vessel([[0, 0], [0.3, 0.01], [0.47, 0.15], [0.5, 0.25], [0.37, 0.25]], w * 0.98, d * 0.8, [0, 0.15, d * 0.06], ceramic);
        m.vessel([[0.37, 0.25], [0.2, 0.1], [0, 0.08]], w * 0.98, d * 0.8, [0, 0.15, d * 0.06], basinInterior);
        const seatRing = m.ring(0.5, 0.055, [0, 0.422, d * 0.06], ivory);
        seatRing.rotation.x = -Math.PI / 2;
        seatRing.scale.set(w * 0.87, d * 0.7, 0.6);
        break;
      }
      m.ellipsoid(w * 0.52, 0.32, d * 0.55, [0, 0.16, d * 0.075], ceramic);
      m.box(w * 0.85, 0.71, d * 0.25, 0, 0.355, -d * 0.365, ceramic, 0.055);
      m.box(w * 0.9, 0.04, d * 0.28, 0, 0.725, -d * 0.365, ceramic, 0.018);
      m.cylinder(w * 0.055, w * 0.055, 0.008, [w * 0.15, 0.75, -d * 0.365], metal);
      m.vessel([[0, 0], [0.3, 0.01], [0.47, 0.15], [0.5, 0.25], [0.37, 0.25]], w * 0.96, d * 0.7, [0, 0.15, d * 0.12], ceramic);
      m.vessel([[0.37, 0.25], [0.2, 0.1], [0, 0.08]], w * 0.96, d * 0.7, [0, 0.15, d * 0.12], basinInterior);
      const seat = m.ring(0.5, 0.055, [0, 0.422, d * 0.12], ivory);
      seat.rotation.x = -Math.PI / 2;
      seat.scale.set(w * 0.85, d * 0.62, 0.6);
      if (variant === 2) {
        // タンクの上の手洗い鉢と、そこへ注ぐ蛇口
        m.vessel([[0, 0], [0.3, 0], [0.5, 0.09], [0.47, 0.1], [0.4, 0.1]], w * 0.62, d * 0.22, [0, 0.745, -d * 0.36], ceramic);
        m.vessel([[0.4, 0.1], [0.25, 0.03], [0, 0.02]], w * 0.62, d * 0.22, [0, 0.745, -d * 0.36], basinInterior);
        m.rod([0, 0.745, -d * 0.475], [0, 0.87, -d * 0.475], 0.01, metal);
        m.rod([0, 0.87, -d * 0.475], [0, 0.85, -d * 0.405], 0.01, metal);
      }
      break;
    }
    case "washbasin": {
      m.box(w * 0.89, 0.12, d * 0.83, 0, 0.06, 0, darkWood);
      m.box(w, 0.55, d * 0.93, 0, 0.395, -d * 0.02, wood);
      for (const sign of [-1, 1]) drawer(sign * w * 0.245, 0.4, d * 0.466, w * 0.49, 0.51);
      if (variant === 1) {
        // 角形ボウル: 四角い器を天板の上に置く（2Dと同じく少し手前寄り）
        const bw = w * 0.6, bd = d * 0.52, t = 0.022, bh = 0.14, y0 = 0.67, zc = d * 0.06;
        for (const sz of [-1, 1]) m.box(bw, bh, t, 0, y0 + bh / 2, zc + sz * (bd / 2 - t / 2), ceramic, 0.006);
        for (const sx of [-1, 1]) m.box(t, bh, bd - t * 2, sx * (bw / 2 - t / 2), y0 + bh / 2, zc, ceramic, 0.006);
        m.box(bw - t * 2, 0.02, bd - t * 2, 0, y0 + 0.01, zc, basinInterior, 0);
        m.cylinder(w * 0.027, w * 0.027, 0.006, [0, y0 + 0.023, zc], metal);
        faucet(0, y0, -d * 0.38, 0.22);
      } else {
        m.vessel([[0, 0], [0.33, 0], [0.5, 0.18], [0.48, 0.2], [0.41, 0.2]], w, d, [0, 0.66, 0], ceramic);
        m.vessel([[0.41, 0.2], [0.27, 0.055], [0, 0.035]], w, d, [0, 0.66, 0], basinInterior);
        m.cylinder(w * 0.027, w * 0.027, 0.008, [0, 0.702, 0], metal);
        faucet(0, 0.79, -d * 0.36, 0.2);
      }
      break;
    }
    case "washer": {
      if (variant === 1) {
        // 縦型: 上面の四角いふた（窓付き）と手前の取っ手、奥の操作パネル
        m.box(w, 0.9, d * 0.94, 0, 0.47, 0, white, 0.03);
        legs(w * 0.84, d * 0.83, 0.04, 0, 0, 0, black);
        m.box(w * 0.96, 0.1, d * 0.2, 0, 0.97, -d * 0.36, white, 0.02);
        m.box(w * 0.3, 0.05, 0.005, -w * 0.12, 0.975, -d * 0.26 + 0.003, black, 0);
        m.cylinder(w * 0.05, w * 0.05, 0.02, [w * 0.3, 1.03, -d * 0.36], metal, 20);
        m.box(w * 0.78, 0.02, d * 0.6, 0, 0.93, d * 0.1, white, 0.012);
        m.box(w * 0.56, 0.006, d * 0.38, 0, 0.941, d * 0.08, m.glass("washer-glass", 0x587481, 0.5), 0);
        m.box(w * 0.2, 0.015, 0.03, 0, 0.945, d * 0.37, black, 0.005);
        break;
      }
      if (variant === 0) {
        // 縦型（標準）: 2Dの記号と同じく、上面の中央に丸いふた（中に窓）、奥の左に操作パネル、左奥の角にボタン
        m.box(w, 0.9, d * 0.94, 0, 0.47, 0, white, 0.03);
        legs(w * 0.84, d * 0.83, 0.04, 0, 0, 0, black);
        m.box(w * 0.55, 0.03, d * 0.11, -w * 0.145, 0.935, -d * 0.395, white, 0.008);
        m.box(w * 0.42, 0.004, d * 0.06, -w * 0.145, 0.952, -d * 0.395, black, 0);
        m.cylinder(0.02, 0.02, 0.012, [-w / 2 + 0.06, 0.926, -d / 2 + 0.06], metal, 16);
        const radius = Math.min(w, d) * 0.3;
        m.cylinder(radius, radius, 0.022, [0, 0.931, 0.01], white, 40);
        m.cylinder(radius * 0.5, radius * 0.5, 0.006, [0, 0.945, 0.01], m.glass("washer-glass", 0x587481, 0.5), 32);
        break;
      }
      // ドラム式（デザイン2）: 前面の丸い扉と操作部
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
      const band = Math.min(w, d);
      if (variant === 1) {
        // 二重の縁: 房はなく、明るい縁取りを2本
        m.box(w, 0.012, d, 0, 0.006, 0, fabric, 0.006);
        [0.14, 0.18, 0.22, 0.26].forEach((inset, i) => m.box(w - band * inset, 0.003, d - band * inset, 0, 0.0135 + i * 0.003, 0, i % 2 ? fabric : ivory, 0.002));
        break;
      }
      if (variant === 2) {
        // ひし形の柄: 縁の内側に、2色のひし形をすき間なく並べる
        const inset = rugDiamonds(item.w, item.h).inset / 100, fieldW = w - inset * 2, fieldD = d - inset * 2;
        m.box(w, 0.012, d, 0, 0.006, 0, fabric, 0.006);
        m.box(fieldW + band * 0.03, 0.003, fieldD + band * 0.03, 0, 0.0135, 0, ivory, 0.002);
        m.box(fieldW, 0.003, fieldD, 0, 0.0165, 0, fabric, 0.002);
        // 2Dの記号と同じ斜めの格子で区切った升目を、1つずつ明るい色のひし形にする（縁で切れた升目も同じ形）
        for (const cell of rugDiamonds(item.w, item.h).cells) shapeSlab(polygonShape(cell), 0.002, 0.0195, m, ivory, 1);
        break;
      }
      m.box(w, 0.012, d, 0, 0.006, 0, fabric, 0.006);
      m.box(w * 0.91, 0.003, d * 0.87, 0, 0.0135, 0, ivory, 0.002);
      m.box(w * 0.87, 0.003, d * 0.82, 0, 0.0165, 0, fabric, 0.002);
      for (const sign of [-1, 1]) for (let i = 0; i < 18; i += 1) m.rod([-w * 0.45 + i * w * 0.9 / 17, 0.006, sign * d * 0.49], [-w * 0.45 + i * w * 0.9 / 17, 0.006, sign * d * 0.515], 0.005, ivory);
      break;
    }
    case "floorLamp": {
      const base = variant === 1 ? m.box(1, 0.035, 1, 0, 0.0175, 0, black, 0.005) : m.cylinder(0.5, 0.5, 0.035, [0, 0.0175, 0], black, 40);
      base.scale.set(w * 0.65, 1, d * 0.65);
      m.rod([0, 0.035, 0], [0, 1.52, 0], 0.014, metal);
      const shadeMat = m.material("lampshade", 0xf4e9d3, 0.96, 0, true);
      shadeMat.side = THREE.DoubleSide;
      // 四角いシェードは、4面のすそ広がりの筒（上から見ると外の四角と上の口の四角）
      const square = variant === 1;
      const shade = m.mesh(new THREE.CylinderGeometry(square ? 0.32 * Math.SQRT2 : 0.32, square ? 0.5 * Math.SQRT2 : 0.5, 0.35, square ? 4 : 40, 1, true), [0, 1.5, 0], shadeMat);
      if (square) shade.rotation.y = Math.PI / 4;
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
      // 鉢の口は、2Dの記号の中央の丸（幅の44%）と同じ大きさ
      const potScale = 0.55;
      m.vessel([[0, 0], [0.3, 0], [0.4, potH * 0.94], [0.4, potH], [0.35, potH], [0.27, 0.04], [0, 0.04]], w * potScale, d * potScale, [0, 0, 0], pot);
      const soil = m.cylinder(0.35, 0.35, 0.02, [0, potH * 0.87, 0], m.material("soil", 0x443d31, 1));
      soil.scale.set(w * potScale, 1, d * potScale);
      const stemMat = m.material("stem", 0x66724b, 0.9);
      const leafColors = [0x42775a, 0x62956b, 0x7ba773];
      const radiusX = w / 2, radiusZ = d / 2;
      // 方向 a での、設置範囲の楕円の半径
      const reachAt = (a: number) => 1 / Math.sqrt((Math.cos(a) / radiusX) ** 2 + (Math.sin(a) / radiusZ) ** 2);
      const leafMaterial = (i: number) => m.material(`leaf-${i % 3}`, leafColors[i % 3], 0.87);
      if (variant === 1) {
        // 丸い葉: 2Dの記号と同じ位置・大きさの丸い葉の塊（外側9つ・内側5つ）を短い幹の上に重ねる
        const crownH = Math.min(height * 0.62, Math.max(w, d) * 0.95);
        const crownY = height - crownH * 0.55;
        m.rod([0, potH * 0.9, 0], [0, crownY, 0], Math.min(w, d) * 0.03, stemMat);
        m.ellipsoid(w * 0.72, crownH * 0.7, d * 0.72, [0, crownY, 0], leafMaterial(0));
        ROUND_LEAF_CLUMPS.forEach((clump, i) => {
          const inner = clump.distance < 0.5;
          m.ellipsoid(radiusX * clump.size * 2, crownH * (inner ? 0.45 : 0.5), radiusZ * clump.size * 2,
            [Math.cos(clump.angle) * radiusX * clump.distance, crownY + crownH * (inner ? 0.2 : -0.05), Math.sin(clump.angle) * radiusZ * clump.distance], leafMaterial(1 + (i % 2)));
        });
        m.reserveFootprint(w, d);
        break;
      }
      if (variant === 2) {
        // 細い葉: 2Dの記号と同じ7本の葉軸（弓なりに上がって垂れる）と、その両側の小葉
        const base = potH * 0.9, rise = Math.min(height * 0.3, Math.max(w, d) * 0.45);
        const lift = (t: number) => base + rise * Math.sin(Math.PI * t * 0.9) * (1 - 0.35 * t);
        for (const [i, frond] of fernFronds().entries()) {
          const toWorld = ([lx, ly]: Point2, y: number): Position => {
            const x = lx * Math.cos(frond.angle) - ly * Math.sin(frond.angle), z = lx * Math.sin(frond.angle) + ly * Math.cos(frond.angle);
            return [x * radiusX, y, z * radiusZ];
          };
          const [[x0, y0], [cx, cy], [x1, y1]] = frond.spine;
          const spineAt = (t: number): Point2 => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1];
          let previous = toWorld([0, 0], base);
          for (let k = 0; k <= 4; k += 1) {
            const t = k / 4, next = toWorld(spineAt(t), lift(t));
            m.rod(previous, next, Math.min(w, d) * 0.008, stemMat);
            previous = next;
          }
          frond.leaflets.forEach(([from, to], k) => {
            // 小葉の付け根の高さは、葉軸上のいちばん近い点の高さにそろえる
            const t = Math.min(1, Math.max(0, (from[0] - x0) / (x1 - x0)));
            const a = toWorld(from, lift(t)), b = toWorld(to, lift(t) - 0.02);
            const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
            const leaflet = m.ellipsoid(length, 0.006, length * 0.3, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], leafMaterial(i + k));
            leaflet.rotation.y = -Math.atan2(b[2] - a[2], b[0] - a[0]);
          });
        }
        m.reserveFootprint(w, d);
        break;
      }
      // 標準: 2Dの記号と同じ8枚の葉を、茎から放射状に広げる
      m.rod([0, potH * 0.9, 0], [0, height * 0.94, 0], Math.min(w, d) * 0.022, stemMat);
      PLANT_LEAF_ANGLES.forEach((a, i) => {
        const y = potH + height * (0.22 + (i % 4) * 0.16 + (i >= 4 ? 0.06 : 0));
        const elevation = i % 2 ? 0.45 : 0.25;
        const start: Position = [Math.cos(a) * radiusX * 0.06, y, Math.sin(a) * radiusZ * 0.06];
        m.rod([0, y - 0.03, 0], start, Math.min(w, d) * 0.008, stemMat);
        const leaf = new THREE.Shape();
        leaf.moveTo(0, 0); leaf.bezierCurveTo(0.22, 0.17, 0.15, 0.75, 0, 1); leaf.bezierCurveTo(-0.15, 0.75, -0.22, 0.17, 0, 0);
        const geometry = new THREE.ShapeGeometry(leaf, 7);
        const positions = geometry.getAttribute("position");
        for (let q = 0; q < positions.count; q += 1) positions.setZ(q, Math.sin(positions.getY(q) * Math.PI) * 0.14);
        geometry.computeVertexNormals();
        const material = leafMaterial(i);
        material.side = THREE.DoubleSide;
        const mesh = m.mesh(geometry, start, material, "leaf");
        // 葉の長さは、上から見て設置範囲の縁近くまで届くように
        const length = (reachAt(a) * 0.9) / Math.cos(elevation);
        mesh.scale.set(Math.min(radiusX, radiusZ) * 0.64, length, Math.min(w, d));
        mesh.rotation.set(-(Math.PI / 2 - elevation), -(a + Math.PI / 2), 0, "YXZ");
      });
      m.reserveFootprint(w, d);
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
      if (variant === 1) {
        // 背もたれなし: 奥行いっぱいに4枚の板（2Dの3本の継ぎ目と同じ位置）
        legs(w * 0.85, d * 0.82, 0.43, 0, 0, 0, black);
        for (let i = 0; i < 4; i += 1) m.box(w, 0.044, d * 0.23, 0, 0.452, -d * 0.375 + i * d * 0.25, wood);
        break;
      }
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
      // ワゴンは屋根を後ろまで伸ばし、後ろの窓を立たせる
      const wagon = variant === 1;
      const rearLow = wagon ? 0.4 : 0.3, rearHigh = wagon ? 0.37 : 0.21;
      m.box(w * 0.95, 0.5, d * 0.94, 0, 0.65, 0, paint, 0.15);
      m.box(w * 0.88, 0.1, d * 0.89, 0, 0.365, 0, black, 0.035);
      // A tapered cabin gives the windshield and rear glass their own sloped faces.
      const cabin = new THREE.BufferGeometry();
      cabin.setAttribute("position", new THREE.Float32BufferAttribute([
        -w * 0.41, 0.87, -d * 0.23, w * 0.41, 0.87, -d * 0.23,
        w * 0.41, 0.87, d * rearLow, -w * 0.41, 0.87, d * rearLow,
        -w * 0.34, 1.31, -d * 0.12, w * 0.34, 1.31, -d * 0.12,
        w * 0.34, 1.31, d * rearHigh, -w * 0.34, 1.31, d * rearHigh,
      ], 3));
      cabin.setIndex([0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0, 4, 7, 6, 4, 6, 5, 0, 1, 2, 0, 2, 3]);
      const cabinFaces = cabin.toNonIndexed();
      cabinFaces.computeVertexNormals();
      cabin.dispose();
      m.mesh(cabinFaces, [0, 0, 0], glass);
      m.box(w * 0.71, 0.035, d * (rearHigh + 0.13), 0, 1.325, d * (rearHigh - 0.12) / 2, paint, 0.018);
      const pillars = wagon ? [[-0.23, -0.12], [0.08, 0.08], [0.25, 0.25], [rearLow, rearHigh]] : [[-0.23, -0.12], [0.065, 0.065], [rearLow, rearHigh]];
      if (wagon) {
        // ルーフレール: 屋根の両脇に前後の細い棒と、それを支える足
        for (const sign of [-1, 1]) {
          m.rod([sign * w * 0.3, 1.37, -d * 0.1], [sign * w * 0.3, 1.37, d * 0.35], 0.012, black);
          for (const z of [-0.08, 0.33]) m.rod([sign * w * 0.3, 1.34, d * z], [sign * w * 0.3, 1.37, d * z], 0.012, black);
        }
      }
      for (const sign of [-1, 1]) {
        for (const [lowerZ, upperZ] of pillars) {
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
      const highBack = variant === 1;
      const backH = highBack ? 0.72 : 0.5;
      const back = m.box(w * 0.72, backH, 0.06, 0, 0.55 + backH / 2, -d * 0.36, fabric, 0.03);
      back.rotation.x = -0.12;
      if (highBack) {
        // ハイバック: 背もたれの上に頭をのせる枕（2Dのいちばん奥の帯）
        const head = m.box(w * 0.46, 0.15, 0.08, 0, 0.55 + backH + 0.1, -d * 0.44, fabric, 0.035);
        head.rotation.x = -0.15;
        m.rod([0, 0.55 + backH - 0.05, -d * 0.43], [0, 0.55 + backH + 0.05, -d * 0.44], 0.012, black);
      }
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
      if (variant === 1) {
        // 布団なし: 天板（2Dと同じ大きさ）と縁の溝、4本の脚と幕板
        m.box(w * 0.64, 0.035, d * 0.64, 0, 0.395, 0, wood, 0.012);
        for (const sz of [-1, 1]) m.box(w * 0.58, 0.003, 0.004, 0, 0.4135, sz * d * 0.29, darkWood, 0);
        for (const sx of [-1, 1]) m.box(0.004, 0.003, d * 0.58, sx * w * 0.29, 0.4135, 0, darkWood, 0);
        m.box(w * 0.58, 0.08, d * 0.58, 0, 0.335, 0, darkWood, 0.006);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.05, 0.3, 0.05, sx * w * 0.28, 0.15, sz * d * 0.28, darkWood, 0.006);
        m.reserveFootprint(w, d);
        break;
      }
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
        m.box(w * 0.9, 0.05, d * 0.76, 0, y + 0.225, d * 0.08, fabric, 0.02);
        m.box(w * 0.56, 0.1, d * 0.09, 0, y + 0.25, -d * 0.415, ivory, 0.035);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.06, 1.72, 0.06, sx * (w / 2 - 0.03), 0.86, sz * (d / 2 - 0.03), wood, 0.01);
      m.box(0.04, 0.18, d * 0.6, -(w / 2 - 0.02), 1.55, d * 0.04, wood, 0.01);
      m.box(0.04, 0.18, d * 0.4, w / 2 - 0.02, 1.55, -d * 0.2, wood, 0.01);
      for (const z of [d * 0.22, d * 0.42]) m.rod([w / 2 - 0.02, 0.2, z], [w / 2 - 0.02, 1.62, z], 0.018, wood);
      for (let i = 0; i < 5; i += 1) m.rod([w / 2 - 0.02, 0.45 + i * 0.25, d * 0.22], [w / 2 - 0.02, 0.45 + i * 0.25, d * 0.42], 0.014, darkWood);
      break;
    }
    case "futon": {
      // 敷布団・掛け布団・枕。脚や枠はなく床に直接置く
      m.box(w, 0.09, d, 0, 0.045, 0, ivory, 0.04);
      // 掛け布団は2Dの記号と同じ範囲（幅の94%、頭から27%の所から足元の手前まで）
      const coverTop = -d * 0.23, coverBottom = d * 0.47;
      if (variant === 1) {
        // 2Dと同じく、掛け布団の頭側・右の角を斜めに折り返して裏地を見せる
        foldedCover(-w * 0.47, w * 0.47, coverTop, coverBottom, Math.min(w * 0.5, d * 0.3), 0.07, 0.155, fabric, m.material("futon-lining", 0xebe6da, 0.95));
      } else {
        m.box(w * 0.94, 0.07, coverBottom - coverTop, 0, 0.12, (coverTop + coverBottom) / 2, fabric, 0.05);
        // 2Dの「＋」と同じ位置の縫い目
        const stitch = Math.min(w, d) * 0.04;
        for (let row = 1; row <= 3; row += 1) {
          for (const col of [-1, 0, 1]) {
            const x = col * w * 0.28, z = coverTop + ((coverBottom - coverTop) * row) / 4;
            m.box(stitch * 2, 0.003, 0.004, x, 0.156, z, darkWood, 0);
            m.box(0.004, 0.003, stitch * 2, x, 0.156, z, darkWood, 0);
          }
        }
      }
      m.box(w * 0.52, 0.09, d * 0.1, 0, 0.135, -d * 0.4, ivory, 0.04);
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
      if (isTree && variant === 1) {
        // 丸く刈り込んだ木: 幹の上に、設置範囲いっぱいの丸い葉の玉（上から見ると2Dの丸）
        const bark = m.material("bark", 0x6d5844, 0.95);
        const crownH = Math.min(tall * 0.6, Math.max(w, d));
        const trunkR = Math.min(clamp(tall * 0.028, 0.04, 0.3), Math.min(w, d) * 0.1);
        m.cylinder(trunkR * 0.7, trunkR, tall - crownH * 0.7, [0, (tall - crownH * 0.7) / 2, 0], bark, 10);
        m.ellipsoid(w, crownH, d, [0, tall - crownH / 2, 0], foliage);
        break;
      }
      if (!isTree && variant === 1) {
        // 生垣: 四角く刈り込んだ植え込み（角の丸い箱）
        m.box(w, tall, d, 0, tall / 2, 0, foliage, Math.min(w, d, tall) * 0.15);
        break;
      }
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
      // 細い幹と、2Dの記号と同じ星形の断面の円すい2段（下の段がとがった葉先の輪郭、上の段が内側の星）
      const needles = m.material("needles", 0x3f6f47, 0.92, 0, true);
      const bark = m.material("bark", 0x6d5844, 0.95);
      const trunkR = Math.min(clamp(tall * 0.025, 0.03, 0.25), Math.min(w, d) * 0.08);
      m.cylinder(trunkR * 0.7, trunkR, tall * 0.2, [0, tall * 0.1, 0], bark, 8);
      const spans: [number, number][] = [[0.12, 0.72], [0.45, 1]];
      CONIFER_TIERS.forEach((tier, index) => {
        const [from, to] = spans[index];
        const ring = Array.from({ length: tier.points * 2 }, (_, i) => {
          const a = (i / (tier.points * 2)) * Math.PI * 2 - Math.PI / 2;
          const k = (i % 2 ? tier.inner : 1) * tier.radius;
          return new THREE.Vector3(Math.cos(a) * (w / 2) * k, tall * from, Math.sin(a) * (d / 2) * k);
        });
        const apex = new THREE.Vector3(0, tall * to, 0), base = new THREE.Vector3(0, tall * from, 0);
        const positions: number[] = [];
        ring.forEach((vertex, i) => {
          const next = ring[(i + 1) % ring.length];
          positions.push(apex.x, apex.y, apex.z, next.x, next.y, next.z, vertex.x, vertex.y, vertex.z);
          positions.push(base.x, base.y, base.z, vertex.x, vertex.y, vertex.z, next.x, next.y, next.z);
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        m.mesh(geometry, [0, 0, 0], needles);
      });
      m.reserveFootprint(w, d);
      break;
    }
    case "palmTree": {
      // 少し反った幹の先に、四方へ垂れる長い葉とヤシの実
      const bark = m.material("palm-bark", 0x8a7456, 0.95);
      const frond = m.material("palm-frond", 0x4f8a46, 0.88, 0, true);
      const nut = m.material("coconut", 0x6b4f2e, 0.8);
      const reach = Math.min(Math.min(w, d) * 0.52, tall * 0.45);
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
      // 葉は2Dの記号と同じ8枚・同じ向き。上向きと下向きを交互にする
      PALM_FROND_ANGLES.forEach((angle, i) => {
        const droop = i % 2 ? 0.45 : -up;
        const dx = Math.cos(droop) * Math.cos(angle), dy = -Math.sin(droop), dz = Math.cos(droop) * Math.sin(angle);
        const leaf = m.ellipsoid(reach, 0.035, reach * 0.3, [tx + dx * reach / 2, ty + dy * reach / 2, tz + dz * reach / 2], frond);
        leaf.rotation.set(0, -angle, -droop);
      });
      for (let i = 0; i < 3; i += 1) {
        const a = i * 2.1;
        m.ellipsoid(0.12, 0.13, 0.12, [tx + Math.cos(a) * 0.08, ty - 0.1, tz + Math.sin(a) * 0.08], nut);
      }
      m.reserveFootprint(w, d);
      break;
    }
    case "rock": {
      // 2Dの記号と同じ輪郭・稜線の、平らな面でできた岩（デザイン1は大小2つ）
      const stone = m.material("rock", 0x8e8b83, 0.96, 0, true);
      stone.flatShading = true;
      for (const shape of rockShapes(item.w, item.h, variant)) m.mesh(rockSolidGeometry(shape, tall), [0, 0, 0], stone);
      m.reserveFootprint(w, d);
      break;
    }
    case "steppingStones": {
      // 2Dの記号と同じ位置・大きさ・向きの、少し丸みのある平たい石
      const stone = m.material("stepping-stone", 0x9c998f, 0.93, 0, true);
      // 面ごとに陰を付けて、角の取れた石らしく見せる（上から見た形は2Dと同じ楕円）
      stone.flatShading = true;
      for (const slab of steppingStoneLayout(item.w, item.h)) {
        const mesh = m.ellipsoid((slab.rx * 2) / 100, 0.07, (slab.ry * 2) / 100, [slab.x / 100, 0.035, slab.y / 100], stone);
        mesh.rotation.y = -slab.angle;
      }
      m.reserveFootprint(w, d);
      break;
    }
    case "flowerBed": {
      // れんがの縁、土、茎の先に5枚の花びらの花。縁の幅と花の位置・数は2Dの記号と同じ
      const border = m.material("bed-border", 0xa86f4c, 0.85, 0, true);
      const soil = m.material("soil", 0x4a3b2c, 1);
      const stem = m.material("stem", 0x4f7a3d, 0.9);
      const center = m.material("flower-center", 0xf2c14e, 0.7);
      const petals = [0xe8506a, 0xf4f1ea, 0xb07cd8].map((color, i) => m.material(`flower-${i}`, color, 0.7));
      if (variant === 1) {
        // 丸い花壇: れんがの丸い縁（上から見ると輪）、土、輪に並んだ花（2Dと同じ位置）
        const round = roundFlowerBedLayout(item.w, item.h);
        const edge = round.edge / 100, soilTop = 0.2;
        const ring = m.vessel([[0.5, 0], [0.5, 0.25], [0.5 - edge / Math.max(w, d), 0.25], [0.5 - edge / Math.max(w, d), soilTop]], w, d, [0, 0, 0], border);
        ring.name = "bed-border";
        const soilDisc = m.cylinder(0.5, 0.5, soilTop, [0, soilTop / 2, 0], soil, 40);
        soilDisc.scale.set(w - edge * 2, 1, d - edge * 2);
        plantFlowers(m, round, soilTop, stem, petals, center);
        break;
      }
      const bed = flowerBedLayout(item.w, item.h);
      const edgeH = 0.25, t = bed.edge / 100;
      for (const side of [-1, 1]) {
        m.box(w, edgeH, t, 0, edgeH / 2, side * (d / 2 - t / 2), border, 0.004);
        m.box(t, edgeH, d - t * 2, side * (w / 2 - t / 2), edgeH / 2, 0, border, 0.004);
      }
      const soilTop = edgeH * 0.8;
      m.box(w - t * 2, soilTop, d - t * 2, 0, soilTop / 2, 0, soil, 0);
      plantFlowers(m, bed, soilTop, stem, petals, center);
      break;
    }
    case "pond": {
      // 2Dの記号と同じ輪郭の水面、同じ位置と大きさのふちの石、水面のさざ波
      const rim = m.material("pond-stone", 0x9a968c, 0.95);
      const water = m.material("water", 0x4a8aa3, 0.06, 0.15, true);
      const ripple = m.material("pond-ripple", 0xd6ecf2, 0.3);
      const pond = pondShape(item.w, item.h);
      const points = pond.points.map(([x, y]) => new THREE.Vector2(x / 100, y / 100));
      const outline = new THREE.Shape();
      const last = points[points.length - 1];
      outline.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
      points.forEach((point, i) => {
        const next = points[(i + 1) % points.length];
        outline.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
      });
      shapeSlab(outline, 0.04, 0.05, m, water, 10);
      for (const stone of pond.stones) {
        const size = Math.min(stone.rx, stone.ry) / 100;
        m.ellipsoid((stone.rx * 2) / 100, size * 1.1, (stone.ry * 2) / 100, [stone.x / 100, size * 0.5, stone.y / 100], rim);
      }
      for (const wave of pond.ripples) {
        const arc = m.mesh(new THREE.TorusGeometry(1, 0.004, 4, 24, RIPPLE_END - RIPPLE_START), [wave.x / 100, 0.052, wave.y / 100], ripple);
        arc.rotation.set(Math.PI / 2, 0, RIPPLE_START);
        arc.scale.set(wave.rx / 100, wave.ry / 100, 1);
      }
      m.reserveFootprint(w, d);
      break;
    }
    case "fence": {
      // 長い辺に沿って、支柱・横木・縦板を並べる。いちばん高い支柱が指定の高さ
      const boards = m.material("fence", 0xc8b08a, 0.8, 0, true);
      const along = w >= d;
      const length = along ? w : d;
      if (variant === 1) {
        // ブロック塀: 20cmの段ごとに半分ずらして積んだブロックと、40cmごとに目地のある笠木（2Dの目地と同じ位置）
        const block = m.material("block", 0x9a968d, 0.95, 0, true);
        const coping = m.material("block-coping", 0xd2cdc2, 0.9);
        const span = Math.min(0.15, along ? d : w) * 0.85;
        const put = (x: number, y: number, sx: number, sy: number, sz: number, material: Material) =>
          along ? m.box(sx, sy, sz, x, y, 0, material, 0) : m.box(sz, sy, sx, 0, y, x, material, 0);
        const capH = 0.05, bodyH = Math.max(0.1, tall - capH);
        const courses = Math.max(1, Math.round(bodyH / 0.2)), courseH = bodyH / courses;
        const blocks = Math.max(1, Math.round(length / 0.4)), blockL = length / blocks;
        for (let c = 0; c < courses; c += 1) {
          const shift = c % 2 ? blockL / 2 : 0;
          for (let i = 0; i <= blocks; i += 1) {
            const start = Math.max(-length / 2, -length / 2 + i * blockL - shift), end = Math.min(length / 2, -length / 2 + (i + 1) * blockL - shift);
            if (end - start < 0.02) continue;
            put((start + end) / 2, c * courseH + courseH / 2, end - start - 0.008, courseH - 0.008, span, block);
          }
        }
        const caps = blockWallCaps(item.w >= item.h ? item.w : item.h), capL = length / caps;
        for (let i = 0; i < caps; i += 1) put(-length / 2 + capL * (i + 0.5), bodyH + capH / 2, capL - 0.008, capH, span * 1.18, coping);
        m.reserveFootprint(w, d);
        break;
      }
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
      const pole = m.material("lamp-pole", 0x30353a, 0.5, 0.2, true);
      const glow = m.material("lamp-glow", 0xfff1c6, 0.35);
      glow.emissive.set(0xffdf8a);
      glow.emissiveIntensity = 0.55;
      if (variant === 1) {
        // 笠付き: 台座、細い柱、光る灯り、暗い色の円すいの笠
        const poleTop = tall * 0.84, lampH = tall * 0.11;
        m.cylinder(0.11, 0.13, 0.08, [0, 0.04, 0], pole, 20);
        m.cylinder(0.03, 0.04, poleTop, [0, poleTop / 2, 0], pole, 12);
        m.cylinder(0.1, 0.075, lampH, [0, poleTop + lampH / 2, 0], glow, 20);
        m.cylinder(0.02, 0.15, tall - poleTop - lampH, [0, (tall + poleTop + lampH) / 2, 0], pole, 20);
        break;
      }
      // 標準: 細い柱の上に白い受け皿と、光る丸い玉（2Dの記号の白い輪と黄色い丸）
      const radius = Math.min(w, d) / 2;
      const saucer = m.material("lamp-saucer", 0xf2f2ee, 0.4, 0.1);
      const globe = radius * 0.34, poleTop = tall - globe * 2;
      const globeMat = m.material("lamp-globe", 0xfff4d2, 0.25);
      globeMat.emissive.set(0xffd98a);
      globeMat.emissiveIntensity = 0.3;
      m.cylinder(radius * 0.3, radius * 0.34, 0.06, [0, 0.03, 0], pole, 20);
      m.cylinder(radius * 0.12, radius * 0.16, 0.3, [0, 0.21, 0], pole, 16);
      m.cylinder(0.026, 0.032, poleTop, [0, poleTop / 2, 0], pole, 12);
      // 受け皿: 下側は柱と同じ暗い金属、上面は2Dの白い輪
      m.cylinder(radius * 0.6, radius * 0.1, 0.06, [0, poleTop - 0.03, 0], pole, 32);
      m.cylinder(radius * 0.62, radius * 0.62, 0.012, [0, poleTop + 0.006, 0], saucer, 32);
      m.ellipsoid(globe * 2, globe * 2, globe * 2, [0, poleTop + globe, 0], globeMat);
      // 受け皿の下から斜め上へ伸びる8本の飾りの腕（2Dの記号の光の筋と同じ向き・長さ）
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        m.rod([Math.cos(a) * radius * 0.2, poleTop - 0.12, Math.sin(a) * radius * 0.2], [Math.cos(a) * radius * 0.97, poleTop + 0.01, Math.sin(a) * radius * 0.97], 0.006, pole);
      }
      m.reserveFootprint(w, d);
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
      // 屋根の波板の筋（2Dの縦線と同じ本数）と、手前の軒の線
      const ribs = Math.max(3, Math.round(item.w / 18));
      for (let i = 1; i < ribs; i += 1) {
        const rib = m.box(0.012, 0.012, d * 0.86, -w / 2 + (w * i) / ribs, 1.93, -d * 0.06, panel, 0);
        rib.rotation.x = -0.07;
      }
      const eave = m.box(w, 0.014, 0.02, 0, 1.932 + d * 0.38 * Math.sin(0.07), d * 0.38, panel, 0);
      eave.rotation.x = -0.07;
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
    case "parasol": {
      // 8角形の傘（2Dと同じ角の向き）、傘の下の骨、柱と重しの台座
      const cloth = m.material("parasol-cloth", 0xe9dcc3, 0.9, 0, true);
      cloth.side = THREE.DoubleSide;
      const pole = m.material("parasol-pole", 0x6d5844, 0.7);
      const rim = 2.05, apex = 2.4;
      const corners = PARASOL_CORNERS.map((a) => new THREE.Vector3(Math.cos(a) * (w / 2), rim, Math.sin(a) * (d / 2)));
      m.mesh(fanGeometry(new THREE.Vector3(0, apex, 0), corners), [0, 0, 0], cloth);
      for (const corner of corners) m.rod([0, apex - 0.05, 0], [corner.x * 0.97, rim - 0.015, corner.z * 0.97], 0.008, pole);
      m.rod([0, 0.08, 0], [0, apex + 0.06, 0], 0.024, pole);
      m.ellipsoid(0.06, 0.08, 0.06, [0, apex + 0.08, 0], pole);
      m.cylinder(0.24, 0.27, 0.08, [0, 0.04, 0], m.material("parasol-base", 0x55595c, 0.8), 24);
      break;
    }
    case "clothesDryer": {
      // 両端の台（奥行いっぱいの足）と柱、上の横木に渡した2本の竿（2Dと同じ位置）
      const frame = m.material("dryer-frame", 0xd8dcdc, 0.35, 0.4, true);
      const poleMat = m.material("dryer-pole", 0xb9c3c7, 0.3, 0.6);
      const foot = dryerFootWidth(item.w) / 100, top = 1.7;
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - foot / 2);
        m.box(foot, 0.06, d, x, 0.03, 0, frame, 0.01);
        m.rod([x, 0.06, 0], [x, top, 0], 0.025, frame);
        m.box(foot * 0.6, 0.04, d * 0.9, x, top, 0, frame, 0.008);
      }
      for (const offset of DRYER_POLES) m.rod([-w / 2 + foot * 0.3, top + 0.035, offset * d], [w / 2 - foot * 0.3, top + 0.035, offset * d], 0.018, poleMat);
      break;
    }
    case "swing": {
      // 両端のA字の脚、上の横木、真ん中に鎖で吊るした座面
      const frame = m.material("swing-frame", 0x3f6f8f, 0.5, 0.2, true);
      const topY = 2.0, inset = w * 0.05;
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - inset);
        for (const sz of [-1, 1]) m.rod([x, 0, sz * d * 0.47], [x, topY, 0], 0.035, frame);
      }
      m.rod([-w / 2 + inset * 0.5, topY, 0], [w / 2 - inset * 0.5, topY, 0], 0.04, frame);
      const seatW = w * 0.3, seatD = d * 0.22, seatY = 0.45;
      m.box(seatW, 0.04, seatD, 0, seatY, 0, wood, 0.01);
      for (const sx of [-1, 1]) m.rod([sx * seatW * 0.42, seatY, 0], [sx * seatW * 0.42, topY, 0], 0.008, metal);
      break;
    }
    case "trashCan": {
      // 丸い胴、少し内側の丸いふた、奥のちょうつがい、手前のペダル（2Dと同じ大きさ）
      const body = m.material("bin-body", 0xdfe3e2, 0.4, 0.2, true);
      const r = Math.min(w, d) / 2;
      m.cylinder(r * 0.84, r * 0.78, 0.55, [0, 0.275, 0], body, 32);
      m.cylinder(r * 0.8, r * 0.8, 0.03, [0, 0.565, 0], body, 32);
      m.box(r * 0.4, 0.03, r * 0.1, 0, 0.57, -r * 0.84, black, 0.005);
      m.box(r * 0.32, 0.03, r * 0.22, 0, 0.03, r * 0.88, black, 0.008);
      m.reserveFootprint(w, d);
      break;
    }
    case "coatStand": {
      // 丸い台座、1本の柱、上の6本のフック（2Dと同じ向き）と頭の玉
      const stand = m.material("coat-stand", 0x6d5844, 0.6, 0, true);
      const r = Math.min(w, d) / 2;
      const base = m.cylinder(0.5, 0.5, 0.03, [0, 0.015, 0], stand, 32);
      base.scale.set(w, 1, d);
      m.rod([0, 0.03, 0], [0, 1.75, 0], 0.022, stand);
      for (const a of COAT_HOOK_ANGLES) {
        const tip: Position = [Math.cos(a) * r * COAT_HOOK_REACH, 1.68, Math.sin(a) * r * COAT_HOOK_REACH];
        m.rod([0, 1.58, 0], tip, 0.012, stand);
        m.ellipsoid(0.03, 0.03, 0.03, tip, stand);
      }
      m.ellipsoid(0.07, 0.07, 0.07, [0, 1.78, 0], stand);
      break;
    }
    case "crib": {
      // ベビーベッド: 四隅の柱と頭の玉、上下の手すり、縦の桟、マットレス・枕・掛け布団（2Dと同じ位置）
      const frame = m.material("crib-wood", 0xe9dcc6, 0.6, 0, true);
      const rail = cribRail(item.w, item.h) / 100, height = 0.95;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - rail / 2), z = sz * (d / 2 - rail / 2);
        m.box(rail, height, rail, x, height / 2, z, frame, 0.008);
        m.ellipsoid(rail * 1.1, rail * 1.1, rail * 1.1, [x, height + rail * 0.4, z], frame);
      }
      for (const y of [0.3, height - 0.02]) {
        for (const sz of [-1, 1]) m.box(w - rail * 2, 0.04, rail * 0.8, 0, y, sz * (d / 2 - rail / 2), frame, 0.006);
        for (const sx of [-1, 1]) m.box(rail * 0.8, 0.04, d - rail * 2, sx * (w / 2 - rail / 2), y, 0, frame, 0.006);
      }
      const barsX = cribBars((w - rail * 2) * 100), barsZ = cribBars((d - rail * 2) * 100);
      for (let i = 1; i < barsX; i += 1) for (const sz of [-1, 1]) {
        const x = -w / 2 + rail + ((w - rail * 2) * i) / barsX;
        m.rod([x, 0.32, sz * (d / 2 - rail / 2)], [x, height - 0.04, sz * (d / 2 - rail / 2)], rail * 0.18, frame);
      }
      for (let i = 1; i < barsZ; i += 1) for (const sx of [-1, 1]) {
        const z = -d / 2 + rail + ((d - rail * 2) * i) / barsZ;
        m.rod([sx * (w / 2 - rail / 2), 0.32, z], [sx * (w / 2 - rail / 2), height - 0.04, z], rail * 0.18, frame);
      }
      m.box(w - rail * 2, 0.1, d - rail * 2, 0, 0.37, 0, ivory, 0.02);
      m.box(w * 0.5, 0.06, d * 0.12, 0, 0.45, -d * 0.33, ivory, 0.025);
      m.box(w - rail * 2 - 0.02, 0.03, d * 0.45, 0, 0.435, d * 0.17, fabric, 0.012);
      break;
    }
    case "catTower": {
      // 床の台と、高さの違う板（2Dと同じ位置・大きさ・丸と四角）、板を支える麻縄巻きの柱
      const carpet = m.material("cat-carpet", 0xd9cbb4, 0.95, 0, true);
      const rope = m.material("sisal", 0xb89b6a, 0.95);
      m.box(w, 0.04, d, 0, 0.02, 0, carpet, 0.01);
      // 板は2Dの記号と同じく2色を交互に（重なった板の縁が上から見分けられる）
      const decks = [m.material("cat-deck-dark", 0xcdbb9b, 0.95), m.material("cat-deck-light", 0xefe5d3, 0.95)];
      CAT_TOWER_DECKS.forEach((deck, i) => {
        const x = deck.x * w, z = deck.y * d, y = deck.height * tall;
        m.cylinder(0.045, 0.045, y - 0.03, [x, (y - 0.03) / 2 + 0.02, z], rope, 12);
        if (deck.round) {
          const disc = m.cylinder(0.5, 0.5, 0.03, [x, y - 0.015, z], decks[i % 2], 32);
          disc.scale.set(deck.w * w, 1, deck.h * d);
        } else {
          m.box(deck.w * w, 0.03, deck.h * d, x, y - 0.015, z, decks[i % 2], 0.01);
        }
      });
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
