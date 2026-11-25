import { describe, expect, it } from 'vitest';
import { clusterPoints, cutWard, elbow, initKMeans, nearest, runKMeans, stepKMeans, ward, wcss } from './clustering';

const blobs = clusterPoints('three', true);

describe('K-Means', () => {
  it('recovers three well-separated blobs and tracks center moves', () => {
    const initial = initKMeans(blobs, 3, 42);
    const first = stepKMeans(blobs, initial);
    expect(first.iteration).toBe(1);
    expect(first.trails.every(trail => trail.length === 2)).toBe(true);
    const result = runKMeans(blobs, first);
    const labels = blobs.map(point => nearest(point, result.centers));
    expect(new Set(labels).size).toBe(3);
    expect(labels.every((label, index) => label === labels[Math.floor(index / 5) * 5])).toBe(true);
    expect(wcss(blobs, result.centers)).toBeLessThan(wcss(blobs, initial.centers));
  });

  it('is deterministic for the same seed', () => {
    expect(runKMeans(blobs, initKMeans(blobs, 3, 42))).toEqual(runKMeans(blobs, initKMeans(blobs, 3, 42)));
  });

  it('handles empty data and more centers than points, including coincident points', () => {
    expect(runKMeans([], initKMeans([], 8, 42)).centers).toEqual([]);
    const points = [blobs[0], blobs[0]];
    const result = runKMeans(points, initKMeans(points, 8, 42));
    expect(result.centers).toHaveLength(2);
    expect(wcss(points, result.centers)).toBe(0);
  });

  it('shows a much smaller WCSS improvement after three blobs', () => {
    const scores = elbow(blobs, 4, 42);
    expect(scores[1] - scores[2]).toBeGreaterThan(3 * (scores[2] - scores[3]));
    expect(elbow([], 8, 42)).toEqual([]);
  });
});

describe('Ward clustering', () => {
  it('recovers the three blobs at an intermediate cut', () => {
    const root = ward(blobs);
    const { labels, count } = cutWard(root, .25);
    expect(count).toBe(3);
    expect(labels.every((label, index) => label === labels[Math.floor(index / 5) * 5])).toBe(true);
    expect(cutWard(root, -.01).count).toBe(blobs.length);
    expect(cutWard(root, root!.height).count).toBe(1);
  });

  it('merges by minimum increase in squared spread and reports Ward heights', () => {
    const root = ward([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }])!;
    expect(root.children?.find(child => child.size === 2)?.height).toBe(1);
    expect(root.height).toBeCloseTo(Math.sqrt(4 / 3) * 2.5);
    expect(cutWard(root, 1).labels[0]).toBe(cutWard(root, 1).labels[1]);
  });

  it('handles empty, singleton and tied inputs deterministically', () => {
    expect(cutWard(ward([]), 1)).toEqual({ labels: [], count: 0 });
    expect(cutWard(ward(blobs.slice(0, 1)), 0)).toEqual({ labels: [0], count: 1 });
    const tied = Array.from({ length: 4 }, () => blobs[0]);
    expect(ward(tied)).toEqual(ward(tied));
    expect(cutWard(ward(tied), 0).count).toBe(1);
  });
});
