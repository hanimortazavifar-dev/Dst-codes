import * as THREE from "three";

/** Deterministic LCG in [0, 1), so particle layouts look identical on every load. */
export function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Soft round sprite so PointsMaterial particles are not square. */
export function makeDotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

export const ORBIT_GOLD = new THREE.Color(1.0, 0.86, 0.4);

/** A thin spherical shell of gold additive-blended particles. */
export function makeShell(opts: {
  radius: number;
  count: number;
  rnd: () => number;
  texture: THREE.Texture;
  size: number;
  opacity: number;
  scale?: [number, number, number];
}) {
  const { radius, count, rnd, texture, size, opacity, scale } = opts;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    const r = radius + (rnd() - 0.5) * 0.12;
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    pos[i * 3 + 2] = Math.cos(phi) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius + 0.2);
  const mat = new THREE.PointsMaterial({
    size,
    map: texture,
    color: ORBIT_GOLD.clone(),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  if (scale) points.scale.set(...scale);
  return { points, material: mat };
}

/** Frees every geometry, material and texture in a scene graph. */
export function disposeScene(root: THREE.Object3D) {
  root.traverse((obj) => {
    const o = obj as THREE.Points;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      (m as THREE.PointsMaterial).map?.dispose();
      m.dispose();
    }
  });
}
