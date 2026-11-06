import { rng, type Rng } from './random';
import type { Label, Sample } from './types';

/** A bad file. `code` picks the message; `params` fill its {placeholders}. */
export class CsvError extends Error {
  constructor(public code: string, public params: Record<string, string | number> = {}) { super(code); }
}

export interface Table { headers: string[]; rows: string[][]; /** Rows whose cell count did not match the header. */ ragged: number }

/** Split CSV text into rows of cells. Handles quotes, "" escapes, CRLF, a BOM and comma, semicolon or tab separators. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const first = text.slice(0, text.search(/\r|\n|$/));
  const sep = [',', ';', '\t'].map(s => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const out: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) out.push(row);
      row = [];
    } else cell += ch;
  }
  if (q) throw new CsvError('quote');
  row.push(cell);
  if (row.some(c => c.trim() !== '')) out.push(row);
  return out;
}

export function loadTable(text: string): Table {
  if (text.includes('\u0000')) throw new CsvError('binary');
  const all = parseCsv(text);
  if (!all.length) throw new CsvError('empty');
  const headers = all[0].map((h, i) => h.trim() || `column ${i + 1}`);
  if (headers.length < 2) throw new CsvError('one_column');
  if (all.length < 2) throw new CsvError('no_rows');
  const rows = all.slice(1).filter(r => r.length === headers.length);
  const ragged = all.length - 1 - rows.length;
  if (rows.length < 2) throw new CsvError('ragged', { n: all.length - 1 });
  return { headers, rows, ragged };
}

const MISSING = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', '?', '-', '--']);
export const isMissing = (s: string) => MISSING.has(s.trim().toLowerCase());
const num = (s: string) => (isMissing(s) || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s.trim()) ? NaN : Number(s));

export interface ColumnInfo { name: string; numeric: boolean; unique: number; missing: number }

/** For each column: numeric when almost all non-empty cells are numbers (so one stray word doesn't hide a column). */
export function describeColumns(t: Table): ColumnInfo[] {
  return t.headers.map((name, c) => {
    const vals = t.rows.map(r => r[c]).filter(v => !isMissing(v));
    const nums = vals.filter(v => !Number.isNaN(num(v)));
    return { name, numeric: vals.length > 0 && nums.length >= vals.length * 0.95, unique: new Set(vals.map(v => v.trim())).size, missing: t.rows.length - vals.length };
  });
}

export type Features = { cols: [number, number] } | 'pca';

export interface Dataset {
  task: 'cls' | 'reg';
  points: Sample[];
  /** Classification: the two class names, class 0 first (the most common one). */
  classes?: [string, string];
  /** What the board axes show. Regression uses only the first. */
  axes: string[];
  info: { read: number; used: number; droppedMissing: number; droppedRagged: number; droppedClasses: number; sampledFrom: number | null; pcaExplained?: number[]; pcaNote?: boolean };
}

export const MAX_ROWS = 1000;

/** Guess the task from the target column. */
export function detectTask(info: ColumnInfo): 'cls' | 'reg' {
  return info.numeric && info.unique > 10 ? 'reg' : 'cls';
}

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

/** Standardise columns, then top-k principal components by power iteration with deflation. Signs are fixed so results repeat. */
export function pca(rows: number[][], k = 2): { scores: number[][]; explained: number[] } {
  const n = rows.length, d = rows[0]?.length ?? 0;
  const mu = Array.from({ length: d }, (_, j) => mean(rows.map(r => r[j])));
  const sd = mu.map((m, j) => Math.sqrt(mean(rows.map(r => (r[j] - m) ** 2))) || 1);
  const Z = rows.map(r => r.map((v, j) => (v - mu[j]) / sd[j]));
  const C = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => Z.reduce((s, r) => s + r[a] * r[b], 0) / Math.max(1, n)));
  const total = C.reduce((s, r, i) => s + r[i], 0) || 1;
  const vecs: number[][] = [], vals: number[] = [];
  for (let c = 0; c < Math.min(k, d); c++) {
    let v = Array.from({ length: d }, (_, j) => 1 + ((j + c * 3) % 5) * 0.1);
    let lambda = 0;
    for (let it = 0; it < 200; it++) {
      const w = C.map(r => r.reduce((s, x, j) => s + x * v[j], 0));
      const norm = Math.hypot(...w);
      if (norm < 1e-12) { lambda = 0; break; }
      const nv = w.map(x => x / norm);
      const diff = Math.hypot(...nv.map((x, j) => x - v[j]));
      v = nv; lambda = norm;
      if (diff < 1e-10) break;
    }
    const big = v.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);
    if (big < 0) v = v.map(x => -x);
    vecs.push(v); vals.push(lambda);
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) C[a][b] -= lambda * v[a] * v[b];
  }
  return { scores: Z.map(r => vecs.map(v => r.reduce((s, x, j) => s + x * v[j], 0))), explained: vals.map(l => l / total) };
}

/** Rescale to [0.06, 0.94]. With 100+ values the 1st and 99th percentiles set the range, so one outlier doesn't squash the rest. */
export function toUnit(v: number[]): number[] {
  const s = [...v].sort((a, b) => a - b);
  const cut = s.length >= 100 ? Math.floor(s.length * 0.01) : 0;
  const lo = s[cut], hi = s[s.length - 1 - cut];
  const span = hi - lo || 1;
  return v.map(x => 0.06 + 0.88 * Math.min(1, Math.max(0, (x - lo) / span)));
}

/**
 * Turn a table into board points: drop rows with missing values, keep the two most common classes (classification),
 * sample down to `max` rows, scale to the board. Regression plots feature 1 (or PC1) against the target; the board's
 * y axis grows downwards, so higher targets are drawn higher.
 */
export function buildDataset(t: Table, target: number, features: Features, max = MAX_ROWS, seed = 7): Dataset {
  const cols = describeColumns(t);
  const tinfo = cols[target];
  const task = detectTask(tinfo);
  if (task === 'cls' && !tinfo.numeric && tinfo.unique > Math.max(10, t.rows.length / 3)) throw new CsvError('target_text', { col: tinfo.name, n: tinfo.unique });
  if (tinfo.unique < 2) throw new CsvError('target_one', { col: tinfo.name });
  let use: number[];
  if (features === 'pca') {
    use = cols.map((_, i) => i).filter(i => i !== target && cols[i].numeric);
    if (use.length < 2) throw new CsvError('pca_few', { n: use.length });
  } else {
    use = features.cols;
    if (use[0] === use[1] || use.includes(target)) throw new CsvError('same_col');
    for (const i of use) if (!cols[i].numeric) throw new CsvError('feature_text', { col: cols[i].name });
  }
  let droppedMissing = 0;
  const rows: { f: number[]; y: string }[] = [];
  for (const r of t.rows) {
    const f = use.map(i => num(r[i]));
    const ty = task === 'reg' ? num(r[target]) : isMissing(r[target]) ? NaN : r[target].trim();
    if (f.some(Number.isNaN) || (typeof ty === 'number' && Number.isNaN(ty))) droppedMissing++;
    else rows.push({ f, y: String(ty) });
  }
  let droppedClasses = 0, classes: [string, string] | undefined;
  let kept = rows;
  if (task === 'cls') {
    const count = new Map<string, number>();
    rows.forEach(r => count.set(r.y, (count.get(r.y) ?? 0) + 1));
    const top = [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 2).map(e => e[0]);
    if (top.length < 2) throw new CsvError('target_one', { col: tinfo.name });
    classes = [top[0], top[1]];
    kept = rows.filter(r => top.includes(r.y));
    droppedClasses = rows.length - kept.length;
  }
  if (kept.length < 6) throw new CsvError('few_rows', { n: kept.length });
  let sampledFrom: number | null = null;
  if (kept.length > max) {
    sampledFrom = kept.length;
    const r: Rng = rng(seed), idx = kept.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const pick = idx.slice(0, max).sort((a, b) => a - b);
    kept = pick.map(i => kept[i]);
  }
  let xy: number[][], explained: number[] | undefined;
  if (features === 'pca') { const p = pca(kept.map(r => r.f), 2); xy = p.scores; explained = p.explained; } else xy = kept.map(r => r.f);
  const X = toUnit(xy.map(r => r[0]));
  let points: Sample[];
  if (task === 'reg') {
    const Y = toUnit(kept.map(r => Number(r.y))).map(v => 1 - v);
    points = kept.map((_, i) => ({ x: X[i], y: Y[i], c: 0 as Label }));
  } else {
    const Y = toUnit(xy.map(r => r[1]));
    points = kept.map((r, i) => ({ x: X[i], y: 1 - Y[i], c: (r.y === classes![0] ? 0 : 1) as Label }));
  }
  const axes = features === 'pca' ? ['PC1', 'PC2'] : features.cols.map(i => cols[i].name);
  return {
    task, points, classes, axes,
    info: { read: t.rows.length + t.ragged, used: points.length, droppedMissing, droppedRagged: t.ragged, droppedClasses, sampledFrom, pcaExplained: explained, pcaNote: features !== 'pca' && task === 'reg' },
  };
}
