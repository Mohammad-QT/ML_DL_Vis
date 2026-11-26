import { dbscan } from '../../engine/dbscan';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const colors = ['var(--a)', 'var(--b)'];
const eps = 45;
const minPts = 4;

const points = [
  // Cluster A (curved arch, 9 core + 1 border)
  { x: 78, y: 152 },
  { x: 96, y: 136 },
  { x: 76, y: 124 },
  { x: 106, y: 110 },
  { x: 132, y: 98 },
  { x: 154, y: 114 },
  { x: 140, y: 124 },
  { x: 104, y: 156 },
  { x: 168, y: 96 },
  { x: 190, y: 132 }, // border
  // Cluster B (curved group, 7 core + 1 border)
  { x: 230, y: 198 },
  { x: 252, y: 212 },
  { x: 256, y: 184 },
  { x: 280, y: 200 },
  { x: 304, y: 182 },
  { x: 294, y: 162 },
  { x: 322, y: 168 }, // border
  { x: 238, y: 220 },
  // Noise
  { x: 56, y: 76 },
  { x: 324, y: 86 },
  { x: 178, y: 222 },
];

const dist = (a: number, b: number) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);

interface PointNodes {
  dot: SVGCircleElement;
  halo: SVGCircleElement;
  cross: SVGGElement;
}

interface CoreEdge {
  a: number;
  b: number;
  cluster: number;
  wave: number;
  el: SVGLineElement;
}

export default function dbscanScene() {
  const result = dbscan(points, eps, minPts);
  const coreIndices = points.map((_, i) => i).filter(i => result.types[i] === 'core');
  const noiseIndices = points.map((_, i) => i).filter(i => result.types[i] === 'noise');
  const borderIndices = points.map((_, i) => i).filter(i => result.types[i] === 'border');

  // Compute BFS wave depth from one seed core point per cluster for the chain-spread animation.
  const waveOf = new Array<number>(points.length).fill(0);
  const seeds = [0, 10];
  const visited = new Set<number>(seeds);
  const queue = [...seeds];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const next of coreIndices) {
      if (!visited.has(next) && result.labels[next] === result.labels[cur] && dist(cur, next) <= eps) {
        visited.add(next);
        waveOf[next] = waveOf[cur] + 1;
        queue.push(next);
      }
    }
  }
  const maxWave = Math.max(...coreIndices.map(i => waveOf[i]));

  let nodes: PointNodes[] = [];
  let coreEdges: CoreEdge[] = [];
  let borderEdges: SVGLineElement[] = [];
  let epsRing: SVGGElement;
  let statusLabel: SVGTextElement;
  let statusNum: SVGTextElement;
  let legendCore: SVGGElement;
  let legendBorder: SVGGElement;
  let legendNoise: SVGGElement;

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function resetDelays() {
    delay(epsRing, 0);
    nodes.forEach(n => {
      delay(n.dot, 0);
      delay(n.halo, 0);
      delay(n.cross, 0);
    });
    coreEdges.forEach(e => delay(e.el, 0));
    borderEdges.forEach(e => delay(e, 0));
    delay(legendCore, 0);
    delay(legendBorder, 0);
    delay(legendNoise, 0);
  }

  function focusEps(centerIndex: number, showRing: boolean, api: SceneApi, staged = false) {
    resetDelays();
    const c = points[centerIndex];
    epsRing.style.transform = `translate(${c.x}px, ${c.y}px) scale(${showRing ? 1 : 0.2})`;
    epsRing.setAttribute('opacity', showRing ? '1' : '0');

    let inside = 0;
    nodes.forEach((node, idx) => {
      const inRadius = dist(centerIndex, idx) <= eps;
      if (inRadius) inside++;
      node.dot.setAttribute('fill', showRing && inRadius ? 'var(--ink)' : 'var(--muted)');
      node.dot.setAttribute('stroke', 'var(--paper)');
      node.dot.setAttribute('stroke-width', '1.5');
      node.dot.setAttribute('opacity', showRing && !inRadius ? '0.65' : '1');
      node.halo.setAttribute('opacity', showRing && inRadius ? '1' : '0');
      node.cross.setAttribute('opacity', '0');
      if (staged) {
        delay(node.dot, 450);
        delay(node.halo, 450);
      }
    });

    coreEdges.forEach(e => {
      e.el.setAttribute('stroke-dashoffset', '1');
      e.el.setAttribute('opacity', '0');
    });
    borderEdges.forEach(e => {
      e.setAttribute('stroke-dashoffset', '1');
      e.setAttribute('opacity', '0');
    });

    statusLabel.textContent = api.t('count');
    statusNum.textContent = String(inside);
    legendCore.setAttribute('opacity', '0.45');
    legendBorder.setAttribute('opacity', '0.45');
    legendNoise.setAttribute('opacity', '0.45');
  }

  function showCore(api: SceneApi) {
    resetDelays();
    epsRing.setAttribute('opacity', '0');
    nodes.forEach((node, idx) => {
      const isCore = result.types[idx] === 'core';
      node.dot.setAttribute('fill', isCore ? 'var(--ink)' : 'var(--muted)');
      node.dot.setAttribute('stroke', 'var(--paper)');
      node.dot.setAttribute('stroke-width', '1.5');
      node.dot.setAttribute('opacity', isCore ? '1' : '0.35');
      node.halo.setAttribute('opacity', isCore ? '1' : '0');
      node.cross.setAttribute('opacity', '0');
      if (isCore) {
        delay(node.dot, 350);
        delay(node.halo, 450);
      }
    });
    coreEdges.forEach(e => {
      e.el.setAttribute('stroke-dashoffset', '1');
      e.el.setAttribute('opacity', '0');
    });
    borderEdges.forEach(e => {
      e.setAttribute('stroke-dashoffset', '1');
      e.setAttribute('opacity', '0');
    });

    statusLabel.textContent = api.t('core');
    statusNum.textContent = String(coreIndices.length);
    legendCore.setAttribute('opacity', '1');
    delay(legendCore, 700);
    legendBorder.setAttribute('opacity', '0.45');
    legendNoise.setAttribute('opacity', '0.45');
  }

  function showChainsThrough(maxVisibleWave: number, api: SceneApi) {
    resetDelays();
    epsRing.setAttribute('opacity', '0');
    nodes.forEach((node, idx) => {
      const isCore = result.types[idx] === 'core';
      const lit = isCore && waveOf[idx] <= maxVisibleWave;
      node.dot.setAttribute('fill', lit ? colors[result.labels[idx]] : isCore ? 'var(--ink)' : 'var(--muted)');
      node.dot.setAttribute('stroke', 'var(--paper)');
      node.dot.setAttribute('stroke-width', '1.5');
      node.dot.setAttribute('opacity', isCore ? '1' : '0.35');
      node.halo.setAttribute('opacity', '0');
      node.cross.setAttribute('opacity', '0');
    });
    coreEdges.forEach(e => {
      const visible = e.wave <= maxVisibleWave;
      e.el.setAttribute('stroke-dashoffset', visible ? '0' : '1');
      e.el.setAttribute('opacity', visible ? '0.6' : '0');
    });
    borderEdges.forEach(e => {
      e.setAttribute('stroke-dashoffset', '1');
      e.setAttribute('opacity', '0');
    });

    statusLabel.textContent = api.t('clusters');
    statusNum.textContent = String(result.count);
    legendCore.setAttribute('opacity', '1');
    legendBorder.setAttribute('opacity', '0.45');
    legendNoise.setAttribute('opacity', '0.45');
  }

  function showBorderAndNoise(api: SceneApi) {
    resetDelays();
    epsRing.setAttribute('opacity', '0');
    nodes.forEach((node, idx) => {
      const kind = result.types[idx];
      const cluster = result.labels[idx];
      if (kind === 'core') {
        node.dot.setAttribute('fill', colors[cluster]);
        node.dot.setAttribute('stroke', 'var(--paper)');
        node.dot.setAttribute('stroke-width', '1.5');
        node.dot.setAttribute('opacity', '1');
        node.halo.setAttribute('opacity', '0');
        node.cross.setAttribute('opacity', '0');
      } else if (kind === 'border') {
        node.dot.setAttribute('fill', 'var(--paper)');
        node.dot.setAttribute('stroke', colors[cluster]);
        node.dot.setAttribute('stroke-width', '2.5');
        node.dot.setAttribute('opacity', '1');
        node.halo.setAttribute('opacity', '0.9');
        node.cross.setAttribute('opacity', '0');
        delay(node.dot, 450);
        delay(node.halo, 450);
      } else {
        node.dot.setAttribute('opacity', '0');
        node.halo.setAttribute('opacity', '0');
        node.cross.setAttribute('opacity', '1');
        delay(node.dot, 900);
        delay(node.cross, 900);
      }
    });
    coreEdges.forEach(e => {
      e.el.setAttribute('stroke-dashoffset', '0');
      e.el.setAttribute('opacity', '0.4');
    });
    borderEdges.forEach(e => {
      e.setAttribute('stroke-dashoffset', '0');
      e.setAttribute('opacity', '0.75');
    });

    statusLabel.textContent = api.t('noise');
    statusNum.textContent = String(result.noise);
    legendCore.setAttribute('opacity', '1');
    legendBorder.setAttribute('opacity', '1');
    delay(legendBorder, 450);
    legendNoise.setAttribute('opacity', '1');
    delay(legendNoise, 900);
  }

  function applyFrame(i: number, api: SceneApi) {
    if (i === 0) focusEps(1, true, api, true);
    else if (i === 1) showCore(api);
    else if (i === 2) showChainsThrough(maxWave, api);
    else showBorderAndNoise(api);
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;
      const grid = el('g');
      for (let x = 35; x <= 365; x += 30) line(api, grid, x, 52, x, 242);
      for (let y = 52; y <= 242; y += 38) line(api, grid, 35, y, 365, y);

      label(api, svg, 35, 33, t('minPts'), { class: 'scene-value', 'font-size': 15, 'font-weight': 700 });
      statusLabel = label(api, svg, 342, 33, '', {
        'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 14, 'font-weight': 600,
      });
      statusNum = label(api, svg, 365, 33, '', {
        'text-anchor': 'end', class: 'scene-value', 'font-size': 15, 'font-weight': 700,
      });

      const edgesLayer = el('g');
      const haloLayer = el('g');
      const ringLayer = el('g');
      const cloudLayer = el('g');

      epsRing = el('g', { class: 'scene-tween' }, ringLayer);
      el('circle', { cx: 0, cy: 0, r: eps, fill: 'var(--hl)', opacity: 0.16 }, epsRing);
      el('circle', {
        cx: 0, cy: 0, r: eps, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.75, 'stroke-dasharray': '4 3',
      }, epsRing);

      coreEdges = [];
      for (let a = 0; a < coreIndices.length; a++) {
        for (let b = a + 1; b < coreIndices.length; b++) {
          const i = coreIndices[a];
          const j = coreIndices[b];
          if (result.labels[i] !== result.labels[j] || dist(i, j) > eps) continue;
          const c = result.labels[i];
          coreEdges.push({
            a: i,
            b: j,
            cluster: c,
            wave: Math.max(waveOf[i], waveOf[j]),
            el: line(api, edgesLayer, points[i].x, points[i].y, points[j].x, points[j].y, {
              stroke: colors[c], 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '1 1',
              'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
            }),
          });
        }
      }

      borderEdges = borderIndices.map(b => {
        let nearestCore = coreIndices[0];
        let best = Infinity;
        for (const c of coreIndices) {
          const d = dist(b, c);
          if (d < best) { best = d; nearestCore = c; }
        }
        return line(api, edgesLayer, points[nearestCore].x, points[nearestCore].y, points[b].x, points[b].y, {
          stroke: colors[result.labels[b]], 'stroke-width': 1.75, pathLength: 1, 'stroke-dasharray': '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        });
      });

      nodes = points.map(pt => {
        const halo = el('circle', {
          cx: pt.x, cy: pt.y, r: 10.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5,
          opacity: 0, class: 'scene-tween',
        }, haloLayer);
        const dot = el('circle', {
          cx: pt.x, cy: pt.y, r: 5.5, fill: 'var(--muted)', stroke: 'var(--paper)', 'stroke-width': 1.5,
          class: 'scene-tween',
        }, cloudLayer);
        const cross = el('g', {
          transform: `translate(${pt.x}, ${pt.y})`, opacity: 0, class: 'scene-tween',
        }, cloudLayer);
        line(api, cross, -4.5, -4.5, 4.5, 4.5, { stroke: 'var(--muted)', 'stroke-width': 2.2 });
        line(api, cross, -4.5, 4.5, 4.5, -4.5, { stroke: 'var(--muted)', 'stroke-width': 2.2 });
        return { dot, halo, cross };
      });

      // Legend row
      legendCore = el('g', { class: 'scene-tween' });
      el('circle', { cx: 46, cy: 269, r: 5.5, fill: 'var(--ink)' }, legendCore);
      label(api, legendCore, 59, 274, t('core'), { fill: 'var(--muted)', 'font-size': 14 });

      legendBorder = el('g', { class: 'scene-tween' });
      el('circle', { cx: 158, cy: 269, r: 5.5, fill: 'var(--paper)', stroke: 'var(--a)', 'stroke-width': 2.2 }, legendBorder);
      label(api, legendBorder, 171, 274, t('border'), { fill: 'var(--muted)', 'font-size': 14 });

      legendNoise = el('g', { class: 'scene-tween' });
      line(api, legendNoise, 272, 265, 280, 273, { stroke: 'var(--muted)', 'stroke-width': 2.2 });
      line(api, legendNoise, 272, 273, 280, 265, { stroke: 'var(--muted)', 'stroke-width': 2.2 });
      label(api, legendNoise, 288, 274, t('noise'), { fill: 'var(--muted)', 'font-size': 14 });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) focusEps(1, false, api);
      else applyFrame(i - 1, api);
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (api.reduced || !browser) return () => {};

      if (i === 0) {
        const timers: number[] = [];
        const noiseSample = noiseIndices[0];
        focusEps(1, true, api, true);
        timers.push(browser.setTimeout(() => focusEps(noiseSample, true, api, false), 1100));
        timers.push(browser.setTimeout(() => focusEps(1, true, api, false), 2150));
        return () => timers.forEach(id => browser.clearTimeout(id));
      }

      if (i === 2) {
        const timers: number[] = [];
        const stepMs = Math.min(340, Math.floor(1900 / (maxWave + 1)));
        showChainsThrough(0, api);
        for (let w = 1; w <= maxWave; w++) {
          timers.push(browser.setTimeout(() => showChainsThrough(w, api), w * stepMs));
        }
        return () => timers.forEach(id => browser.clearTimeout(id));
      }

      return () => {};
    },
  });
}
