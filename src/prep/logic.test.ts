import { describe, expect, it } from 'vitest';
import { columnMean, impute, labelEncode, mean, median, nearest, oneHot, shuffleSplit, standardize } from './logic';
import { AGE_SALARY } from './data';

const table = [[20, 100], [null, 300], [40, null], [60, 200]];

describe('mean and median', () => {
  it('ignore blanks', () => {
    expect(mean([1, null, 3])).toBe(2);
    expect(median([1, null, 3, 100])).toBe(3);
    expect(median([1, 2, null, 4])).toBe(2);
  });
  it('return null with nothing known', () => expect(mean([null])).toBeNull());
});

describe('impute', () => {
  it('drop removes rows with any blank', () => {
    const r = impute(table, 'drop');
    expect(r.keep).toEqual([true, false, false, true]);
    expect(columnMean(r.table, r.keep, 0)).toBe(40);
  });
  it('mean fills with the column mean and keeps the column mean', () => {
    const r = impute(table, 'mean');
    expect(r.keep.every(Boolean)).toBe(true);
    expect(r.table[1][0]).toBe(40);
    expect(r.table[2][1]).toBe(200);
    expect(r.filled[1]).toEqual([true, false]);
    expect(columnMean(r.table, r.keep, 0)).toBe(40);
  });
  it('median fills with the column median', () => {
    expect(impute(table, 'median').table[2][1]).toBe(200);
    expect(impute([[1], [2], [null], [100]], 'median').table[2][0]).toBe(2);
  });
  it('does not change the input', () => {
    impute(table, 'mean');
    expect(table[1][0]).toBeNull();
  });
});

describe('encoding', () => {
  const v = ['Spain', 'France', 'Spain', 'Germany'];
  it('label encoding numbers the sorted classes', () => {
    expect(labelEncode(v)).toEqual({ classes: ['France', 'Germany', 'Spain'], codes: [2, 0, 2, 1] });
  });
  it('one-hot gives one 1 per row', () => {
    const r = oneHot(v);
    expect(r.rows).toEqual([[0, 0, 1], [1, 0, 0], [0, 0, 1], [0, 1, 0]]);
    expect(r.rows.every(row => row.reduce((a, b) => a + b) === 1)).toBe(true);
  });
});

describe('shuffleSplit', () => {
  it('splits every index exactly once, with ceil(n * frac) test items', () => {
    const s = shuffleSplit(40, 0.25, 1);
    expect(s.test).toHaveLength(10);
    expect([...s.train, ...s.test].sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => i));
    expect(shuffleSplit(10, 0.25, 1).test).toHaveLength(3);
  });
  it('is repeatable for one seed and changes with another', () => {
    expect(shuffleSplit(40, 0.3, 42)).toEqual(shuffleSplit(40, 0.3, 42));
    expect(shuffleSplit(40, 0.3, 42).test).not.toEqual(shuffleSplit(40, 0.3, 43).test);
  });
});

describe('standardize', () => {
  it('gives mean 0 and standard deviation 1', () => {
    const { values } = standardize([10, 20, 30, 40]);
    expect(values.reduce((a, b) => a + b) / 4).toBeCloseTo(0);
    expect(Math.sqrt(values.reduce((a, b) => a + b * b, 0) / 4)).toBeCloseTo(1);
  });
  it('survives a constant column', () => expect(standardize([5, 5]).values).toEqual([0, 0]));
});

describe('nearest', () => {
  it('finds the closest other point', () => {
    expect(nearest([[0, 0], [5, 5], [1, 1]], 0)).toBe(2);
    expect(nearest([[0, 0]], 0)).toBe(-1);
  });
  it('scaling changes the neighbour for some point in the lesson data', () => {
    const a = standardize(AGE_SALARY.map(p => p[0])).values, s = standardize(AGE_SALARY.map(p => p[1])).values;
    const z = a.map((v, i) => [v, s[i]]);
    expect(AGE_SALARY.some((_, i) => nearest(AGE_SALARY, i) !== nearest(z, i))).toBe(true);
  });
});
