import { expect, it } from 'vitest';
import { clusterPoints } from './clustering';
import { dbscan } from './dbscan';

it('finds all three seeded blobs without changing the input', () => {
  const points = clusterPoints('three');
  const before = structuredClone(points);
  const result = dbscan(points, .13, 4);
  expect(result.count).toBe(3);
  expect(result.noise).toBe(0);
  expect(result.labels).toEqual(points.map((_, index) => Math.floor(index / 18)));
  expect(dbscan(points, .13, 4)).toEqual(result);
  expect(points).toEqual(before);
});

it('follows the two curved moons instead of splitting them by a straight line', () => {
  const points = clusterPoints('moons');
  const result = dbscan(points, .12, 4);
  expect(result.count).toBe(2);
  expect(result.noise).toBe(2);
  expect(result.labels.every((label, index) => label === -1 || label === Math.floor(index / 32))).toBe(true);
});

it('includes the point itself and can attach an early non-core point to a core cluster', () => {
  const points = [0, .2, .3, .4, .45, 1].map(x => ({ x, y: 0 }));
  expect(dbscan(points, .21, 4)).toEqual({
    labels: [0, 0, 0, 0, 0, -1], types: ['border', 'core', 'core', 'core', 'border', 'noise'], count: 1, noise: 1,
  });
});

it('reports isolated points as noise and handles empty input', () => {
  const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
  expect(dbscan(points, .2, 2)).toEqual({ labels: [-1, -1, -1], types: ['noise', 'noise', 'noise'], count: 0, noise: 3 });
  expect(dbscan([], .2, 2)).toEqual({ labels: [], types: [], count: 0, noise: 0 });
});

it('rejects invalid radius or neighbor counts', () => {
  expect(() => dbscan([], -1, 4)).toThrow(RangeError);
  expect(() => dbscan([], .1, 0)).toThrow(RangeError);
});
