import { contour, sampleGrid } from '../engine/contour';
import { gradientDescent, gradientDiverged, gradientStep, lineLoss } from '../engine/gradient-descent';
import { RegBoard } from '../engine/regboard';
import { RegStore } from '../engine/regstore';

const ns = 'http://www.w3.org/2000/svg';
const width = 300, height = 210, limit = 200;
const start = { slope: 0, intercept: 0.12 };

export function mountGradientDescent(root: HTMLElement): void {
  const get = <T extends Element = HTMLElement>(name: string) => root.querySelector<T>(`[data-gd-${name}]`)!;
  const figure = root.hasAttribute('data-gd-figure');
  const ui: Record<string, string> = JSON.parse(root.dataset.gdUi!);
  const store = new RegStore({ testFrac: 0 });
  store.preset('line', 8);
  const board = new RegBoard(get<HTMLCanvasElement>('board'), store, { static: true, dot: figure ? 3 : 4 });
  const points = store.points.map(({ x, y }) => ({ x: 2 * x - 1, y: 1 - y }));
  const initial = { ...start, loss: lineLoss(points, start) };
  const path = figure ? gradientDescent(points, 0.2, 25, start).path : [initial];

  if (figure) {
    const last = path[path.length - 1];
    board.setReg({ predict: x => 1 - (last.slope * (2 * x - 1) + last.intercept) });
    return;
  }

  const rate = get<HTMLInputElement>('rate');
  const step = get<HTMLButtonElement>('step');
  const run = get<HTMLButtonElement>('run');
  const status = get('status');
  const contourLines = get<SVGPathElement>('contours');
  const dots = get<SVGGElement>('dots');
  const lossTrace = get<SVGPolylineElement>('loss-trace');
  const format = new Intl.NumberFormat(root.dataset.gdLang, { maximumSignificantDigits: 3 });
  let timer: number | undefined, diverged = false, overshot = false;
  let prevExtent = '';
  const redraw = () => {
    const last = path[path.length - 1];
    const rateValue = 10 ** Number(rate.value);
    const slopeMax = Math.max(0.85, Math.ceil(Math.max(...path.map(point => Math.abs(point.slope))) * 4) / 4);
    const biasMax = Math.max(0.9, Math.ceil(Math.max(...path.map(point => Math.abs(point.intercept))) * 4) / 4);
    const contourX = (slope: number) => 12 + (width - 24) * (slope + slopeMax) / (2 * slopeMax);
    const contourY = (bias: number) => 12 + (height - 24) * (biasMax - bias) / (2 * biasMax);
    const extent = `${slopeMax}:${biasMax}`;
    if (prevExtent !== extent) {
      const grid = sampleGrid((x, y) => lineLoss(points, {
        slope: (x * 2 - 1) * slopeMax,
        intercept: (1 - y * 2) * biasMax,
      }), width - 24, height - 24, 4);
      contourLines.setAttribute('d', [0.005, 0.015, 0.04, 0.1, 0.25, 0.55, 1.2, 2.5, 5, 10, 20, 40, 80]
        .flatMap(value => contour(grid, value)).map(([x0, y0, x1, y1]) =>
          `M${x0 + 12} ${y0 + 12}L${x1 + 12} ${y1 + 12}`).join(' '));
      prevExtent = extent;
    }
    board.setReg({ predict: x => 1 - (last.slope * (2 * x - 1) + last.intercept) });
    dots.replaceChildren(...path.map((point, index) => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', String(contourX(point.slope)));
      dot.setAttribute('cy', String(contourY(point.intercept)));
      dot.setAttribute('r', index === path.length - 1 ? '4' : '2.5');
      dot.setAttribute('fill', index === path.length - 1 ? 'var(--b)' : 'var(--a)');
      return dot;
    }));
    const peak = Math.max(1e-12, ...path.map(point => point.loss));
    lossTrace.setAttribute('points', path.map((point, index) =>
      `${8 + (width - 16) * index / Math.max(1, path.length - 1)},${52 - 44 * point.loss / peak}`).join(' '));
    get('rate-value').textContent = format.format(rateValue);
    get('loss-value').textContent = format.format(last.loss);
    get('step-value').textContent = format.format(path.length - 1);
    step.disabled = diverged || path.length > limit || timer != null;
    run.disabled = diverged || path.length > limit;
    run.textContent = timer == null ? ui.run : ui.pause;
    const message = diverged ? ui.diverged : path.length > limit ? ui.capped
      : overshot ? ui.overshoot : rateValue < 0.01 ? ui.slow : ui.ready;
    if (status.textContent !== message) status.textContent = message;
  };

  const pause = () => { window.clearInterval(timer); timer = undefined; };
  const advance = () => {
    const previous = path[path.length - 1];
    const next = gradientStep(points, previous, 10 ** Number(rate.value));
    overshot = next.loss > previous.loss + 1e-9;
    if (Number.isFinite(next.loss)) path.push(next);
    diverged = gradientDiverged(next, initial);
    if (diverged || path.length > limit) pause();
    redraw();
  };
  step.addEventListener('click', advance);
  run.addEventListener('click', () => {
    if (timer == null) timer = window.setInterval(advance, 105);
    else pause();
    redraw();
  });
  get('reset').addEventListener('click', () => {
    pause();
    path.splice(1);
    diverged = overshot = false;
    redraw();
  });
  rate.addEventListener('input', () => {
    if (diverged) {
      diverged = false;
      path.splice(1);
    }
    overshot = false;
    redraw();
  });
  redraw();
}
