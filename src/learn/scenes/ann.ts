import { Mlp, activate } from '../../engine/mlp';
import { defineScene } from '../scene';
import { label, line } from './svg';

const layers = [
  [{ x: 55, y: 99 }, { x: 55, y: 155 }],
  [{ x: 170, y: 72 }, { x: 170, y: 127 }, { x: 170, y: 182 }],
  [{ x: 287, y: 127 }],
];
const input = [-.7, .75];
const target = 1;

// Use the normal of the local decision line to show how training turns it.
function boundaryAngle(net: Mlp) {
  const dx = net.prob1([.01, 0]) - net.prob1([-.01, 0]);
  const dy = net.prob1([0, .01]) - net.prob1([0, -.01]);
  return Math.atan2(dx, dy) * 180 / Math.PI;
}

export default function annScene() {
  const net = new Mlp({ inputs: 2, hidden: [3], activation: 'tanh', seed: 23 });
  net.layers[0].w.set([.85, .1, -.25, .9, .45, .2]);
  net.layers[0].b.set([.1, -.1, .05]);
  net.layers[1].w.set([.5, .3, .35]);
  net.layers[1].b.set([-.1]);
  const hiddenSums = Array.from(net.layers[0].b, (b, i) => b + net.layers[0].w[2 * i] * input[0] + net.layers[0].w[2 * i + 1] * input[1]);
  const hidden = hiddenSums.map(sum => activate('tanh', sum));
  const outputSum = hidden.reduce((sum, value, i) => sum + value * net.layers[1].w[i], net.layers[1].b[0]);
  const sums = [input, hiddenSums, [outputSum]];
  const output = net.prob1(input);
  const loss = net.loss([input], [target]);
  const before = net.layers.map(layer => [...layer.w]);
  const beforeAngle = boundaryAngle(net);
  net.step([input], [target], 1.2);
  const afterAngle = boundaryAngle(net);

  const edges: { line: SVGLineElement; pulse: SVGCircleElement; dx: number; dy: number; layer: number; weight: number }[] = [];
  const units: { sum: SVGTextElement; activation: SVGTextElement; layer: number }[] = [];
  let heading: SVGTextElement;
  let compare: SVGGElement;
  let lossBar: SVGRectElement;
  let board: SVGGElement;
  let boundary: SVGLineElement;

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;
      heading = label(api, svg, 200, 30, '', { 'text-anchor': 'middle', 'font-weight': 700 });
      const network = el('g');
      const signals = el('g');
      const nodes = el('g');
      for (const [layer, destinations] of layers.slice(1).entries()) {
        const sources = layers[layer];
        for (const [j, to] of destinations.entries()) for (const [i, from] of sources.entries()) {
          edges.push({
            layer, weight: j * sources.length + i, dx: to.x - from.x, dy: to.y - from.y,
            line: line(api, network, from.x, from.y, to.x, to.y, { class: 'scene-tween' }),
            pulse: el('circle', { cx: (from.x + to.x) / 2, cy: (from.y + to.y) / 2, r: 4.5 }, signals),
          });
        }
      }
      for (const [l, layer] of layers.entries()) {
        layer.forEach(({ x, y }, i) => {
          const val = [input, hidden, [output]][l][i];
          el('circle', { cx: x, cy: y, r: 18, fill: 'var(--sheet)', stroke: l === 0 ? 'var(--muted)' : 'var(--a)', 'stroke-width': 2 }, nodes);
          const attrs = { 'text-anchor': 'middle', 'font-size': 11, class: 'scene-value' };
          const activation = label(api, nodes, x, y + 4, val.toFixed(2), attrs);
          if (l > 0) {
            const sum = label(api, nodes, x, y + 4, sums[l][i].toFixed(2), { ...attrs, opacity: 0, fill: 'var(--muted)' });
            units.push({ sum, activation, layer: l });
          }
        });
      }
      label(api, svg, 55, 207, t('input'), { 'text-anchor': 'middle', fill: 'var(--muted)' });
      label(api, svg, 287, 207, t('output'), { 'text-anchor': 'middle', fill: 'var(--muted)' });

      compare = el('g', { class: 'scene-tween' });
      label(api, compare, 30, 234, t('output'), { fill: 'var(--muted)', 'font-size': 14 });
      label(api, compare, 93, 234, output.toFixed(2), { class: 'scene-value', 'font-size': 14 });
      label(api, compare, 145, 234, t('label'), { fill: 'var(--muted)', 'font-size': 14 });
      label(api, compare, 242, 234, String(target), { class: 'scene-value', 'font-size': 14 });
      label(api, compare, 30, 266, t('loss'), { 'font-size': 15 });
      el('rect', { x: 90, y: 252, width: 140, height: 16, rx: 5, fill: 'var(--rule)' }, compare);
      lossBar = el('rect', { x: 90, y: 252, width: 140 * Math.min(loss, 1), height: 16, rx: 5, fill: 'var(--bad)', class: 'scene-tween' }, compare);
      lossBar.style.transformOrigin = '90px 260px';
      label(api, compare, 241, 265, loss.toFixed(2), { class: 'scene-value', 'font-size': 14 });

      board = el('g', { class: 'scene-tween' });
      label(api, board, 329, 215, t('boundary'), { 'text-anchor': 'middle', 'font-size': 14 });
      el('rect', { x: 281, y: 222, width: 96, height: 66, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 }, board);
      for (const [x, y, c] of [[305, 269, 0], [318, 266, 0], [324, 276, 0], [338, 235, 1], [347, 246, 1], [357, 237, 1]]) {
        el('circle', { cx: x, cy: y, r: 3.5, fill: c === 0 ? 'var(--a)' : 'var(--b)' }, board);
      }
      const axis = el('g', { transform: 'translate(329 255)' }, board);
      line(api, axis, -39, 0, 39, 0, { stroke: 'var(--muted)', 'stroke-dasharray': '3 4', transform: `rotate(${beforeAngle})` });
      boundary = line(api, axis, -39, 0, 39, 0, { stroke: 'var(--ink)', 'stroke-width': 2, class: 'scene-tween' });
    },
    frame(i, api) {
      const { t } = api;
      heading.textContent = [
        `${t('weightedSum')} → ${t('activation')}`,
        `${t('output')} · ${t('label')}`,
        t('error'),
        t('weights'),
      ][i];
      for (const edge of edges) {
        const weight = i === 3 ? net.layers[edge.layer].w[edge.weight] : before[edge.layer][edge.weight];
        const strength = Math.min(Math.abs(weight), 1);
        edge.line.setAttribute('stroke', i === 2 ? 'var(--bad)' : weight < 0 ? 'var(--b)' : 'var(--a)');
        edge.line.setAttribute('stroke-width', String(1.5 + .5 * strength));
        edge.line.setAttribute('opacity', String(.42 + .58 * strength));
        edge.pulse.setAttribute('fill', i === 2 ? 'var(--bad)' : 'var(--a)');
        edge.pulse.setAttribute('opacity', i === 0 || i === 2 ? '1' : '0');
      }
      compare.setAttribute('opacity', i === 1 ? '1' : '0');
      lossBar.setAttribute('transform', i === 1 ? 'scale(1 1)' : 'scale(0 1)');
      board.setAttribute('opacity', i === 3 ? '1' : '0');
      boundary.setAttribute('transform', `rotate(${i === 3 ? afterAngle : beforeAngle})`);
    },
    loop(i) {
      if (i !== 0 && i !== 2) return () => {};
      const sign = i === 0 ? 1 : -1;
      const animations: Animation[] = [];
      const travel = 550, start = 130, layerTime = 850;
      for (const { pulse, dx, dy, layer } of edges) {
        const delay = start + (i === 0 ? layer : 1 - layer) * layerTime;
        const shift = (fraction: number) => `translate(${sign * fraction * dx}px, ${sign * fraction * dy}px)`;
        const animation = pulse.animate?.([
          { transform: shift(-.5), opacity: 0 },
          { opacity: 1, offset: .2 },
          { opacity: 1, offset: .8 },
          { transform: shift(.5), opacity: 0 },
        ], { duration: travel, delay, fill: 'both' });
        if (animation) animations.push(animation);
      }
      if (i === 0) for (const { sum, activation, layer } of units) {
        const arrival = start + (layer - 1) * layerTime + travel;
        const showSum = sum.animate?.(
          [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }],
          { delay: arrival - 40, duration: 260, fill: 'both' },
        );
        const activateUnit = activation.animate?.([{ opacity: 0 }, { opacity: 1 }], {
          delay: arrival + 220, duration: 200, fill: 'both',
        });
        if (showSum) animations.push(showSum);
        if (activateUnit) animations.push(activateUnit);
      }
      return () => animations.forEach(animation => animation.cancel());
    },
  });
}
