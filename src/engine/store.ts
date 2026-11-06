import { gauss, randomSeed, rng, type Rng } from './random';
import type { Label, Point, Sample } from './types';

type Generator = (r: Rng) => Sample[];

export const PRESETS = {
  blobs(r) {
    const p: Sample[] = [];
    for (let i = 0; i < 40; i++) {
      p.push({ x: 0.3 + gauss(r) * 0.11, y: 0.36 + gauss(r) * 0.11, c: 0 });
      p.push({ x: 0.68 + gauss(r) * 0.11, y: 0.64 + gauss(r) * 0.11, c: 1 });
    }
    return p;
  },
  moons(r) {
    const p: Sample[] = [];
    for (let i = 0; i < 45; i++) {
      const t = Math.PI * r(), u = Math.PI * r();
      p.push({ x: 0.36 + 0.25 * Math.cos(t) + gauss(r) * 0.035, y: 0.56 - 0.3 * Math.sin(t) + gauss(r) * 0.035, c: 0 });
      p.push({ x: 0.62 - 0.25 * Math.cos(u) + gauss(r) * 0.035, y: 0.42 + 0.3 * Math.sin(u) + gauss(r) * 0.035, c: 1 });
    }
    return p;
  },
  circles(r) {
    const p: Sample[] = [];
    for (let i = 0; i < 90; i++) {
      const t = 2 * Math.PI * r(), inner = i % 2 === 0, rad = (inner ? 0.13 : 0.34) + gauss(r) * 0.035;
      p.push({ x: 0.5 + rad * Math.cos(t), y: 0.5 + rad * Math.sin(t) * 1.15, c: inner ? 1 : 0 });
    }
    return p;
  },
  xor(r) {
    const p: Sample[] = [];
    for (let i = 0; i < 90; i++) {
      const x = 0.07 + r() * 0.86, y = 0.07 + r() * 0.86;
      p.push({ x, y, c: (x > 0.5) !== (y > 0.5) ? 1 : 0 });
    }
    return p;
  },
} satisfies Record<string, Generator>;

export type PresetName = keyof typeof PRESETS;
export const isPreset = (name: string): name is PresetName => name in PRESETS;

const clamp01 = (v: number) => Math.min(0.985, Math.max(0.015, v));

/** Shared dataset: points plus a train/test split. Boards and scores subscribe to it. */
export class Store {
  points: Point[] = [];
  testFrac: number;
  presetName: PresetName | null = null;
  private subs: Array<(s: Store) => void> = [];

  constructor(opts: { testFrac?: number } = {}) {
    this.testFrac = opts.testFrac ?? 0.25;
  }

  subscribe(fn: (s: Store) => void): void { this.subs.push(fn); }
  emit(): void { this.subs.forEach(f => f(this)); }

  /** Load a preset shape. Pass a seed for a repeatable dataset and split. */
  preset(name: PresetName, seed: number = randomSeed()): void {
    const r = rng(seed);
    this.presetName = name;
    this.points = PRESETS[name](r).map(p => ({ x: clamp01(p.x), y: clamp01(p.y), c: p.c, test: false }));
    this.split(r);
    this.emit();
  }

  split(r: Rng = rng(randomSeed())): void {
    this.points.forEach(p => (p.test = r() < this.testFrac));
  }

  resplit(): void { this.split(); this.emit(); }
  add(x: number, y: number, c: Label): void { this.points.push({ x, y, c, test: false }); this.emit(); }
  clear(): void { this.points = []; this.presetName = null; this.emit(); }
  train(): Point[] { return this.points.filter(p => !p.test); }
  test(): Point[] { return this.points.filter(p => p.test); }
}
