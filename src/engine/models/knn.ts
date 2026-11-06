import type { Sample, Trainable } from '../types';

/** K-Nearest Neighbors: keep every training point, vote among the K closest. */
export function knn(p: { k: number }): Trainable {
  let tr: Sample[] = [];
  const near = (x: number, y: number) =>
    tr
      .map((q, i) => ({ i, d: (q.x - x) ** 2 + (q.y - y) ** 2 }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, p.k);
  return {
    fit(t) { tr = t; },
    predict(x, y) {
      const nb = near(x, y);
      return nb.reduce((s, n) => s + tr[n.i].c, 0) / Math.max(nb.length, 1);
    },
    neighbours(x, y) { return near(x, y).map(n => tr[n.i]); },
  };
}
