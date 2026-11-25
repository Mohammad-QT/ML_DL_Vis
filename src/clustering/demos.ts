import { ClusterBoard, clusterInk } from '../engine/clusterboard';
import { clusterPoints, cutWard, elbow, initKMeans, runKMeans, stepKMeans, ward, type ClusterPreset, type WardNode } from '../engine/clustering';
import { randomSeed } from '../engine/random';

const svgNode = (tag: string, attrs: Record<string, string | number>, text?: string) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text !== undefined) node.textContent = text;
  return node;
};

function drawElbow(svg: SVGSVGElement, scores: number[], k: number) {
  const top = 16, bottom = 177, left = 50, right = 279;
  const max = scores[0] || 1;
  const x = (index: number) => left + index * (right - left) / 7;
  const y = (score: number) => bottom - score / max * (bottom - top);
  const text = { fill: 'var(--muted)', 'font-size': 11, 'font-family': 'var(--mono)' };
  svg.replaceChildren(svgNode('path', { d: `M${left} ${top}V${bottom}H${right}`, fill: 'none', stroke: 'var(--muted)' }),
    svgNode('text', { ...text, x: right, y: 202 }, 'K'));
  [0, .5, 1].forEach(frac => {
    svg.append(svgNode('text', { ...text, x: left - 5, y: y(max * frac) + 4, 'text-anchor': 'end' }, (max * frac).toFixed(2)));
  });
  svg.append(svgNode('polyline', { points: scores.map((score, index) => `${x(index)},${y(score)}`).join(' '),
    fill: 'none', stroke: 'var(--a)', 'stroke-width': 2 }));
  scores.forEach((score, index) => {
    const dot = svgNode('circle', { cx: x(index), cy: y(score), r: 4, stroke: 'var(--a)', fill: index + 1 === k ? 'var(--hl)' : 'var(--a)' });
    dot.append(svgNode('title', {}, `K = ${index + 1} · WCSS = ${score.toFixed(3)}`));
    svg.append(dot, svgNode('text', { ...text, x: x(index), y: 193, 'text-anchor': 'middle' }, String(index + 1)));
  });
}

const treeTop = 12, treeBottom = 195, initialCut = .42;

function drawDendrogram(svg: SVGSVGElement, tree: WardNode, position: number) {
  const max = (tree.height || 1) * 1.1;
  const min = -max * .025;
  const height = min + (max - min) * position;
  const y = (value: number) => treeBottom - (value - min) / (max - min) * (treeBottom - treeTop);
  const { labels, count } = cutWard(tree, height);
  const parts: SVGElement[] = [];
  const line = (path: string, ink: string) => parts.push(svgNode('path', { d: path, stroke: ink, 'stroke-width': 1.5, fill: 'none' }));
  let leaf = 0;
  function branch(node: WardNode, parentHeight: number): number {
    let x: number;
    const ink = (sample: WardNode): string => sample.children ? ink(sample.children[0]) : clusterInk(labels[sample.id]);
    if (node.children) {
      const [left, right] = node.children.map(child => branch(child, node.height));
      line(`M${left} ${y(node.height)}H${right}`, node.height <= height ? ink(node) : 'var(--muted)');
      x = (left + right) / 2;
    } else {
      x = 18 + 258 * leaf++ / Math.max(1, tree.size - 1);
      line(`M${x} ${treeBottom}V${y(0)}`, ink(node));
    }
    const start = Math.max(node.height, Math.min(parentHeight, height));
    line(`M${x} ${y(node.height)}V${y(start)}`, node.height <= height ? ink(node) : 'var(--muted)');
    if (start < parentHeight) line(`M${x} ${y(start)}V${y(parentHeight)}`, 'var(--muted)');
    return x;
  }
  branch(tree, max);
  svg.querySelector('[data-branches]')!.replaceChildren(...parts);
  svg.querySelector('[data-cut]')!.setAttribute('transform', `translate(0 ${y(height)})`);
  return { labels, count };
}

export function mountCluster(root: HTMLElement) {
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const means = root.dataset.cluster === 'kmeans';
  const canvas = get<HTMLCanvasElement>('canvas');
  const figure = root.hasAttribute('data-figure');
  let points = clusterPoints('three', !means);
  if (figure) {
    const board = new ClusterBoard(canvas);
    if (means) {
      board.show(points, [], runKMeans(points, initKMeans(points, 3, 42)));
    } else {
      const { labels } = drawDendrogram(get<SVGSVGElement>('[data-tree]'), ward(points)!, initialCut);
      board.show(points, labels);
    }
    return;
  }

  const maxPoints = 120;
  const status = get('[data-state]');
  const reset = get<HTMLButtonElement>('[data-reset]');
  const board = new ClusterBoard(canvas, point => {
    if (points.length >= maxPoints) { status.textContent = root.dataset.limit!; return; }
    points.push({ x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)) });
    rebuild();
  });
  let rebuild: () => void;
  if (means) {
    const slider = get<HTMLInputElement>('[data-k]');
    const preset = get<HTMLSelectElement>('[data-preset]');
    const step = get<HTMLButtonElement>('[data-step-once]');
    const run = get<HTMLButtonElement>('[data-run]');
    const chart = get<SVGSVGElement>('[data-elbow]');
    let seed = 42, scores: number[] = [];
    let state = initKMeans(points, slider.valueAsNumber, seed);
    const paint = () => {
      board.show(points, [], state);
      get('[data-k-value]').textContent = slider.value;
      step.disabled = run.disabled = state.converged;
      status.textContent = root.dataset.status!.replace('{n}', String(state.iteration)) + (state.converged ? ` · ${root.dataset.done}` : '');
      drawElbow(chart, scores, slider.valueAsNumber);
    };
    const restart = () => { state = initKMeans(points, slider.valueAsNumber, seed); paint(); };
    rebuild = () => { scores = elbow(points, 8, 42); restart(); };
    slider.addEventListener('input', restart);
    const resetPoints = () => { points = clusterPoints(preset.value as ClusterPreset); seed = 42; rebuild(); };
    preset.addEventListener('change', resetPoints);
    reset.addEventListener('click', resetPoints);
    step.addEventListener('click', () => { state = stepKMeans(points, state); paint(); });
    run.addEventListener('click', () => { state = runKMeans(points, state); paint(); });
    get('[data-reseed]').addEventListener('click', () => { seed = randomSeed(); restart(); });
  } else {
    const svg = get<SVGSVGElement>('[data-tree]');
    const cut = get<SVGGElement>('[data-cut]');
    let tree: WardNode, position = initialCut;
    const paint = () => {
      const { labels, count } = drawDendrogram(svg, tree, position);
      const message = root.dataset.count!.replace('{n}', String(count));
      cut.setAttribute('aria-valuenow', String(Math.round(position * 100)));
      cut.setAttribute('aria-valuetext', message);
      status.textContent = message;
      board.show(points, labels);
    };
    const move = (event: PointerEvent) => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      position = Math.max(0, Math.min(1, (treeBottom - point.y) / (treeBottom - treeTop)));
      paint();
    };
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      cut.focus(); svg.setPointerCapture(event.pointerId); move(event);
    });
    svg.addEventListener('pointermove', event => { if (svg.hasPointerCapture(event.pointerId)) move(event); });
    cut.addEventListener('keydown', event => {
      const delta = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? .015 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -.015 : 0;
      if (!delta && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      position = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : Math.max(0, Math.min(1, position + delta));
      paint();
    });
    rebuild = () => { tree = ward(points)!; paint(); };
    reset.addEventListener('click', () => { points = clusterPoints('three', true); position = initialCut; rebuild(); });
  }
  rebuild();
}
