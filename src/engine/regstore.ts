import { gauss, randomSeed, rng, type Rng } from './random';
import type { Label, Point, Sample } from './types';

type Generator = (r: Rng) => Sample[];
const N = 44;
/** x in [0.05, 0.95]; y is a board coordinate, so a larger y is lower on screen. `c` is unused. */
const at = (r: Rng, f: (x: number) => number, noise: number): Sample[] =>
  Array.from({ length: N }, () => { const x = 0.05 + 0.9 * r(); return { x, y: f(x) + gauss(r) * noise, c: 0 as Label }; });

export const REG_PRESETS = {
  line: r => at(r, x => 0.82 - 0.62 * x, 0.05),
  curve: r => at(r, x => 0.28 + 2.2 * (x - 0.48) ** 2, 0.04),
  steps: r => at(r, x => (x < 0.25 ? 0.75 : x < 0.5 ? 0.5 : x < 0.75 ? 0.62 : 0.25), 0.035),
  sine: r => at(r, x => 0.5 - 0.3 * Math.sin(2 * Math.PI * x), 0.06),
  outliers: r => [...at(r, x => 0.8 - 0.55 * x, 0.04).slice(0, N - 5), ...[[0.12, 0.1], [0.3, 0.06], [0.82, 0.92], [0.9, 0.95], [0.55, 0.05]].map(([x, y]) => ({ x, y, c: 0 as Label }))],
} satisfies Record<string, Generator>;

export type RegPresetName = keyof typeof REG_PRESETS;
export const isRegPreset = (name: string): name is RegPresetName => name in REG_PRESETS;

const clamp01 = (v: number) => Math.min(0.985, Math.max(0.015, v));

/** Same shape as `Store`, for 1-D regression: points plus a train/test split. */
export class RegStore {
  points: Point[] = [];
  testFrac: number;
  presetName: RegPresetName | null = null;
  private subs: Array<(s: RegStore) => void> = [];

  constructor(opts: { testFrac?: number } = {}) { this.testFrac = opts.testFrac ?? 0.25; }

  subscribe(fn: (s: RegStore) => void): void { this.subs.push(fn); }
  emit(): void { this.subs.forEach(f => f(this)); }

  preset(name: RegPresetName, seed: number = randomSeed()): void {
    const r = rng(seed);
    this.presetName = name;
    this.points = REG_PRESETS[name](r).map(p => ({ x: clamp01(p.x), y: clamp01(p.y), c: 0 as Label, test: false }));
    this.split(r);
    this.emit();
  }

  split(r: Rng = rng(randomSeed())): void { this.points.forEach(p => (p.test = r() < this.testFrac)); }
  resplit(): void { this.split(); this.emit(); }
  /** Add a training point; returns it so Undo can take it back. */
  add(x: number, y: number): Point { const p: Point = { x, y, c: 0, test: false }; this.points.push(p); this.emit(); return p; }
  /** Take one point out (by identity). Returns false when it was not in the data. */
  remove(p: Point): boolean { const i = this.points.indexOf(p); if (i < 0) return false; this.points.splice(i, 1); this.emit(); return true; }
  /** Replace the data with uploaded points (already scaled to [0, 1]) and make a fresh split. */
  load(points: Sample[], seed: number = randomSeed()): void {
    this.presetName = null;
    this.points = points.map(p => ({ x: p.x, y: p.y, c: p.c, test: false }));
    this.split(rng(seed));
    this.emit();
  }
  clear(): void { this.points = []; this.presetName = null; this.emit(); }
  train(): Point[] { return this.points.filter(p => !p.test); }
  test(): Point[] { return this.points.filter(p => p.test); }
}
