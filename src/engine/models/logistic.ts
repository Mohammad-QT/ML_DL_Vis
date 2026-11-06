import type { Trainable } from '../types';

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Logistic regression: gradient descent on standardised features, light L2. */
export function logistic(): Trainable {
  let w = [0, 0], b = 0;
  const m = [0, 0], sd = [1, 1];
  return {
    fit(t) {
      const n = t.length;
      (['x', 'y'] as const).forEach((f, j) => {
        m[j] = t.reduce((s, q) => s + q[f], 0) / n;
        sd[j] = Math.sqrt(t.reduce((s, q) => s + (q[f] - m[j]) ** 2, 0) / n) || 1;
      });
      const X = t.map(q => [(q.x - m[0]) / sd[0], (q.y - m[1]) / sd[1]]);
      w = [0, 0]; b = 0;
      for (let it = 0; it < 400; it++) {
        let g0 = 0, g1 = 0, gb = 0;
        X.forEach((x, i) => {
          const e = sigmoid(w[0] * x[0] + w[1] * x[1] + b) - t[i].c;
          g0 += e * x[0]; g1 += e * x[1]; gb += e;
        });
        w[0] -= g0 / n + 0.01 * w[0];
        w[1] -= g1 / n + 0.01 * w[1];
        b -= gb / n;
      }
    },
    predict(x, y) { return sigmoid(w[0] * (x - m[0]) / sd[0] + w[1] * (y - m[1]) / sd[1] + b); },
  };
}
