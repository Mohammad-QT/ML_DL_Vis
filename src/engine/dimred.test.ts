import { describe, expect, it } from 'vitest';
import { kernelPca, lda, MAX_KERNEL_POINTS, pca } from './dimred';

describe('PCA', () => {
  const angle = Math.PI / 6;
  const along = [Math.cos(angle), Math.sin(angle)];
  const rows = [-4, -2, 0, 2, 4].flatMap(t => [-0.4, 0.4].map(u => [
    3 + t * along[0] - u * along[1],
    7 + t * along[1] + u * along[0],
  ]));

  it('finds the longest direction through the mean', () => {
    const result = pca(rows);
    const [x, y] = result.directions[0];
    expect(Math.abs(x * along[0] + y * along[1])).toBeCloseTo(1, 10);
    expect(result.mean[0]).toBeCloseTo(3);
    expect(result.mean[1]).toBeCloseTo(7);
    expect(result.explained[0]).toBeGreaterThan(0.95);
    expect(result.explained[0] + result.explained[1]).toBeCloseTo(1, 10);
  });

  it('keeps the signs and order deterministic', () => {
    expect(pca(rows)).toEqual(pca(rows));
  });

  it('returns finite zero scores and ratios with no variance', () => {
    expect(pca([])).toEqual({ mean: [], directions: [], scores: [], explained: [] });
    for (const rows of [[[0.1, 0.2]], Array.from({ length: 10 }, () => [0.1, 0.2])]) {
      const result = pca(rows);
      expect(result.explained).toEqual([0, 0]);
      expect(result.scores).toEqual(rows.map(() => [0, 0]));
      expect(result.directions.flat().every(Number.isFinite)).toBe(true);
    }
  });
});

describe('Fisher LDA', () => {
  const rows = [-3, -1, 1, 3].flatMap(x => [[x, -0.2], [x, 0.2]]);
  const labels = rows.map((_, i) => i % 2);

  it('finds low-variance class separation even when the within-class scatter is singular', () => {
    expect(Math.abs(pca(rows).directions[0][0])).toBeCloseTo(1);
    const result = lda(rows, labels);
    expect(Math.abs(result.directions[0][1])).toBeCloseTo(1);
    expect(result.transform([[2, -0.2], [2, 0.2]])).toEqual([[-0.2], [0.2]]);
  });

  it('keeps two discriminants for three classes and repeats the same projection', () => {
    const multiclass = [...rows, [-1, 1], [1, 1]];
    const classes = [...labels, 2, 2];
    const first = lda(multiclass, classes), second = lda(multiclass, classes);
    expect(first.directions).toHaveLength(2);
    expect(first.directions).toEqual(second.directions);
    expect(first.scores).toEqual(second.scores);
    expect(first.scores.flat().every(Number.isFinite)).toBe(true);
  });

  it('returns no discriminants for an empty or one-class input', () => {
    expect(lda([], []).scores).toEqual([]);
    const result = lda(rows, rows.map(() => 0));
    expect(result.directions).toEqual([]);
    expect(result.transform(rows)).toEqual(rows.map(() => []));
  });
});

function bestThreshold(scores: number[][], labels: number[]) {
  const ordered = scores.map(([x], i) => ({ x, label: labels[i] })).sort((a, b) => a.x - b.x);
  let correct = labels.reduce((sum, label) => sum + label, 0);
  let best = Math.max(correct, ordered.length - correct);
  ordered.forEach(({ x, label }, i) => {
    correct += label ? -1 : 1;
    if (ordered[i + 1]?.x !== x) best = Math.max(best, correct, ordered.length - correct);
  });
  return best / ordered.length;
}

describe('RBF kernel PCA', () => {
  const rows = Array.from({ length: 44 }, (_, i) => [0, 1].map(c => {
    const angle = 2 * Math.PI * (i + c * 0.37) / 44;
    const radius = (c ? 0.10 : 0.34) + 0.009 * Math.sin(i * 1.414 + c);
    return [0.5 + radius * Math.cos(angle), 0.5 + radius * Math.sin(angle)];
  })).flat();
  const labels = rows.map((_, i) => i % 2);

  it('separates two concentric circles with one component where linear PCA falls short', () => {
    const { scores } = kernelPca(rows, 20, 1);
    expect(bestThreshold(scores, labels)).toBeGreaterThan(0.9);
    expect(bestThreshold(pca(rows, 1).scores, labels)).toBeLessThan(0.8);
    expect(scores.reduce((sum, row) => sum + row[0], 0)).toBeCloseTo(0, 10);
  });

  it('repeats the same kernel projection', () => {
    expect(kernelPca(rows, 20)).toEqual(kernelPca(rows, 20));
  });

  it('handles empty, single and identical points and caps the matrix size', () => {
    expect(kernelPca([])).toEqual({ scores: [], eigenvalues: [] });
    expect(kernelPca([[1, 2]]).scores).toEqual([[0]]);
    expect(kernelPca([[1, 2], [1, 2]]).scores).toEqual([[0, 0], [0, 0]]);
    const result = kernelPca(Array.from({ length: MAX_KERNEL_POINTS + 10 }, () => [0, 0]));
    expect(result.scores).toHaveLength(MAX_KERNEL_POINTS);
    expect(result.eigenvalues).toEqual([0, 0]);
  });
});
