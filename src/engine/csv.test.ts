import { describe, expect, it } from 'vitest';
import { buildDataset, CsvError, describeColumns, loadTable, parseCsv, pca, rng } from './index';

const code = (f: () => unknown) => { try { f(); } catch (e) { return e instanceof CsvError ? e.code : 'other'; } return 'none'; };

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF, BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"'], ['1', '2']]);
  });
  it('detects semicolons and tabs', () => {
    expect(parseCsv('a;b\n1;2')[1]).toEqual(['1', '2']);
    expect(parseCsv('a\tb\n1\t2')[1]).toEqual(['1', '2']);
  });
  it('rejects an unclosed quote', () => { expect(code(() => parseCsv('a,b\n"1,2'))).toBe('quote'); });
});

describe('loadTable errors', () => {
  it('names the problem', () => {
    expect(code(() => loadTable(''))).toBe('empty');
    expect(code(() => loadTable('a\n1\n2'))).toBe('one_column');
    expect(code(() => loadTable('a,b'))).toBe('no_rows');
    expect(code(() => loadTable('a,b\n1,2,3\n4'))).toBe('ragged');
    expect(code(() => loadTable('a,b\n\u0000\u0001,2'))).toBe('binary');
  });
  it('counts ragged rows but keeps the rest', () => {
    const t = loadTable('a,b\n1,2\n3,4\n5\n6,7');
    expect(t.rows.length).toBe(3);
    expect(t.ragged).toBe(1);
  });
});

function table() {
  const r = rng(3), rows = ['h,w,z,label,price'];
  for (let i = 0; i < 60; i++) {
    const c = i % 2;
    rows.push(`${c ? 8 + r() : 2 + r()},${(c ? 5 : 1) + r()},${r()},${c ? 'yes' : 'no'},${i * 3 + r()}`);
  }
  rows.push('3,,0.5,no,4', '1,1,NA,yes,5', 'x,1,1,no,3');
  return loadTable(rows.join('\n'));
}

describe('buildDataset', () => {
  it('detects classification, drops missing rows and scales to the board', () => {
    const t = table(), cols = describeColumns(t);
    expect(cols.map(c => c.numeric)).toEqual([true, true, true, false, true]);
    const d = buildDataset(t, 3, { cols: [0, 1] });
    expect(d.task).toBe('cls');
    expect([...d.classes!].sort()).toEqual(['no', 'yes']);
    expect(d.info.droppedMissing).toBe(2);
    expect(d.points.length).toBe(61);
    for (const p of d.points) { expect(p.x).toBeGreaterThanOrEqual(0.06); expect(p.x).toBeLessThanOrEqual(0.94); }
  });
  it('detects regression from a many-valued numeric target', () => {
    const d = buildDataset(table(), 4, { cols: [0, 1] });
    expect(d.task).toBe('reg');
    expect(d.info.pcaNote).toBe(true);
  });
  it('keeps the two commonest classes of a many-class target', () => {
    const rows = ['a,b,k'];
    for (let i = 0; i < 30; i++) rows.push(`${i},${i % 7},${i < 13 ? 'p' : i < 25 ? 'q' : 'r'}`);
    const d = buildDataset(loadTable(rows.join('\n')), 2, { cols: [0, 1] });
    expect(d.info.droppedClasses).toBe(5);
    expect(d.points.length).toBe(25);
  });
  it('caps rows with a repeatable sample', () => {
    const rows = ['a,b,k'];
    for (let i = 0; i < 300; i++) rows.push(`${i},${(i * 7) % 11},${i % 2}`);
    const t = loadTable(rows.join('\n'));
    const d = buildDataset(t, 2, { cols: [0, 1] }, 100), e = buildDataset(t, 2, { cols: [0, 1] }, 100);
    expect(d.points.length).toBe(100);
    expect(d.info.sampledFrom).toBe(300);
    expect(d.points).toEqual(e.points);
  });
  it('gives clear errors', () => {
    const t = table();
    expect(code(() => buildDataset(t, 3, { cols: [0, 0] }))).toBe('same_col');
    expect(code(() => buildDataset(t, 0, { cols: [3, 1] }))).toBe('feature_text');
    expect(code(() => buildDataset(loadTable('a,b,c\n1,2,x\n3,4,x\n5,6,x\n7,8,x\n9,1,x\n2,3,x\n4,5,x'), 2, { cols: [0, 1] }))).toBe('target_one');
    expect(code(() => buildDataset(loadTable('a,b,c\n1,2,x\n3,4,y\n5,6,x'), 2, { cols: [0, 1] }))).toBe('few_rows');
    expect(code(() => buildDataset(loadTable('a,t\n1,x\n3,y'), 1, 'pca'))).toBe('pca_few');
  });
  it('works with PCA', () => {
    const d = buildDataset(table(), 3, 'pca');
    expect(d.axes).toEqual(['PC1', 'PC2']);
    expect(d.info.pcaExplained!.length).toBe(2);
  });
});

describe('pca', () => {
  it('finds the main direction of a line and explains most variance', () => {
    const r = rng(9), rows = Array.from({ length: 80 }, () => { const t = r() * 10; return [t, 2 * t + (r() - 0.5) * 0.1, r() - 0.5]; });
    const { scores, explained } = pca(rows, 2);
    expect(explained[0]).toBeGreaterThan(0.6);
    expect(explained[0] + explained[1]).toBeLessThanOrEqual(1.0001);
    const m = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const a = scores.map(s => s[0]), b = rows.map(x => x[0]), ma = m(a), mb = m(b);
    const corr = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) * b.reduce((s, v) => s + (v - mb) ** 2, 0));
    expect(Math.abs(corr)).toBeGreaterThan(0.99);
  });
  it('handles constant columns and is deterministic', () => {
    const rows = [[1, 5, 2], [2, 5, 4], [3, 5, 6], [4, 5, 9]];
    expect(pca(rows, 2)).toEqual(pca(rows, 2));
    expect(pca(rows, 2).scores.every(s => s.every(Number.isFinite))).toBe(true);
  });
  it('gives uncorrelated components', () => {
    const r = rng(4), rows = Array.from({ length: 100 }, () => [r(), r() * 2, r() * 3, r()]);
    const { scores } = pca(rows, 2);
    const dot = scores.reduce((s, v) => s + v[0] * v[1], 0) / scores.length;
    expect(Math.abs(dot)).toBeLessThan(0.05);
  });
});
