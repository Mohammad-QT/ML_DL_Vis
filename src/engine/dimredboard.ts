import { Board, rgb } from './board';

type Vector = readonly number[];

export interface ProjectionAxis {
  direction: Vector;
  dashed?: boolean;
  project?: boolean;
}

export class DimredBoard extends Board {
  private origin: Vector = [];
  private axes: ProjectionAxis[] = [];

  showAxes(origin: Vector, axes: ProjectionAxis[]) {
    this.origin = origin;
    this.axes = axes;
    this.refresh();
  }

  protected drawUnder() {
    const { ctx, W, H, colors, origin, axes } = this;
    if (!axes?.length) return;
    const [mx, my] = origin;
    const x = mx * W, y = my * H;
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    };
    for (const { direction: [u, v], dashed, project } of axes) {
      if (!u && !v) continue;
      if (project) {
        const drops = this.store.points.map(point => {
          const along = (point.x - mx) * u + (point.y - my) * v;
          return { point, px: (mx + along * u) * W, py: (my + along * v) * H };
        });
        ctx.beginPath();
        ctx.strokeStyle = rgb(colors.ink, .28);
        ctx.lineWidth = 1;
        drops.forEach(({ point, px, py }) => line(point.x * W, point.y * H, px, py));
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = rgb(colors.ink, .84);
        ctx.lineWidth = 1.5;
        drops.forEach(({ px, py }) => line(px - 4 * v, py + 4 * u, px + 4 * v, py - 4 * u));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.strokeStyle = rgb(dashed ? colors.ok : colors.ink);
      ctx.lineWidth = dashed ? 1.8 : 2;
      ctx.setLineDash(dashed ? [7, 5] : []);
      line(x - 2 * u * W, y - 2 * v * H, x + 2 * u * W, y + 2 * v * H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.fillStyle = rgb(colors.sheet);
    ctx.strokeStyle = rgb(colors.ink);
    ctx.lineWidth = 1.5;
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  protected drawOver() {
    if (!this.model && this.ghost) {
      const { ctx, ghost, W, H, colors } = this;
      ctx.beginPath();
      ctx.strokeStyle = rgb(colors.ink);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.arc(ghost.x * W, ghost.y * H, 7, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/** Board's class dots use the same color for every unlabelled sample. */
export class UnlabelledBoard extends DimredBoard {
  protected readColors() {
    super.readColors();
    this.colors.a = this.colors.ink;
  }
}
