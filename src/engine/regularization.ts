import type { RegModel } from './regression';
import type { Sample } from './types';

type XY = Pick<Sample, 'x' | 'y'>;
export type Penalty = 'ridge' | 'lasso';
export interface RegularizedModel extends RegModel { weights: number[]; intercept: number }

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function features(x: number, degree: number): number[] {
  const input = 2 * x - 1;
  const values = [1, input];
  for (let order = 2; order <= degree; order++) values.push(2 * input * values[order - 1] - values[order - 2]);
  return values.slice(1);
}

function solve(matrix: number[][], target: number[]): number[] {
  const size = target.length;
  const pivots: number[] = [];
  for (let column = 0; column < size; column++) {
    let pivot = pivots.length;
    for (let row = pivot + 1; row < size; row++) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    if (pivot >= size || Math.abs(matrix[pivot][column]) < 1e-12) continue;
    const lead = pivots.length;
    [matrix[lead], matrix[pivot]] = [matrix[pivot], matrix[lead]];
    [target[lead], target[pivot]] = [target[pivot], target[lead]];
    for (let row = lead + 1; row < size; row++) {
      const ratio = matrix[row][column] / matrix[lead][column];
      for (let entry = column; entry < size; entry++) matrix[row][entry] -= ratio * matrix[lead][entry];
      target[row] -= ratio * target[lead];
    }
    pivots.push(column);
  }
  const weights = new Array<number>(size).fill(0);
  for (let row = pivots.length - 1; row >= 0; row--) {
    const column = pivots[row];
    let value = target[row];
    for (let entry = column + 1; entry < size; entry++) value -= matrix[row][entry] * weights[entry];
    weights[column] = value / matrix[row][column];
  }
  return weights;
}

function coordinateDescent(gram: number[][], target: number[], alpha: number): number[] {
  const weights = target.map(() => 0);
  for (let pass = 0; pass < 4000; pass++) {
    let maxChange = 0;
    for (let index = 0; index < weights.length; index++) {
      const row = gram[index], variance = row[index];
      if (variance < 1e-12) continue;
      const partial = target[index] - row.reduce((sum, value, other) =>
        sum + (other === index ? 0 : value * weights[other]), 0);
      const next = Math.abs(partial) <= alpha ? 0 : (partial - Math.sign(partial) * alpha) / variance;
      maxChange = Math.max(maxChange, Math.abs(next - weights[index]));
      weights[index] = next;
    }
    if (maxChange < 1e-8) break;
  }
  return weights;
}

/** Fit on x in [0, 1], using standardized Chebyshev features T1..Tdegree and an unpenalized intercept. */
export function fitRegularized(points: readonly XY[], degree: number, penalty: Penalty, alpha: number): RegularizedModel {
  const order = Math.max(1, Math.min(10, Math.round(degree)));
  const raw = points.map(({ x }) => features(x, order));
  const columns = Array.from({ length: order }, (_, index) => raw.map(row => row[index]));
  const offsets = columns.map(mean);
  const scales = columns.map((column, index) => {
    const deviation = Math.sqrt(mean(column.map(value => (value - offsets[index]) ** 2)));
    return deviation > 1e-12 ? deviation : 1;
  });
  const scaled = columns.map((column, index) => column.map(value => (value - offsets[index]) / scales[index]));
  const intercept = points.length ? mean(points.map(point => point.y)) : 0.5;
  const dot = (left: number[], right: number[]) => mean(left.map((value, index) => value * right[index]));
  const centered = points.map(point => point.y - intercept);
  const gram = scaled.map(left => scaled.map(right => dot(left, right)));
  const target = scaled.map(column => dot(column, centered));
  const weights = penalty === 'lasso' && alpha > 0
    ? coordinateDescent(gram, target, alpha)
    : solve(gram.map((row, index) => row.map((value, other) => value + (index === other ? alpha : 0))), target);
  return {
    weights,
    intercept,
    predict: x => features(x, order).reduce((sum, value, index) =>
      sum + weights[index] * (value - offsets[index]) / scales[index], intercept),
  };
}

export const mse = (model: RegModel, points: readonly XY[]): number | null =>
  points.length ? mean(points.map(({ x, y }) => (model.predict(x) - y) ** 2)) : null;
