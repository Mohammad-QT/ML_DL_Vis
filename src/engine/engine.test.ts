import { describe, expect, it } from 'vitest';
import { MODEL_NAMES, fitModel, score, Store, rng, gauss, type Sample } from './index';

// Two well separated groups: any reasonable classifier should get (almost) all of them.
function separable(seed = 1): Sample[] {
  const r = rng(seed), pts: Sample[] = [];
  for (let i = 0; i < 40; i++) {
    pts.push({ x: 0.25 + gauss(r) * 0.06, y: 0.3 + gauss(r) * 0.06, c: 0 });
    pts.push({ x: 0.75 + gauss(r) * 0.06, y: 0.7 + gauss(r) * 0.06, c: 1 });
  }
  return pts;
}

const grid = Array.from({ length: 121 }, (_, i) => [(i % 11) / 10, Math.floor(i / 11) / 10] as const);

describe.each(MODEL_NAMES)('%s', name => {
  it('fits a separable set to at least 95% train accuracy', () => {
    const train = separable();
    expect(score(fitModel(name, {}, train), train)).toBeGreaterThanOrEqual(0.95);
  });

  it('handles single-class data with a constant guess', () => {
    const train = separable().filter(p => p.c === 1);
    const m = fitModel(name, {}, train);
    expect(m.constant).toBe(true);
    expect(m.predict(0.1, 0.1)).toBe(1);
    expect(score(m, train)).toBe(1);
  });

  it('handles an empty training set', () => {
    const m = fitModel(name, {}, []);
    expect(m.predict(0.5, 0.5)).toBe(0.5);
  });

  it('is deterministic', () => {
    const a = fitModel(name, {}, separable(5)), b = fitModel(name, {}, separable(5));
    for (const [x, y] of grid) expect(a.predict(x, y)).toBe(b.predict(x, y));
  });

  it('returns probabilities in [0, 1]', () => {
    const m = fitModel(name, {}, separable(9));
    for (const [x, y] of grid) {
      const p = m.predict(x, y);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('knn', () => {
  it('K = 1 memorises the training set', () => {
    const s = new Store();
    s.preset('xor', 3);
    expect(score(fitModel('knn', { k: 1 }, s.train()), s.train())).toBe(1);
  });

  it('reports K neighbours', () => {
    const m = fitModel('knn', { k: 7 }, separable());
    expect(m.neighbours?.(0.5, 0.5)).toHaveLength(7);
  });
});

describe('Store', () => {
  it('same preset and seed give the same points and split', () => {
    const a = new Store(), b = new Store();
    a.preset('moons', 11); b.preset('moons', 11);
    expect(a.points).toEqual(b.points);
    expect(a.test().length).toBeGreaterThan(0);
    expect(a.train().length + a.test().length).toBe(a.points.length);
  });

  it('keeps points inside the board and notifies subscribers', () => {
    const s = new Store();
    let calls = 0;
    s.subscribe(() => calls++);
    s.preset('circles', 2);
    s.add(0.5, 0.5, 1);
    s.clear();
    expect(calls).toBe(3);
    expect(s.points).toEqual([]);
  });

  it.each(['blobs', 'moons', 'circles', 'xor'] as const)('%s points stay in [0, 1]', name => {
    const s = new Store();
    s.preset(name, 4);
    for (const p of s.points) {
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(1);
    }
  });
});

describe('score', () => {
  it('is null for no points', () => {
    expect(score({ predict: () => 1 }, [])).toBeNull();
  });
});
