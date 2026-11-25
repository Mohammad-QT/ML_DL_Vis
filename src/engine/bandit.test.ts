import { describe, expect, it } from 'vitest';
import { createBandit, hiddenRates, sampleBeta } from './bandit';
import { rng } from './random';

const rates = [0.12, 0.31, 0.75, 0.47, 0.24];
const seed = 2026;

describe('bandit policies', () => {
  it('plays each UCB arm once before comparing confidence scores', () => {
    const lab = createBandit(rates, seed, 'ucb');
    expect(rates.map(() => lab.step().chosen)).toEqual([0, 1, 2, 3, 4]);
    const { before, scores, chosen } = lab.step();
    expect(scores).toEqual(before.map(arm => arm.wins + Math.sqrt(2 * Math.log(5))));
    expect(scores[chosen]).toBe(Math.max(...scores));
  });

  it('learns the best arm and adds regret more slowly than random', () => {
    const ucb = createBandit(rates, seed, 'ucb');
    const random = createBandit(rates, seed, 'random');
    ucb.run(5000);
    random.run(5000);
    expect(ucb.arms[2].plays).toBeGreaterThan(4000);
    expect(ucb.regret[5000] - ucb.regret[2500]).toBeLessThan(random.regret[5000] - random.regret[2500]);
    expect(ucb.rewards[5000]).toBeGreaterThan(random.rewards[5000]);
  });

  it('draws from a Beta posterior with the expected mean', () => {
    const draw = rng(seed);
    for (const [alpha, beta] of [[1, 1], [2, 7], [40, 10]]) {
      const samples = Array.from({ length: 10000 }, () => sampleBeta(alpha, beta, draw));
      expect(samples.every(value => value > 0 && value < 1)).toBe(true);
      expect(samples.reduce((sum, value) => sum + value, 0) / samples.length).toBeCloseTo(alpha / (alpha + beta), 2);
    }
  });

  it('Thompson finds the best arm and beats UCB on the same seeded outcomes', () => {
    const thompson = createBandit(rates, seed, 'thompson');
    const ucb = createBandit(rates, seed, 'ucb');
    thompson.run(5000);
    ucb.run(5000);
    expect(thompson.arms[2].plays).toBeGreaterThan(4500);
    expect(thompson.rewards[5000]).toBeGreaterThan(ucb.rewards[5000]);
    expect(thompson.last!.scores[thompson.last!.chosen]).toBe(Math.max(...thompson.last!.scores));
  });

  it.each(['ucb', 'thompson', 'random', 'oracle'] as const)('%s is deterministic and supports one arm and zero rounds', policy => {
    const first = createBandit(hiddenRates(seed), seed, policy);
    const second = createBandit(hiddenRates(seed), seed, policy);
    const single = createBandit([1], seed, policy);
    single.run(0);
    expect(single.last).toBeUndefined();
    expect(single.rewards).toEqual([0]);
    first.run(100);
    for (let index = 0; index < 100; index++) second.step();
    expect(first.rewards).toEqual(second.rewards);
    expect(first.regret).toEqual(second.regret);
    expect(first.last).toEqual(second.last);
    expect(single.step().reward).toBe(1);
    expect(single.regret).toEqual([0, 0]);
  });

  it('uses the same outcomes across policies and charges zero oracle regret', () => {
    const oracle = createBandit(rates, seed, 'oracle');
    const human = createBandit(rates, seed, 'human');
    for (let round = 0; round < 30; round++) {
      expect(human.step(2).reward).toBe(oracle.step().reward);
    }
    expect(oracle.regret.every(value => value === 0)).toBe(true);
  });
});
