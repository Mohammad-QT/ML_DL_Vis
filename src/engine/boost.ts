import type { Model, Sample } from './types';

type Node = { w: number } | { f: 'x' | 'y'; t: number; l: Node; r: Node };

export interface BoostParams { rounds: number; lr: number; depth: number }
export const BOOST_DEFAULTS: BoostParams = { rounds: 40, lr: 0.3, depth: 3 };

const LAMBDA = 1;
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** One regression tree on gradients g and hessians h (XGBoost-style gain and leaf weights). */
function grow(idx: number[], pts: Sample[], g: number[], h: number[], depth: number, maxDepth: number): Node {
  let G = 0, H = 0;
  for (const i of idx) { G += g[i]; H += h[i]; }
  const leaf: Node = { w: -G / (H + LAMBDA) };
  if (depth >= maxDepth || idx.length < 2) return leaf;
  let best: { gain: number; f: 'x' | 'y'; t: number } | null = null;
  for (const f of ['x', 'y'] as const) {
    const s = idx.slice().sort((a, b) => pts[a][f] - pts[b][f]);
    let GL = 0, HL = 0;
    for (let i = 1; i < s.length; i++) {
      GL += g[s[i - 1]]; HL += h[s[i - 1]];
      if (pts[s[i - 1]][f] === pts[s[i]][f]) continue;
      const GR = G - GL, HR = H - HL;
      if (HL < 0.1 || HR < 0.1) continue;
      const gain = GL * GL / (HL + LAMBDA) + GR * GR / (HR + LAMBDA) - G * G / (H + LAMBDA);
      if (gain > 1e-9 && (!best || gain > best.gain)) best = { gain, f, t: (pts[s[i - 1]][f] + pts[s[i]][f]) / 2 };
    }
  }
  if (!best) return leaf;
  const { f, t } = best;
  return {
    f, t,
    l: grow(idx.filter(i => pts[i][f] <= t), pts, g, h, depth + 1, maxDepth),
    r: grow(idx.filter(i => pts[i][f] > t), pts, g, h, depth + 1, maxDepth),
  };
}

function leafOf(nd: Node, x: number, y: number): number {
  while ('f' in nd) nd = (nd.f === 'x' ? x : y) <= nd.t ? nd.l : nd.r;
  return nd.w;
}

export interface Boosted {
  /** Number of trees actually built. */
  rounds: number;
  /** The model after `r` rounds (0 = just the base rate). `predict` returns P(class B). */
  at(r: number): Model;
  /** Mean log-loss on `pts` after `r` rounds. */
  logLoss(r: number, pts: Sample[]): number;
}

/**
 * Simplified gradient boosting for two classes: start from the base log-odds, then each round fits a shallow tree to
 * the log-loss gradient and adds it, scaled by the learning rate. Like XGBoost it uses second-order leaf weights, but
 * it has no column sampling, no pruning and no regularisation beyond lambda = 1. Deterministic.
 */
export function fitBoost(train: Sample[], p: BoostParams = BOOST_DEFAULTS): Boosted {
  const n = train.length, ones = train.reduce((s, q) => s + q.c, 0);
  const prior = n && ones > 0 && ones < n ? Math.log(ones / (n - ones)) : ones ? 4 : -4;
  const trees: Node[] = [];
  if (n && ones > 0 && ones < n) {
    const F = new Array<number>(n).fill(prior), idx = train.map((_, i) => i);
    for (let r = 0; r < p.rounds; r++) {
      const g = F.map((f, i) => sigmoid(f) - train[i].c), h = F.map(f => Math.max(sigmoid(f) * (1 - sigmoid(f)), 1e-6));
      const t = grow(idx, train, g, h, 0, p.depth);
      trees.push(t);
      for (let i = 0; i < n; i++) F[i] += p.lr * leafOf(t, train[i].x, train[i].y);
    }
  }
  const score = (r: number, x: number, y: number) => {
    let z = prior;
    for (let i = 0; i < r; i++) z += p.lr * leafOf(trees[i], x, y);
    return z;
  };
  const clampR = (r: number) => Math.max(0, Math.min(trees.length, Math.round(r)));
  return {
    rounds: trees.length,
    at(r) { const k = clampR(r); return { predict: (x, y) => sigmoid(score(k, x, y)), constant: !trees.length }; },
    logLoss(r, pts) {
      if (!pts.length) return 0;
      const k = clampR(r);
      let s = 0;
      for (const q of pts) { const pr = Math.min(1 - 1e-9, Math.max(1e-9, sigmoid(score(k, q.x, q.y)))); s -= q.c ? Math.log(pr) : Math.log(1 - pr); }
      return s / pts.length;
    },
  };
}
