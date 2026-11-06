import type { Model, Point } from './types';

export type RGB = [number, number, number];

export interface BoardOptions {
  /** Draw only: no hover, no clicks. */
  static?: boolean;
  /** Pixel size of a sampling cell. Smaller is smoother and slower. */
  cell?: number;
  dot?: number;
  tint?: number;
  line?: number;
  onAdd?(p: { x: number; y: number }, e: MouseEvent): void;
  onHover?(p: { x: number; y: number } | null): void;
}

/** Read a CSS custom property from :root as an RGB triple (handles hex and rgba()). */
export function cssColor(name: string): RGB {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = v;
  const h = String(c.fillStyle);
  if (h[0] === '#') return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const m = h.match(/[\d.]+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
}
export const rgb = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/**
 * Draws a fitted model over the store's points: a tinted probability field, the 0.5 decision line
 * (marching squares with linear interpolation), training dots and ringed test dots.
 * Redraws on resize and on the window `themechange` event.
 */
export class Board {
  protected ctx: CanvasRenderingContext2D;
  protected field = document.createElement('canvas');
  private prev = document.createElement('canvas');
  protected W = 0;
  protected H = 0;
  protected dpr = 1;
  private fade = 1;
  protected ghost: { x: number; y: number } | null = null;
  protected colors!: { a: RGB; b: RGB; sheet: RGB; ink: RGB; grid: RGB };
  model: Model | null = null;

  constructor(private canvas: HTMLCanvasElement, protected store: { points: Point[] }, protected opts: BoardOptions = {}) {
    this.ctx = canvas.getContext('2d')!;
    if (!opts.static) this.bindPointer();
    new ResizeObserver(() => this.resize()).observe(canvas);
    addEventListener('themechange', () => { if (this.W) { this.readColors(); this.renderField(); this.draw(); } });
  }

  setModel(m: Model, animate = false): void {
    if (animate && this.W && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.prev.width = this.field.width;
      this.prev.height = this.field.height;
      this.prev.getContext('2d')!.drawImage(this.field, 0, 0);
      this.model = m;
      this.renderField();
      this.fade = 0;
      const t0 = performance.now();
      const step = (t: number) => { this.fade = Math.min(1, (t - t0) / 650); this.draw(); if (this.fade < 1) requestAnimationFrame(step); };
      step(t0);
    } else {
      this.model = m;
      if (this.W) { this.renderField(); this.draw(); }
    }
  }

  setGhost(g: { x: number; y: number } | null): void { this.ghost = g; this.draw(); }

  private hover(g: { x: number; y: number } | null) {
    this.ghost = g;
    this.draw();
    this.opts.onHover?.(g);
  }

  /**
   * Mouse: hover shows the ghost, a click adds a point.
   * Touch/pen: a tap adds a point; touch-and-hold shows the ghost until the finger lifts.
   * The canvas sets `touch-action: pinch-zoom` so taps and drags don't scroll the page.
   */
  private bindPointer() {
    const c = this.canvas;
    c.style.touchAction = 'pinch-zoom';
    c.style.userSelect = 'none';
    c.style.setProperty('-webkit-touch-callout', 'none');
    const HOLD_MS = 280, SLOP = 10;
    let down: { id: number; x: number; y: number; holding: boolean; timer: number } | null = null;

    let mouseDown = false;
    c.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') { mouseDown = e.button === 0; return; }
      try { c.setPointerCapture(e.pointerId); } catch { /* pointer already gone: the hold still works without capture */ }
      const id = e.pointerId, p = this.pos(e);
      down = { id, x: e.clientX, y: e.clientY, holding: false, timer: 0 };
      down.timer = window.setTimeout(() => { if (down?.id === id) { down.holding = true; this.hover(p); } }, HOLD_MS);
    });
    c.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') { this.hover(this.pos(e)); return; }
      if (!down || down.id !== e.pointerId) return;
      if (down.holding) this.hover(this.pos(e));
      else if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > SLOP) { down.holding = true; clearTimeout(down.timer); this.hover(this.pos(e)); }
    });
    const end = (e: PointerEvent, add: boolean) => {
      if (!down || down.id !== e.pointerId) return;
      clearTimeout(down.timer);
      const wasHolding = down.holding;
      down = null;
      if (wasHolding) this.hover(null);
      else if (add) this.opts.onAdd?.(this.pos(e), e);
    };
    c.addEventListener('pointerup', e => {
      if (e.pointerType === 'mouse') { if (mouseDown && e.button === 0) this.opts.onAdd?.(this.pos(e), e); mouseDown = false; return; }
      end(e, true);
    });
    c.addEventListener('pointercancel', e => end(e, false));
    c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.hover(null); });
    c.addEventListener('contextmenu', e => { if (down) e.preventDefault(); });
  }

  private pos(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  private readColors() {
    this.colors = { a: cssColor('--a'), b: cssColor('--b'), sheet: cssColor('--sheet'), ink: cssColor('--ink'), grid: cssColor('--muted') };
  }

  private resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.W = this.canvas.clientWidth;
    this.H = this.canvas.clientHeight;
    if (!this.W || !this.H) return;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.readColors();
    this.renderField();
    this.draw();
  }

  protected renderField() {
    const { W, H, dpr, colors, model, opts } = this;
    const cell = opts.cell ?? 5;
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
    if (!model) return;

    // sample P(class B) on grid corners, shade each cell by the mean, then trace the 0.5 contour
    const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), C1 = cols + 1;
    const v = new Float32Array(C1 * (rows + 1));
    for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) v[r * C1 + q] = model.predict(q * cell / W, r * cell / H);
    const tint = opts.tint ?? 0.2;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const p = (v[r * C1 + q] + v[r * C1 + q + 1] + v[(r + 1) * C1 + q] + v[(r + 1) * C1 + q + 1]) / 4;
      f.fillStyle = rgb(p > 0.5 ? colors.b : colors.a, tint * (0.35 + 1.3 * Math.abs(p - 0.5)));
      f.fillRect(q * cell, r * cell, cell, cell);
    }
    if (model.constant) return;

    f.strokeStyle = rgb(colors.ink, 0.78);
    f.lineWidth = opts.line ?? 1.8;
    f.lineCap = 'round';
    f.lineJoin = 'round';
    f.beginPath();
    const lerp = (a: number, b: number) => (0.5 - a) / (b - a);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const tl = v[r * C1 + q], tr = v[r * C1 + q + 1], br = v[(r + 1) * C1 + q + 1], bl = v[(r + 1) * C1 + q];
      const x0 = q * cell, y0 = r * cell, pts: Array<[number, number]> = [];
      if ((tl > 0.5) !== (tr > 0.5)) pts.push([x0 + lerp(tl, tr) * cell, y0]);
      if ((tr > 0.5) !== (br > 0.5)) pts.push([x0 + cell, y0 + lerp(tr, br) * cell]);
      if ((bl > 0.5) !== (br > 0.5)) pts.push([x0 + lerp(bl, br) * cell, y0 + cell]);
      if ((tl > 0.5) !== (bl > 0.5)) pts.push([x0, y0 + lerp(tl, bl) * cell]);
      for (let i = 0; i + 1 < pts.length; i += 2) { f.moveTo(pts[i][0], pts[i][1]); f.lineTo(pts[i + 1][0], pts[i + 1][1]); }
    }
    f.stroke();
  }

  protected draw() {
    const { ctx, canvas, W, H, dpr, colors, model, ghost, opts } = this;
    if (!W) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.fade < 1 && this.prev.width) { ctx.drawImage(this.prev, 0, 0); ctx.globalAlpha = this.fade; }
    ctx.drawImage(this.field, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawUnder();
    const R = opts.dot ?? 5;
    if (ghost && model?.neighbours && !opts.static) {
      ctx.lineWidth = 1.4;
      for (const p of model.neighbours(ghost.x, ghost.y)) {
        ctx.strokeStyle = rgb(p.c ? colors.b : colors.a, 0.6);
        ctx.beginPath(); ctx.moveTo(ghost.x * W, ghost.y * H); ctx.lineTo(p.x * W, p.y * H); ctx.stroke();
      }
    }
    for (const p of this.store.points) {
      const col = p.c ? colors.b : colors.a;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.test ? R - 0.5 : R, 0, 7);
      if (p.test) { ctx.fillStyle = rgb(colors.sheet); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = rgb(col); ctx.stroke(); }
      else { ctx.fillStyle = rgb(col); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgb(colors.sheet); ctx.stroke(); }
    }
    if (ghost && model && !opts.static) {
      const c = model.predict(ghost.x, ghost.y) > 0.5;
      ctx.beginPath(); ctx.arc(ghost.x * W, ghost.y * H, 9, 0, 7);
      ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeStyle = rgb(c ? colors.b : colors.a); ctx.stroke(); ctx.setLineDash([]);
    }
    this.drawOver();
  }

  /** Hooks for subclasses: drawn above the field and below the points / above everything. */
  protected drawUnder(): void {}
  protected drawOver(): void {}
}
