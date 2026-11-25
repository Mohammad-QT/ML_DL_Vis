import { gauss, rng } from './random';

export interface Sample { x: number; y: number }
export interface KMeansState { centers: Sample[]; trails: Sample[][]; iteration: number; converged: boolean }

const distance = (first: Sample, second: Sample) => (first.x - second.x) ** 2 + (first.y - second.y) ** 2;

export function nearest(point: Sample, centers: readonly Sample[]): number {
  let best = -1, score = Infinity;
  centers.forEach((center, index) => {
    const squared = distance(point, center);
    if (squared < score) { best = index; score = squared; }
  });
  return best;
}

export function initKMeans(points: readonly Sample[], k: number, seed: number): KMeansState {
  const count = Math.min(points.length, Math.max(0, Math.floor(k)));
  const random = rng(seed);
  const remaining = [...points];
  const centers: Sample[] = [];
  while (centers.length < count) {
    let index = Math.floor(random() * remaining.length);
    if (centers.length) {
      const weights = remaining.map(point => distance(point, centers[nearest(point, centers)]));
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      if (total > 0) {
        let threshold = random() * total;
        index = weights.findIndex(weight => (threshold -= weight) < 0);
        if (index === -1) index = weights.length - 1;
      }
    }
    centers.push({ ...remaining.splice(index, 1)[0] });
  }
  return { centers, trails: centers.map(center => [center]), iteration: 0, converged: !centers.length };
}

export function stepKMeans(points: readonly Sample[], state: KMeansState): KMeansState {
  if (state.converged) return state;
  const sums = state.centers.map(() => ({ x: 0, y: 0, size: 0 }));
  for (const point of points) {
    const sum = sums[nearest(point, state.centers)];
    sum.x += point.x; sum.y += point.y; sum.size++;
  }
  const centers = sums.map((sum, index) => sum.size ? { x: sum.x / sum.size, y: sum.y / sum.size } : state.centers[index]);
  const moved = centers.map((center, index) => distance(center, state.centers[index]) > 1e-16);
  return { centers, trails: state.trails.map((trail, index) => moved[index] ? [...trail, centers[index]] : trail),
    iteration: state.iteration + 1, converged: !moved.some(Boolean) };
}

export function runKMeans(points: readonly Sample[], state: KMeansState): KMeansState {
  while (!state.converged) state = stepKMeans(points, state);
  return state;
}

export const wcss = (points: readonly Sample[], centers: readonly Sample[]): number => centers.length
  ? points.reduce((sum, point) => sum + distance(point, centers[nearest(point, centers)]), 0) : 0;

export function elbow(points: readonly Sample[], maxK: number, seed: number): number[] {
  return Array.from({ length: Math.min(points.length, maxK) }, (_, index) => Math.min(...Array.from({ length: 8 }, (_, start) =>
    wcss(points, runKMeans(points, initKMeans(points, index + 1, seed + start * 104729)).centers))));
}

export interface WardNode extends Sample {
  id: number;
  size: number;
  height: number;
  children?: [WardNode, WardNode];
}

export function ward(points: readonly Sample[]): WardNode | undefined {
  const active: WardNode[] = points.map((point, id) => ({ ...point, id, size: 1, height: 0 }));
  let id = active.length;
  while (active.length > 1) {
    let left = 0, right = 1, cost = Infinity;
    for (let first = 0; first < active.length - 1; first++) {
      const a = active[first];
      for (let second = first + 1; second < active.length; second++) {
        const b = active[second];
        const increase = (a.size * b.size / (a.size + b.size)) * distance(a, b);
        if (increase < cost) { cost = increase; left = first; right = second; }
      }
    }
    const first = active[left], second = active[right], size = first.size + second.size;
    active.splice(right, 1);
    active.splice(left, 1);
    active.push({ id: id++, size, height: Math.sqrt(2 * cost), children: [first, second],
      x: (first.x * first.size + second.x * second.size) / size,
      y: (first.y * first.size + second.y * second.size) / size });
  }
  return active[0];
}

export function cutWard(root: WardNode | undefined, height: number): { labels: number[]; count: number } {
  const labels: number[] = [];
  let count = 0;
  function label(node: WardNode, index: number) {
    if (node.children) node.children.forEach(child => label(child, index));
    else labels[node.id] = index;
  }
  function visit(node: WardNode) {
    if (!node.children || node.height <= height) label(node, count++);
    else node.children.forEach(visit);
  }
  if (root) visit(root);
  return { labels, count };
}

export const CLUSTER_PRESETS = ['three', 'five', 'uneven', 'moons'] as const;
export type ClusterPreset = (typeof CLUSTER_PRESETS)[number];

export function clusterPoints(preset: ClusterPreset, compact = false): Sample[] {
  const random = rng(91);
  const bound = (value: number) => Math.max(.03, Math.min(.97, value));
  if (preset === 'moons') return Array.from({ length: 64 }, (_, index) => {
    const angle = random() * Math.PI, lower = index >= 32;
    return {
      x: bound((lower ? .64 : .36) + (lower ? -1 : 1) * .25 * Math.cos(angle) + .023 * gauss(random)),
      y: bound((lower ? .46 : .54) + (lower ? 1 : -1) * .29 * Math.sin(angle) + .023 * gauss(random)),
    };
  });
  const blobs = preset === 'five' ? [[.2, .24], [.75, .25], [.48, .48], [.22, .76], [.76, .76]]
    : [[.21, .29], [.75, .28], [.51, .74]];
  return blobs.flatMap(([x, y], index) => Array.from({ length: compact ? 5 : preset === 'uneven' ? [44, 9, 18][index] : 18 }, () => ({
    x: bound(x + (.045 + (preset === 'uneven' && index === 0 ? .065 : 0)) * gauss(random)),
    y: bound(y + (.045 + (preset === 'uneven' && index === 0 ? .065 : 0)) * gauss(random)),
  })));
}
