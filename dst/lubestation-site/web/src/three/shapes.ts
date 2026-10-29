/**
 * Particle target shapes for the home hero. Every shape is COUNT points (x, y, z).
 * The procedural shapes are only placeholders shown until the traced images decode.
 */
export const COUNT = 9000;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Gen = (r: () => number) => [number, number, number] | null;

function fill(gen: Gen, seed: number) {
  const r = rng(seed);
  const out = new Float32Array(COUNT * 3);
  let i = 0;
  let guard = 0;
  while (i < COUNT && guard < COUNT * 50) {
    guard++;
    const p = gen(r);
    if (!p) continue;
    out.set(p, i * 3);
    i++;
  }
  return out;
}

function sphereDir(r: () => number): [number, number, number] {
  const u = r() * 2 - 1;
  const t = r() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(t), u, s * Math.sin(t)];
}

export function maskShape() {
  return fill((r) => {
    const y = r() * 2.6 - 1.3;
    const theta = (r() * 2 - 1) * 1.35;
    const w = 1 - 0.28 * Math.max(0, -y) ** 2 * 1.6 - 0.08 * y * y;
    let x = Math.sin(theta) * 0.95 * w;
    let z = Math.cos(theta) * 0.6 * w;
    for (const ex of [-0.36, 0.36]) {
      const dx = (x - ex) / 0.22;
      const dy = (y - 0.25) / 0.08;
      if (dx * dx + dy * dy < 1) return null;
    }
    z += Math.exp(-(x * x) / 0.01) * Math.max(0, 0.25 - Math.abs(y + 0.05)) * 1.2;
    z += Math.exp(-((y - 0.42) ** 2) / 0.004) * 0.06;
    if (r() < 0.12) x = Math.round(x * 10) / 10;
    return [x, y, z];
  }, 11);
}

export function brainShape() {
  return fill((r) => {
    const [dx, dy, dz] = sphereDir(r);
    const side = dx >= 0 ? 1 : -1;
    const fold = 1 + 0.09 * Math.sin(dx * 13) * Math.sin(dy * 15) * Math.sin(dz * 11);
    const rad = (r() < 0.85 ? 1 : r()) * fold;
    const x = dx * 0.75 * rad + side * 0.07;
    const y = dy * 0.82 * rad + 0.1;
    const z = dz * 1.15 * rad;
    if (y < -0.45 && Math.abs(z) > 0.3) return null;
    if (r() < 0.06) return [r() * 0.16 - 0.08, -0.6 - r() * 0.6, -0.3 + r() * 0.2];
    return [x, y, z];
  }, 22);
}

export function boneShape() {
  const a = Math.PI / 4;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return fill((r) => {
    let x: number, y: number, z: number;
    const pick = r();
    if (pick < 0.55) {
      const t = r() * 2.2 - 1.1;
      const ang = r() * Math.PI * 2;
      const rad = 0.16 + 0.04 * t * t;
      x = Math.cos(ang) * rad;
      y = t;
      z = Math.sin(ang) * rad;
    } else {
      const end = pick < 0.775 ? 1 : -1;
      const lobe = r() < 0.5 ? 1 : -1;
      const [dx, dy, dz] = sphereDir(r);
      x = dx * 0.28 + lobe * 0.18;
      y = dy * 0.28 + end * 1.25;
      z = dz * 0.28;
    }
    return [x * ca - y * sa, x * sa + y * ca, z];
  }, 33);
}

export function skullShape() {
  return fill((r) => {
    if (r() < 0.75) {
      const [dx, dy, dz] = sphereDir(r);
      let x = dx * 0.9;
      const y = dy * 0.95 + 0.25;
      const z = dz * 1.05;
      if (dy < -0.2) {
        if (dz < 0.3) return null;
        x *= 0.85;
      }
      for (const ex of [-0.33, 0.33]) {
        const ddx = (x - ex) / 0.2;
        const ddy = (y - 0.05) / 0.18;
        if (dz > 0.5 && ddx * ddx + ddy * ddy < 1) return null;
      }
      if (dz > 0.6 && Math.abs(x) < 0.08 && y > -0.25 && y < -0.05) return null;
      return [x, y, z];
    }
    const t = (r() * 2 - 1) * 1.4;
    const rad = 0.6;
    const y = -0.65 + (r() - 0.5) * 0.2 + Math.abs(t) * 0.25;
    return [Math.sin(t) * rad, y, Math.cos(t) * rad * 1.1 - 0.05];
  }, 44);
}

export interface TraceOptions {
  /** World-space width of the traced image (default 3.2). */
  scale?: number;
  /** Trace bright pixels on a dark background instead of dark ink on white. */
  invert?: boolean;
  /**
   * Also classify each point as a thick "line" stroke (1) or thin "border" outline (0) by local
   * ink density; used by the network map, whose radiating lines get their own colour travel.
   */
  withLineMask?: boolean;
  /** Fraction (0–1) of ink pixels used as distinct positions; lower reads less dense. */
  density?: number;
}

/** Turns an image's ink pixels into COUNT flat particle positions. */
export function traceImage(pixels: Uint8ClampedArray, width: number, height: number, opts: TraceOptions = {}) {
  const { scale = 3.2, invert = false, withLineMask = false, density } = opts;
  const inkSet = withLineMask ? new Uint8Array(width * height) : null;
  let ink: number[] = [];
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const brightness = (pixels[o] + pixels[o + 1] + pixels[o + 2]) / 3;
    const isInk = invert ? brightness > 105 : brightness < 150;
    if (isInk && pixels[o + 3] > 0) {
      ink.push(i);
      if (inkSet) inkSet[i] = 1;
    }
  }
  if (ink.length === 0) return null;

  if (density && density < 1) {
    const keep = Math.max(1, Math.round(ink.length * density));
    const sparse = new Array<number>(keep);
    for (let k = 0; k < keep; k++) sparse[k] = ink[Math.floor((k / keep) * ink.length)];
    ink = sparse;
  }

  const points = new Float32Array(COUNT * 3);
  const lineMask = new Float32Array(COUNT);
  const R = 2;
  for (let i = 0; i < COUNT; i++) {
    const pixel = ink[Math.floor((i / COUNT) * ink.length)];
    const px = pixel % width;
    const py = Math.floor(pixel / width);
    points[i * 3] = (px / width - 0.5) * scale;
    points[i * 3 + 1] = (0.5 - py / height) * scale * (height / width);
    if (!inkSet) continue;
    let neighborInk = 0;
    let total = 0;
    for (let dy = -R; dy <= R; dy++) {
      const ny = py + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -R; dx <= R; dx++) {
        const nx = px + dx;
        if (nx < 0 || nx >= width) continue;
        total++;
        if (inkSet[ny * width + nx]) neighborInk++;
      }
    }
    lineMask[i] = total > 0 && neighborInk / total > 0.6 ? 1 : 0;
  }
  return { points, lineMask };
}

/** Loads an image and traces it at 800 px width. */
export function loadTracedImage(url: string, opts: TraceOptions) {
  return new Promise<ReturnType<typeof traceImage>>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = Math.round((800 * image.naturalHeight) / image.naturalWidth);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(null);
      ctx.drawImage(image, 0, 0, c.width, c.height);
      resolve(traceImage(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, opts));
    };
    image.onerror = reject;
    image.src = url;
  });
}
