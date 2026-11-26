// A small multi-layer perceptron trained with mini-batch gradient descent and cross-entropy loss.
// Plain arrays, no dependencies, and deterministic for a given seed (weights and batch order).
import { gauss, rng, type Rng } from './random';

export type Activation = 'relu' | 'tanh' | 'sigmoid' | 'leaky';
export type Output = 'sigmoid' | 'softmax';
export const LEAK = 0.1;

export interface MlpOptions {
  inputs: number;
  /** Units in each hidden layer, e.g. [8, 8]. An empty list gives a single layer of output neurons. */
  hidden: number[];
  activation?: Activation;
  /** `sigmoid`: one output, P(class 1). `softmax`: one output per class. */
  output?: Output;
  /** Number of classes for softmax output (at least 2). Ignored for sigmoid. */
  classes?: number;
  seed?: number;
}

export interface Layer {
  /** Row-major weights: `w[o * inputs + i]` connects input `i` to unit `o`. */
  w: Float64Array;
  b: Float64Array;
  inputs: number;
  units: number;
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
const act: Record<Activation, (z: number) => number> = {
  relu: (z: number) => (z > 0 ? z : 0),
  tanh: Math.tanh,
  sigmoid,
  leaky: (z: number) => (z > 0 ? z : LEAK * z),
};
// Derivative written in terms of the activation's output `a`.
const dact: Record<Activation, (a: number) => number> = {
  relu: (a: number) => (a > 0 ? 1 : 0),
  tanh: (a: number) => 1 - a * a,
  sigmoid: (a: number) => a * (1 - a),
  leaky: (a: number) => (a > 0 ? 1 : LEAK),
};
export const activate = (name: Activation, z: number) => act[name](z);
const EPS = 1e-12;

export class Mlp {
  readonly layers: Layer[];
  readonly activation: Activation;
  readonly output: Output;
  readonly classes: number;
  private random: Rng;
  /** Reused buffers: activations of every layer for one sample (index 0 is the input). */
  private acts: Float64Array[];
  private deltas: Float64Array[];

  constructor(opts: MlpOptions) {
    if (!Number.isInteger(opts.inputs) || opts.inputs < 1) throw new Error('inputs must be a positive integer');
    if (opts.hidden.some(n => !Number.isInteger(n) || n < 1)) throw new Error('hidden layer sizes must be positive integers');
    this.activation = opts.activation ?? 'relu';
    this.output = opts.output ?? 'sigmoid';
    this.classes = this.output === 'softmax' ? Math.max(2, opts.classes ?? 2) : 2;
    this.random = rng(opts.seed ?? 1);
    const sizes = [opts.inputs, ...opts.hidden, this.output === 'softmax' ? this.classes : 1];
    this.layers = sizes.slice(1).map((units, l) => {
      const inputs = sizes[l];
      // He initialisation suits ReLU and Leaky ReLU; Xavier (Glorot) suits tanh, sigmoid and the output layer.
      const hiddenLayer = l < sizes.length - 2;
      const he = this.activation === 'relu' || this.activation === 'leaky';
      const scale = hiddenLayer && he ? Math.sqrt(2 / inputs) : Math.sqrt(1 / inputs);
      const w = new Float64Array(units * inputs).map(() => gauss(this.random) * scale);
      return { w, b: new Float64Array(units), inputs, units };
    });
    this.acts = sizes.map(n => new Float64Array(n));
    this.deltas = sizes.map(n => new Float64Array(n));
  }

  /** Forward pass for one sample. Returns class probabilities (length 1 for sigmoid: P(class 1)). The array is reused. */
  forward(x: ArrayLike<number>): Float64Array {
    const { layers, acts } = this;
    acts[0].set(x as ArrayLike<number>);
    const f = act[this.activation];
    for (let l = 0; l < layers.length; l++) {
      const { w, b, inputs, units } = layers[l];
      const a = acts[l], z = acts[l + 1];
      const last = l === layers.length - 1;
      for (let o = 0; o < units; o++) {
        let s = b[o];
        const row = o * inputs;
        for (let i = 0; i < inputs; i++) s += w[row + i] * a[i];
        z[o] = last ? s : f(s);
      }
      if (last) {
        if (this.output === 'sigmoid') z[0] = sigmoid(z[0]);
        else {
          let max = -Infinity, sum = 0;
          for (let o = 0; o < units; o++) max = Math.max(max, z[o]);
          for (let o = 0; o < units; o++) sum += (z[o] = Math.exp(z[o] - max));
          for (let o = 0; o < units; o++) z[o] /= sum;
        }
      }
    }
    return acts[acts.length - 1];
  }

  /** P(class 1) for sigmoid output, or the probability of class 1 for softmax. */
  prob1(x: ArrayLike<number>): number {
    const p = this.forward(x);
    return this.output === 'sigmoid' ? p[0] : p[1];
  }

  /** Most likely class. */
  predict(x: ArrayLike<number>): number {
    const p = this.forward(x);
    if (this.output === 'sigmoid') return p[0] > 0.5 ? 1 : 0;
    let best = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
    return best;
  }

  /** Mean cross-entropy over a dataset. Returns 0 for an empty set. */
  loss(X: ArrayLike<number>[], y: number[]): number {
    if (!X.length) return 0;
    let total = 0;
    for (let n = 0; n < X.length; n++) {
      const p = this.forward(X[n]);
      total -= this.output === 'sigmoid'
        ? Math.log(y[n] ? p[0] + EPS : 1 - p[0] + EPS)
        : Math.log(p[y[n]] + EPS);
    }
    return total / X.length;
  }

  /** Share of samples classified correctly, or null for an empty set. */
  accuracy(X: ArrayLike<number>[], y: number[]): number | null {
    if (!X.length) return null;
    let right = 0;
    for (let n = 0; n < X.length; n++) if (this.predict(X[n]) === y[n]) right++;
    return right / X.length;
  }

  /**
   * One gradient-descent update on a mini-batch: average the gradients of the cross-entropy loss over the batch,
   * then move every weight a `rate`-sized step downhill.
   */
  step(X: ArrayLike<number>[], y: number[], rate: number): void {
    if (!X.length || !(rate > 0)) return;
    const { layers, acts, deltas } = this;
    const gw = layers.map(l => new Float64Array(l.w.length));
    const gb = layers.map(l => new Float64Array(l.b.length));
    const d = dact[this.activation];
    for (let n = 0; n < X.length; n++) {
      const p = this.forward(X[n]);
      // Output error: for sigmoid + binary cross-entropy and softmax + cross-entropy alike, dLoss/dz = p - target.
      const out = deltas[layers.length];
      for (let o = 0; o < p.length; o++) out[o] = p[o] - (this.output === 'sigmoid' ? y[n] : o === y[n] ? 1 : 0);
      for (let l = layers.length - 1; l >= 0; l--) {
        const { w, inputs, units } = layers[l];
        const a = acts[l], delta = deltas[l + 1], below = deltas[l];
        if (l > 0) below.fill(0);
        for (let o = 0; o < units; o++) {
          const g = delta[o];
          if (!g) continue;
          gb[l][o] += g;
          const row = o * inputs;
          for (let i = 0; i < inputs; i++) {
            gw[l][row + i] += g * a[i];
            if (l > 0) below[i] += g * w[row + i];
          }
        }
        if (l > 0) for (let i = 0; i < inputs; i++) below[i] *= d(a[i]);
      }
    }
    const k = rate / X.length;
    layers.forEach((layer, l) => {
      for (let i = 0; i < layer.w.length; i++) layer.w[i] -= k * gw[l][i];
      for (let i = 0; i < layer.b.length; i++) layer.b[i] -= k * gb[l][i];
    });
  }

  /** One epoch: shuffle (seeded), then one `step` per mini-batch. Returns the mean loss on the whole set after the epoch. */
  epoch(X: ArrayLike<number>[], y: number[], rate: number, batch = 16): number {
    const order = X.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const size = Math.max(1, Math.floor(batch));
    for (let s = 0; s < order.length; s += size) {
      const ids = order.slice(s, s + size);
      this.step(ids.map(i => X[i]), ids.map(i => y[i]), rate);
    }
    return this.loss(X, y);
  }

}
