import { describe, expect, it } from 'vitest';
import { UndoStack, sampleGrid, contour, chain, curve, duel, Store, RegStore } from './index';

describe('UndoStack', () => {
  it('pops newest first', () => {
    const u = new UndoStack<number>();
    [1, 2, 3].forEach(n => u.push(n));
    expect(u.pop()).toBe(3);
    expect(u.pop()).toBe(2);
    expect(u.size).toBe(1);
  });

  it('skips entries that are no longer in the data', () => {
    const u = new UndoStack<string>();
    ['a', 'b', 'c'].forEach(s => u.push(s));
    const alive = new Set(['a']);
    expect(u.pop(s => alive.has(s))).toBe('a');
    expect(u.pop()).toBeUndefined();
  });

  it('prunes dead entries and reports what is left', () => {
    const u = new UndoStack<number>();
    [1, 2, 3, 4].forEach(n => u.push(n));
    expect(u.prune(n => n % 2 === 0)).toBe(2);
    expect(u.pop()).toBe(4);
  });

  it('forgets the oldest past its limit', () => {
    const u = new UndoStack<number>(2);
    [1, 2, 3].forEach(n => u.push(n));
    expect(u.size).toBe(2);
    expect(u.pop()).toBe(3);
    expect(u.pop()).toBe(2);
    expect(u.pop()).toBeUndefined();
  });

  it('works with Store.add / Store.remove to take back the last added point', () => {
    const s = new Store(), u = new UndoStack<ReturnType<Store['add']>>();
    s.preset('blobs', 1);
    const n = s.points.length;
    u.push(s.add(0.1, 0.1, 0));
    u.push(s.add(0.2, 0.2, 1));
    const last = u.pop(p => s.points.includes(p))!;
    expect(last.c).toBe(1);
    expect(s.remove(last)).toBe(true);
    expect(s.points.length).toBe(n + 1);
    s.preset('moons', 2); // the earlier point is gone with the old data
    expect(u.pop(p => s.points.includes(p))).toBeUndefined();
  });

  it('RegStore.remove ignores points that are not there', () => {
    const s = new RegStore();
    const p = s.add(0.5, 0.5);
    expect(s.remove(p)).toBe(true);
    expect(s.remove(p)).toBe(false);
  });
});

describe('contour + chain', () => {
  // a vertical boundary at x = 0.5: P(B) = 1 on the right
  const g = sampleGrid(x => (x > 0.5 ? 1 : 0), 100, 60, 5);

  it('traces a line where the value crosses 0.5', () => {
    const segs = contour(g);
    expect(segs.length).toBe(12); // one segment per row of cells
    for (const [x1, , x2] of segs) { expect(x1).toBeGreaterThanOrEqual(50); expect(x2).toBeLessThanOrEqual(55); }
  });

  it('chains the pieces into one polyline from top to bottom', () => {
    const lines = chain(contour(g));
    expect(lines).toHaveLength(1);
    const ys = lines[0].map(p => p[1]).sort((a, b) => a - b);
    expect(ys[0]).toBe(0);
    expect(ys[ys.length - 1]).toBe(60);
    expect(lines[0]).toHaveLength(13);
  });

  it('keeps separate lines apart and closes a loop', () => {
    const ring = sampleGrid((x, y) => (Math.hypot(x - 0.5, y - 0.5) < 0.25 ? 1 : 0), 80, 80, 4);
    const lines = chain(contour(ring));
    expect(lines).toHaveLength(1);
    const l = lines[0];
    expect(l[0]).toEqual(l[l.length - 1]); // closed
    const two = sampleGrid(x => (x < 0.25 || x > 0.75 ? 1 : 0), 80, 40, 4);
    expect(chain(contour(two))).toHaveLength(2);
  });

  it('returns nothing for a constant field', () => {
    expect(chain(contour(sampleGrid(() => 0.9, 40, 40, 5)))).toEqual([]);
  });
});

describe('curve', () => {
  it('spans the full width in pixels', () => {
    const c = curve(x => x, 101, 50, 2);
    expect(c[0]).toEqual([0, 0]);
    expect(c[c.length - 1]).toEqual([101, 50]);
    expect(c.every(([x, y]) => Math.abs(y - x * 50 / 101) < 1e-9)).toBe(true);
  });
});

describe('duel', () => {
  it('asks for more data with few test points', () => {
    expect(duel(0.9, 0.5, 3, false)).toEqual({ kind: 'more' });
    expect(duel(null, 0.5, 10, false)).toEqual({ kind: 'more' });
  });
  it('counts test points for classification', () => {
    expect(duel(0.9, 0.8, 20, false)).toEqual({ kind: 'win', side: 'a', diff: 2 });
    expect(duel(0.8, 0.9, 20, false)).toEqual({ kind: 'win', side: 'b', diff: 2 });
    expect(duel(0.8, 0.8, 20, false)).toEqual({ kind: 'tie' });
  });
  it('compares R² for regression with a small tie band', () => {
    expect(duel(0.9, 0.898, 10, true)).toEqual({ kind: 'tie' });
    const d = duel(0.5, 0.9, 10, true);
    expect(d.kind === 'win' && d.side).toBe('b');
  });
});
