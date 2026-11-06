import type { Trainable } from '../types';
import { sigmoid } from './logistic';

interface ClassStats { prior: number; mx: number; my: number; vx: number; vy: number }

/** Gaussian Naive Bayes: one independent bell curve per feature per class. */
export function naiveBayes(): Trainable {
  let st: ClassStats[] = [];
  return {
    fit(t) {
      st = [0, 1].map(c => {
        const g = t.filter(q => q.c === c), n = g.length || 1;
        const mx = g.reduce((s, q) => s + q.x, 0) / n, my = g.reduce((s, q) => s + q.y, 0) / n;
        return {
          prior: n / t.length, mx, my,
          vx: g.reduce((s, q) => s + (q.x - mx) ** 2, 0) / n + 1e-3,
          vy: g.reduce((s, q) => s + (q.y - my) ** 2, 0) / n + 1e-3,
        };
      });
    },
    predict(x, y) {
      const ll = st.map(s => Math.log(s.prior) - 0.5 * (Math.log(s.vx) + Math.log(s.vy))
        - (x - s.mx) ** 2 / (2 * s.vx) - (y - s.my) ** 2 / (2 * s.vy));
      return sigmoid(ll[1] - ll[0]);
    },
  };
}
