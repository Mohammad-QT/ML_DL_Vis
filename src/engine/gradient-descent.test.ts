import { describe, expect, it } from 'vitest';
import { gradientDescent } from './gradient-descent';

const points = [-1, -0.5, 0, 0.5, 1].map(x => ({ x, y: 2 * x - 0.5 }));

describe('batch gradient descent', () => {
  it('converges to the least-squares line with a suitable rate', () => {
    const { path, diverged } = gradientDescent(points, 0.3, 70);
    expect(diverged).toBe(false);
    expect(path).toHaveLength(71);
    expect(path[path.length - 1].slope).toBeCloseTo(2);
    expect(path[path.length - 1].intercept).toBeCloseTo(-0.5);
    expect(path[path.length - 1].loss).toBeLessThan(1e-12);
    expect(path.every((point, index) => !index || point.loss <= path[index - 1].loss)).toBe(true);
  });

  it('reports divergence and stops early without returning non-finite steps', () => {
    const { path, diverged } = gradientDescent(points, 5, 70);
    expect(diverged).toBe(true);
    expect(path).toHaveLength(2);
    expect(path[1].loss).toBeGreaterThan(path[0].loss * 16);
    expect(gradientDescent(points, Number.MAX_VALUE, 3)).toEqual({
      path: [{ slope: 0, intercept: 0, loss: 2.25 }],
      diverged: true,
    });
  });

  it('returns the same path for the same data, rate and start', () => {
    const start = { slope: -0.2, intercept: 1 };
    expect(gradientDescent(points, 0.1, 10, start)).toEqual(gradientDescent(points, 0.1, 10, start));
  });
});
