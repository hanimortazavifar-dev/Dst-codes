import * as THREE from "three";
import { disposeScene, lcg, makeDotTexture, makeShell, ORBIT_GOLD } from "./common";
import { fragmentShader, vertexShader } from "./shaders";
import { boneShape, brainShape, COUNT, loadTracedImage, maskShape, skullShape, type TraceOptions } from "./shapes";

/** Last stage index; uProgress runs 0..MAX_STAGE across the five shapes. */
export const MAX_STAGE = 4;

/** One traced image per stage, in scroll order. */
export interface StageImage {
  url: string;
  trace?: TraceOptions;
}

const color = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

function makeUniforms(renderer: THREE.WebGLRenderer, overrides: Record<string, unknown>) {
  const base: Record<string, unknown> = {
    uProgress: 0,
    uTime: 0,
    uMouse: new THREE.Vector3(99, 99, 0),
    uPR: Math.min(renderer.getPixelRatio(), 2),
    uDim: 1,
    uMobile: 0,
    uJitterAmp: 1,
    uLineColorA: color(0, 0, 0),
    uLineColorB: color(0, 0, 0),
    uLineColorC: color(0, 0, 0),
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, value]) => [k, { value }])) as Record<string, THREE.IUniform>;
}

/**
 * Orbit shells around the shapes. Set 1 (four layers plus a crossing ellipsoid) is visible from
 * the first stage and grows as the user scrolls; set 2 (three small layers) fades in from stage 2.
 */
function buildOrbits(parent: THREE.Group, texture: THREE.Texture) {
  const rnd = lcg(918273);
  const BASE_COUNT = Math.round(1400 * 1.3 * 1.35);
  const BASE_RADIUS = 2.3 * 0.8;
  const SIZE = 0.028 * 0.5;
  const BASE_SPEED = { y: 0.2, x: 0.072 };
  const SET1_SPEED = 0.8;

  type Shell = { mesh: THREE.Points; speed: { x: number; y: number } };
  const set1 = new THREE.Group();
  const set2 = new THREE.Group();
  parent.add(set1, set2);
  const set1Materials: THREE.PointsMaterial[] = [];
  const set2Materials: THREE.PointsMaterial[] = [];
  const shells: Shell[] = [];

  const add = (group: THREE.Group, mats: THREE.PointsMaterial[], radius: number, count: number, speedMult: number, scale?: [number, number, number]) => {
    const { points, material } = makeShell({ radius, count, rnd, texture, size: SIZE, opacity: 0, scale });
    group.add(points);
    mats.push(material);
    shells.push({ mesh: points, speed: { y: BASE_SPEED.y * speedMult, x: BASE_SPEED.x * speedMult } });
  };

  // Set 1: outer ellipsoid + three nested spheres; the outer three are denser.
  const layerRadii = [BASE_RADIUS * 1.25, BASE_RADIUS * 0.9 * 1.15, BASE_RADIUS * 0.8 * 1.15, BASE_RADIUS * 0.7 * 1.15];
  const layerSpeed = [1, 1, 0.9, 0.8];
  layerRadii.forEach((radius, i) => {
    const count = i < 3 ? Math.round(BASE_COUNT * 1.4) : BASE_COUNT;
    add(set1, set1Materials, radius, count, SET1_SPEED * layerSpeed[i], i === 0 ? [1.4, 1.15, 1.0] : undefined);
  });
  // A second ellipsoid stretched on the other axis so the two cross, 10% bigger, 30% slower.
  add(set1, set1Materials, layerRadii[0] * 1.1, BASE_COUNT, SET1_SPEED * 0.7, [1.0, 1.4, 1.15]);

  // Set 2: three layers at the smallest set-1 radius +20%, with slightly varied speeds.
  for (const mult of [1, 0.85, 0.7]) add(set2, set2Materials, layerRadii[3] * 1.2, Math.round(1400 * 1.3), mult);

  return {
    update(dt: number, progress: number, compact: boolean) {
      for (const { mesh, speed } of shells) {
        mesh.rotation.y += speed.y * dt;
        mesh.rotation.x += speed.x * dt;
      }
      const visible1 = progress <= MAX_STAGE ? 1 : THREE.MathUtils.clamp(1 - (progress - MAX_STAGE) * 2, 0, 1);
      for (const m of set1Materials) m.opacity = visible1 * 0.8;
      // Desktop: the three outer set-1 layers glow 40% brighter.
      const boost = compact ? 1 : 1.4;
      for (let i = 0; i < 3; i++) set1Materials[i].color.copy(ORBIT_GOLD).multiplyScalar(boost);

      const visible2 = THREE.MathUtils.clamp((progress - 0.5) * 2, 0, 1);
      for (const m of set2Materials) m.opacity = visible2 * 0.8;

      // Set 1 grows ×2.2 from stage 1 to 2 ("flying in"); both sets then grow 30% per later stage.
      const spurts = [1, 2, 3].reduce((acc, k) => acc * THREE.MathUtils.lerp(1, 1.3, THREE.MathUtils.clamp(progress - k, 0, 1)), 1);
      set1.scale.setScalar(THREE.MathUtils.lerp(1, 2.2, THREE.MathUtils.clamp(progress, 0, 1)) * spurts);
      set2.scale.setScalar(spurts);
    },
  };
}

/** A soft, non-morphing ambient particle cloud behind everything. */
function buildHalo(renderer: THREE.WebGLRenderer) {
  const HALO = 3500;
  const rnd = lcg(1234567);
  const pos = new Float32Array(HALO * 3);
  const rand = new Float32Array(HALO);
  for (let i = 0; i < HALO; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    const r = 1.9 + Math.pow(rnd(), 1.4) * 1.9;
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r * 1.5;
    pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 1.05;
    pos[i * 3 + 2] = Math.cos(phi) * r * 0.7;
    rand[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  for (const name of ["position", "p0", "p1", "p2", "p3", "p4"]) geo.setAttribute(name, attr);
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  geo.setAttribute("aLineMask", new THREE.BufferAttribute(new Float32Array(HALO), 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);

  // Matte ↔ bright yellow pulse (colour C equal to A collapses the 3-stop cycle to two tones).
  const matte = color(0.55, 0.5, 0.18);
  const uniforms = makeUniforms(renderer, { uDim: 0.456, uJitterAmp: 1.5, uColorA: matte, uColorB: color(1.0, 0.95, 0.25), uColorC: matte.clone() });
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms });
  return { points: new THREE.Points(geo, material), uniforms };
}

/**
 * Starts the scroll-driven particle hero on `canvas`. Call `setProgress` with the target stage
 * position (0..MAX_STAGE); the field eases toward it. Returns controls including `dispose`.
 */
export function startParticleHero(canvas: HTMLCanvasElement, images: StageImage[]) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  const group = new THREE.Group();
  scene.add(group);

  // Procedural placeholders until each stage's image is traced.
  const geometry = new THREE.BufferGeometry();
  const placeholders = [skullShape(), skullShape(), brainShape(), boneShape(), maskShape()];
  geometry.setAttribute("position", new THREE.BufferAttribute(placeholders[0].slice(), 3));
  placeholders.forEach((p, i) => geometry.setAttribute(`p${i}`, new THREE.BufferAttribute(p, 3)));
  const rand = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) rand[i] = ((i * 2654435761) % 1000) / 1000;
  geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  geometry.setAttribute("aLineMask", new THREE.BufferAttribute(new Float32Array(COUNT), 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  let disposed = false;
  images.forEach(({ url, trace = {} }, i) => {
    loadTracedImage(url, trace)
      .then((result) => {
        if (disposed || !result) return;
        geometry.setAttribute(`p${i}`, new THREE.BufferAttribute(result.points, 3));
        if (trace.withLineMask) geometry.setAttribute("aLineMask", new THREE.BufferAttribute(result.lineMask, 1));
      })
      .catch(() => {
        /* keep the placeholder shape */
      });
  });

  const uniforms = makeUniforms(renderer, {
    uColorA: color(0.45, 0.32, 0.06), // dark gold
    uColorB: color(1.0, 0.84, 0.35), // gold
    uColorC: color(1.0, 0.63, 0.3), // light orange
    uLineColorA: color(1.0, 0.82, 0.25), // golden yellow
    uLineColorB: color(0.5, 0.42, 0.05), // dark yellow
    uLineColorC: color(1.0, 0.68, 0.35), // light orange
  });
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms });
  group.add(new THREE.Points(geometry, material));

  const orbits = buildOrbits(group, makeDotTexture());
  const halo = buildHalo(renderer);
  scene.add(halo.points); // sibling of `group`, so it stays put while the shape scales

  // Pointer in normalized device coords; (5, 5) means "outside".
  const mouse = { x: 5, y: 5 };
  const onMove = (e: PointerEvent) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  const onLeave = () => {
    mouse.x = 5;
    mouse.y = 5;
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  const timer = new THREE.Timer();
  const ray = new THREE.Vector3();
  const mouseWorld = new THREE.Vector3();
  let target = 0;
  let current = 0;
  let frame = 0;

  const animate = (now: number) => {
    frame = requestAnimationFrame(animate);
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();

    current += (target - current) * (1 - Math.exp(-4 * dt));
    uniforms.uProgress.value = current;
    uniforms.uTime.value = t;
    halo.uniforms.uTime.value = t;

    // Project the pointer onto the z=0 plane.
    ray.set(mouse.x, mouse.y, 0.5).unproject(camera).sub(camera.position).normalize();
    mouseWorld.copy(camera.position).addScaledVector(ray, -camera.position.z / ray.z);
    (uniforms.uMouse.value as THREE.Vector3).lerp(mouseWorld, 1 - Math.exp(-12 * dt));
    (halo.uniforms.uMouse.value as THREE.Vector3).copy(uniforms.uMouse.value);

    const compact = (canvas.clientWidth || window.innerWidth) < 600;
    uniforms.uDim.value = compact ? 0.8 : 1.0; // mobile: traced images 20% dimmer
    uniforms.uMobile.value = compact ? 1 : 0;

    // Fit the flat traced images to the visible plane at z=0; sit lower on mobile.
    const vpHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
    const vpWidth = vpHeight * camera.aspect;
    group.scale.setScalar(Math.min((vpWidth * 0.88) / 3.2, (vpHeight * (compact ? 0.3 : 0.65)) / 2.45, 1));
    group.position.y = compact ? vpHeight * 0.14 : 0;

    // Gentle sway that follows the pointer (damped heavily since every stage is a flat image).
    const inside = Math.abs(mouse.x) <= 1 && Math.abs(mouse.y) <= 1;
    const sway = 0.15;
    group.rotation.y += (((inside ? mouse.x * 0.35 : 0) + Math.sin(t * 0.3) * 0.15) * sway - group.rotation.y) * (1 - Math.exp(-2 * dt));
    group.rotation.x += ((inside ? -mouse.y * 0.2 * sway : 0) - group.rotation.x) * (1 - Math.exp(-2 * dt));

    orbits.update(dt, current, compact);
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(animate);

  return {
    setProgress(p: number) {
      target = p;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      timer.dispose();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      disposeScene(scene);
      renderer.dispose();
    },
  };
}
