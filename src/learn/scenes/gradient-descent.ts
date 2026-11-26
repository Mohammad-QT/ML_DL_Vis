import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface DataPoint {
  x: number;
  y: number;
}

interface StepState {
  w: number;
  loss: number;
  grad: number;
}

// Centered linear dataset (mean x = 0, mean y = 0) so MSE(w) is an exact smooth bowl.
const points: DataPoint[] = [
  { x: -0.85, y: -0.52 },
  { x: -0.62, y: -0.48 },
  { x: -0.36, y: -0.18 },
  { x: -0.14, y: -0.16 },
  { x: 0.14, y: 0.16 },
  { x: 0.36, y: 0.22 },
  { x: 0.62, y: 0.38 },
  { x: 0.85, y: 0.58 },
];

const W_MIN = -0.95;
const W_MAX = 0.95;
const START_W = -0.75;
const LEARNING_RATE = 0.55;

// Bowl panel bounds
const BX = 30;
const BY = 54;
const BW = 194;
const BH = 186;

// Mini scatter board bounds
const MX = 248;
const MY = 62;
const MS = 126;
const MCX = MX + MS / 2;
const MCY = MY + MS / 2;

function evaluate(w: number): StepState {
  let lossSum = 0;
  let gradSum = 0;
  for (const p of points) {
    const err = w * p.x - p.y;
    lossSum += err * err;
    gradSum += 2 * err * p.x;
  }
  return {
    w,
    loss: lossSum / points.length,
    grad: gradSum / points.length,
  };
}

function buildTrajectory(): StepState[] {
  const states: StepState[] = [evaluate(START_W)];
  for (let i = 0; i < 6; i++) {
    const prev = states[states.length - 1];
    states.push(evaluate(prev.w - LEARNING_RATE * prev.grad));
  }
  return states;
}

const MAX_LOSS = evaluate(W_MIN).loss;
const MIN_LOSS = evaluate(
  points.reduce((s, p) => s + p.x * p.y, 0) / points.reduce((s, p) => s + p.x * p.x, 0),
).loss;

const bowlX = (w: number) => BX + ((w - W_MIN) / (W_MAX - W_MIN)) * BW;
const bowlY = (loss: number) => BY + BH - ((loss - MIN_LOSS * 0.5) / (MAX_LOSS - MIN_LOSS * 0.5)) * (BH - 14);
const miniX = (x: number) => MCX + x * (MS * 0.46);
const miniY = (y: number) => MCY - y * (MS * 0.46);

export default function gradientDescentScene() {
  const states = buildTrajectory();
  const residuals: SVGLineElement[] = [];
  const trailDots: SVGCircleElement[] = [];
  const trailSegs: SVGLineElement[] = [];
  let ball: SVGGElement;
  let ballRing: SVGCircleElement;
  let slopeArrow: SVGGElement;
  let slopeLine: SVGLineElement;
  let slopeHead: SVGPathElement;
  let slopeLabel: SVGTextElement;
  let fitLine: SVGLineElement;
  let lossBar: SVGRectElement;
  let status: SVGTextElement;

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function resetDelays() {
    delay(ball, 0);
    delay(ballRing, 0);
    delay(slopeArrow, 0);
    delay(slopeLabel, 0);
    trailDots.forEach(d => delay(d, 0));
    trailSegs.forEach(s => delay(s, 0));
    delay(fitLine, 0);
    residuals.forEach(r => delay(r, 0));
    delay(lossBar, 0);
    delay(status, 0);
  }

  function showStep(stepIndex: number, opts: { showSlope: boolean; showResiduals: boolean; showRing: boolean; text: string; staged?: number }) {
    resetDelays();
    const s = states[stepIndex];
    const bx = bowlX(s.w);
    const by = bowlY(s.loss);

    ball.style.transform = `translate(${bx}px, ${by}px)`;
    ball.setAttribute('opacity', '1');
    ballRing.setAttribute('opacity', opts.showRing ? '1' : '0');

    // Slope arrow points along the downhill tangent of the loss curve.
    const dw = 0.02;
    const dx = bowlX(s.w + dw) - bowlX(s.w - dw);
    const dy = bowlY(evaluate(s.w + dw).loss) - bowlY(evaluate(s.w - dw).loss);
    const dir = s.grad > 0 ? -1 : 1;
    const angle = (Math.atan2(dir * dy, dir * dx) * 180) / Math.PI;
    const arrowLen = Math.max(14, Math.min(44, 10 + Math.abs(s.grad) * 34));
    slopeArrow.style.transform = `translate(${bx}px, ${by}px) rotate(${angle}deg)`;
    slopeArrow.setAttribute('opacity', opts.showSlope ? '1' : '0');
    slopeLine.setAttribute('x2', String(arrowLen));
    slopeHead.style.transform = `translate(${arrowLen}px, 0px)`;

    slopeLabel.setAttribute('x', String(Math.min(BX + BW - 26, Math.max(BX + 26, bx + dir * 24))));
    slopeLabel.setAttribute('y', String(Math.max(BY + 18, by - 16)));
    slopeLabel.setAttribute('opacity', opts.showSlope ? '1' : '0');

    for (let k = 0; k < trailDots.length; k++) {
      const vis = k < stepIndex;
      trailDots[k].setAttribute('opacity', vis ? '0.65' : '0');
      trailSegs[k].setAttribute('opacity', vis ? '0.6' : '0');
    }

    const lineDeg = (Math.atan2(-s.w, 1) * 180) / Math.PI;
    fitLine.style.transform = `rotate(${lineDeg}deg)`;

    for (let k = 0; k < points.length; k++) {
      const p = points[k];
      const pyPred = miniY(s.w * p.x);
      residuals[k].setAttribute('y2', String(pyPred));
      residuals[k].setAttribute('stroke-dashoffset', opts.showResiduals ? '0' : '1');
      residuals[k].setAttribute('opacity', opts.showResiduals ? '0.85' : '0');
    }

    const ratio = Math.max(0.05, Math.min(1, s.loss / states[0].loss));
    lossBar.style.transform = `scale(${ratio}, 1)`;
    lossBar.setAttribute('fill', ratio < 0.25 ? 'var(--ok)' : 'var(--bad)');

    status.textContent = opts.text;
    status.setAttribute('opacity', opts.text ? '1' : '0');

    if (opts.staged === 1) {
      delay(slopeArrow, 500);
      delay(slopeLabel, 500);
      delay(status, 750);
    } else if (opts.staged === 2) {
      delay(ball, 250);
      delay(fitLine, 250);
      delay(lossBar, 250);
      delay(ballRing, 550);
      delay(slopeArrow, 550);
      delay(slopeLabel, 550);
      delay(status, 550);
    }
  }

  function applyFrame(i: number, api: SceneApi) {
    if (i === 0) {
      showStep(0, { showSlope: false, showResiduals: false, showRing: false, text: '' });
    } else if (i === 1) {
      showStep(0, { showSlope: true, showResiduals: true, showRing: false, text: api.t('step').replace('{n}', '0'), staged: 1 });
    } else if (i === 2) {
      showStep(1, { showSlope: true, showResiduals: false, showRing: true, text: api.t('step').replace('{n}', '1'), staged: 2 });
    } else {
      showStep(states.length - 1, { showSlope: false, showResiduals: false, showRing: true, text: api.t('bottom') });
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      // Grid lines in the bowl panel
      const grid = el('g');
      for (let x = BX; x <= BX + BW; x += 32) line(api, grid, x, BY, x, BY + BH);
      for (let y = BY; y <= BY + BH; y += 37) line(api, grid, BX, y, BX + BW, y);

      label(api, svg, BX, 34, t('lossCurve'), { 'font-size': 15, 'font-weight': 700 });
      label(api, svg, MCX, 34, t('fit'), { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });

      // Loss curve path
      const curvePts: string[] = [];
      for (let k = 0; k <= 40; k++) {
        const w = W_MIN + ((W_MAX - W_MIN) * k) / 40;
        curvePts.push(`${k === 0 ? 'M' : 'L'}${bowlX(w).toFixed(1)},${bowlY(evaluate(w).loss).toFixed(1)}`);
      }
      el('path', {
        d: curvePts.join(' '), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linecap': 'round',
      }, svg);

      // Minimum dashed tick
      const optW = bowlX(states[states.length - 1].w);
      line(api, svg, optW, BY + BH - 20, optW, BY + BH + 6, { stroke: 'var(--muted)', 'stroke-dasharray': '3 3' });

      // Trails between consecutive GD states
      const trailLayer = el('g');
      for (let k = 0; k < states.length - 1; k++) {
        const a = states[k];
        const b = states[k + 1];
        trailSegs.push(line(api, trailLayer, bowlX(a.w), bowlY(a.loss), bowlX(b.w), bowlY(b.loss), {
          stroke: 'var(--a)', 'stroke-width': 1.75, 'stroke-dasharray': '3 4', opacity: 0, class: 'scene-tween',
        }));
        trailDots.push(el('circle', {
          cx: bowlX(a.w), cy: bowlY(a.loss), r: 3.5, fill: 'var(--paper)', stroke: 'var(--a)',
          'stroke-width': 1.5, opacity: 0, class: 'scene-tween',
        }, trailLayer));
      }

      // Slope arrow attached to ball position
      slopeArrow = el('g', { class: 'scene-tween', opacity: 0 }, svg);
      slopeLine = line(api, slopeArrow, 0, 0, 32, 0, { stroke: 'var(--b)', 'stroke-width': 2.5 });
      slopeHead = el('path', {
        d: 'M -6 -4 L 0 0 L -6 4', fill: 'none', stroke: 'var(--b)', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, slopeArrow);
      el('circle', { cx: 0, cy: 0, r: 2.5, fill: 'var(--b)' }, slopeArrow);
      slopeLabel = label(api, svg, 0, 0, t('slope'), {
        fill: 'var(--b)', 'font-size': 13, 'font-weight': 700, 'text-anchor': 'middle', opacity: 0, class: 'scene-tween',
      });

      // Ball
      ball = el('g', { class: 'scene-tween' }, svg);
      ballRing = el('circle', {
        cx: 0, cy: 0, r: 12, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      }, ball);
      el('circle', { cx: 0, cy: 0, r: 6.5, fill: 'var(--b)', stroke: 'var(--paper)', 'stroke-width': 1.5 }, ball);

      // Mini scatter board
      el('rect', {
        x: MX, y: MY, width: MS, height: MS, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      }, svg);

      const residLayer = el('g');
      for (const p of points) {
        const px = miniX(p.x);
        const py = miniY(p.y);
        residuals.push(line(api, residLayer, px, py, px, py, {
          stroke: 'var(--bad)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        }));
      }

      for (const p of points) {
        el('circle', { cx: miniX(p.x), cy: miniY(p.y), r: 3.5, fill: 'var(--a)' }, svg);
      }

      const axis = el('g', { transform: `translate(${MCX} ${MCY})` }, svg);
      fitLine = line(api, axis, -52, 0, 52, 0, { stroke: 'var(--ink)', 'stroke-width': 2, class: 'scene-tween' });

      // Loss bar beneath mini board
      el('rect', { x: MX, y: 204, width: MS, height: 12, rx: 4, fill: 'var(--rule)' }, svg);
      lossBar = el('rect', { x: MX, y: 204, width: MS, height: 12, rx: 4, fill: 'var(--bad)', class: 'scene-tween' }, svg);
      lossBar.style.transformOrigin = `${MX}px 210px`;

      status = label(api, svg, MX + MS, 240, '', {
        'text-anchor': 'end', 'font-size': 14, 'font-weight': 600, class: 'scene-value scene-tween', opacity: 0,
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        showStep(0, { showSlope: false, showResiduals: false, showRing: false, text: '' });
        ball.style.transform = `translate(${bowlX(START_W)}px, ${bowlY(states[0].loss) - 18}px)`;
        ball.setAttribute('opacity', '0');
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 3 || api.reduced || !browser) return () => {};
      const timers: number[] = [];
      const phaseMs = 380;
      for (let s = 1; s < states.length; s++) {
        const idx = s;
        const text = idx === states.length - 1 ? api.t('bottom') : api.t('step').replace('{n}', String(idx));
        const run = () => showStep(idx, {
          showSlope: idx < states.length - 1,
          showResiduals: false,
          showRing: true,
          text,
        });
        if (s === 1) run();
        else timers.push(browser.setTimeout(run, (s - 1) * phaseMs));
      }
      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
