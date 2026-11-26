import { knn } from '../../engine/models/knn';
import type { Sample } from '../../engine/types';
import { defineScene } from '../scene';
import { label, line } from './svg';

const colors = ['var(--a)', 'var(--b)'];
const positions = [
  [[65, 108], [84, 173], [103, 83], [116, 143], [136, 199], [139, 108], [167, 100], [164, 149], [173, 174]],
  [[227, 136], [235, 104], [263, 82], [265, 178], [281, 128], [306, 147], [313, 197], [322, 100], [344, 160]],
];
const queryX = 198, queryY = 137, k = 5;

export default function knnScene() {
  let points: { dot: SVGCircleElement; edge: SVGLineElement; near: boolean; c: number }[];
  let query: SVGCircleElement;
  let queryLabel: SVGTextElement;
  let votes: SVGGElement;
  let winner: number;

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;
      const grid = el('g');
      for (let x = 35; x <= 365; x += 30) line(api, grid, x, 56, x, 226);
      for (let y = 56; y <= 226; y += 34) line(api, grid, 35, y, 365, y);
      label(api, svg, 200, 35, t('neighbours'), { 'text-anchor': 'middle', class: 'scene-value' });

      const edges = el('g');
      const cloud = el('g');
      const samples = positions.flatMap((group, c) => group.map<Sample>(([x, y]) => ({
        x: (x + 8 * (random() - .5)) / 400, y: (y + 8 * (random() - .5)) / 400, c: c === 0 ? 0 : 1,
      })));
      const model = knn({ k });
      model.fit(samples);
      const nearest = model.neighbours!(queryX / 400, queryY / 400);
      const countA = nearest.filter(point => point.c === 0).length;
      winner = countA > k / 2 ? 0 : 1;

      points = samples.map(sample => {
        const { c } = sample;
        const x = sample.x * 400, y = sample.y * 400;
        return {
          c, near: nearest.includes(sample),
          dot: el('circle', { cx: x, cy: y, r: 5.5, fill: colors[c], class: 'scene-tween' }, cloud),
          edge: line(api, edges, queryX, queryY, x, y, {
            stroke: 'var(--muted)', pathLength: 1, 'stroke-dasharray': '1 1', class: 'scene-tween',
          }),
        };
      });

      query = el('circle', { cx: queryX, cy: queryY, r: 9, stroke: 'var(--paper)', 'stroke-width': 2, class: 'scene-tween' });
      queryLabel = label(api, svg, queryX, 206, t('query'), { 'text-anchor': 'middle', fill: 'var(--muted)', class: 'scene-tween' });
      for (const [i, x] of [56, 246].entries()) {
        el('circle', { cx: x, cy: 264, r: 5.5, fill: colors[i] });
        label(api, svg, x + 16, 270, t(i === 0 ? 'classA' : 'classB'), { fill: 'var(--muted)' });
      }
      votes = el('g', { class: 'scene-tween' });
      label(api, votes, 200, 249, t('votes'), { 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 14 });
      label(api, votes, 158, 270, String(countA), { class: 'scene-value', 'font-weight': 700 });
      label(api, votes, 348, 270, String(k - countA), { class: 'scene-value', 'font-weight': 700 });
    },
    frame(i) {
      for (const { dot, edge, c, near } of points) {
        dot.setAttribute('opacity', i >= 2 && !near ? '0.22' : '1');
        edge.setAttribute('stroke-dashoffset', i === 0 || (i >= 2 && !near) ? '1' : '0');
        edge.setAttribute('stroke', i >= 2 ? colors[c] : 'var(--muted)');
      }
      query.setAttribute('fill', i === 3 ? colors[winner] : 'var(--muted)');
      queryLabel.setAttribute('opacity', i === 0 ? '1' : '0');
      votes.setAttribute('opacity', i === 3 ? '1' : '0');
    },
    loop(i) {
      const animation = i === 0 ? query.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 350 }) : undefined;
      return () => animation?.cancel();
    },
  });
}
