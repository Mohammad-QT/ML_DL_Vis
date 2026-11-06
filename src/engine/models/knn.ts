import type { Sample, Trainable } from '../types';

/** K-Nearest Neighbors: keep every training point, vote among the K closest. */
export function knn(p: { k: number }): Trainable {
  let tr: Sample[] = [];
  let xs = new Float64Array(0), ys = new Float64Array(0);
  const k = Math.max(1, Math.floor(p.k));
  // reused buffers: the K best so far, nearest first (a board render calls this thousands of times)
  const bi = new Int32Array(k), bd = new Float64Array(k);
  /** Fills `bi` with the indices of the K closest points, nearest first; ties go to the earlier point. Returns how many it found. */
  const near = (x: number, y: number) => {
    let m = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - x, dy = ys[i] - y, d = dx * dx + dy * dy;
      if (m === k && d >= bd[k - 1]) continue;
      let pos = m < k ? m : k - 1;
      while (pos > 0 && bd[pos - 1] > d) { bd[pos] = bd[pos - 1]; bi[pos] = bi[pos - 1]; pos--; }
      bd[pos] = d; bi[pos] = i;
      if (m < k) m++;
    }
    return m;
  };
  return {
    fit(t) { tr = t; xs = Float64Array.from(t, q => q.x); ys = Float64Array.from(t, q => q.y); },
    predict(x, y) {
      const m = near(x, y);
      let s = 0;
      for (let i = 0; i < m; i++) s += tr[bi[i]].c;
      return s / Math.max(m, 1);
    },
    neighbours(x, y) { const m = near(x, y); return Array.from(bi.subarray(0, m), i => tr[i]); },
  };
}
