import { rng } from './random';

type Rows = readonly (readonly number[])[];
interface Eigenpair { value: number; direction: number[] }

const dot = (a: readonly number[], b: readonly number[]) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};
const basis = (n: number, j: number) => Array.from({ length: n }, (_, i) => Number(i === j));
const identity = (n: number) => Array.from({ length: n }, (_, i) => basis(n, i));
const trace = (matrix: number[][]) => matrix.reduce((sum, row, i) => sum + row[i], 0);

// Anchor the average at the first point so constant columns centre to exactly zero.
const columnMeans = (rows: Rows) => rows[0]?.map((first, j) =>
  first + rows.reduce((sum, row) => sum + (row[j] - first), 0) / rows.length) ?? [];

function scatter(rows: Rows, dimensions: number) {
  const covariance = Array.from({ length: dimensions }, () => new Array<number>(dimensions).fill(0));
  for (const row of rows) {
    for (let i = 0; i < dimensions; i++) {
      for (let j = 0; j <= i; j++) covariance[i][j] += row[i] * row[j];
    }
  }
  for (let i = 0; i < dimensions; i++) {
    for (let j = 0; j < i; j++) covariance[j][i] = covariance[i][j];
  }
  return covariance;
}

/** Fix the arbitrary sign using the entry with largest magnitude. */
function canonical(direction: number[]) {
  const largest = direction.reduce((big, x) => Math.abs(x) > Math.abs(big) ? x : big, 0);
  return largest < 0 ? direction.map(x => -x) : direction;
}

/** Jacobi rotations give small symmetric matrices an orthogonal basis even at tied eigenvalues. */
function jacobi(matrix: number[][], k: number): Eigenpair[] {
  const n = matrix.length;
  const vectors = identity(n);
  const tolerance = trace(matrix) * 1e-14;
  for (let sweep = 0; sweep < 30; sweep++) {
    let changed = false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const ij = matrix[i][j];
      if (Math.abs(ij) <= tolerance) continue;
      changed = true;
      const ii = matrix[i][i], jj = matrix[j][j];
      const angle = Math.atan2(2 * ij, jj - ii) / 2;
      const c = Math.cos(angle), s = Math.sin(angle);
      matrix[i][i] = c * c * ii - 2 * c * s * ij + s * s * jj;
      matrix[j][j] = s * s * ii + 2 * c * s * ij + c * c * jj;
      matrix[i][j] = matrix[j][i] = 0;
      for (let p = 0; p < n; p++) {
        if (p !== i && p !== j) {
          const pi = matrix[p][i], pj = matrix[p][j];
          matrix[p][i] = matrix[i][p] = c * pi - s * pj;
          matrix[p][j] = matrix[j][p] = s * pi + c * pj;
        }
        const vi = vectors[p][i], vj = vectors[p][j];
        vectors[p][i] = c * vi - s * vj;
        vectors[p][j] = s * vi + c * vj;
      }
    }
    if (!changed) break;
  }
  return matrix.map((row, i) => ({ value: Math.max(0, row[i]), direction: canonical(vectors.map(v => v[i])) }))
    .sort((a, b) => b.value - a.value).slice(0, k);
}

/** For large matrices, find only the requested leading eigenvectors by deflated power iteration. */
function leading(matrix: number[][], k: number): Eigenpair[] {
  const n = matrix.length;
  if (n <= 24) return jacobi(matrix, k);
  const random = rng(42), pairs: Eigenpair[] = [];
  const tolerance = trace(matrix) * 1e-14;
  const deflate = (v: number[]) => {
    for (const { direction } of pairs) {
      const length = dot(v, direction);
      for (let j = 0; j < n; j++) v[j] -= length * direction[j];
    }
    return Math.sqrt(dot(v, v));
  };
  for (let i = 0; i < k; i++) {
    let direction = Array.from({ length: n }, () => random() - 0.5);
    let norm = deflate(direction);
    if (norm < 1e-10) {
      // Choose the coordinate with the most room left outside the previous components.
      const used = (j: number) => pairs.reduce((sum, pair) => sum + pair.direction[j] ** 2, 0);
      let axis = 0;
      for (let j = 1; j < n; j++) if (used(j) < used(axis)) axis = j;
      direction = basis(n, axis);
      norm = deflate(direction);
    }
    direction = direction.map(x => x / norm);
    let value = 0;
    for (let iteration = 0; iteration < 180; iteration++) {
      const next = matrix.map(row => dot(row, direction));
      norm = deflate(next);
      if (norm <= tolerance) break;
      value = dot(next, direction);
      let change = 0;
      for (let j = 0; j < n; j++) {
        next[j] /= norm;
        change += (next[j] - direction[j]) ** 2;
      }
      direction = next;
      if (change < 1e-16) break;
    }
    pairs.push({ value: Math.max(0, value), direction: canonical(direction) });
  }
  return pairs.sort((a, b) => b.value - a.value);
}

/** Centre columns and project onto the axes of greatest variance. Directions are in standardized coordinates when requested. */
export function pca(rows: Rows, k = 2, standardize = false) {
  const mean = columnMeans(rows);
  const centred = rows.map(row => row.map((x, i) => x - mean[i]));
  if (standardize) {
    const scales = mean.map((_, i) => Math.sqrt(centred.reduce((sum, row) => sum + row[i] ** 2, 0) / rows.length) || 1);
    for (const row of centred) row.forEach((x, i) => { row[i] = x / scales[i]; });
  }
  const matrix = scatter(centred, mean.length);
  const total = trace(matrix);
  const pairs = leading(matrix, Math.min(k, mean.length));
  const directions = pairs.map(pair => pair.direction);
  return {
    mean, directions,
    scores: centred.map(row => directions.map(direction => dot(row, direction))),
    explained: pairs.map(({ value }) => total > 0 ? value / total : 0),
  };
}

/** CSV projections have always standardized features before applying PCA. */
export const standardizedPca = (rows: Rows, k = 2) => pca(rows, k, true);

function cholesky(matrix: number[][]) {
  const lower = matrix.map(row => row.map(() => 0));
  for (let i = 0; i < lower.length; i++) for (let j = 0; j <= i; j++) {
    let value = matrix[i][j];
    for (let p = 0; p < j; p++) value -= lower[i][p] * lower[j][p];
    lower[i][j] = i === j ? Math.sqrt(value) : value / lower[j][j];
  }
  return lower;
}

/** Fisher LDA: maximize between-class scatter relative to ridge-regularized within-class scatter. */
export function lda(rows: Rows, labels: readonly number[], k = 2) {
  const mean = columnMeans(rows), dimensions = mean.length;
  const groups = new Map<number, (readonly number[])[]>();
  rows.forEach((row, i) => {
    const group = groups.get(labels[i]);
    if (group) group.push(row);
    else groups.set(labels[i], [row]);
  });
  let directions: number[][] = [];
  if (groups.size > 1 && dimensions) {
    const residuals: number[][] = [], offsets: number[][] = [];
    for (const group of groups.values()) {
      const centre = columnMeans(group);
      for (const row of group) residuals.push(row.map((x, i) => x - centre[i]));
      offsets.push(centre.map((x, i) => Math.sqrt(group.length) * (x - mean[i])));
    }
    const within = scatter(residuals, dimensions);
    const ridge = (trace(within) / dimensions || 1) * 1e-6;
    within.forEach((row, i) => { row[i] += ridge; });
    const lower = cholesky(within);
    // If Sw = L Lᵀ, whiten the offsets with L⁻¹ to diagonalize L⁻¹ Sb L⁻ᵀ.
    const whitened = offsets.map(offset => lower.reduce<number[]>((solved, row, i) => {
      solved.push((offset[i] - dot(solved, row)) / row[i]);
      return solved;
    }, []));
    const between = scatter(whitened, dimensions);
    directions = leading(between, Math.min(k, dimensions, groups.size - 1)).map(({ direction }) => {
      const axis = new Array<number>(dimensions);
      for (let i = dimensions - 1; i >= 0; i--) {
        let value = direction[i];
        for (let j = i + 1; j < dimensions; j++) value -= lower[j][i] * axis[j];
        axis[i] = value / lower[i][i];
      }
      const norm = Math.sqrt(dot(axis, axis));
      return canonical(axis.map(x => x / norm));
    });
  }
  const transform = (samples: Rows) => samples.map(row => {
    const centred = row.map((x, i) => x - mean[i]);
    return directions.map(direction => dot(centred, direction));
  });
  return { mean, directions, transform, scores: transform(rows) };
}

export const MAX_KERNEL_POINTS = 300;

/** RBF kernel PCA scores for the first 300 points. Centre K in feature space before taking its eigenvectors. */
export function kernelPca(rows: Rows, gamma = 20, k = 2) {
  const n = Math.min(rows.length, MAX_KERNEL_POINTS);
  if (!n) return { scores: [], eigenvalues: [] };
  const matrix = Array.from({ length: n }, () => new Array<number>(n).fill(1));
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) {
    let squaredDistance = 0;
    for (let d = 0; d < rows[i].length; d++) squaredDistance += (rows[i][d] - rows[j][d]) ** 2;
    matrix[j][i] = matrix[i][j] = Math.exp(-gamma * squaredDistance);
  }
  const means = matrix.map(row => row.reduce((sum, x) => sum + x, 0) / n);
  const overall = means.reduce((sum, x) => sum + x, 0) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    matrix[j][i] = matrix[i][j] = matrix[i][j] - means[i] - means[j] + overall;
  }
  const pairs = leading(matrix, Math.min(k, n));
  const eigenvalues = pairs.map(pair => pair.value);
  const scales = eigenvalues.map(Math.sqrt);
  const scores = matrix.map((_, i) => pairs.map(({ direction }, j) => scales[j] ? direction[i] * scales[j] : 0));
  return { scores, eigenvalues };
}
