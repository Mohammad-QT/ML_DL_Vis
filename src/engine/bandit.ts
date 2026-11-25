import { gauss, rng, type Rng } from './random';

export type Policy = 'ucb' | 'thompson' | 'random' | 'oracle' | 'human';
export interface Arm { plays: number; wins: number }

const best = (values: readonly number[]) => values.reduce((index, value, current) =>
  value > values[index] ? current : index, 0);

export function hiddenRates(seed: number): number[] {
  const draw = rng(seed);
  const rates = [0.1, 0.25, 0.4, 0.55, 0.7].map(rate => rate + (draw() - 0.5) * 0.1);
  for (let index = rates.length - 1; index > 0; index--) {
    const swap = Math.floor(draw() * (index + 1));
    [rates[index], rates[swap]] = [rates[swap], rates[index]];
  }
  return rates;
}

function gamma(shape: number, draw: Rng): number {
  const scale = shape - 1 / 3;
  const factor = 1 / Math.sqrt(9 * scale);
  while (true) {
    const normal = gauss(draw);
    const root = 1 + factor * normal;
    if (root <= 0) continue;
    const volume = root ** 3;
    if (Math.log(draw()) < normal ** 2 / 2 + scale * (1 - volume + Math.log(volume))) {
      return scale * volume;
    }
  }
}

/** Beta via two unit-scale Gamma draws (Marsaglia–Tsang); posterior shapes are at least 1. */
export function sampleBeta(alpha: number, beta: number, draw: Rng): number {
  if (!Number.isFinite(alpha) || !Number.isFinite(beta) || alpha < 1 || beta < 1) {
    throw new RangeError('Beta shapes must be finite and at least 1');
  }
  const wins = gamma(alpha, draw);
  const losses = gamma(beta, draw);
  return 1 / (1 + losses / wins);
}

export function createBandit(rates: readonly number[], seed: number, policy: Policy) {
  if (!rates.length || rates.some(rate => !(rate >= 0 && rate <= 1))) {
    throw new RangeError('Expected at least one rate, between 0 and 1');
  }
  const probabilities = [...rates];
  const outcomes = rng(seed);
  const choices = rng(seed + 100003);
  const bestArm = best(probabilities);
  const arms: Arm[] = rates.map(() => ({ plays: 0, wins: 0 }));
  const rewards = [0];
  const regret = [0];
  let last: { chosen: number; reward: 0 | 1; scores: number[]; before: Arm[] } | undefined;

  function step(humanChoice?: number) {
    const rounds = rewards.length - 1;
    const before = arms.map(arm => ({ ...arm }));
    let scores: number[] = [];
    let chosen: number;
    if (policy === 'ucb') {
      scores = before.map(({ plays, wins }) => plays ? wins / plays + Math.sqrt(2 * Math.log(rounds) / plays) : Infinity);
      chosen = best(scores);
    } else if (policy === 'thompson') {
      scores = before.map(({ plays, wins }) => sampleBeta(1 + wins, 1 + plays - wins, choices));
      chosen = best(scores);
    } else if (policy === 'human') {
      if (humanChoice === undefined || !Number.isInteger(humanChoice) || humanChoice < 0 || humanChoice >= arms.length) {
        throw new RangeError('Choose an available arm');
      }
      chosen = humanChoice;
    } else {
      chosen = policy === 'oracle' ? bestArm : Math.floor(choices() * arms.length);
    }

    let reward: 0 | 1 = 0;
    for (const [index, rate] of probabilities.entries()) {
      const click = outcomes() < rate;
      if (index === chosen && click) reward = 1;
    }
    arms[chosen].plays++;
    arms[chosen].wins += reward;
    rewards.push(rewards[rounds] + reward);
    regret.push(regret[rounds] + (probabilities[bestArm] - probabilities[chosen]));
    return last = { chosen, reward, scores, before };
  }

  return {
    arms, rewards, regret, step,
    get last() { return last; },
    run(rounds: number) { for (let index = 0; index < rounds; index++) step(); },
  };
}
