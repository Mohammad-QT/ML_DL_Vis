import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const TRUE_RATES = [0.25, 0.72, 0.45];
const AD_COLORS = ['var(--a)', 'var(--ok)', 'var(--b)'];
const ROW_Y = [98, 166, 234];
const X_LEFT = 98;
const X_WIDTH = 264;
const CURVE_MAX_H = 44;
const TOTAL_ROUNDS = 24;

interface RoundSnapshot {
  round: number;
  alpha: number[];
  beta: number[];
  samples: number[];
  chosen: number;
  click: boolean;
}

function sampleGamma(k: number, random: () => number): number {
  let sum = 0;
  for (let i = 0; i < k; i++) sum -= Math.log(random() + 1e-9);
  return sum;
}

function sampleBeta(a: number, b: number, random: () => number): number {
  const g1 = sampleGamma(a, random);
  const g2 = sampleGamma(b, random);
  return g1 / (g1 + g2 || 1);
}

function betaPath(a: number, b: number, baseY: number): string {
  const steps = 44;
  if (a === 1 && b === 1) {
    const h = 0.34 * CURVE_MAX_H;
    return `M ${X_LEFT} ${baseY} L ${X_LEFT} ${baseY - h} L ${X_LEFT + X_WIDTH} ${baseY - h} L ${X_LEFT + X_WIDTH} ${baseY} Z`;
  }
  const vals: number[] = [];
  let maxLog = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const u = Math.min(0.995, Math.max(0.005, i / steps));
    const lp = (a - 1) * Math.log(u) + (b - 1) * Math.log(1 - u);
    vals.push(lp);
    if (lp > maxLog) maxLog = lp;
  }
  const scale = Math.min(1, 0.34 + 0.14 * Math.sqrt(a + b - 2)) * CURVE_MAX_H;
  const pts = vals.map((lp, i) => {
    const x = X_LEFT + (i / steps) * X_WIDTH;
    const h = Math.exp(lp - maxLog) * scale;
    return `${x.toFixed(1)} ${(baseY - h).toFixed(1)}`;
  });
  return `M ${X_LEFT} ${baseY} L ${pts.join(' L ')} L ${X_LEFT + X_WIDTH} ${baseY} Z`;
}

function simulateThompson(random: () => number): RoundSnapshot[] {
  const alpha = [1, 1, 1];
  const beta = [1, 1, 1];
  const history: RoundSnapshot[] = [];

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const samples = [0, 1, 2].map(i => sampleBeta(alpha[i], beta[i], random));
    let chosen = 0;
    for (let i = 1; i < 3; i++) if (samples[i] > samples[chosen]) chosen = i;
    const click = random() < TRUE_RATES[chosen];
    const nextAlpha = [...alpha];
    const nextBeta = [...beta];
    if (click) nextAlpha[chosen] += 1;
    else nextBeta[chosen] += 1;

    history.push({
      round,
      alpha: [...alpha],
      beta: [...beta],
      samples,
      chosen,
      click,
    });
    alpha[chosen] = nextAlpha[chosen];
    beta[chosen] = nextBeta[chosen];
  }
  return history;
}

export default function thompsonScene() {
  let history: RoundSnapshot[] = [];
  const curves: SVGPathElement[] = [];
  const dots: SVGCircleElement[] = [];
  let winRing: SVGCircleElement;
  let guide: SVGLineElement;
  let badge: SVGTextElement;
  let status: SVGTextElement;

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function resetDelays() {
    curves.forEach(c => delay(c, 0));
    dots.forEach(d => delay(d, 0));
    delay(winRing, 0);
    delay(guide, 0);
    delay(badge, 0);
  }

  function drawCurves(alpha: number[], beta: number[], opacity = '1', focus = -1) {
    for (let a = 0; a < 3; a++) {
      curves[a].setAttribute('d', betaPath(alpha[a], beta[a], ROW_Y[a]));
      curves[a].setAttribute('opacity', opacity);
      curves[a].setAttribute('stroke-width', a === focus ? '3' : '2');
    }
  }

  function drawSamples(samples: number[], chosen: number, visible: boolean) {
    for (let a = 0; a < 3; a++) {
      const cx = X_LEFT + samples[a] * X_WIDTH;
      dots[a].setAttribute('cx', cx.toFixed(1));
      dots[a].setAttribute('opacity', visible ? '1' : '0');
    }
    const winX = X_LEFT + samples[chosen] * X_WIDTH;
    winRing.setAttribute('cx', winX.toFixed(1));
    winRing.setAttribute('cy', String(ROW_Y[chosen]));
    winRing.setAttribute('opacity', visible ? '1' : '0');

    guide.setAttribute('x1', winX.toFixed(1));
    guide.setAttribute('x2', winX.toFixed(1));
    guide.setAttribute('opacity', visible ? '0.65' : '0');
  }

  function applyFrame(i: number, api: SceneApi) {
    resetDelays();
    const first = history[0];
    if (i === 0) {
      drawCurves(first.alpha, first.beta, '1');
      curves.forEach((c, a) => delay(c, a * 220));
      drawSamples(first.samples, first.chosen, false);
      badge.setAttribute('opacity', '0');
      status.textContent = api.t('round').replace('{n}', '0');
    } else if (i === 1) {
      drawCurves(first.alpha, first.beta, '1');
      drawSamples(first.samples, first.chosen, true);
      dots.forEach((d, a) => delay(d, a * 200));
      delay(winRing, 750);
      delay(guide, 750);
      badge.setAttribute('opacity', '0');
      status.textContent = api.t('round').replace('{n}', '1');
    } else if (i === 2) {
      const next = history[1];
      drawCurves(next.alpha, next.beta, '1', first.chosen);
      delay(curves[first.chosen], 300);
      drawSamples(first.samples, first.chosen, false);
      badge.textContent = api.t(first.click ? 'click' : 'miss');
      badge.setAttribute('fill', first.click ? 'var(--ok)' : 'var(--bad)');
      badge.setAttribute('y', String(ROW_Y[first.chosen] - 26));
      badge.setAttribute('opacity', '1');
      delay(badge, 700);
      status.textContent = api.t('round').replace('{n}', '1');
    } else {
      const last = history[history.length - 1];
      drawCurves(last.alpha, last.beta, '1');
      drawSamples(last.samples, last.chosen, true);
      badge.setAttribute('opacity', '0');
      status.textContent = api.t('round').replace('{n}', String(last.round));
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;
      history = simulateThompson(random);

      status = label(api, svg, X_LEFT + X_WIDTH, 30, '', {
        'text-anchor': 'end', 'font-size': 14, 'font-weight': 600, class: 'scene-value',
      });

      const adKeys = ['ad1', 'ad2', 'ad3'];
      for (let a = 0; a < 3; a++) {
        const y = ROW_Y[a];
        line(api, svg, X_LEFT, y, X_LEFT + X_WIDTH, y, { stroke: 'var(--rule)', 'stroke-width': 1.5 });
        label(api, svg, 24, y - 4, t(adKeys[a]), {
          fill: AD_COLORS[a], 'font-size': 14, 'font-weight': 700,
        });
        const path = el('path', {
          d: betaPath(1, 1, y),
          fill: AD_COLORS[a], 'fill-opacity': 0.18,
          stroke: AD_COLORS[a], 'stroke-width': 2, 'stroke-linejoin': 'round',
          class: 'scene-tween',
        }, svg);
        curves.push(path);
      }

      guide = line(api, svg, X_LEFT, 48, X_LEFT, 244, {
        stroke: 'var(--hl)', 'stroke-width': 1.75, 'stroke-dasharray': '4 4', opacity: 0, class: 'scene-tween',
      });

      for (let a = 0; a < 3; a++) {
        dots.push(el('circle', {
          cx: X_LEFT, cy: ROW_Y[a], r: 5.5,
          fill: AD_COLORS[a], stroke: 'var(--paper)', 'stroke-width': 1.75,
          opacity: 0, class: 'scene-tween',
        }, svg));
      }

      winRing = el('circle', {
        cx: X_LEFT, cy: ROW_Y[0], r: 10, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.75,
        opacity: 0, class: 'scene-tween',
      }, svg);

      badge = label(api, svg, X_LEFT + X_WIDTH, 70, '', {
        'text-anchor': 'end', 'font-size': 14, 'font-weight': 700, opacity: 0, class: 'scene-tween',
      });

      // Shared 0 to 1 axis labels at bottom.
      for (const [frac, txt] of [[0, '0'], [0.5, '0.5'], [1, '1']] as const) {
        label(api, svg, X_LEFT + frac * X_WIDTH, 266, txt, {
          'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value',
        });
      }

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        curves.forEach(c => c.setAttribute('opacity', '0'));
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 3 || api.reduced || !browser) return () => {};

      const timers: number[] = [];
      const steps = history.slice(1);
      const stepMs = Math.min(85, Math.floor(2000 / steps.length));
      steps.forEach((snap, idx) => {
        const draw = () => {
          resetDelays();
          drawCurves(snap.alpha, snap.beta, '1');
          drawSamples(snap.samples, snap.chosen, true);
          status.textContent = api.t('round').replace('{n}', String(snap.round));
        };
        if (idx === 0) draw();
        else timers.push(browser.setTimeout(draw, idx * stepMs));
      });

      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
