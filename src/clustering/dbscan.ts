import { clusterPoints, CLUSTER_PRESETS, nearest } from '../engine/clustering';
import { dbscan, type DbscanPointType } from '../engine/dbscan';

export const DBSCAN_PRESETS = ['noisy', ...CLUSTER_PRESETS] as const;
export type DbscanPreset = (typeof DBSCAN_PRESETS)[number];
export const DBSCAN_INITIAL = { preset: 'noisy', eps: .12, minPts: 4 } as const;
export const DBSCAN_SIZE = 300;

export const dbscanPoints = (preset: DbscanPreset) => preset !== 'noisy' ? clusterPoints(preset) : [
  ...clusterPoints('three'),
  ...[[.06, .08], [.51, .13], [.94, .06], [.08, .78], [.93, .78], [.82, .56], [.29, .55], [.12, .55]]
    .map(([x, y]) => ({ x, y })),
];

export const DBSCAN_MARKS = {
  core: 'M-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0Z',
  border: 'M-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0Z',
  noise: 'M-2-2l4 4M2-2l-4 4',
} satisfies Record<DbscanPointType, string>;

const colors = ['--a', '--b', '--ok', '--ink', '--hl'];
export const dbscanInk = (label: number) => label < 0 ? 'var(--muted)' : `var(${colors[label % colors.length]})`;

export function mountDbscan(root: HTMLElement) {
  const get = <T extends Element = HTMLElement>(key: string) => root.querySelector<T>(`[data-dbscan-${key}]`)!;
  const board = get<SVGSVGElement>('board');
  const marks = get<SVGGElement>('marks');
  const ring = get<SVGCircleElement>('radius');
  const preset = get<HTMLSelectElement>('preset');
  const eps = get<HTMLInputElement>('eps');
  const minPts = get<HTMLInputElement>('minpts');
  const locale = root.dataset.dbscanLang;
  const integer = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 2 });
  let points = dbscanPoints(preset.value as DbscanPreset);
  let inspected = -1;
  let activePointer: number | undefined;

  const paintRadius = () => {
    const point = points[inspected];
    ring.toggleAttribute('data-dbscan-hidden', !point);
    if (!point) return;
    ring.setAttribute('cx', String(point.x * DBSCAN_SIZE));
    ring.setAttribute('cy', String(point.y * DBSCAN_SIZE));
    ring.setAttribute('r', String(eps.valueAsNumber * DBSCAN_SIZE));
  };

  const redraw = () => {
    const result = dbscan(points, eps.valueAsNumber, minPts.valueAsNumber);
    marks.replaceChildren(...points.map((point, index) => {
      const type = result.types[index];
      const color = dbscanInk(result.labels[index]);
      const mark = document.createElementNS(board.namespaceURI, 'path');
      mark.setAttribute('d', DBSCAN_MARKS[type]);
      mark.setAttribute('transform', `translate(${point.x * DBSCAN_SIZE} ${point.y * DBSCAN_SIZE})`);
      mark.setAttribute('data-dbscan-type', type);
      mark.setAttribute('fill', type === 'core' ? color : type === 'border' ? 'var(--sheet)' : 'none');
      mark.setAttribute('stroke', type === 'core' ? 'var(--sheet)' : color);
      return mark;
    }));
    get('clusters').textContent = integer.format(result.count);
    get('noise').textContent = integer.format(result.noise);
    get('eps-value').textContent = decimal.format(eps.valueAsNumber);
    get('minpts-value').textContent = integer.format(minPts.valueAsNumber);
    paintRadius();
  };

  const inspect = (event: PointerEvent) => {
    const box = board.getBoundingClientRect();
    if (!box.width || !box.height) return;
    inspected = nearest({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }, points);
    paintRadius();
  };

  board.addEventListener('pointerdown', event => {
    if (event.button !== 0 || activePointer !== undefined) return;
    activePointer = event.pointerId;
    board.setPointerCapture?.(event.pointerId);
    inspect(event);
  });
  board.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' || event.pointerId === activePointer) inspect(event);
  });
  board.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') { inspected = -1; paintRadius(); }
  });
  board.addEventListener('lostpointercapture', () => { activePointer = undefined; });
  for (const type of ['pointerup', 'pointercancel'] as const) {
    board.addEventListener(type, event => {
      if (event.pointerId === activePointer) activePointer = undefined;
    });
  }
  board.addEventListener('keydown', event => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    inspected = inspected < 0 ? 0 : (inspected + delta + points.length) % points.length;
    paintRadius();
  });
  board.addEventListener('blur', () => { inspected = -1; paintRadius(); });

  const reset = () => {
    points = dbscanPoints(preset.value as DbscanPreset);
    eps.value = String(DBSCAN_INITIAL.eps);
    minPts.value = String(DBSCAN_INITIAL.minPts);
    inspected = -1;
    redraw();
  };
  preset.addEventListener('change', reset);
  eps.addEventListener('input', redraw);
  minPts.addEventListener('input', redraw);
  get('reset').addEventListener('click', reset);
  redraw();
}
