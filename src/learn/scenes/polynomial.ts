import { fitReg } from '../../engine/regression';
import type { Label, Sample } from '../../engine/types';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const BX = 34;
const BY = 52;
const BW = 332;
const BH = 196;

const RAW_X = [0.08, 0.15, 0.23, 0.31, 0.39, 0.47, 0.55, 0.63, 0.71, 0.79, 0.86, 0.93];
const HIGHLIGHT_IDX = new Set([2, 6, 10]);

function px(x: number) { return BX + x * BW; }
function py(y: number) { return BY + (1 - y) * BH; }

function setDelay(el: SVGElement, ms: number) {
  el.style.setProperty('--delay', `${ms}ms`);
}

function sampleCurvePath(predict: (x: number) => number, steps = 64): string {
  const parts: string[] = [];
  for (let s = 0; s <= steps; s++) {
    const x = 0.02 + (0.96 * s) / steps;
    const y = Math.max(-0.25, Math.min(1.25, predict(x)));
    parts.push(`${s === 0 ? 'M' : 'L'} ${px(x).toFixed(1)} ${py(y).toFixed(1)}`);
  }
  return parts.join(' ');
}

export default function polynomialScene() {
  let samples: Sample[] = [];
  let badge: SVGTextElement;
  let cards: SVGGElement[] = [];
  let dots: SVGCircleElement[] = [];
  let noiseRings: SVGCircleElement[] = [];
  let residuals: SVGLineElement[] = [];
  let curve1: SVGPathElement;
  let curve2: SVGPathElement;
  let curve3: SVGPathElement;
  let curve9: SVGPathElement;

  function showPowerCards(visible: boolean) {
    cards.forEach((card, idx) => {
      setDelay(card, visible ? idx * 360 : 0);
      card.setAttribute('opacity', visible ? '1' : '0');
      card.style.transform = visible ? 'translateY(0px)' : 'translateY(10px)';
    });
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;

    showPowerCards(i === 0);

    // Degree 1 line
    const showC1 = i >= 1 && i <= 2;
    setDelay(curve1, i === 1 ? 150 : 0);
    curve1.setAttribute('stroke-dashoffset', showC1 ? '0' : '1');
    curve1.setAttribute('opacity', i === 1 ? '1' : i === 2 ? '0.4' : '0');
    curve1.setAttribute('stroke', i === 1 ? 'var(--ink)' : 'var(--muted)');
    curve1.setAttribute('stroke-dasharray', i === 1 ? '1 1' : '0.025 0.02');

    // Residuals in step 1 (linear regression fit)
    residuals.forEach((r, idx) => {
      setDelay(r, i === 1 ? 550 + idx * 25 : 0);
      r.setAttribute('stroke-dashoffset', i === 1 ? '0' : '1');
      r.setAttribute('opacity', i === 1 ? '0.65' : '0');
    });

    // Degree 2 bend in step 2
    setDelay(curve2, i === 2 ? 200 : 0);
    curve2.setAttribute('stroke-dashoffset', i === 2 ? '0' : '1');
    curve2.setAttribute('opacity', i === 2 ? '0.65' : '0');

    // Degree 3 S-curve in steps 2 and 3
    setDelay(curve3, i === 2 ? 750 : 0);
    curve3.setAttribute('stroke-dashoffset', i >= 2 ? '0' : '1');
    curve3.setAttribute('opacity', i === 2 ? '1' : i === 3 ? '0.55' : '0');
    curve3.setAttribute('stroke', i === 2 ? 'var(--ink)' : 'var(--ok)');
    curve3.setAttribute('stroke-dasharray', i === 2 ? '1 1' : '0.025 0.02');

    // Noisy points highlight + Degree 9 wiggle in step 3
    noiseRings.forEach((ring, idx) => {
      setDelay(ring, i === 3 ? 220 + idx * 70 : 0);
      ring.setAttribute('opacity', i === 3 ? '1' : '0');
    });
    setDelay(curve9, i === 3 ? 500 : 0);
    curve9.setAttribute('stroke-dashoffset', i === 3 ? '0' : '1');
    curve9.setAttribute('opacity', i === 3 ? '1' : '0');

    dots.forEach((dot, idx) => {
      setDelay(dot, 0);
      dot.setAttribute('opacity', i === 3 && !HIGHLIGHT_IDX.has(idx) ? '0.65' : '1');
    });

    // Top-right status badge
    setDelay(badge, i === 0 ? 750 : 900);
    badge.textContent = i === 0 ? t('powers') : i === 1 ? t('deg1') : i === 2 ? t('deg3') : t('deg8');
    badge.setAttribute('fill', i === 3 ? 'var(--bad)' : 'var(--ink)');
    badge.setAttribute('opacity', '1');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random } = api;

      samples = RAW_X.map((x, idx) => {
        const base = 0.48 + 0.27 * Math.sin(2 * Math.PI * (x - 0.05)) + 0.08 * (x - 0.5);
        const jitter = (idx % 2 === 0 ? 1 : -1) * (0.04 + 0.04 * random());
        return {
          x,
          y: Math.max(0.12, Math.min(0.88, base + jitter)),
          c: 0 as Label,
        };
      });

      const m1 = fitReg('polynomial', { degree: 1 }, samples);
      const m2 = fitReg('polynomial', { degree: 2 }, samples);
      const m3 = fitReg('polynomial', { degree: 3 }, samples);
      const m9 = fitReg('polynomial', { degree: 9 }, samples);

      badge = label(api, svg, BX + BW, 33, '', {
        'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, opacity: 0, class: 'scene-tween',
      });

      // Board sheet + grid
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const grid = el('g');
      for (let k = 1; k < 4; k++) {
        line(api, grid, BX + (BW * k) / 4, BY, BX + (BW * k) / 4, BY + BH);
        line(api, grid, BX, BY + (BH * k) / 4, BX + BW, BY + (BH * k) / 4);
      }

      const defs = el('defs');
      const clip = el('clipPath', { id: 'poly-board-clip' }, defs);
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8 }, clip);
      const clipped = el('g', { 'clip-path': 'url(#poly-board-clip)' });

      // Residual ticks for Degree 1
      const residLayer = el('g', {}, clipped);
      residuals = samples.map(s => line(api, residLayer, px(s.x), py(s.y), px(s.x), py(m1.predict(s.x)), {
        stroke: 'var(--muted)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }));

      // Fitted curves
      curve1 = el('path', {
        d: sampleCurvePath(m1.predict), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.25,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      curve2 = el('path', {
        d: sampleCurvePath(m2.predict), fill: 'none', stroke: 'var(--a)', 'stroke-width': 2,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      curve3 = el('path', {
        d: sampleCurvePath(m3.predict), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      curve9 = el('path', {
        d: sampleCurvePath(m9.predict, 96), fill: 'none', stroke: 'var(--bad)', 'stroke-width': 2.25,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5 });

      // Data points + highlight rings
      const cloud = el('g');
      noiseRings = [];
      dots = samples.map((s, idx) => {
        const cx = px(s.x);
        const cy = py(s.y);
        if (HIGHLIGHT_IDX.has(idx)) {
          noiseRings.push(el('circle', {
            cx, cy, r: 9.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
          }, cloud));
        }
        return el('circle', {
          cx, cy, r: 5, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
        }, cloud);
      });

      // Power feature cards shown below the board in Step 0: x, x², x³
      const cardSpecs = [
        { text: 'x', path: 'M 10 21 L 28 9' },
        { text: 'x²', path: 'M 10 10 Q 19 25 28 10' },
        { text: 'x³', path: 'M 10 21 C 16 7 22 23 28 9' },
      ];
      cards = cardSpecs.map((spec, idx) => {
        const g = el('g', { opacity: 0, class: 'scene-tween' });
        const cx = 74 + idx * 90;
        el('rect', {
          x: cx, y: 260, width: 72, height: 28, rx: 7,
          fill: 'var(--sheet)', stroke: idx === 0 ? 'var(--rule)' : 'var(--a)', 'stroke-width': 1.5,
        }, g);
        el('path', {
          d: spec.path, fill: 'none', stroke: idx === 0 ? 'var(--muted)' : 'var(--a)',
          'stroke-width': 1.75, 'stroke-linecap': 'round',
          transform: `translate(${cx} 259)`,
        }, g);
        label(api, g, cx + 48, 279, spec.text, {
          'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 'scene-value',
        });
        return g;
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        showPowerCards(false);
        badge.setAttribute('opacity', '0');
      } else if (i === 2) {
        applyFrame(1, api);
      } else if (i === 3) {
        applyFrame(2, api);
        curve1.setAttribute('opacity', '0');
        curve2.setAttribute('opacity', '0');
        curve3.setAttribute('stroke', 'var(--ink)');
        curve3.setAttribute('stroke-dasharray', '1 1');
      } else {
        applyFrame(i - 1, api);
      }
    },
  });
}
