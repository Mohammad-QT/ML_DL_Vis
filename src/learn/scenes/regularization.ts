import { fitRegularized } from '../../engine/regularization';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

// Left scatter panel
const BX = 22;
const BY = 54;
const BW = 184;
const BH = 186;

// Right weight-bars panel
const WX = 228;
const WY = 54;
const WW = 150;
const WH = 186;
const WZERO = WY + WH / 2;
const BAR_HALF = WH * 0.42;

const TRAIN_RAW: Array<[number, number]> = [
  [0.08, 0.54], [0.16, 0.72], [0.25, 0.82], [0.34, 0.72], [0.43, 0.56],
  [0.54, 0.40], [0.64, 0.23], [0.73, 0.19], [0.83, 0.28], [0.92, 0.46],
];
const TEST_RAW: Array<[number, number]> = [
  [0.20, 0.76], [0.49, 0.50], [0.78, 0.24],
];

// Exaggerated unscaled multipliers used only in Step 0 before standardization in Step 1.
const UNSCALED_FACTORS = [0.65, 1.35, 0.8, 1.55, 0.9, 1.45];

function px(x: number) { return BX + x * BW; }
function py(y: number) { return BY + (1 - y) * BH; }

function setDelay(el: SVGElement, ms: number) {
  el.style.setProperty('--delay', `${ms}ms`);
}

function curvePath(predict: (x: number) => number, steps = 56): string {
  const parts: string[] = [];
  for (let s = 0; s <= steps; s++) {
    const x = 0.03 + (0.94 * s) / steps;
    const y = Math.max(-0.2, Math.min(1.2, predict(x)));
    parts.push(`${s === 0 ? 'M' : 'L'} ${px(x).toFixed(1)} ${py(y).toFixed(1)}`);
  }
  return parts.join(' ');
}

function pickAlpha(trainPts: Array<{ x: number; y: number }>): number {
  for (const a of [0.04, 0.03, 0.035, 0.025, 0.05]) {
    const model = fitRegularized(trainPts, 6, 'lasso', a);
    const zeros = model.weights.filter(w => Math.abs(w) < 1e-6).length;
    if (zeros >= 2 && zeros <= 4) return a;
  }
  return 0.04;
}

export default function regularizationScene() {
  let trainPts: Array<{ x: number; y: number }> = [];
  let testPts: Array<{ x: number; y: number }> = [];
  let unregWeights: number[] = [];
  let ridgeWeights: number[] = [];
  let lassoWeights: number[] = [];
  let maxWeight = 1;

  let alphaBadge: SVGTextElement;
  let rightBadge: SVGTextElement;
  let scaleBand: SVGRectElement;
  let legendGroup: SVGGElement;

  let unregCurve: SVGPathElement;
  let ridgeCurve: SVGPathElement;
  let lassoCurve: SVGPathElement;

  let testRings: SVGCircleElement[] = [];
  let testMissUnreg: SVGLineElement[] = [];
  let testMissReg: SVGLineElement[] = [];

  let ridgeBars: SVGRectElement[] = [];
  let lassoBars: SVGRectElement[] = [];
  let zeroRings: SVGCircleElement[] = [];

  function setBar(bar: SVGRectElement, weight: number, delayMs: number, visible: boolean) {
    const ratio = Math.max(-1, Math.min(1, weight / maxWeight));
    const scale = Math.abs(ratio) < 0.015 ? 0.015 * (ratio < 0 ? -1 : 1) : ratio;
    setDelay(bar, delayMs);
    bar.style.transform = visible ? `scaleY(${scale.toFixed(3)})` : 'scaleY(0)';
    bar.setAttribute('opacity', visible ? '1' : '0');
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;

    // Left board curves
    setDelay(unregCurve, i === 0 ? 150 : 0);
    unregCurve.setAttribute('stroke-dashoffset', i <= 3 ? '0' : '1');
    unregCurve.setAttribute('opacity', i <= 1 ? '1' : '0.4');
    unregCurve.setAttribute('stroke', i <= 1 ? 'var(--ink)' : 'var(--muted)');
    unregCurve.setAttribute('stroke-dasharray', i <= 1 ? '1 1' : '0.035 0.025');

    setDelay(ridgeCurve, i === 2 ? 350 : 0);
    ridgeCurve.setAttribute('stroke-dashoffset', i === 2 ? '0' : '1');
    ridgeCurve.setAttribute('opacity', i === 2 ? '1' : '0');

    setDelay(lassoCurve, i === 3 ? 350 : 0);
    lassoCurve.setAttribute('stroke-dashoffset', i === 3 ? '0' : '1');
    lassoCurve.setAttribute('opacity', i === 3 ? '1' : '0');

    // Held-out test points + error ticks in Step 3
    const showTest = i === 3;
    testRings.forEach((ring, idx) => {
      setDelay(ring, showTest ? 100 + idx * 50 : 0);
      ring.setAttribute('opacity', showTest ? '1' : '0');
    });
    testMissUnreg.forEach(tick => {
      setDelay(tick, showTest ? 250 : 0);
      tick.setAttribute('opacity', '0');
      tick.setAttribute('stroke-dashoffset', '1');
    });
    testMissReg.forEach((tick, idx) => {
      setDelay(tick, showTest ? 750 + idx * 60 : 0);
      tick.setAttribute('stroke-dashoffset', showTest ? '0' : '1');
      tick.setAttribute('opacity', showTest ? '0.9' : '0');
    });

    // Right panel scale band (Step 1+)
    setDelay(scaleBand, i === 1 ? 500 : 0);
    scaleBand.setAttribute('opacity', i >= 1 ? '1' : '0');

    // Weight bars
    for (let k = 0; k < 6; k++) {
      const w0 = unregWeights[k] * (i === 0 ? UNSCALED_FACTORS[k] : 1);
      const wr = i <= 1 ? w0 : ridgeWeights[k];
      const wl = i <= 1 ? w0 : lassoWeights[k];
      const zeroed = i >= 2 && Math.abs(wl) < 1e-6;

      const dRidge = i === 0 ? k * 70 : i === 1 ? 150 + k * 45 : i === 2 ? 100 + k * 40 : 0;
      const dLasso = i === 0 ? k * 70 : i === 1 ? 150 + k * 45 : i === 2 ? 500 + k * 55 : 0;

      setBar(ridgeBars[k], wr, dRidge, true);
      ridgeBars[k].setAttribute('fill', i <= 1 ? 'var(--ink)' : 'var(--a)');

      setBar(lassoBars[k], zeroed ? 0.001 : wl, dLasso, true);
      lassoBars[k].setAttribute('fill', i <= 1 ? 'var(--ink)' : 'var(--b)');
      if (zeroed) lassoBars[k].setAttribute('opacity', '0.3');

      setDelay(zeroRings[k], i === 2 ? 950 + k * 40 : 0);
      zeroRings[k].setAttribute('opacity', zeroed ? '1' : '0');
    }

    // Labels
    setDelay(alphaBadge, i === 0 ? 700 : 850);
    alphaBadge.textContent = i <= 1 ? t('alphaLow') : t('alphaMid');
    alphaBadge.setAttribute('fill', i === 3 ? 'var(--ok)' : 'var(--ink)');
    alphaBadge.setAttribute('opacity', '1');

    setDelay(rightBadge, i === 1 ? 850 : i === 2 ? 900 : 0);
    rightBadge.textContent = i === 1 ? t('scale') : '';
    rightBadge.setAttribute('opacity', i === 1 ? '1' : '0');

    setDelay(legendGroup, i === 2 ? 250 : 0);
    legendGroup.setAttribute('opacity', i >= 2 ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      trainPts = TRAIN_RAW.map(([x, y], idx) => ({
        x,
        y: Math.max(0.12, Math.min(0.88, y + (idx % 2 === 0 ? 1 : -1) * (0.04 + 0.04 * random()))),
      }));
      testPts = TEST_RAW.map(([x, y]) => ({ x, y }));

      const alpha = pickAlpha(trainPts);
      const mUnreg = fitRegularized(trainPts, 6, 'ridge', 0);
      const mRidge = fitRegularized(trainPts, 6, 'ridge', alpha);
      const mLasso = fitRegularized(trainPts, 6, 'lasso', alpha);

      unregWeights = mUnreg.weights;
      ridgeWeights = mRidge.weights;
      lassoWeights = mLasso.weights;
      maxWeight = Math.max(
        0.2,
        ...unregWeights.map((w, k) => Math.abs(w * UNSCALED_FACTORS[k])),
        ...unregWeights.map(w => Math.abs(w)),
      );

      alphaBadge = label(api, svg, BX, 34, '', {
        'font-size': 15, 'font-weight': 700, opacity: 0, class: 'scene-value scene-tween',
      });
      rightBadge = label(api, svg, WX + WW, 34, '', {
        'text-anchor': 'end', 'font-size': 14, 'font-weight': 600, fill: 'var(--a)', opacity: 0, class: 'scene-tween',
      });

      // Left panel
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const lGrid = el('g');
      for (let k = 1; k < 4; k++) {
        line(api, lGrid, BX + (BW * k) / 4, BY, BX + (BW * k) / 4, BY + BH);
        line(api, lGrid, BX, BY + (BH * k) / 4, BX + BW, BY + (BH * k) / 4);
      }

      const defs = el('defs');
      const clip = el('clipPath', { id: 'reg-board-clip' }, defs);
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8 }, clip);
      const clipped = el('g', { 'clip-path': 'url(#reg-board-clip)' });

      unregCurve = el('path', {
        d: curvePath(mUnreg.predict), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.1,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      ridgeCurve = el('path', {
        d: curvePath(mRidge.predict), fill: 'none', stroke: 'var(--a)', 'stroke-width': 2.35,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      lassoCurve = el('path', {
        d: curvePath(mLasso.predict), fill: 'none', stroke: 'var(--ok)', 'stroke-width': 2.35,
        'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        opacity: 0, class: 'scene-tween scene-slow',
      }, clipped);

      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5 });

      const missLayer = el('g');
      testMissUnreg = testPts.map(p => line(api, missLayer, px(p.x), py(p.y), px(p.x), py(mUnreg.predict(p.x)), {
        stroke: 'var(--bad)', 'stroke-width': 1.75, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }));
      testMissReg = testPts.map(p => line(api, missLayer, px(p.x), py(p.y), px(p.x), py(mLasso.predict(p.x)), {
        stroke: 'var(--ok)', 'stroke-width': 1.75, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }));

      for (const p of trainPts) {
        el('circle', { cx: px(p.x), cy: py(p.y), r: 4.5, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.4 });
      }
      testRings = testPts.map(p => el('circle', {
        cx: px(p.x), cy: py(p.y), r: 5.5, fill: 'var(--sheet)', stroke: 'var(--ok)', 'stroke-width': 2.25,
        opacity: 0, class: 'scene-tween',
      }));

      // Right panel: weight bars around zero line
      el('rect', { x: WX, y: WY, width: WW, height: WH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      scaleBand = el('rect', {
        x: WX + 6, y: WZERO - BAR_HALF * 0.72, width: WW - 12, height: BAR_HALF * 1.44, rx: 4,
        fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.25, 'stroke-dasharray': '4 4', opacity: 0, class: 'scene-tween',
      });
      line(api, svg, WX + 6, WZERO, WX + WW - 6, WZERO, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      label(api, svg, WX - 6, WZERO + 4, '0', { 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });

      ridgeBars = [];
      lassoBars = [];
      zeroRings = [];
      for (let k = 0; k < 6; k++) {
        const cx = WX + 18 + k * 22;
        const rBar = el('rect', {
          x: cx - 7, y: WZERO - BAR_HALF, width: 6, height: BAR_HALF, rx: 1.5, fill: 'var(--ink)', opacity: 0, class: 'scene-tween scene-slow',
        });
        rBar.style.transformOrigin = `${cx - 4}px ${WZERO}px`;
        ridgeBars.push(rBar);

        const lBar = el('rect', {
          x: cx + 1, y: WZERO - BAR_HALF, width: 6, height: BAR_HALF, rx: 1.5, fill: 'var(--ink)', opacity: 0, class: 'scene-tween scene-slow',
        });
        lBar.style.transformOrigin = `${cx + 4}px ${WZERO}px`;
        lassoBars.push(lBar);

        zeroRings.push(el('circle', {
          cx: cx + 4, cy: WZERO, r: 5, fill: 'var(--hl)', stroke: 'var(--b)', 'stroke-width': 1.75,
          opacity: 0, class: 'scene-tween',
        }));

        label(api, svg, cx, WY + WH + 18, `w${k + 1}`, {
          'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value',
        });
      }

      // Legend at bottom for Ridge vs Lasso
      legendGroup = el('g', { opacity: 0, class: 'scene-tween' });
      el('rect', { x: WX, y: 266, width: 10, height: 10, rx: 2, fill: 'var(--a)' }, legendGroup);
      label(api, legendGroup, WX + 16, 276, t('ridge'), { fill: 'var(--muted)', 'font-size': 13 });
      el('rect', { x: WX + 82, y: 266, width: 10, height: 10, rx: 2, fill: 'var(--b)' }, legendGroup);
      label(api, legendGroup, WX + 98, 276, t('lasso'), { fill: 'var(--muted)', 'font-size': 13 });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        unregCurve.setAttribute('stroke-dashoffset', '1');
        unregCurve.setAttribute('opacity', '0');
        ridgeBars.forEach((b, k) => setBar(b, unregWeights[k] * UNSCALED_FACTORS[k], 0, false));
        lassoBars.forEach((b, k) => setBar(b, unregWeights[k] * UNSCALED_FACTORS[k], 0, false));
        alphaBadge.setAttribute('opacity', '0');
      } else if (i === 3) {
        // Start from α = 0 curve with red miss ticks to held-out test points, then watch regularization fix test error.
        applyFrame(1, api);
        testRings.forEach(r => r.setAttribute('opacity', '1'));
        testMissUnreg.forEach(tick => {
          tick.setAttribute('stroke-dashoffset', '0');
          tick.setAttribute('opacity', '0.85');
        });
        legendGroup.setAttribute('opacity', '1');
        for (let k = 0; k < 6; k++) {
          ridgeBars[k].setAttribute('fill', 'var(--a)');
          lassoBars[k].setAttribute('fill', 'var(--b)');
        }
      } else {
        applyFrame(i - 1, api);
      }
    },
  });
}
