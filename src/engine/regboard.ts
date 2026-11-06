import { Board, rgb } from './board';
import type { RegModel } from './regression';
import type { Point } from './types';

/**
 * The regression version of `Board`: x → y points (filled = train, ringed = test), the fitted curve as the "line",
 * the epsilon tube for SVR, and residual sticks from test points to the curve (always on with `residuals`,
 * otherwise only for the test point nearest the pointer).
 */
export class RegBoard extends Board {
  reg: RegModel | null = null;
  residuals = false;

  setReg(m: RegModel): void {
    this.reg = m;
    this.refresh();
  }

  setResiduals(on: boolean): void { this.residuals = on; this.draw(); }

  protected renderField(): void {
    const { W, H, dpr, colors, reg } = this;
    this.field.width = W * dpr;
    this.field.height = H * dpr;
    const f = this.field.getContext('2d')!;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.fillStyle = rgb(colors.sheet);
    f.fillRect(0, 0, W, H);
    f.strokeStyle = rgb(colors.grid, 0.12);
    f.lineWidth = 1;
    f.beginPath();
    for (let i = 1; i < 10; i++) {
      f.moveTo(i * W / 10 + 0.5, 0); f.lineTo(i * W / 10 + 0.5, H);
      f.moveTo(0, i * H / 10 + 0.5); f.lineTo(W, i * H / 10 + 0.5);
    }
    f.stroke();
    if (!reg) return;
    const ys: number[] = [];
    for (let px = 0; px <= W; px += 2) ys.push(reg.predict(px / W) * H);
    const trace = (dy: number) => { ys.forEach((y, i) => (i ? f.lineTo(i * 2, y + dy) : f.moveTo(0, y + dy))); };
    if (reg.tube) {
      const d = reg.tube * H;
      f.beginPath(); trace(-d);
      for (let i = ys.length - 1; i >= 0; i--) f.lineTo(i * 2, ys[i] + d);
      f.closePath();
      f.fillStyle = rgb(colors.b, 0.13); f.fill();
      f.strokeStyle = rgb(colors.b, 0.7); f.lineWidth = 1.2; f.setLineDash([5, 4]);
      f.beginPath(); trace(-d); f.stroke(); f.beginPath(); trace(d); f.stroke();
      f.setLineDash([]);
    }
    f.strokeStyle = rgb(colors.ink, 0.78);
    f.lineWidth = this.opts.line ?? 1.8;
    f.lineCap = 'round'; f.lineJoin = 'round';
    f.beginPath(); trace(0); f.stroke();
  }

  protected drawUnder(): void {
    const { ctx, W, H, colors, reg, ghost } = this;
    if (!reg) return;
    const tests = this.store.points.filter((p: Point) => p.test);
    let near: Point | null = null;
    if (!this.residuals && ghost) {
      let best = 18 / W;
      for (const p of tests) if (Math.abs(p.x - ghost.x) < best) { best = Math.abs(p.x - ghost.x); near = p; }
    }
    ctx.lineWidth = 2; ctx.strokeStyle = rgb(colors.b, 0.85);
    ctx.beginPath();
    for (const p of this.residuals ? tests : near ? [near] : []) { ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(p.x * W, reg.predict(p.x) * H); }
    ctx.stroke();
  }

  protected drawOver(): void {
    const { ctx, W, H, colors, reg, ghost } = this;
    if (!ghost || !reg || this.opts.static) return;
    ctx.beginPath(); ctx.arc(ghost.x * W, reg.predict(ghost.x) * H, 8, 0, 7);
    ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeStyle = rgb(colors.ink); ctx.stroke(); ctx.setLineDash([]);
    if (this.kbActive) {
      // keyboard cursor: a cross where Enter will add the point
      const x = ghost.x * W, y = ghost.y * H;
      ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9);
      ctx.lineWidth = 2; ctx.strokeStyle = rgb(colors.b); ctx.stroke();
    }
  }
}
