import { rng, thin } from './random';
import type { ParamSpec } from './models';
import type { Params, Sample } from './types';

/** A fitted 1-D regression model: `predict(x)` returns y. Both axes are board coordinates in [0, 1]. */
export interface RegModel {
  predict(x: number): number;
  /** SVR only: half-width of the epsilon tube around the curve. */
  tube?: number;
  /** True when there was too little data to fit a curve (the model just returns a constant). */
  constant?: boolean;
}
interface RegTrainable extends RegModel { fit(train: Sample[]): void }
interface RegDef { make: (p: Params) => RegTrainable; params: Record<string, ParamSpec> }

const mean = (v: number[]) => (v.length ? v.reduce((s, a) => s + a, 0) / v.length : 0);

/** R² = 1 - (squared error of the model) / (squared error of always guessing the mean). Null with no points. */
export function r2(model: RegModel, pts: Sample[]): number | null {
  if (!pts.length) return null;
  const m = mean(pts.map(p => p.y));
  let res = 0, tot = 0;
  for (const p of pts) { res += (p.y - model.predict(p.x)) ** 2; tot += (p.y - m) ** 2; }
  if (tot < 1e-12) return res < 1e-12 ? 1 : 0;
  return 1 - res / tot;
}
export const fmtR2 = (v: number | null): string => (v == null ? '–' : v.toFixed(2));

/** Solve A·w = b by Gaussian elimination with partial pivoting. A is n×n, row-major. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const w = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * w[k];
    w[r] = s / A[r][r];
  }
  return w;
}

/** Chebyshev basis T0..Td at x in [-1, 1]: well conditioned, unlike raw powers of x. */
function cheb(x: number, d: number): number[] {
  const t = [1, x];
  for (let k = 2; k <= d; k++) t[k] = 2 * x * t[k - 1] - t[k - 2];
  return t.slice(0, d + 1);
}

/**
 * Least-squares polynomial of a given degree (degree 1 is simple linear regression).
 * x is scaled to [-1, 1] and fitted in the Chebyshev basis, with a tiny ridge so that
 * a degree larger than the number of points still gives a sensible curve.
 */
function polynomial(p: { degree: number }): RegTrainable {
  let w: number[] = [0.5];
  const d = Math.max(1, Math.round(p.degree));
  return {
    fit(t) {
      const rows = t.map(q => cheb(q.x * 2 - 1, d));
      const A = Array.from({ length: d + 1 }, (_, i) => Array.from({ length: d + 1 }, (_, j) => rows.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? 1e-9 : 0)));
      const b = Array.from({ length: d + 1 }, (_, i) => rows.reduce((s, r, k) => s + r[i] * t[k].y, 0));
      w = solve(A, b);
    },
    predict(x) { return cheb(x * 2 - 1, d).reduce((s, v, i) => s + v * w[i], 0); },
  };
}

/**
 * Support vector regression with an RBF kernel, solved in the dual by coordinate descent.
 * The bias is folded into the kernel (K + 1). `C` and `gamma` are log10 values, as the sliders show them.
 * Points that fall inside the epsilon tube get a weight of exactly zero.
 */
function svr(p: { C: number; gamma: number; epsilon: number }): RegTrainable {
  const C = 10 ** p.C, gamma = 10 ** p.gamma, eps = p.epsilon;
  let sv: Array<{ x: number; w: number }> = [], offset = 0;
  const K = (a: number, b: number) => Math.exp(-gamma * (a - b) ** 2) + 1;
  return {
    tube: eps,
    fit(all) {
      const t = thin(all, 250), n = t.length, X = t.map(q => q.x * 2 - 1);
      offset = mean(t.map(q => q.y));
      const Y = t.map(q => q.y - offset);
      const Kc = new Float64Array(n * n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Kc[i * n + j] = K(X[i], X[j]);
      const beta = new Float64Array(n);
      for (let it = 0; it < 400; it++) {
        let move = 0;
        for (let i = 0; i < n; i++) {
          let g = Y[i];
          for (let j = 0; j < n; j++) if (j !== i && beta[j]) g -= beta[j] * Kc[i * n + j];
          const soft = Math.sign(g) * Math.max(0, Math.abs(g) - eps);
          const nb = Math.min(C, Math.max(-C, soft / Kc[i * n + i]));
          move = Math.max(move, Math.abs(nb - beta[i]));
          beta[i] = nb;
        }
        if (move < 1e-6) break;
      }
      sv = [];
      for (let i = 0; i < n; i++) if (Math.abs(beta[i]) > 1e-9) sv.push({ x: X[i], w: beta[i] });
    },
    predict(x) {
      const q = x * 2 - 1;
      let s = offset;
      for (const v of sv) s += v.w * K(v.x, q);
      return s;
    },
  };
}

type Node = { v: number } | { t: number; l: Node; r: Node };

/** Regression tree: each split minimises the squared error of the two sides. */
function build(pts: Sample[], depth: number, maxDepth: number): Node {
  const n = pts.length, sum = pts.reduce((s, q) => s + q.y, 0);
  if (depth >= maxDepth || n < 2) return { v: sum / n };
  const s = pts.slice().sort((a, b) => a.x - b.x);
  let best: { e: number; t: number } | null = null, left = 0, leftSq = 0;
  const sq = s.reduce((a, q) => a + q.y * q.y, 0);
  for (let i = 1; i < n; i++) {
    left += s[i - 1].y; leftSq += s[i - 1].y ** 2;
    if (s[i - 1].x === s[i].x) continue;
    const right = sum - left, e = leftSq - left * left / i + (sq - leftSq) - right * right / (n - i);
    if (!best || e < best.e - 1e-12) best = { e, t: (s[i - 1].x + s[i].x) / 2 };
  }
  if (!best) return { v: sum / n };
  const { t } = best;
  return { t, l: build(pts.filter(q => q.x <= t), depth + 1, maxDepth), r: build(pts.filter(q => q.x > t), depth + 1, maxDepth) };
}
const walk = (nd: Node, x: number): number => { while ('t' in nd) nd = x <= nd.t ? nd.l : nd.r; return nd.v; };

function regTree(p: { depth: number }): RegTrainable {
  let root: Node = { v: 0.5 };
  return { fit(t) { root = build(t, 0, p.depth); }, predict: x => walk(root, x) };
}

/** Random forest: every tree sees a bootstrap sample, and the answers are averaged. Fixed seed. */
function regForest(p: { trees: number }): RegTrainable {
  let trees: Node[] = [];
  return {
    fit(t) {
      const r = rng(42);
      trees = [];
      for (let k = 0; k < p.trees; k++) trees.push(build(t.map(() => t[Math.floor(r() * t.length)]), 0, 7));
    },
    predict: x => trees.reduce((s, nd) => s + walk(nd, x), 0) / trees.length,
  };
}

export const REG_MODELS = {
  linear:     { make: () => polynomial({ degree: 1 }), params: {} },
  polynomial: { make: p => polynomial({ degree: p.degree }), params: { degree: { min: 1, max: 10, step: 1, def: 3 } } },
  svr:        { make: p => svr({ C: p.C, gamma: p.gamma, epsilon: p.epsilon }), params: {
    epsilon: { min: 0, max: 0.2, step: 0.01, def: 0.05 },
    C: { min: -1, max: 2, step: 0.1, def: 1, log: true },
    gamma: { min: 0, max: 2.3, step: 0.05, def: 1, log: true },
  } },
  tree:       { make: p => regTree({ depth: p.depth }), params: { depth: { min: 1, max: 12, step: 1, def: 3 } } },
  forest:     { make: p => regForest({ trees: p.trees }), params: { trees: { min: 1, max: 60, step: 1, def: 20 } } },
} satisfies Record<string, RegDef>;

export type RegModelName = keyof typeof REG_MODELS;
export const REG_NAMES = Object.keys(REG_MODELS) as RegModelName[];
export const isRegModel = (name: string): name is RegModelName => name in REG_MODELS;

export function regDefaults(name: RegModelName): Params {
  const specs: Record<string, ParamSpec> = REG_MODELS[name].params;
  return Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, v.def]));
}

/** Fit on training points. No points: a flat guess at 0.5. One point, or all at the same x: a flat line through the mean. */
export function fitReg(name: RegModelName, params: Params, train: Sample[]): RegModel {
  if (!train.length) return { predict: () => 0.5, constant: true };
  if (train.length < 2 || train.every(p => p.x === train[0].x)) { const m = mean(train.map(p => p.y)); return { predict: () => m, constant: true }; }
  const def: RegDef = REG_MODELS[name];
  const m = def.make({ ...regDefaults(name), ...params });
  m.fit(train);
  return m;
}
