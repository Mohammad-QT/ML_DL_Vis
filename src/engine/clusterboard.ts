import { Board, rgb, type RGB } from './board';
import { nearest, type KMeansState, type Sample } from './clustering';

const inks = ['--a', '--b', '--ok', '--cluster-amber', '--cluster-violet', '--cluster-cyan', '--cluster-rose', '--cluster-olive'];

export const clusterInk = (index: number) => index < inks.length ? `var(${inks[index]})`
  : `hsl(${(index * 137.508) % 360} 48% 50%)`;

export class ClusterBoard extends Board {
  private points: readonly Sample[] = [];
  private groups: readonly number[] = [];
  private state?: KMeansState;
  private palette: RGB[] = [];

  constructor(private element: HTMLCanvasElement, onAdd?: (point: Sample) => void) {
    super(element, { points: [] }, { static: !onAdd, onAdd, dot: onAdd ? 4 : 3 });
  }

  show(points: readonly Sample[], groups: readonly number[], state?: KMeansState) {
    this.points = points;
    this.groups = groups;
    this.state = state;
    this.refresh();
  }

  protected readColors() {
    super.readColors();
    const css = getComputedStyle(this.element);
    this.palette = inks.map(ink => {
      const hex = css.getPropertyValue(ink).trim();
      return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) as RGB;
    });
  }

  protected renderField() {
    super.renderField();
    const centers = this.state?.centers;
    if (!centers?.length) return;
    const field = this.field.getContext('2d')!;
    const tints = this.palette.map(color => rgb(color, .21));
    const cell = 4;
    for (let top = 0; top < this.H; top += cell) for (let left = 0; left < this.W; left += cell) {
      field.fillStyle = tints[nearest({ x: (left + cell / 2) / this.W, y: (top + cell / 2) / this.H }, centers)];
      field.fillRect(left, top, cell, cell);
    }
  }

  protected drawOver() {
    const { ctx, W, H, colors, ghost } = this;
    this.points.forEach((point, index) => {
      const group = this.groups[index];
      ctx.fillStyle = group === undefined ? rgb(colors.ink) : group < inks.length ? rgb(this.palette[group]) : clusterInk(group);
      ctx.strokeStyle = rgb(colors.sheet);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(point.x * W, point.y * H, this.opts.dot ?? 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    });
    this.state?.trails.forEach((trail, index) => {
      const center = this.state!.centers[index];
      const x = center.x * W, y = center.y * H;
      ctx.strokeStyle = rgb(this.palette[index], .75);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); trail.forEach(point => ctx.lineTo(point.x * W, point.y * H)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
      ctx.strokeStyle = rgb(colors.sheet); ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = rgb(this.palette[index]); ctx.lineWidth = 3; ctx.stroke();
    });
    if (ghost && this.kbActive) {
      ctx.strokeStyle = rgb(colors.ink);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ghost.x * W, ghost.y * H, 8, 0, 2 * Math.PI); ctx.stroke();
    }
  }
}
