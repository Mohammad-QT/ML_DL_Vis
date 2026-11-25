import { expect, it } from 'vitest';
import { DEFAULT_TRAINING, EPISODE_CAP, gridWorld } from './q-learning';

it('learns a shortest safe path around a wall and pit on a fixed map', () => {
  const world = gridWorld(['S#..G', '.X.#.', '.....']);
  for (let episode = 0; episode < 600; episode++) world.episode(DEFAULT_TRAINING);
  const greedy = world.episode();
  expect(greedy.outcome).toBe('goal');
  expect(greedy.steps).toBe(8);
  expect(greedy.path.every(state => !['wall', 'pit'].includes(world.cells[state]))).toBe(true);
});

it('is deterministic with the same seed and settings', () => {
  const first = gridWorld();
  const second = gridWorld();
  for (let episode = 0; episode < 12; episode++) {
    expect(first.episode(DEFAULT_TRAINING)).toEqual(second.episode(DEFAULT_TRAINING));
  }
  expect(first.table).toEqual(second.table);
});

it('stops at the episode cap when the goal cannot be reached', () => {
  const world = gridWorld(['S#G']);
  for (const training of [DEFAULT_TRAINING, undefined]) {
    const episode = world.episode(training, 2000);
    expect(episode).toEqual({ path: Array(EPISODE_CAP + 1).fill(world.start), steps: EPISODE_CAP, outcome: 'cap' });
  }
  expect(world.episode(DEFAULT_TRAINING, 3).steps).toBe(3);
});
