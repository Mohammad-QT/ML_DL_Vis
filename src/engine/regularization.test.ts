import { describe, expect, it } from 'vitest';
import { fitReg } from './regression';
import { fitRegularized, mse } from './regularization';

const points = Array.from({ length: 25 }, (_, index) => {
  const x = index / 24;
  return { x, y: 0.2 + x * x + 0.03 * Math.sin(20 * x), c: 0 as const };
});

describe('polynomial regularization', () => {
  it.each(['ridge', 'lasso'] as const)('matches ordinary least squares with no %s penalty', penalty => {
    const ols = fitReg('polynomial', { degree: 5 }, points);
    const fitted = fitRegularized(points, 5, penalty, 0);
    for (const { x } of points) expect(fitted.predict(x)).toBeCloseTo(ols.predict(x), 9);
  });

  it('shrinks the weight norm with a larger ridge penalty without penalizing the intercept', () => {
    const low = fitRegularized(points, 7, 'ridge', 0.01);
    const high = fitRegularized(points, 7, 'ridge', 1);
    expect(Math.hypot(...high.weights)).toBeLessThan(Math.hypot(...low.weights));
    expect(high.intercept).toBe(low.intercept);
    expect(mse(low, points)!).toBeLessThan(mse(high, points)!);
  });

  it('sets some lasso weights to exactly zero while retaining useful signal', () => {
    const model = fitRegularized(points, 7, 'lasso', 0.06);
    expect(model.weights).toContain(0);
    expect(model.weights.some(weight => weight !== 0)).toBe(true);
    expect(mse(model, points)!).toBeLessThan(0.02);
  });

  it('falls back to the mean on constant input', () => {
    const model = fitRegularized([{ x: 0.5, y: 0.25 }, { x: 0.5, y: 0.75 }], 10, 'ridge', 0);
    expect(model.predict(0.5)).toBe(0.5);
    expect(model.weights.every(weight => weight === 0)).toBe(true);
  });
});
