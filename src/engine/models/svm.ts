import { rng } from '../random';
import type { Trainable } from '../types';
import { sigmoid } from './logistic';

type Vec = [number, number];

/**
 * Support vector machine trained with simplified SMO (Platt). Fine for a few hundred points.
 * Board coordinates are mapped to [-1, 1]. `C` and `gamma` are log10 values, as the sliders show them.
 */
export function svm(kernel: 'linear' | 'rbf', p: { C?: number; gamma?: number }): Trainable {
  const C = kernel === 'linear' ? Math.pow(10, p.C ?? 1) : 10;
  const gamma = Math.pow(10, p.gamma ?? 1);
  const K = kernel === 'linear'
    ? (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1]
    : (a: Vec, b: Vec) => Math.exp(-gamma * ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2));
  const map = (x: number, y: number): Vec => [x * 2 - 1, y * 2 - 1];
  let sv: Array<{ x: Vec; w: number }> = [], b = 0;
  return {
    fit(t) {
      const X = t.map(q => map(q.x, q.y)), Y = t.map(q => (q.c ? 1 : -1)), n = X.length, r = rng(7);
      const Kc = new Float64Array(n * n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Kc[i * n + j] = K(X[i], X[j]);
      const a = new Float64Array(n);
      b = 0;
      let passes = 0, iter = 0;
      const f = (i: number) => { let s = b; for (let j = 0; j < n; j++) if (a[j]) s += a[j] * Y[j] * Kc[j * n + i]; return s; };
      while (passes < 8 && iter++ < 150) {
        let changed = 0;
        for (let i = 0; i < n; i++) {
          const Ei = f(i) - Y[i];
          if (!((Y[i] * Ei < -1e-3 && a[i] < C) || (Y[i] * Ei > 1e-3 && a[i] > 0))) continue;
          let j = Math.floor(r() * (n - 1));
          if (j >= i) j++;
          const Ej = f(j) - Y[j], ai = a[i], aj = a[j];
          const L = Y[i] !== Y[j] ? Math.max(0, aj - ai) : Math.max(0, ai + aj - C);
          const H = Y[i] !== Y[j] ? Math.min(C, C + aj - ai) : Math.min(C, ai + aj);
          if (L === H) continue;
          const eta = 2 * Kc[i * n + j] - Kc[i * n + i] - Kc[j * n + j];
          if (eta >= 0) continue;
          const nj = Math.min(H, Math.max(L, aj - (Y[j] * (Ei - Ej)) / eta));
          if (Math.abs(nj - aj) < 1e-5) continue;
          const ni = ai + Y[i] * Y[j] * (aj - nj);
          const b1 = b - Ei - Y[i] * (ni - ai) * Kc[i * n + i] - Y[j] * (nj - aj) * Kc[i * n + j];
          const b2 = b - Ej - Y[i] * (ni - ai) * Kc[i * n + j] - Y[j] * (nj - aj) * Kc[j * n + j];
          a[i] = ni; a[j] = nj;
          b = ni > 0 && ni < C ? b1 : nj > 0 && nj < C ? b2 : (b1 + b2) / 2;
          changed++;
        }
        passes = changed ? 0 : passes + 1;
      }
      sv = [];
      for (let i = 0; i < n; i++) if (a[i] > 1e-6) sv.push({ x: X[i], w: a[i] * Y[i] });
    },
    predict(x, y) {
      const q = map(x, y);
      let s = b;
      for (const v of sv) s += v.w * K(v.x, q);
      return sigmoid(2.5 * s);
    },
  };
}
