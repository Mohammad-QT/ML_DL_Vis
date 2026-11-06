import { describe, expect, it } from 'vitest';
import { BOOST_DEFAULTS, PRESETS, crossValidate, fitBoost, foldIds, gauss, jitter, randomSplitScores, rng, score, std, type Sample } from './index';

function separable(seed = 1): Sample[] {
  const r = rng(seed), pts: Sample[] = [];
  for (let i = 0; i < 40; i++) {
    pts.push({ x: 0.25 + gauss(r) * 0.06, y: 0.3 + gauss(r) * 0.06, c: 0 });
    pts.push({ x: 0.75 + gauss(r) * 0.06, y: 0.7 + gauss(r) * 0.06, c: 1 });
  }
  return pts;
}
const moons = () => jitter(PRESETS.moons(rng(4)), 0.07, 5);

describe('foldIds', () => {
  it('puts every point in exactly one fold and keeps sizes within 1', () => {
    const ids = foldIds(83, 5, 1), sizes = Array.from({ length: 5 }, (_, f) => ids.filter(i => i === f).length);
    expect(ids).toHaveLength(83);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(83);
  });
  it('is deterministic and changes with the seed', () => {
    expect(foldIds(50, 4, 9)).toEqual(foldIds(50, 4, 9));
    expect(foldIds(50, 4, 9)).not.toEqual(foldIds(50, 4, 10));
  });
});

describe('crossValidate', () => {
  it('returns k scores and a mean and std that match them', () => {
    const r = crossValidate('knn', { k: 5 }, separable(), 5, 1);
    expect(r.scores).toHaveLength(5);
    expect(r.mean).toBeCloseTo(r.scores.reduce((a, b) => a + b, 0) / 5);
    expect(r.std).toBeCloseTo(std(r.scores));
    expect(r.mean).toBeGreaterThan(0.95);
  });
  it('is deterministic', () => {
    const pts = moons();
    expect(crossValidate('tree', { depth: 4 }, pts, 5, 3)).toEqual(crossValidate('tree', { depth: 4 }, pts, 5, 3));
  });
  it('shows overfitting: a deep tree scores higher on train than in CV', () => {
    const r = crossValidate('tree', { depth: 12 }, moons(), 5, 3);
    expect(r.trainMean).toBeGreaterThan(r.mean);
  });
});

describe('randomSplitScores', () => {
  it('gives one score per split and varies between splits', () => {
    const s = randomSplitScores('knn', { k: 5 }, moons(), 5, 11);
    expect(s).toHaveLength(5);
    expect(new Set(s).size).toBeGreaterThan(1);
  });
});

describe('fitBoost', () => {
  it('fits a separable set to at least 95% train accuracy', () => {
    const train = separable();
    expect(score(fitBoost(train).at(BOOST_DEFAULTS.rounds), train)).toBeGreaterThanOrEqual(0.95);
  });
  it('handles single-class and empty data with a constant guess', () => {
    const one = separable().filter(p => p.c === 1);
    expect(fitBoost(one).at(10).constant).toBe(true);
    expect(fitBoost(one).at(10).predict(0.1, 0.1)).toBeGreaterThan(0.9);
    expect(fitBoost([]).at(3).predict(0.5, 0.5)).toBeLessThan(0.1);
  });
  it('round 0 predicts the base rate and later rounds lower the training loss', () => {
    const train = moons(), b = fitBoost(train, { rounds: 20, lr: 0.3, depth: 3 });
    const ones = train.filter(p => p.c).length / train.length;
    expect(b.at(0).predict(0.2, 0.2)).toBeCloseTo(ones, 5);
    expect(b.logLoss(5, train)).toBeLessThan(b.logLoss(0, train));
    expect(b.logLoss(20, train)).toBeLessThan(b.logLoss(5, train));
  });
  it('is deterministic and clamps the round number', () => {
    const train = moons();
    const a = fitBoost(train, { rounds: 8, lr: 0.3, depth: 2 }), b = fitBoost(train, { rounds: 8, lr: 0.3, depth: 2 });
    expect(a.at(8).predict(0.4, 0.5)).toBe(b.at(8).predict(0.4, 0.5));
    expect(a.at(99).predict(0.4, 0.5)).toBe(a.at(8).predict(0.4, 0.5));
    expect(a.rounds).toBe(8);
  });
  it('stumps (depth 1) can still learn an axis-aligned split', () => {
    const train = separable().map(p => ({ ...p, y: 0.5 })), m = fitBoost(train, { rounds: 10, lr: 0.5, depth: 1 }).at(10);
    expect(score(m, train)).toBeGreaterThanOrEqual(0.95);
  });
  it('outputs probabilities in [0, 1]', () => {
    const m = fitBoost(moons()).at(40);
    for (let i = 0; i <= 10; i++) { const p = m.predict(i / 10, (10 - i) / 10); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
  });
});
