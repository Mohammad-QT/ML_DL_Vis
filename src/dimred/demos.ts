import { Board } from '../engine/board';
import { kernelPca, lda, MAX_KERNEL_POINTS, pca } from '../engine/dimred';
import { DimredBoard, UnlabelledBoard } from '../engine/dimredboard';
import { fitModel } from '../engine/models';
import { gauss, rng } from '../engine/random';
import { score } from '../engine/score';
import { PRESETS, Store } from '../engine/store';
import type { Label, Point, Sample } from '../engine/types';
import type { DimredId } from '../lessons';

const seed = 42;
const clamp = (value: number) => Math.max(.02, Math.min(.98, value));
const dot = (x: readonly number[], y: readonly number[]) => x.reduce((sum, value, i) => sum + value * y[i], 0);

function presetPoints(demo: DimredId, preset: string): Sample[] {
  const random = rng(seed);
  if (demo === 'pca') {
    if (preset === 'blobs') return PRESETS.blobs(random).map(point => ({ ...point, c: 0 }));
    const along = preset === 'round' ? .12 : .19;
    const across = preset === 'round' ? .12 : .045;
    return Array.from({ length: 55 }, () => {
      const u = gauss(random) * along, v = gauss(random) * across;
      return { x: .5 + .8 * u - .6 * v, y: .5 + .6 * u + .8 * v, c: 0 };
    });
  }
  if (demo === 'lda') {
    return Array.from({ length: 60 }, (_, i) => {
      const c = (i % 2) as Label, sign = c ? 1 : -1;
      const x = gauss(random), y = gauss(random);
      if (preset === 'pca_wins') return { x: .5 + sign * .25 + x * .055, y: .5 + y * .10, c };
      if (preset === 'overlap') return { x: .5 + sign * .035 + x * .14, y: .5 + y * .12, c };
      return { x: .5 + x * .20, y: .5 + sign * .085 + y * .017, c };
    });
  }
  if (preset === 'moons' || preset === 'xor') return PRESETS[preset](random);
  return Array.from({ length: 88 }, (_, i) => {
    const c = (i % 2) as Label;
    const angle = 2 * Math.PI * (Math.floor(i / 2) + c / 2) / 44;
    const radius = (c ? .10 : .36) + gauss(random) * .008;
    return { x: .5 + radius * Math.cos(angle), y: .5 + radius * Math.sin(angle), c };
  });
}

const svgNode = (tag: string, attrs: Record<string, string | number>) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
};

function drawStrip(svg: SVGSVGElement, samples: Point[], scores: number[][]) {
  const bound = Math.max(...scores.map(([value]) => Math.abs(value)), Number.EPSILON);
  const line = svgNode('path', { d: 'M10 14H290M150 7V21', stroke: 'var(--muted)', fill: 'none' });
  const dots = scores.map(([value], i) => svgNode('circle', {
    cx: 150 + 134 * value / bound, cy: samples[i].c ? 17 : 11, r: 3.2,
    fill: samples[i].c ? 'var(--b)' : 'var(--a)', opacity: .83,
  }));
  svg.replaceChildren(line, ...dots);
}

function thresholdAccuracy(values: number[][], points: Point[]): number | null {
  if (new Set(points.map(point => point.c)).size < 2) return null;
  const ordered = values.map(([value], i) => ({ value, label: points[i].c }))
    .sort((a, b) => a.value - b.value);
  // Move a cut left to right and score both ways of assigning classes to its sides.
  let correct = ordered.filter(point => point.label === 1).length;
  let best = Math.max(correct, ordered.length - correct);
  ordered.forEach((point, i) => {
    correct += point.label === 0 ? 1 : -1;
    if (point.value !== ordered[i + 1]?.value) best = Math.max(best, correct, ordered.length - correct);
  });
  return best / ordered.length;
}

export function mountDimred(root: HTMLElement) {
  const get = <T extends Element = HTMLElement>(role: string) => root.querySelector<T>(`[data-dimred-${role}]`)!;
  const demo = root.dataset.dimred as DimredId;
  const figure = root.hasAttribute('data-dimred-figure');
  const percent = new Intl.NumberFormat(root.dataset.dimredLang, { style: 'percent' });
  const number = new Intl.NumberFormat(root.dataset.dimredLang, { maximumFractionDigits: 1 });
  const report = (element: HTMLElement, value: number | null) => {
    element.textContent = value === null
      ? element.dataset.dimredEmpty ?? '–'
      : element.dataset.dimredTemplate!.replace('{n}', percent.format(value));
  };
  const store = new Store({ testFrac: 0 });
  const canvas = get<HTMLCanvasElement>('input');
  const status = get('status');
  let preset = demo === 'pca' ? 'stretched' : demo === 'lda' ? 'lda_wins' : 'circles';
  let label: Label = 0;
  const onAdd = (point: { x: number; y: number }, event: MouseEvent) => {
    if (store.points.length >= MAX_KERNEL_POINTS) {
      status.textContent = status.dataset.dimredLimit!;
      return;
    }
    const selected = demo === 'pca' ? 0 : (event.shiftKey ? 1 - label : label) as Label;
    store.add(clamp(point.x), clamp(point.y), selected);
  };
  const opts = { static: figure, onAdd: figure ? undefined : onAdd, dot: figure ? 2.7 : 4 };
  const board = demo === 'pca' ? new UnlabelledBoard(canvas, store, opts) : new DimredBoard(canvas, store, opts);
  const rows = () => store.points.map(point => [point.x, point.y]);

  const load = () => {
    if (status) status.textContent = '';
    store.load(presetPoints(demo, preset).map(point => ({ ...point, x: clamp(point.x), y: clamp(point.y) })), seed);
  };
  if (!figure) {
    const select = (buttons: HTMLButtonElement[], selected: HTMLButtonElement) => {
      buttons.forEach(button => {
        button.classList.toggle('on', button === selected);
        button.setAttribute('aria-pressed', String(button === selected));
      });
    };
    const presets = [...root.querySelectorAll<HTMLButtonElement>('[data-dimred-preset]')];
    const pick = (button: HTMLButtonElement) => {
      preset = button.dataset.dimredPreset!;
      select(presets, button);
      load();
    };
    presets.forEach(button => {
      button.addEventListener('click', () => pick(button));
      if (demo === 'pca') button.addEventListener('dragstart', event => {
        event.dataTransfer?.setData('application/x-mlv-dimred-preset', button.dataset.dimredPreset!);
      });
    });
    if (demo === 'pca') {
      canvas.addEventListener('dragover', event => {
        if (event.dataTransfer?.types.includes('application/x-mlv-dimred-preset')) event.preventDefault();
      });
      canvas.addEventListener('drop', event => {
        const id = event.dataTransfer?.getData('application/x-mlv-dimred-preset');
        const button = presets.find(item => item.dataset.dimredPreset === id);
        if (button) { event.preventDefault(); pick(button); }
      });
    }
    const classes = [...root.querySelectorAll<HTMLButtonElement>('[data-dimred-class]')];
    classes.forEach(button => button.addEventListener('click', () => {
      label = Number(button.dataset.dimredClass) as Label;
      select(classes, button);
    }));
    get('reset').addEventListener('click', load);
  }

  if (demo === 'pca') {
    const slider = get<HTMLInputElement>('angle');
    let fit: ReturnType<typeof pca>;
    let centered: number[][];
    let total: number;
    let animation = 0;
    const paint = () => {
      const best = { direction: fit.directions[0], project: true };
      if (figure) { board.showAxes(fit.mean, [best]); return; }
      const angle = slider.valueAsNumber;
      const radians = angle * Math.PI / 180;
      const candidate = [Math.cos(radians), Math.sin(radians)];
      const kept = centered.reduce((sum, row) => sum + dot(row, candidate) ** 2, 0);
      board.showAxes(fit.mean, [{ direction: candidate, dashed: true }, best]);
      get('angle-value').textContent = `${number.format(angle)}°`;
      report(get('variance'), total ? kept / total : 0);
    };
    store.subscribe(() => {
      const data = rows();
      fit = pca(data);
      centered = data.map(row => row.map((value, i) => value - fit.mean[i]));
      total = centered.reduce((sum, row) => sum + dot(row, row), 0);
      if (!figure) {
        cancelAnimationFrame(animation);
        ['pc1', 'pc2'].forEach((key, i) => {
          get(`${key}-value`).textContent = percent.format(fit.explained[i]);
          get(`${key}-bar`).style.width = `${fit.explained[i] * 100}%`;
        });
      }
      paint();
    });
    if (!figure) {
      slider.addEventListener('input', () => { cancelAnimationFrame(animation); paint(); });
      get('snap').addEventListener('click', () => {
        cancelAnimationFrame(animation);
        const start = slider.valueAsNumber;
        const [x, y] = fit.directions[0];
        const angle = Math.atan2(y, x) * 180 / Math.PI;
        const target = [angle - 180, angle, angle + 180].filter(value => Math.abs(value) <= 180)
          .sort((a, b) => Math.abs(a - start) - Math.abs(b - start))[0];
        if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
          slider.value = String(target);
          paint();
          return;
        }
        const begin = performance.now();
        const step = (time: number) => {
          const progress = Math.min(1, (time - begin) / 360);
          slider.value = String(start + (target - start) * (1 - (1 - progress) ** 3));
          paint();
          if (progress < 1) animation = requestAnimationFrame(step);
        };
        animation = requestAnimationFrame(step);
      });
    }
  } else if (demo === 'lda') {
    store.subscribe(() => {
      const data = rows(), labels = store.points.map(point => point.c);
      const linear = pca(data, 1);
      const fisher = lda(data, labels, 1);
      const axes = [{ direction: linear.directions[0], dashed: true }];
      if (fisher.directions.length) axes.push({ direction: fisher.directions[0], dashed: false });
      board.showAxes(linear.mean, axes);
      for (const [id, scores] of [['pca', linear.scores], ['lda', fisher.directions.length ? fisher.scores : []]] as const) {
        drawStrip(get<SVGSVGElement>(`strip="${id}"`), store.points, scores);
        if (!figure) report(get(`separation="${id}"`), scores.length ? thresholdAccuracy(scores, store.points) : null);
      }
    });
  } else {
    const slider = get<HTMLInputElement>('gamma');
    const projection = { points: [] as Point[] };
    const projectedBoard = new Board(get<HTMLCanvasElement>('output'), projection, { static: true, dot: opts.dot });
    const redraw = () => {
      const gamma = 10 ** (figure ? 1.4 : slider.valueAsNumber);
      const { scores } = kernelPca(rows(), gamma);
      // Scale both axes together so that the plot preserves distances and relative spread.
      const bound = Math.max(...scores.flat().map(Math.abs), Number.EPSILON) / .42;
      projection.points = scores.map(([x = 0, y = 0], i) => ({ ...store.points[i], x: .5 + x / bound, y: .5 - y / bound }));
      const model = fitModel('logistic', {}, projection.points);
      projectedBoard.setModel(model);
      if (!figure) {
        get('gamma-value').textContent = number.format(gamma);
        report(get('projected-score'), score(model, projection.points));
      }
    };
    store.subscribe(() => {
      const model = fitModel('logistic', {}, store.points);
      board.setModel(model);
      if (!figure) report(get('original-score'), score(model, store.points));
      redraw();
    });
    if (!figure) {
      let frame = 0;
      slider.addEventListener('input', () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(redraw);
      });
    }
  }
  load();
}
