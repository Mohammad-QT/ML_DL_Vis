import { fitModel, type ModelName } from './models';
import { gauss, rng } from './random';
import { score } from './score';
import type { Params, Sample } from './types';

/** Fold number (0..k-1) for each of n points: a seeded shuffle dealt out like cards, so fold sizes differ by at most 1. */
export function foldIds(n: number, k: number, seed: number): number[] {
  const r = rng(seed), order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const ids = new Array<number>(n);
  order.forEach((idx, pos) => (ids[idx] = pos % k));
  return ids;
}

export const mean = (v: number[]) => (v.length ? v.reduce((s, a) => s + a, 0) / v.length : 0);
/** Population standard deviation, the way NumPy's `.std()` does it. */
export const std = (v: number[]) => { const m = mean(v); return Math.sqrt(mean(v.map(a => (a - m) ** 2))); };

export interface CvResult {
  /** Test accuracy of each fold (held-out part). */
  scores: number[];
  /** Training accuracy of each fold. */
  trainScores: number[];
  mean: number;
  std: number;
  trainMean: number;
}

/** k-fold cross-validation: every point is held out exactly once. `pts` are all the points, split or not. */
export function crossValidate(name: ModelName, params: Params, pts: Sample[], k: number, seed: number): CvResult {
  const ids = foldIds(pts.length, k, seed), scores: number[] = [], trainScores: number[] = [];
  for (let f = 0; f < k; f++) {
    const train = pts.filter((_, i) => ids[i] !== f), test = pts.filter((_, i) => ids[i] === f);
    const m = fitModel(name, params, train);
    scores.push(score(m, test) ?? 0);
    trainScores.push(score(m, train) ?? 0);
  }
  return { scores, trainScores, mean: mean(scores), std: std(scores), trainMean: mean(trainScores) };
}

/** Test accuracy on `count` different random train/test splits (each `testFrac` held out). */
export function randomSplitScores(name: ModelName, params: Params, pts: Sample[], count: number, seed: number, testFrac = 0.25): number[] {
  const out: number[] = [];
  for (let s = 0; s < count; s++) {
    const r = rng(seed + s * 7919);
    const test = pts.filter(() => r() < testFrac), train = pts.filter(p => !test.includes(p));
    out.push(score(fitModel(name, params, train), test) ?? 0);
  }
  return out;
}

/** Make a clean preset messier: shift every point by Gaussian noise of spread `amount`, kept inside the board. */
export function jitter<T extends Sample>(pts: T[], amount: number, seed: number): T[] {
  const r = rng(seed), c = (v: number) => Math.min(0.985, Math.max(0.015, v));
  return pts.map(p => ({ ...p, x: c(p.x + gauss(r) * amount), y: c(p.y + gauss(r) * amount) }));
}
