/** Pure drawing helpers shared by the boards: sampling a model on a grid, tracing its 0.5 line, chaining segments. */

export type Seg = [number, number, number, number];
export type Pt = [number, number];

export interface Grid { v: Float32Array; cols: number; rows: number; cell: number }

/** Sample `f` (in [0, 1] board coordinates) on the corners of a `cell`-pixel grid covering W × H pixels. */
export function sampleGrid(f: (x: number, y: number) => number, W: number, H: number, cell: number): Grid {
  const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), C1 = cols + 1;
  const v = new Float32Array(C1 * (rows + 1));
  for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) v[r * C1 + q] = f(q * cell / W, r * cell / H);
  return { v, cols, rows, cell };
}

/** Marching squares with linear interpolation: the line segments where the sampled value crosses `level`. */
export function contour({ v, cols, rows, cell }: Grid, level = 0.5): Seg[] {
  const C1 = cols + 1, out: Seg[] = [];
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const tl = v[r * C1 + q], tr = v[r * C1 + q + 1], br = v[(r + 1) * C1 + q + 1], bl = v[(r + 1) * C1 + q];
    const x0 = q * cell, y0 = r * cell, pts: Pt[] = [];
    if ((tl > level) !== (tr > level)) pts.push([x0 + lerp(tl, tr) * cell, y0]);
    if ((tr > level) !== (br > level)) pts.push([x0 + cell, y0 + lerp(tr, br) * cell]);
    if ((bl > level) !== (br > level)) pts.push([x0 + lerp(bl, br) * cell, y0 + cell]);
    if ((tl > level) !== (bl > level)) pts.push([x0, y0 + lerp(tl, bl) * cell]);
    for (let i = 0; i + 1 < pts.length; i += 2) out.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
  }
  return out;
}

/**
 * Join segments that share end points into polylines, so a dashed stroke runs smoothly along the whole line
 * (canvas restarts the dash pattern on every sub-path, and marching-squares segments are only a few pixels long).
 */
export function chain(segs: Seg[]): Pt[][] {
  const key = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
  const at = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const k of [key(s[0], s[1]), key(s[2], s[3])]) { const l = at.get(k); if (l) l.push(i); else at.set(k, [i]); }
  });
  const used = new Uint8Array(segs.length);
  /** Walk from point p (end of a polyline) through unused segments, appending points. */
  const walk = (line: Pt[]) => {
    for (;;) {
      const [x, y] = line[line.length - 1];
      const next = (at.get(key(x, y)) ?? []).find(i => !used[i]);
      if (next == null) return;
      used[next] = 1;
      const s = segs[next];
      line.push(key(s[0], s[1]) === key(x, y) ? [s[2], s[3]] : [s[0], s[1]]);
    }
  };
  const lines: Pt[][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const s = segs[i], fwd: Pt[] = [[s[0], s[1]], [s[2], s[3]]];
    walk(fwd);
    const back: Pt[] = [[s[0], s[1]]];
    walk(back);
    lines.push([...back.slice(1).reverse(), ...fwd]);
  }
  return lines;
}

/** A regression curve as screen points: y = f(x) every `step` pixels across W, scaled to H. */
export function curve(f: (x: number) => number, W: number, H: number, step = 2): Pt[] {
  const out: Pt[] = [];
  for (let px = 0; px <= W; px += step) out.push([px, f(px / W) * H]);
  if (out[out.length - 1][0] < W) out.push([W, f(1) * H]);
  return out;
}

export type Duel = { kind: 'more' } | { kind: 'tie' } | { kind: 'win'; side: 'a' | 'b'; diff: number };

/**
 * Who wins on the test points. Classification compares how many of the `n` test points each gets right
 * (accuracies `a`, `b`); regression compares test R² (a tie within 0.005). Fewer than 4 test points: "add more".
 */
export function duel(a: number | null, b: number | null, n: number, reg: boolean): Duel {
  if (n < 4 || a == null || b == null) return { kind: 'more' };
  const d = reg ? a - b : Math.round((a - b) * n);
  if (Math.abs(d) < (reg ? 0.005 : 1)) return { kind: 'tie' };
  return { kind: 'win', side: d > 0 ? 'a' : 'b', diff: Math.abs(d) };
}
