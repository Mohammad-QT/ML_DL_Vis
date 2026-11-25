import { gauss, rng } from '../engine/random';
import { RegBoard } from '../engine/regboard';
import { fitRegularized, mse, type Penalty } from '../engine/regularization';
import type { Point } from '../engine/types';

const ns = 'http://www.w3.org/2000/svg';
const trend = (x: number) => 0.52 - 0.27 * Math.sin(2 * Math.PI * x);

function demoPoints(): Point[] {
  const random = rng(16);
  const train = Array.from({ length: 18 }, (_, index): Point => {
    const x = 0.12 + (index + 0.6 * random()) * 0.76 / 18;
    return { x, y: trend(x) + 0.05 * gauss(random), c: 0, test: false };
  });
  const test = Array.from({ length: 21 }, (_, index): Point => {
    const x = 0.025 + index * 0.95 / 20;
    return { x, y: trend(x) + 0.025 * gauss(random), c: 0, test: true };
  });
  return [...train, ...test];
}

export function mountRegularization(root: HTMLElement): void {
  const get = <T extends Element = HTMLElement>(name: string) => root.querySelector<T>(`[data-regz-${name}]`)!;
  const figure = root.hasAttribute('data-regz-figure');
  const points = demoPoints();
  const train = points.filter(point => !point.test), test = points.filter(point => point.test);
  const board = new RegBoard(get<HTMLCanvasElement>('board'), { points }, { static: true, dot: figure ? 3 : 4 });
  if (figure) {
    board.setReg(fitRegularized(train, 9, 'ridge', 0.01));
    return;
  }

  const degree = get<HTMLInputElement>('degree');
  const penaltyInput = get<HTMLSelectElement>('penalty');
  const strength = get<HTMLInputElement>('alpha');
  const bars = get<SVGGElement>('bars');
  const format = new Intl.NumberFormat(root.dataset.regzLang, { maximumSignificantDigits: 3 });
  const redraw = () => {
    const order = Number(degree.value);
    const alpha = strength.value === strength.min ? 0 : 10 ** Number(strength.value);
    const penalty = penaltyInput.value as Penalty;
    const model = fitRegularized(train, order, penalty, alpha);
    board.setReg(model);
    get('degree-value').textContent = format.format(order);
    get('alpha-value').textContent = format.format(alpha);
    get('train').textContent = format.format(mse(model, train)!);
    get('test').textContent = format.format(mse(model, test)!);
    get('zeros').textContent = format.format(model.weights.filter(weight => weight === 0).length);
    const max = Math.max(0.25, ...model.weights.map(Math.abs));
    get('axis-high').textContent = format.format(max);
    get('axis-low').textContent = format.format(-max);
    const spacing = 250 / order;
    bars.replaceChildren(...model.weights.map((weight, index) => {
      const offset = 45 + (index + 0.5) * spacing;
      const magnitude = Math.abs(weight / max) * 61;
      const group = document.createElementNS(ns, 'g');
      const title = document.createElementNS(ns, 'title');
      title.textContent = `T${index + 1}: ${format.format(weight)}`;
      const bar = document.createElementNS(ns, 'rect');
      const barWidth = Math.min(17, spacing * 0.68);
      bar.setAttribute('x', String(offset - barWidth / 2));
      bar.setAttribute('y', String(weight === 0 ? 74 : weight > 0 ? 75 - magnitude : 75));
      bar.setAttribute('width', String(barWidth));
      bar.setAttribute('height', String(weight === 0 ? 2 : magnitude));
      bar.setAttribute('fill', weight === 0 ? 'var(--muted)' : weight > 0 ? 'var(--a)' : 'var(--b)');
      if (weight === 0) bar.setAttribute('data-regz-zero', '');
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', String(offset));
      label.setAttribute('y', '149');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = String(index + 1);
      group.append(title, bar, label);
      return group;
    }));
  };
  degree.addEventListener('input', redraw);
  strength.addEventListener('input', redraw);
  penaltyInput.addEventListener('change', redraw);
  redraw();
}
