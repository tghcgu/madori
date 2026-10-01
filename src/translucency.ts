import * as THREE from "three";

// 色のカラーコードに透明度があるとき、立体をまるごと半透明にする。
// ガラスのように元から透けている部品は、その濃さに掛け合わせる。半透明の物は影を落とさない
export function applyOpacity(object: THREE.Object3D, alpha: number): void {
  if (!(alpha < 1)) return;
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => materials.add(material));
    mesh.castShadow = false;
  });
  materials.forEach((material) => makeTranslucent(material, alpha));
}

export function makeTranslucent(material: THREE.Material, alpha: number): void {
  if (!(alpha < 1)) return;
  material.transparent = true;
  material.opacity *= Math.max(0, alpha);
  // 奥の物が手前の半透明の物に隠されないようにする
  material.depthWrite = false;
}
