import type { Sample } from './types';

type XY = Pick<Sample, 'x' | 'y'>;
export interface Line { slope: number; intercept: number }
export interface GradientStep extends Line { loss: number }

export const lineLoss = (points: readonly XY[], { slope, intercept }: Line): number =>
  points.reduce((sum, { x, y }) => sum + (slope * x + intercept - y) ** 2, 0) / Math.max(1, points.length);

export function gradientStep(points: readonly XY[], line: Line, learningRate: number): GradientStep {
  let slopeGradient = 0, interceptGradient = 0;
  for (const { x, y } of points) {
    const error = line.slope * x + line.intercept - y;
    slopeGradient += error * x;
    interceptGradient += error;
  }
  const scale = 2 * learningRate / Math.max(1, points.length);
  const next = { slope: line.slope - scale * slopeGradient, intercept: line.intercept - scale * interceptGradient };
  return { ...next, loss: lineLoss(points, next) };
}

export const gradientDiverged = (step: GradientStep, start: GradientStep): boolean =>
  !Number.isFinite(step.loss) || step.loss > Math.max(1e-12, start.loss) * 16;

export function gradientDescent(points: readonly XY[], learningRate: number, steps: number, line: Line = { slope: 0, intercept: 0 }) {
  const path: GradientStep[] = [{ ...line, loss: lineLoss(points, line) }];
  let diverged = false;
  for (let step = 0; step < steps; step++) {
    const next = gradientStep(points, path[path.length - 1], learningRate);
    if (Number.isFinite(next.loss)) path.push(next);
    if (gradientDiverged(next, path[0])) { diverged = true; break; }
  }
  return { path, diverged };
}
