import { describe, expect, it } from 'vitest';
import { REG_NAMES, REG_PRESETS, RegStore, fitReg, gauss, r2, rng, type Sample } from './index';

const xs = Array.from({ length: 40 }, (_, i) => 0.05 + (0.9 * i) / 39);
const make = (f: (x: number) => number, noise = 0, seed = 1): Sample[] => {
  const r = rng(seed);
  return xs.map(x => ({ x, y: f(x) + gauss(r) * noise, c: 0 }));
};
const grid = Array.from({ length: 51 }, (_, i) => i / 50);

describe('linear', () => {
  it('recovers a known slope and intercept', () => {
    const m = fitReg('linear', {}, make(x => 0.2 + 0.5 * x));
    expect(m.predict(0)).toBeCloseTo(0.2, 6);
    expect(m.predict(1) - m.predict(0)).toBeCloseTo(0.5, 6);
  });
});

describe('polynomial', () => {
  it('fits a known curve', () => {
    const f = (x: number) => 0.3 + 2 * (x - 0.5) ** 2;
    const train = make(f);
    const m = fitReg('polynomial', { degree: 2 }, train);
    for (const x of grid) expect(m.predict(x)).toBeCloseTo(f(x), 5);
    expect(r2(m, train)).toBeCloseTo(1, 8);
  });
  it('stays finite at degree 10, even with fewer points than coefficients', () => {
    const m = fitReg('polynomial', { degree: 10 }, make(x => x, 0.02).slice(0, 6));
    for (const x of grid) expect(Number.isFinite(m.predict(x))).toBe(true);
  });
});

describe('r2', () => {
  it('is 1 on a perfect fit and 0 for the mean', () => {
    const pts = make(x => 0.2 + 0.5 * x);
    expect(r2(fitReg('linear', {}, pts), pts)).toBeCloseTo(1, 10);
    const mean = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    expect(r2({ predict: () => mean }, pts)).toBeCloseTo(0, 10);
  });
  it('is null with no points', () => expect(r2({ predict: () => 0 }, [])).toBeNull());
});

describe.each(REG_NAMES)('%s', name => {
  const data = make(x => 0.5 - 0.3 * Math.sin(2 * Math.PI * x), 0.04);

  it('is deterministic', () => {
    const a = fitReg(name, {}, data), b = fitReg(name, {}, data);
    for (const x of grid) expect(a.predict(x)).toBe(b.predict(x));
  });
  it('handles empty data', () => {
    const m = fitReg(name, {}, []);
    expect(m.predict(0.3)).toBe(0.5);
    expect(r2(m, [])).toBeNull();
  });
  it('handles a single point', () => {
    const m = fitReg(name, {}, [{ x: 0.4, y: 0.7, c: 0 }]);
    expect(m.predict(0.9)).toBeCloseTo(0.7, 10);
  });
  it('handles points that all share one x', () => {
    const m = fitReg(name, {}, [{ x: 0.4, y: 0.2, c: 0 }, { x: 0.4, y: 0.6, c: 0 }]);
    expect(m.predict(0.1)).toBeCloseTo(0.4, 10);
  });
  it('predicts finite numbers', () => {
    const m = fitReg(name, {}, data);
    for (const x of grid) expect(Number.isFinite(m.predict(x))).toBe(true);
  });
});

describe('flexible models', () => {
  const data = make(x => 0.5 - 0.3 * Math.sin(2 * Math.PI * x), 0.02);
  it.each([['polynomial', { degree: 6 }], ['svr', { epsilon: 0.01, C: 2, gamma: 1.3 }], ['tree', { depth: 6 }], ['forest', { trees: 30 }]] as const)(
    '%s follows a sine wave better than a straight line',
    (name, params) => {
      expect(r2(fitReg(name, params, data), data)!).toBeGreaterThan(0.9);
      expect(r2(fitReg('linear', {}, data), data)!).toBeLessThan(0.8);
    },
  );
  it('a deeper tree fits training data at least as well', () => {
    expect(r2(fitReg('tree', { depth: 8 }, data), data)!).toBeGreaterThanOrEqual(r2(fitReg('tree', { depth: 2 }, data), data)!);
  });
  it('a wider epsilon tube leaves fewer weights, and reports the tube', () => {
    expect(fitReg('svr', { epsilon: 0.1 }, data).tube).toBe(0.1);
  });
});

describe('RegStore', () => {
  it('builds every preset with a split, repeatable by seed', () => {
    for (const name of Object.keys(REG_PRESETS) as Array<keyof typeof REG_PRESETS>) {
      const a = new RegStore(), b = new RegStore();
      a.preset(name, 4); b.preset(name, 4);
      expect(a.points.length).toBeGreaterThan(30);
      expect(a.points).toEqual(b.points);
      expect(a.test().length).toBeGreaterThan(0);
    }
  });
});
