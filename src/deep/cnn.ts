// The draw-a-digit network: a small CNN trained offline in Keras (scripts/train_cnn.py) and run here in plain TypeScript.
// Layers: conv 3×3×8 + ReLU → max-pool 2 → conv 3×3×16 + ReLU → max-pool 2 → dense 64 + ReLU → dense 10 + softmax.
// Every tensor uses Keras's channels-last layout: pixel (r, c) of channel k sits at (r * W + c) * C + k.

export interface CnnLayer { shape: number[]; w: Float32Array; b: Float32Array }
export interface Cnn { conv1: CnnLayer; conv2: CnnLayer; dense1: CnnLayer; dense2: CnnLayer; accuracy: number }
interface RawLayer { shape: number[]; w: string; b: string }
interface RawModel { format: string; test_accuracy: number; layers: Record<'conv1' | 'conv2' | 'dense1' | 'dense2', RawLayer> }

export const SIZE = 28;
export const MAP = 26;
export const FILTERS = 8;

function floats(base64: string): Float32Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  return Float32Array.from({ length: bytes.length / 4 }, (_, i) => view.getFloat32(i * 4, true));
}

/** Turn the exported JSON into typed arrays and check that the shapes match the architecture. */
export function parseCnn(raw: RawModel): Cnn {
  if (raw.format !== 'mlv-cnn-1') throw new Error(`Unknown model format ${raw.format}`);
  const expected = { conv1: [3, 3, 1, 8], conv2: [3, 3, 8, 16], dense1: [400, 64], dense2: [64, 10] } as const;
  const layer = (name: keyof typeof expected): CnnLayer => {
    const { shape, w, b } = raw.layers[name];
    if (shape.join() !== expected[name].join()) throw new Error(`${name} has shape ${shape}`);
    const out = { shape, w: floats(w), b: floats(b) };
    if (out.w.length !== shape.reduce((a, n) => a * n, 1) || out.b.length !== shape[shape.length - 1]) throw new Error(`${name} has the wrong size`);
    return out;
  };
  return { conv1: layer('conv1'), conv2: layer('conv2'), dense1: layer('dense1'), dense2: layer('dense2'), accuracy: raw.test_accuracy };
}

/** 3×3 'valid' convolution with ReLU. */
function conv(input: Float32Array, size: number, cin: number, { w, b, shape }: CnnLayer): Float32Array {
  const cout = shape[3], outSize = size - 2;
  const out = new Float32Array(outSize * outSize * cout);
  for (let r = 0; r < outSize; r++) for (let c = 0; c < outSize; c++) {
    const o0 = (r * outSize + c) * cout;
    for (let o = 0; o < cout; o++) out[o0 + o] = b[o];
    for (let kr = 0; kr < 3; kr++) for (let kc = 0; kc < 3; kc++) {
      const i0 = ((r + kr) * size + c + kc) * cin, k0 = (kr * 3 + kc) * cin * cout;
      for (let i = 0; i < cin; i++) {
        const v = input[i0 + i];
        if (!v) continue;
        const k = k0 + i * cout;
        for (let o = 0; o < cout; o++) out[o0 + o] += v * w[k + o];
      }
    }
    for (let o = 0; o < cout; o++) if (out[o0 + o] < 0) out[o0 + o] = 0;
  }
  return out;
}

/** 2×2 max pooling with stride 2 (an odd last row or column is dropped, like Keras). */
function pool(input: Float32Array, size: number, ch: number): Float32Array {
  const half = Math.floor(size / 2);
  const out = new Float32Array(half * half * ch);
  for (let r = 0; r < half; r++) for (let c = 0; c < half; c++) for (let k = 0; k < ch; k++) {
    const at = (rr: number, cc: number) => input[(rr * size + cc) * ch + k];
    out[(r * half + c) * ch + k] = Math.max(at(2 * r, 2 * c), at(2 * r, 2 * c + 1), at(2 * r + 1, 2 * c), at(2 * r + 1, 2 * c + 1));
  }
  return out;
}

function dense(input: Float32Array, { w, b, shape }: CnnLayer, relu: boolean): Float32Array {
  const [n, m] = shape;
  const out = Float32Array.from(b);
  for (let i = 0; i < n; i++) {
    const v = input[i];
    if (!v) continue;
    for (let j = 0; j < m; j++) out[j] += v * w[i * m + j];
  }
  if (relu) for (let j = 0; j < m; j++) if (out[j] < 0) out[j] = 0;
  return out;
}

export interface Inference {
  /** Probability of each digit 0–9 (sums to 1). */
  probs: Float32Array;
  /** First-layer feature maps after ReLU, 26 × 26 × 8, channels last. */
  conv1: Float32Array;
}

/** Run the network on a 28 × 28 image with values 0 (background) to 1 (ink). */
export function infer(model: Cnn, image: Float32Array): Inference {
  const c1 = conv(image, SIZE, 1, model.conv1);
  const p1 = pool(c1, MAP, 8);
  const c2 = conv(p1, 13, 8, model.conv2);
  const p2 = pool(c2, 11, 16);
  const logits = dense(dense(p2, model.dense1, true), model.dense2, false);
  const max = Math.max(...logits);
  const exp = logits.map(v => Math.exp(v - max));
  const sum = exp.reduce((a, v) => a + v, 0);
  return { probs: exp.map(v => v / sum), conv1: c1 };
}

/** One feature map (channel k) as a 26 × 26 array. */
export const featureMap = (conv1: Float32Array, k: number) => Float32Array.from({ length: MAP * MAP }, (_, i) => conv1[i * FILTERS + k]);

/** The 3 × 3 weights of first-layer filter k, row by row. */
export const kernel = (model: Cnn, k: number) => Array.from({ length: 9 }, (_, i) => model.conv1.w[i * FILTERS + k]);

export type Stroke = Array<{ x: number; y: number }>;

/** Pen radius in pixels of the 28 × 28 image: MNIST strokes are about 2–3 pixels wide. */
const PEN = 1.15;

function distanceToStrokes(px: number, py: number, strokes: Array<Array<[number, number]>>): number {
  let best = Infinity;
  for (const pts of strokes) {
    if (pts.length === 1) best = Math.min(best, Math.hypot(px - pts[0][0], py - pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
  }
  return best;
}

/**
 * Turn pen strokes (pad coordinates 0–1) into a 28 × 28 image the way MNIST digits were prepared: crop to the ink,
 * scale the longer side to fit a 20 × 20 box, then shift so the centre of mass sits in the middle. Returns null when empty.
 */
export function rasterize(strokes: Stroke[]): Float32Array | null {
  const all = strokes.flat();
  if (!all.length) return null;
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // A dot or a tiny scribble should not be blown up to fill the box.
  const extent = Math.max(x1 - x0, y1 - y0, 0.12);
  const scale = (20 - 2 * PEN) / extent;
  const render = (ox: number, oy: number) => {
    const mapped = strokes.filter(s => s.length).map(s => s.map((p): [number, number] =>
      [(p.x - (x0 + x1) / 2) * scale + 14 + ox, (p.y - (y0 + y1) / 2) * scale + 14 + oy]));
    const image = new Float32Array(SIZE * SIZE);
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const d = distanceToStrokes(c + 0.5, r + 0.5, mapped);
      image[r * SIZE + c] = Math.max(0, Math.min(1, PEN + 0.5 - d));
    }
    return image;
  };
  const first = render(0, 0);
  let mass = 0, mx = 0, my = 0;
  first.forEach((v, i) => { mass += v; mx += v * ((i % SIZE) + 0.5); my += v * (Math.floor(i / SIZE) + 0.5); });
  if (!mass) return first;
  const shiftX = Math.max(-4, Math.min(4, 14 - mx / mass)), shiftY = Math.max(-4, Math.min(4, 14 - my / mass));
  return Math.abs(shiftX) < 0.25 && Math.abs(shiftY) < 0.25 ? first : render(shiftX, shiftY);
}
