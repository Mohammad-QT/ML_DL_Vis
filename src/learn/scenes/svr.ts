import { fitReg } from '../../engine/regression';
import type { Label, Sample } from '../../engine/types';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const BX = 34;
const BY = 52;
const BW = 332;
const BH = 196;

const BASE_EPS = 0.085;
const HIGH_G_EPS = 0.045;

// 14 deterministic points: 10 follow a gentle wave, 4 sit outside to pull the curve.
const RAW_PTS: Array<[number, number]> = [
  [0.09, 0.39],
  [0.16, 0.48],
  [0.22, 0.80],
  [0.28, 0.57],
  [0.35, 0.62],
  [0.42, 0.65],
  [0.48, 0.36],
  [0.54, 0.61],
  [0.61, 0.56],
  [0.67, 0.81],
  [0.73, 0.46],
  [0.80, 0.42],
  [0.86, 0.16],
  [0.92, 0.36],
];

function px(x: number) { return BX + x * BW; }
function py(y: number) { return BY + (1 - y) * BH; }

function setDelay(el: SVGElement, ms: number) {
  el.style.setProperty('--delay', `${ms}ms`);
}

function curvePath(predict: (x: number) => number, offset = 0, steps = 64): string {
  const parts: string[] = [];
  for (let s = 0; s <= steps; s++) {
    const x = 0.02 + (0.96 * s) / steps;
    const y = Math.max(-0.2, Math.min(1.2, predict(x) + offset));
    parts.push(`${s === 0 ? 'M' : 'L'} ${px(x).toFixed(1)} ${py(y).toFixed(1)}`);
  }
  return parts.join(' ');
}

function tubeBandPath(predict: (x: number) => number, eps: number, steps = 64): string {
  const upper: string[] = [];
  const lower: string[] = [];
  for (let s = 0; s <= steps; s++) {
    const x = 0.02 + (0.96 * s) / steps;
    const y = predict(x);
    upper.push(`${s === 0 ? 'M' : 'L'} ${px(x).toFixed(1)} ${py(y + eps).toFixed(1)}`);
    lower.unshift(`L ${px(x).toFixed(1)} ${py(y - eps).toFixed(1)}`);
  }
  return `${upper.join(' ')} ${lower.join(' ')} Z`;
}

export default function svrScene() {
  let samples: Sample[] = [];
  let outside: boolean[] = [];
  let badge: SVGTextElement;
  let legendText: SVGTextElement;

  let baseTube: SVGGElement;
  let baseCurve: SVGPathElement;
  let highCTube: SVGGElement;
  let highCCurve: SVGPathElement;
  let highGTube: SVGGElement;
  let highGCurve: SVGPathElement;

  let pullTethers: SVGLineElement[] = [];
  let svRings: SVGCircleElement[] = [];
  let dots: SVGCircleElement[] = [];

  function setTubeVisible(group: SVGGElement, visible: boolean, delayMs: number) {
    setDelay(group, delayMs);
    group.setAttribute('opacity', visible ? '1' : '0');
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;

    // Frame 0 & 1: baseline SVR curve + tube
    const showBaseTube = i === 0 || i === 1;
    setTubeVisible(baseTube, showBaseTube, i === 0 ? 450 : 0);
    setDelay(baseCurve, i === 0 ? 100 : 0);
    baseCurve.setAttribute('stroke-dashoffset', i <= 2 ? '0' : '1');
    baseCurve.setAttribute('opacity', i <= 1 ? '1' : i === 2 ? '0.45' : '0');
    baseCurve.setAttribute('stroke', i <= 1 ? 'var(--ink)' : 'var(--muted)');
    baseCurve.setAttribute('stroke-dasharray', i <= 1 ? '1 1' : '0.025 0.02');

    // Frame 2: High C curve + tube pulled toward outside points
    setTubeVisible(highCTube, i === 2, i === 2 ? 420 : 0);
    setDelay(highCCurve, i === 2 ? 350 : 0);
    highCCurve.setAttribute('stroke-dashoffset', i >= 2 ? '0' : '1');
    highCCurve.setAttribute('opacity', i === 2 ? '1' : i === 3 ? '0.4' : '0');
    highCCurve.setAttribute('stroke', i === 2 ? 'var(--ink)' : 'var(--muted)');
    highCCurve.setAttribute('stroke-dasharray', i === 2 ? '1 1' : '0.025 0.02');

    // Frame 3: High gamma curve + narrow wiggly tube
    setTubeVisible(highGTube, i === 3, i === 3 ? 500 : 0);
    setDelay(highGCurve, i === 3 ? 350 : 0);
    highGCurve.setAttribute('stroke-dashoffset', i === 3 ? '0' : '1');
    highGCurve.setAttribute('opacity', i === 3 ? '1' : '0');

    // Support vectors (outside points) + pull tethers
    const showPullers = i === 1 || i === 2;
    dots.forEach((dot, idx) => {
      const isOut = outside[idx];
      if (i === 0) {
        setDelay(dot, isOut ? 650 : 850);
        dot.setAttribute('fill', 'var(--a)');
        dot.setAttribute('opacity', isOut ? '1' : '0.42');
      } else if (i === 1 || i === 2) {
        setDelay(dot, isOut ? 200 : 0);
        dot.setAttribute('fill', isOut ? 'var(--b)' : 'var(--muted)');
        dot.setAttribute('opacity', isOut ? '1' : '0.35');
      } else {
        setDelay(dot, 200);
        dot.setAttribute('fill', isOut ? 'var(--b)' : 'var(--a)');
        dot.setAttribute('opacity', '1');
      }
    });

    svRings.forEach((ring, idx) => {
      setDelay(ring, showPullers ? 220 + idx * 45 : 0);
      ring.setAttribute('opacity', showPullers ? '1' : '0');
    });

    pullTethers.forEach((tether, idx) => {
      setDelay(tether, i === 1 ? 580 + idx * 55 : 0);
      tether.setAttribute('stroke-dashoffset', showPullers ? '0' : '1');
      tether.setAttribute('stroke-width', i === 2 ? '2.75' : '1.75');
      tether.setAttribute('opacity', showPullers ? '0.9' : '0');
    });

    setDelay(badge, 900);
    badge.textContent = i === 0 ? t('tube') : i === 1 ? t('sv') : i === 2 ? t('cHigh') : t('gHigh');
    badge.setAttribute('fill', i === 3 ? 'var(--b)' : 'var(--ink)');
    badge.setAttribute('opacity', '1');

    setDelay(legendText, i === 1 ? 750 : 0);
    legendText.setAttribute('opacity', i === 1 || i === 2 ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      samples = RAW_PTS.map(([x, y]) => ({
        x,
        y: Math.max(0.1, Math.min(0.9, y + 0.02 * (random() - 0.5))),
        c: 0 as Label,
      }));

      const mBase = fitReg('svr', { epsilon: BASE_EPS, C: -0.2, gamma: 0.3 }, samples);
      const mHighC = fitReg('svr', { epsilon: BASE_EPS, C: 1.8, gamma: 0.4 }, samples);
      const mHighG = fitReg('svr', { epsilon: HIGH_G_EPS, C: 1.8, gamma: 1.75 }, samples);

      outside = samples.map(s => Math.abs(s.y - mBase.predict(s.x)) > BASE_EPS + 0.01);

      badge = label(api, svg, BX + BW, 33, '', {
        'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, opacity: 0, class: 'scene-tween',
      });

      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const grid = el('g');
      for (let k = 1; k < 4; k++) {
        line(api, grid, BX + (BW * k) / 4, BY, BX + (BW * k) / 4, BY + BH);
        line(api, grid, BX, BY + (BH * k) / 4, BX + BW, BY + (BH * k) / 4);
      }

      const defs = el('defs');
      const clip = el('clipPath', { id: 'svr-board-clip' }, defs);
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8 }, clip);
      const clipped = el('g', { 'clip-path': 'url(#svr-board-clip)' });

      const buildTube = (predict: (x: number) => number, eps: number) => {
        const g = el('g', { opacity: 0, class: 'scene-tween' }, clipped);
        el('path', { d: tubeBandPath(predict, eps), fill: 'var(--hl)', 'fill-opacity': 0.18 }, g);
        el('path', { d: curvePath(predict, eps), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
        el('path', { d: curvePath(predict, -eps), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
        return g;
      };

      baseTube = buildTube(mBase.predict, BASE_EPS);
      highCTube = buildTube(mHighC.predict, BASE_EPS);
      highGTube = buildTube(mHighG.predict, HIGH_G_EPS);

      baseCurve = el('path', {
        d: curvePath(mBase.predict), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.35,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      highCCurve = el('path', {
        d: curvePath(mHighC.predict), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.35,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      highGCurve = el('path', {
        d: curvePath(mHighG.predict, 0, 88), fill: 'none', stroke: 'var(--b)', 'stroke-width': 2.35,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      const tetherLayer = el('g', {}, clipped);
      pullTethers = [];
      samples.forEach((s, idx) => {
        if (!outside[idx]) return;
        const pred = mBase.predict(s.x);
        const edgeY = s.y > pred ? pred + BASE_EPS : pred - BASE_EPS;
        pullTethers.push(line(api, tetherLayer, px(s.x), py(s.y), px(s.x), py(edgeY), {
          stroke: 'var(--b)', 'stroke-width': 1.75, pathLength: 1, 'stroke-dasharray': '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        }));
      });

      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5 });

      const cloud = el('g');
      svRings = [];
      dots = samples.map((s, idx) => {
        const cx = px(s.x);
        const cy = py(s.y);
        if (outside[idx]) {
          svRings.push(el('circle', {
            cx, cy, r: 9.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
          }, cloud));
        }
        return el('circle', {
          cx, cy, r: 5, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
        }, cloud);
      });

      // Bottom legend for tube & pullers
      el('rect', { x: BX, y: 266, width: 16, height: 10, rx: 3, fill: 'var(--hl)', 'fill-opacity': 0.35, stroke: 'var(--muted)', 'stroke-dasharray': '3 2' });
      label(api, svg, BX + 24, 276, t('tube'), { fill: 'var(--muted)', 'font-size': 13 });

      legendText = label(api, svg, BX + BW, 276, t('sv'), {
        'text-anchor': 'end', fill: 'var(--b)', 'font-size': 13, 'font-weight': 600, opacity: 0, class: 'scene-tween',
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        baseCurve.setAttribute('stroke-dashoffset', '1');
        baseCurve.setAttribute('opacity', '0');
        setTubeVisible(baseTube, false, 0);
        dots.forEach(d => {
          d.setAttribute('fill', 'var(--a)');
          d.setAttribute('opacity', '1');
        });
        badge.setAttribute('opacity', '0');
      } else if (i === 1) {
        applyFrame(0, api);
      } else if (i === 2) {
        applyFrame(1, api);
      } else {
        applyFrame(2, api);
      }
    },
  });
}
