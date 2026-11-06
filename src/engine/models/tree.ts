import { rng } from '../random';
import type { Sample, Trainable } from '../types';

type Feature = 'x' | 'y';
type Node = { p: number } | { f: Feature; t: number; l: Node; r: Node };

/** Greedy CART with Gini impurity. `pickFeat` limits each split to one random feature (forest). */
export function buildTree(pts: Sample[], depth: number, maxDepth: number, pickFeat?: () => Feature): Node {
  const n = pts.length, ones = pts.reduce((s, q) => s + q.c, 0);
  if (depth >= maxDepth || ones === 0 || ones === n || n < 2) return { p: ones / n };
  let best: { g: number; f: Feature; t: number } | null = null;
  for (const f of pickFeat ? [pickFeat()] : (['x', 'y'] as const)) {
    const s = pts.slice().sort((a, b) => a[f] - b[f]);
    let lo = 0;
    for (let i = 1; i < n; i++) {
      lo += s[i - 1].c;
      if (s[i - 1][f] === s[i][f]) continue;
      const ro = ones - lo, nl = i, nr = n - i;
      const g = nl * (1 - (lo / nl) ** 2 - (1 - lo / nl) ** 2) + nr * (1 - (ro / nr) ** 2 - (1 - ro / nr) ** 2);
      if (!best || g < best.g) best = { g, f, t: (s[i - 1][f] + s[i][f]) / 2 };
    }
  }
  if (!best) return { p: ones / n };
  const { f, t } = best;
  return {
    f, t,
    l: buildTree(pts.filter(q => q[f] <= t), depth + 1, maxDepth, pickFeat),
    r: buildTree(pts.filter(q => q[f] > t), depth + 1, maxDepth, pickFeat),
  };
}

export function walk(nd: Node, x: number, y: number): number {
  while ('f' in nd) nd = (nd.f === 'x' ? x : y) <= nd.t ? nd.l : nd.r;
  return nd.p;
}

export function tree(p: { depth: number }): Trainable {
  let root: Node = { p: 0.5 };
  return {
    fit(t) { root = buildTree(t, 0, p.depth); },
    predict(x, y) { return walk(root, x, y); },
  };
}

/** Random forest: bootstrap samples, random feature per split, averaged votes. Fixed seed. */
export function forest(p: { trees: number }): Trainable {
  let trees: Node[] = [];
  return {
    fit(t) {
      const r = rng(42);
      trees = [];
      for (let k = 0; k < p.trees; k++) {
        const boot = t.map(() => t[Math.floor(r() * t.length)]);
        trees.push(buildTree(boot, 0, 8, () => (r() < 0.5 ? 'x' : 'y')));
      }
    },
    predict(x, y) { return trees.reduce((s, nd) => s + walk(nd, x, y), 0) / trees.length; },
  };
}
