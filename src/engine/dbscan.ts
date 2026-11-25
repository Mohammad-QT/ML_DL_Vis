import type { Sample } from './clustering';

export type DbscanPointType = 'core' | 'border' | 'noise';

export interface DbscanResult {
  labels: number[];
  types: DbscanPointType[];
  count: number;
  noise: number;
}

export function dbscan(points: readonly Sample[], eps: number, minPts: number): DbscanResult {
  if (!Number.isFinite(eps) || eps < 0 || !Number.isInteger(minPts) || minPts < 1) {
    throw new RangeError('DBSCAN needs a non-negative radius and a positive whole number of points.');
  }

  const radiusSquared = eps ** 2;
  const neighbors = points.map((_, index) => [index]);
  points.forEach((point, index) => {
    for (let other = index + 1; other < points.length; other++) {
      const candidate = points[other];
      if ((point.x - candidate.x) ** 2 + (point.y - candidate.y) ** 2 <= radiusSquared) {
        neighbors[index].push(other);
        neighbors[other].push(index);
      }
    }
  });

  const core = neighbors.map(group => group.length >= minPts);
  const labels = points.map(() => -1);
  let count = 0;
  points.forEach((_, seed) => {
    if (!core[seed] || labels[seed] !== -1) return;

    const queue = [seed];
    labels[seed] = count;
    for (let next = 0; next < queue.length; next++) {
      for (const neighbor of neighbors[queue[next]]) {
        if (labels[neighbor] !== -1) continue;
        labels[neighbor] = count;
        if (core[neighbor]) queue.push(neighbor);
      }
    }
    count++;
  });

  const types = labels.map((label, index) => core[index] ? 'core' : label === -1 ? 'noise' : 'border');
  return { labels, types, count, noise: labels.filter(label => label === -1).length };
}
