// Pure helpers behind the Part 1 interactives. No DOM here, so they are easy to test.
import { rng } from '../engine';

export type Cell = number | null;
export type ImputeMode = 'drop' | 'mean' | 'median';

const known = (xs: Cell[]) => xs.filter((x): x is number => x != null);

export function mean(xs: Cell[]): number | null {
  const k = known(xs);
  return k.length ? k.reduce((a, b) => a + b, 0) / k.length : null;
}

export function median(xs: Cell[]): number | null {
  const k = known(xs).sort((a, b) => a - b);
  if (!k.length) return null;
  const m = k.length >> 1;
  return k.length % 2 ? k[m] : (k[m - 1] + k[m]) / 2;
}

/**
 * Treat missing numbers in a table (rows of columns). `drop` removes every row that has a blank.
 * `mean` / `median` fill each blank with that column's value, computed from the known numbers.
 * Returns the table with the same shape, a keep flag per row, and which cells were filled.
 */
export function impute(table: Cell[][], mode: ImputeMode) {
  const cols = table[0]?.length ?? 0;
  const fill = Array.from({ length: cols }, (_, j) => (mode === 'median' ? median : mean)(table.map(r => r[j])));
  const filled = table.map(r => r.map(v => v == null && mode !== 'drop'));
  const out = table.map(r => r.map((v, j) => (v == null && mode !== 'drop' ? fill[j] : v)));
  const keep = table.map(r => mode !== 'drop' || r.every(v => v != null));
  return { table: out, keep, filled };
}

/** Mean of one column over the kept rows. */
export function columnMean(table: Cell[][], keep: boolean[], j: number): number | null {
  return mean(table.filter((_, i) => keep[i]).map(r => r[j]));
}

/** Label encoding as scikit-learn's LabelEncoder does it: classes sorted A-Z, numbered from 0. */
export function labelEncode(values: string[]) {
  const classes = [...new Set(values)].sort();
  return { classes, codes: values.map(v => classes.indexOf(v)) };
}

/** One-hot encoding: one 0/1 column per category, columns sorted A-Z. */
export function oneHot(values: string[]) {
  const classes = [...new Set(values)].sort();
  return { classes, rows: values.map((v): number[] => classes.map(c => (c === v ? 1 : 0))) };
}

/** Seeded shuffle split. The test set gets ceil(n * testFrac) items, like train_test_split. */
export function shuffleSplit(n: number, testFrac: number, seed: number) {
  const r = rng(seed), idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const nTest = Math.min(n, Math.max(0, Math.ceil(n * testFrac)));
  return { test: idx.slice(0, nTest), train: idx.slice(nTest) };
}

/** Standardise a column: subtract the mean, divide by the (population) standard deviation, as StandardScaler does. */
export function standardize(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1;
  return { mean: m, sd, values: xs.map(x => (x - m) / sd) };
}

/** Index of the point closest to point `i` (Euclidean distance), or -1 with fewer than two points. */
export function nearest(points: number[][], i: number): number {
  let best = -1, bd = Infinity;
  points.forEach((p, j) => {
    if (j === i) return;
    const d = Math.hypot(...p.map((v, k) => v - points[i][k]));
    if (d < bd) { bd = d; best = j; }
  });
  return best;
}
