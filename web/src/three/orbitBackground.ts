import * as THREE from "three";
import { disposeScene, lcg, makeDotTexture, makeShell } from "./common";

/**
 * The home hero's largest orbit ellipsoid as a standalone, ever-rotating background:
 * two co-axial gold particle shells (the inner one 30% smaller). Returns a cleanup function.
 */
export function startOrbitBackground(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 4.8;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const texture = makeDotTexture();
  const group = new THREE.Group();
  scene.add(group);

  const RADIUS = 2.53;
  const COUNT = 2457;
  const shellOpts = { texture, size: 0.02, opacity: 0.8, scale: [1.0, 1.4, 1.15] as [number, number, number] };
  group.add(makeShell({ ...shellOpts, radius: RADIUS, count: COUNT, rnd: lcg(918273) }).points);
  group.add(makeShell({ ...shellOpts, radius: RADIUS * 0.7, count: Math.round(COUNT * 0.49), rnd: lcg(554433) }).points);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", onResize);

  let frame = 0;
  const tick = () => {
    group.rotation.y += 0.056 / 60;
    group.rotation.x += 0.02016 / 60;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
    disposeScene(scene);
    renderer.dispose();
  };
}
