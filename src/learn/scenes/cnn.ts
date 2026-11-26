import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const pixels = [
  '00000000', '00111000', '00001100', '00001000',
  '00111000', '00001100', '00111000', '00000000',
].map(row => [...row].map(Number));

// Trace one horizontal-stroke filter, then keep the maximum of each non-overlapping patch.
const features = Array.from({ length: 6 }, (_, y) => Array.from({ length: 6 }, (_, x) =>
  Math.max(0, (pixels[y + 1][x] + pixels[y + 1][x + 1] + pixels[y + 1][x + 2]
    - .5 * (pixels[y][x + 1] + pixels[y + 2][x + 1])) / 3)));
const pooled = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) =>
  Math.max(features[2 * y][2 * x], features[2 * y][2 * x + 1], features[2 * y + 1][2 * x], features[2 * y + 1][2 * x + 1])));
const second = [
  [[.4, .7], [.8, .1]],
  [[.2, .6], [.5, .9]],
  [[.7, .4], [.9, .2]],
];
const scores = [.08, .04, .23, .88, .07, .29, .05, .11, .17, .12];

function grid(api: SceneApi, parent: Element, values: number[][], x: number, y: number, size: number) {
  return values.flatMap((row, r) => row.map((value, c) => {
    api.el('rect', { x: x + c * size, y: y + r * size, width: size, height: size, fill: 'var(--sheet)', stroke: 'var(--rule)' }, parent);
    return api.el('rect', { x: x + c * size + 1, y: y + r * size + 1, width: size - 2, height: size - 2, fill: 'var(--a)', opacity: value }, parent);
  }));
}

function arrow(api: SceneApi, parent: Element, x: number, y: number, tip: number) {
  const style = { stroke: 'var(--muted)' };
  line(api, parent, x, y, tip, y, style);
  line(api, parent, tip - 7, y - 6, tip, y, style);
  line(api, parent, tip - 7, y + 6, tip, y, style);
}

export default function cnnScene() {
  const frames: SVGGElement[] = [];
  const bars: SVGRectElement[] = [];
  let window: SVGRectElement;
  let cells: SVGRectElement[];
  let poolCells: SVGRectElement[];
  let merging: SVGRectElement[];

  function reveal(count: number) {
    const index = Math.min(count, cells.length - 1);
    window.setAttribute('x', String(30 + 19 * (index % 6)));
    window.setAttribute('y', String(73 + 19 * Math.floor(index / 6)));
    cells.forEach((cell, i) => cell.style.visibility = i < count ? 'visible' : 'hidden');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, t } = api;
      for (let i = 0; i < 4; i++) frames.push(el('g', { class: 'scene-tween' }));
      const [convolution, pooling, stacking, scoring] = frames;
      const title = (parent: Element, x: number, y: number, key: string) =>
        label(api, parent, x, y, t(key), { 'text-anchor': 'middle', 'font-weight': 700 });

      title(convolution, 106, 49, 'pixels');
      title(convolution, 306, 49, 'featureMap');
      grid(api, convolution, pixels, 30, 73, 19);
      cells = grid(api, convolution, features, 246, 89, 20);
      arrow(api, convolution, 195, 147, 231);
      window = el('rect', { width: 57, height: 57, rx: 3, fill: 'none', stroke: 'var(--b)', 'stroke-width': 2, class: 'scene-filter' }, convolution);
      title(convolution, 200, 264, 'filter');

      title(pooling, 100, 51, 'featureMap');
      title(pooling, 299, 51, 'pooled');
      grid(api, pooling, features, 34, 79, 22);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
        el('rect', { x: 34 + 44 * x, y: 79 + 44 * y, width: 44, height: 44, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5 }, pooling);
      }
      poolCells = grid(api, pooling, pooled, 242, 88, 38);
      arrow(api, pooling, 183, 145, 225);
      title(pooling, 200, 254, 'pool');
      merging = pooled.flatMap((row, r) => row.map((value, c) => {
        const match = [0, 1, 2, 3].findIndex(i => features[2 * r + Math.floor(i / 2)][2 * c + (i % 2)] === value);
        return el('rect', {
          x: 35 + 44 * c + 22 * (match % 2), y: 80 + 44 * r + 22 * Math.floor(match / 2),
          width: 20, height: 20, fill: 'var(--a)', opacity: 0,
        }, pooling);
      }));

      title(stacking, 96, 57, 'pooled');
      title(stacking, 293, 57, 'maps');
      grid(api, stacking, pooled, 39, 92, 38);
      arrow(api, stacking, 171, 148, 222);
      second.forEach((map, i) => grid(api, stacking, map, 257 + i * 15, 99 + (2 - i) * 20, 33));

      title(scoring, 71, 31, 'maps');
      title(scoring, 173, 31, 'flatten');
      title(scoring, 308, 31, 'prediction');
      second.forEach((map, i) => grid(api, scoring, map, 42, 53 + i * 74, 24));
      arrow(api, scoring, 101, 148, 146);
      grid(api, scoring, second.flat(2).map(value => [value]), 164, 53, 16);
      arrow(api, scoring, 188, 148, 220);
      scores.forEach((score, i) => {
        const y = 53 + i * 21;
        label(api, scoring, 234, y + 12, String(i), { class: 'scene-value', 'font-size': 15, 'font-weight': i === 3 ? 700 : 500 });
        el('rect', { x: 253, y, width: 116, height: 14, rx: 4, fill: 'var(--rule)' }, scoring);
        const bar = el('rect', { x: 253, y, width: 116 * score, height: 14, rx: 4, fill: i === 3 ? 'var(--b)' : 'var(--a)', class: 'scene-tween' }, scoring);
        bar.style.transformOrigin = '253px 0';
        bars.push(bar);
      });
    },
    frame(i) {
      frames.forEach((group, index) => group.setAttribute('opacity', index === i ? '1' : '0'));
      bars.forEach(bar => bar.setAttribute('transform', i === 3 ? 'scale(1 1)' : 'scale(0 1)'));
      if (i === 0) reveal(cells.length);
    },
    loop(i, { svg }) {
      if (i === 0) {
        const browser = svg.ownerDocument.defaultView!;
        let count = 0;
        reveal(count);
        const scan = browser.setInterval(() => {
          count = (count + 1) % (cells.length + 7);
          reveal(Math.min(count, cells.length));
        }, 65);
        return () => browser.clearInterval(scan);
      }
      if (i === 1) {
        const animations: Animation[] = [];
        for (const [n, cell] of merging.entries()) {
          const [destination, value] = [poolCells[n], Number(poolCells[n].getAttribute('opacity'))];
          const dx = Number(destination.getAttribute('x')) - Number(cell.getAttribute('x')) + 8;
          const dy = Number(destination.getAttribute('y')) - Number(cell.getAttribute('y')) + 8;
          const delay = n * 65;
          const move = cell.animate?.([
            { opacity: 0, transform: 'translate(0, 0)' },
            { opacity: value, offset: .15 },
            { opacity: value, offset: .85 },
            { opacity: 0, transform: `translate(${dx}px, ${dy}px)` },
          ], { duration: 440, delay });
          const appear = destination.animate?.([{ opacity: 0 }, { opacity: value }], { duration: 200, delay: delay + 340, fill: 'backwards' });
          if (move) animations.push(move);
          if (appear) animations.push(appear);
        }
        return () => animations.forEach(animation => animation.cancel());
      }
      return () => {};
    },
  });
}
