import { rng } from './random';

export const WORLD = [
  '......',
  '.##.X.',
  '...#..',
  '.X.#..',
  '..#...',
  'S....G',
] as const;

export const ACTIONS = ['up', 'right', 'down', 'left'] as const;
const MOVES = [[-1, 0], [0, 1], [1, 0], [0, -1]] as const;
export const DEFAULT_TRAINING = { epsilon: 0.2, rate: 0.5, discount: 0.95 };
export const EPISODE_CAP = 72;

export type Cell = 'open' | 'wall' | 'start' | 'goal' | 'pit';
export type Outcome = 'goal' | 'pit' | 'cap';
export interface Episode { path: number[]; steps: number; outcome: Outcome }
type Training = typeof DEFAULT_TRAINING;
const TILES: Partial<Record<string, Cell>> = { '#': 'wall', S: 'start', G: 'goal', X: 'pit' };

export function gridWorld(map: readonly string[] = WORLD, seed = 2026) {
  const width = map[0]?.length;
  const height = map.length;
  if (!width || map.some(row => row.length !== width)) throw new Error('Expected a rectangular grid');
  const cells = Array.from(map.join(''), tile => TILES[tile] ?? 'open');
  const start = cells.indexOf('start');
  if (start < 0) throw new Error('Expected a start cell');
  const nextRandom = rng(seed);
  const table = cells.map(() => ACTIONS.map(() => 0));
  const visited = cells.map(() => false);

  function bestAction(state: number) {
    return table[state].indexOf(Math.max(...table[state]));
  }

  function move(state: number, action: number) {
    const [dr, dc] = MOVES[action];
    const row = Math.floor(state / width) + dr;
    const col = state % width + dc;
    const target = row * width + col;
    return row < 0 || row >= height || col < 0 || col >= width || cells[target] === 'wall' ? state : target;
  }

  function episode(training?: Training, limit = EPISODE_CAP): Episode {
    let state = start;
    const path = [start];
    const cap = Math.min(EPISODE_CAP, Math.max(0, Math.floor(limit)));
    for (let step = 0; step < cap; step++) {
      let action = bestAction(state);
      if (training) {
        if (nextRandom() < training.epsilon) {
          action = Math.floor(nextRandom() * ACTIONS.length);
        } else {
          const best = table[state][action];
          const choices = ACTIONS.map((_, index) => index).filter(index => table[state][index] === best);
          action = choices[Math.floor(nextRandom() * choices.length)];
        }
      }

      const next = move(state, action);
      const terminal = cells[next] === 'goal' || cells[next] === 'pit';
      if (training) {
        visited[state] = true;
        const reward = cells[next] === 'goal' ? 1 : cells[next] === 'pit' ? -1 : -0.04;
        const future = terminal ? 0 : Math.max(...table[next]);
        table[state][action] += training.rate * (reward + training.discount * future - table[state][action]);
      }
      path.push(next);
      state = next;
      if (terminal) return { path, steps: step + 1, outcome: cells[next] === 'goal' ? 'goal' : 'pit' };
    }
    return { path, steps: path.length - 1, outcome: 'cap' };
  }

  return { cells, width, table, visited, start, bestAction, episode };
}
