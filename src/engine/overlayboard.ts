import { Board, rgb, type RGB } from './board';
import { chain, contour, curve, sampleGrid, type Pt } from './contour';
import type { RegModel } from './regression';
import type { Model } from './types';

export type Pair = { kind: 'cls'; a: Model; b: Model } | { kind: 'reg'; a: RegModel; b: RegModel };

/** Line styles for the two models: A is solid ink, B is a dashed green (`--ok`), so they read apart in both themes. */
export const OVERLAY_DASH = [7, 5];

/**
 * Compare's Overlay view: both models' lines on one board, over the same points.
 * Classification: the two 0.5 boundaries, with a faint highlighter wash where the models disagree.
 * Regression: the two fitted curves.
 */
export class OverlayBoard extends Board {
  pair: Pair | null = null;

  setPair(p: Pair): void {
    this.pair = p;
    this.refresh();
  }

  protected renderField(): void {
    super.renderField(); // model is null: just the sheet and the grid
    const { W, H, colors, pair, opts } = this;
    if (!pair) return;
    const f = this.field.getContext('2d')!;
    const cell = opts.cell ?? 5;
    let lines: [Pt[][], Pt[][]];
    if (pair.kind === 'cls') {
      const ga = sampleGrid((x, y) => pair.a.predict(x, y), W, H, cell);
      const gb = sampleGrid((x, y) => pair.b.predict(x, y), W, H, cell);
      const C1 = ga.cols + 1;
      f.fillStyle = rgb(colors.hl, 0.16);
      for (let r = 0; r < ga.rows; r++) for (let q = 0; q < ga.cols; q++) {
        const i = r * C1 + q, mean = (v: Float32Array) => (v[i] + v[i + 1] + v[i + C1] + v[i + C1 + 1]) / 4;
        if ((mean(ga.v) > 0.5) !== (mean(gb.v) > 0.5)) f.fillRect(q * cell, r * cell, cell, cell);
      }
      lines = [pair.a.constant ? [] : chain(contour(ga)), pair.b.constant ? [] : chain(contour(gb))];
    } else {
      lines = [[curve(x => pair.a.predict(x), W, H)], [curve(x => pair.b.predict(x), W, H)]];
    }
    const stroke = (ls: Pt[][], col: RGB, dash: number[]) => {
      f.strokeStyle = rgb(col, 0.92);
      f.lineWidth = 2.4;
      f.lineCap = dash.length ? 'butt' : 'round';
      f.lineJoin = 'round';
      f.setLineDash(dash);
      f.beginPath();
      for (const l of ls) l.forEach(([x, y], i) => (i ? f.lineTo(x, y) : f.moveTo(x, y)));
      f.stroke();
      f.setLineDash([]);
    };
    stroke(lines[0], colors.ink, []);
    stroke(lines[1], colors.ok, OVERLAY_DASH);
  }

  protected drawOver(): void {
    const { ctx, W, H, colors, pair, ghost } = this;
    if (!ghost || !pair || this.opts.static) return;
    ctx.setLineDash([3, 3]); ctx.lineWidth = 2;
    if (pair.kind === 'reg') {
      for (const [m, col] of [[pair.a, colors.ink], [pair.b, colors.ok]] as const) {
        ctx.beginPath(); ctx.arc(ghost.x * W, m.predict(ghost.x) * H, 7, 0, 7); ctx.strokeStyle = rgb(col); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.arc(ghost.x * W, ghost.y * H, 9, 0, 7); ctx.strokeStyle = rgb(colors.ink); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}
