import { naiveBayes } from '../../engine/models/naiveBayes';
import type { Sample } from '../../engine/types';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface ClassSummary {
  prior: number;
  mx: number;
  my: number;
  vx: number;
  vy: number;
}

const BX = 86;
const BY = 38;
const BW = 182;
const BH = 156;

const X1_BASE = 248;
const X1_PEAK = 42;
const X2_BASE = 76;
const X2_PEAK = 44;

const BAR_Y = 216;
const BAR_MAX_H = 128;
const BAR_W = 28;
const BAR_X = [302, 348];

const rawA: Array<[number, number]> = [
  [0.20, 0.72], [0.27, 0.56], [0.33, 0.82], [0.38, 0.65], [0.25, 0.67], [0.43, 0.74], [0.31, 0.60],
];
const rawB: Array<[number, number]> = [
  [0.57, 0.34], [0.64, 0.22], [0.71, 0.42], [0.77, 0.27], [0.68, 0.32], [0.82, 0.38], [0.61, 0.46],
];
const QUERY = { x: 0.60, y: 0.43 };

const mapX = (u: number) => BX + u * BW;
const mapY = (v: number) => BY + v * BH;

function setDelay(el: Element, ms: number) {
  (el as SVGElement).style.setProperty('--delay', `${ms}ms`);
}

function gaussDensity(val: number, mean: number, variance: number) {
  return Math.exp(-((val - mean) ** 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);
}

function bellPathX(mean: number, variance: number, maxPeak: number): string {
  const steps = 36;
  const pts: string[] = [];
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    const h = Math.exp(-((u - mean) ** 2) / (2 * variance)) * maxPeak;
    pts.push(`${mapX(u).toFixed(1)} ${(X1_BASE - h).toFixed(1)}`);
  }
  return `M ${BX} ${X1_BASE} L ${pts.join(' L ')} L ${BX + BW} ${X1_BASE} Z`;
}

function bellPathY(mean: number, variance: number, maxPeak: number): string {
  const steps = 36;
  const pts: string[] = [];
  for (let k = 0; k <= steps; k++) {
    const v = k / steps;
    const w = Math.exp(-((v - mean) ** 2) / (2 * variance)) * maxPeak;
    pts.push(`${(X2_BASE - w).toFixed(1)} ${mapY(v).toFixed(1)}`);
  }
  return `M ${X2_BASE} ${BY} L ${pts.join(' L ')} L ${X2_BASE} ${BY + BH} Z`;
}

export default function nbScene() {
  let stats: ClassSummary[] = [];
  let pClassB = 0.85;

  let ellipses: SVGEllipseElement[] = [];
  let meanGuides: SVGLineElement[] = [];
  let x1Bells: SVGPathElement[] = [];
  let x2Bells: SVGPathElement[] = [];
  let f1Label: SVGTextElement;
  let f2Label: SVGTextElement;

  let queryGroup: SVGGElement;
  let queryRing: SVGCircleElement;
  let queryDot: SVGCircleElement;
  let qLineX1: SVGLineElement;
  let qLineX2: SVGLineElement;
  let qDotsX1: SVGCircleElement[] = [];
  let qDotsX2: SVGCircleElement[] = [];

  let scorePanel: SVGGElement;
  let scoreHeading: SVGTextElement;
  let scoreBars: SVGRectElement[] = [];
  let scoreVals: SVGTextElement[] = [];
  let winFrame: SVGRectElement;

  function applyFrame(i: number, api: SceneApi, instant = false) {
    const { t } = api;
    const d = (ms: number) => (instant ? 0 : ms);

    // Step 1: mean guides, ellipses, bell curves along both features
    meanGuides.forEach(g => {
      setDelay(g, d(0));
      g.setAttribute('opacity', i === 0 ? '0.65' : '0.25');
    });
    ellipses.forEach(e => {
      setDelay(e, d(i === 0 ? 450 : 0));
      e.setAttribute('opacity', i === 3 ? '0.9' : '0.6');
    });
    x1Bells.forEach(b => {
      setDelay(b, d(i === 0 ? 350 : 0));
      b.style.transform = 'scale(1, 1)';
      b.setAttribute('opacity', '1');
    });
    x2Bells.forEach(b => {
      setDelay(b, d(i === 0 ? 350 : 0));
      b.style.transform = 'scale(1, 1)';
      b.setAttribute('opacity', '1');
    });
    setDelay(f1Label, d(i === 0 ? 850 : 0));
    setDelay(f2Label, d(i === 0 ? 850 : 0));
    f1Label.setAttribute('opacity', '1');
    f2Label.setAttribute('opacity', '1');

    // Step 2: new point & feature-by-feature likelihood projections
    const hasQuery = i >= 1;
    setDelay(queryGroup, d(i === 1 ? 0 : 0));
    queryGroup.setAttribute('opacity', hasQuery ? '1' : '0');
    setDelay(queryRing, d(i === 1 ? 0 : i === 3 ? 450 : 0));
    queryRing.setAttribute('opacity', i === 1 || i === 3 ? '1' : '0');
    setDelay(queryDot, d(i === 3 ? 450 : 0));
    queryDot.setAttribute('fill', i === 3 ? 'var(--b)' : 'var(--muted)');

    setDelay(qLineX1, d(i === 1 ? 350 : 0));
    qLineX1.setAttribute('stroke-dashoffset', hasQuery ? '0' : '1');
    qLineX1.setAttribute('opacity', i === 1 ? '0.9' : i >= 2 ? '0.45' : '0');

    setDelay(qLineX2, d(i === 1 ? 800 : 0));
    qLineX2.setAttribute('stroke-dashoffset', hasQuery ? '0' : '1');
    qLineX2.setAttribute('opacity', i === 1 ? '0.9' : i >= 2 ? '0.45' : '0');

    qDotsX1.forEach(dot => {
      setDelay(dot, d(i === 1 ? 450 : 0));
      dot.setAttribute('opacity', hasQuery ? '1' : '0');
    });
    qDotsX2.forEach(dot => {
      setDelay(dot, d(i === 1 ? 900 : 0));
      dot.setAttribute('opacity', hasQuery ? '1' : '0');
    });

    // Steps 3–4: multiply into class bars -> higher score wins
    const hasBars = i >= 2;
    setDelay(scorePanel, d(i === 2 ? 0 : 0));
    scorePanel.setAttribute('opacity', hasBars ? '1' : '0');

    setDelay(scoreHeading, d(i === 2 ? 0 : i === 3 ? 800 : 0));
    scoreHeading.textContent = i === 3 ? t('wins') : t('multiply');

    const probs = [1 - pClassB, pClassB];
    scoreBars.forEach((bar, c) => {
      setDelay(bar, d(i === 2 ? 350 : 0));
      const scale = hasBars ? Math.max(0.08, probs[c]) : 0.02;
      bar.style.transform = `scale(1, ${scale.toFixed(3)})`;
      bar.setAttribute('opacity', i === 3 && c === 0 ? '0.35' : '1');
    });
    scoreVals.forEach((val, c) => {
      setDelay(val, d(i === 2 ? 900 : 0));
      val.setAttribute('opacity', hasBars ? (i === 3 && c === 0 ? '0.45' : '1') : '0');
    });

    setDelay(winFrame, d(i === 3 ? 150 : 0));
    winFrame.setAttribute('opacity', i === 3 ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      const makeCluster = (raw: Array<[number, number]>, c: 0 | 1): Sample[] =>
        raw.map(([x, y]) => ({
          x: x + 0.03 * (random() - 0.5),
          y: y + 0.03 * (random() - 0.5),
          c,
        }));
      const samples = [...makeCluster(rawA, 0), ...makeCluster(rawB, 1)];

      const model = naiveBayes();
      model.fit(samples);
      pClassB = model.predict(QUERY.x, QUERY.y);

      stats = [0, 1].map(c => {
        const g = samples.filter(s => s.c === c);
        const mx = g.reduce((s, q) => s + q.x, 0) / g.length;
        const my = g.reduce((s, q) => s + q.y, 0) / g.length;
        return {
          prior: g.length / samples.length,
          mx,
          my,
          vx: g.reduce((s, q) => s + (q.x - mx) ** 2, 0) / g.length + 1e-3,
          vy: g.reduce((s, q) => s + (q.y - my) ** 2, 0) / g.length + 1e-3,
        };
      });

      // 2D feature board
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const grid = el('g');
      for (let k = 1; k < 4; k++) {
        line(api, grid, BX + (BW * k) / 4, BY, BX + (BW * k) / 4, BY + BH);
        line(api, grid, BX, BY + (BH * k) / 4, BX + BW, BY + (BH * k) / 4);
      }

      const colors = ['var(--a)', 'var(--b)'];

      meanGuides = [];
      ellipses = stats.map((st, c) => {
        const cx = mapX(st.mx);
        const cy = mapY(st.my);
        meanGuides.push(
          line(api, svg, cx, cy, cx, X1_BASE, { stroke: colors[c], 'stroke-dasharray': '3 4', opacity: 0, class: 'scene-tween' }),
          line(api, svg, cx, cy, X2_BASE, cy, { stroke: colors[c], 'stroke-dasharray': '3 4', opacity: 0, class: 'scene-tween' }),
        );
        return el('ellipse', {
          cx, cy, rx: Math.sqrt(st.vx) * BW * 1.75, ry: Math.sqrt(st.vy) * BH * 1.75,
          fill: colors[c], 'fill-opacity': 0.08, stroke: colors[c], 'stroke-width': 1.5, 'stroke-dasharray': '4 3',
          opacity: 0, class: 'scene-tween',
        });
      });

      for (const s of samples) {
        el('circle', {
          cx: mapX(s.x), cy: mapY(s.y), r: 4.5, fill: colors[s.c], stroke: 'var(--paper)', 'stroke-width': 1.25,
        });
      }

      // Feature 1 bell curves along bottom
      line(api, svg, BX, X1_BASE, BX + BW, X1_BASE, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      const peakX1 = Math.max(...stats.map(st => gaussDensity(st.mx, st.mx, st.vx)));
      x1Bells = stats.map((st, c) => {
        const h = (gaussDensity(st.mx, st.mx, st.vx) / peakX1) * X1_PEAK;
        const p = el('path', {
          d: bellPathX(st.mx, st.vx, h), fill: colors[c], 'fill-opacity': 0.18,
          stroke: colors[c], 'stroke-width': 2, 'stroke-linejoin': 'round', opacity: 0, class: 'scene-tween scene-slow',
        });
        p.style.transformOrigin = `${BX}px ${X1_BASE}px`;
        return p;
      });
      f1Label = label(api, svg, BX + BW / 2, 268, t('f1'), {
        'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13, opacity: 0, class: 'scene-tween',
      });

      // Feature 2 bell curves along left
      line(api, svg, X2_BASE, BY, X2_BASE, BY + BH, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      const peakX2 = Math.max(...stats.map(st => gaussDensity(st.my, st.my, st.vy)));
      x2Bells = stats.map((st, c) => {
        const w = (gaussDensity(st.my, st.my, st.vy) / peakX2) * X2_PEAK;
        const p = el('path', {
          d: bellPathY(st.my, st.vy, w), fill: colors[c], 'fill-opacity': 0.18,
          stroke: colors[c], 'stroke-width': 2, 'stroke-linejoin': 'round', opacity: 0, class: 'scene-tween scene-slow',
        });
        p.style.transformOrigin = `${X2_BASE}px ${BY}px`;
        return p;
      });
      f2Label = label(api, svg, 24, 26, t('f2'), {
        fill: 'var(--muted)', 'font-size': 13, opacity: 0, class: 'scene-tween',
      });

      // Query point & projection lines onto feature bell curves
      const qx = mapX(QUERY.x);
      const qy = mapY(QUERY.y);
      qLineX1 = line(api, svg, qx, qy, qx, X1_BASE, {
        stroke: 'var(--ink)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });
      qLineX2 = line(api, svg, qx, qy, X2_BASE, qy, {
        stroke: 'var(--ink)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      qDotsX1 = stats.map((st, c) => {
        const h = (gaussDensity(QUERY.x, st.mx, st.vx) / peakX1) * X1_PEAK;
        return el('circle', {
          cx: qx, cy: X1_BASE - h, r: 4.5, fill: colors[c], stroke: 'var(--paper)', 'stroke-width': 1.5, opacity: 0, class: 'scene-tween',
        });
      });
      qDotsX2 = stats.map((st, c) => {
        const w = (gaussDensity(QUERY.y, st.my, st.vy) / peakX2) * X2_PEAK;
        return el('circle', {
          cx: X2_BASE - w, cy: qy, r: 4.5, fill: colors[c], stroke: 'var(--paper)', 'stroke-width': 1.5, opacity: 0, class: 'scene-tween',
        });
      });

      queryGroup = el('g', { opacity: 0, class: 'scene-tween' });
      queryRing = el('circle', {
        cx: qx, cy: qy, r: 10.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      }, queryGroup);
      queryDot = el('circle', {
        cx: qx, cy: qy, r: 6, fill: 'var(--muted)', stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
      }, queryGroup);

      // Right panel: multiplied score bars
      scorePanel = el('g', { opacity: 0, class: 'scene-tween' });
      scoreHeading = label(api, scorePanel, (BAR_X[0] + BAR_X[1]) / 2 + BAR_W / 2, 62, t('multiply'), {
        'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, class: 'scene-tween',
      });
      line(api, scorePanel, BAR_X[0] - 8, BAR_Y, BAR_X[1] + BAR_W + 8, BAR_Y, { stroke: 'var(--muted)', 'stroke-width': 1.5 });

      const winH = Math.max(10, pClassB * BAR_MAX_H);
      winFrame = el('rect', {
        x: BAR_X[1] - 5, y: BAR_Y - winH - 5, width: BAR_W + 10, height: winH + 10, rx: 7,
        fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      }, scorePanel);

      const probs = [1 - pClassB, pClassB];
      scoreBars = [0, 1].map(c => {
        const bx = BAR_X[c];
        const bar = el('rect', {
          x: bx, y: BAR_Y - BAR_MAX_H, width: BAR_W, height: BAR_MAX_H, rx: 5,
          fill: colors[c], class: 'scene-tween scene-slow',
        }, scorePanel);
        bar.style.transformOrigin = `${bx}px ${BAR_Y}px`;
        bar.style.transform = 'scale(1, 0.02)';
        return bar;
      });
      scoreVals = [0, 1].map(c =>
        label(api, scorePanel, BAR_X[c] + BAR_W / 2, BAR_Y + 20, `${Math.round(probs[c] * 100)}%`, {
          'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'scene-value scene-tween',
        }),
      );

      // Legend at bottom-right
      for (const [idx, x] of [42, 134].entries()) {
        el('circle', { cx: x, cy: 284, r: 5, fill: colors[idx] });
        label(api, svg, x + 12, 289, t(idx === 0 ? 'classA' : 'classB'), { fill: 'var(--muted)', 'font-size': 13 });
      }

      applyFrame(0, api, true);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api, true);
        x1Bells.forEach(b => {
          b.style.transform = 'scale(1, 0)';
          b.setAttribute('opacity', '0');
        });
        x2Bells.forEach(b => {
          b.style.transform = 'scale(0, 1)';
          b.setAttribute('opacity', '0');
        });
        ellipses.forEach(e => e.setAttribute('opacity', '0'));
        meanGuides.forEach(g => g.setAttribute('opacity', '0'));
        f1Label.setAttribute('opacity', '0');
        f2Label.setAttribute('opacity', '0');
      } else {
        applyFrame(i - 1, api, true);
      }
    },
  });
}
