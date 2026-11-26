import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface HeldPoint {
  score: number;
  actual: 0 | 1;
}

const points: HeldPoint[] = [
  { score: 0.94, actual: 1 },
  { score: 0.87, actual: 1 },
  { score: 0.80, actual: 1 },
  { score: 0.73, actual: 1 },
  { score: 0.64, actual: 1 },
  { score: 0.55, actual: 1 },
  { score: 0.43, actual: 1 },
  { score: 0.26, actual: 1 },
  { score: 0.59, actual: 0 },
  { score: 0.47, actual: 0 },
  { score: 0.39, actual: 0 },
  { score: 0.33, actual: 0 },
  { score: 0.24, actual: 0 },
  { score: 0.18, actual: 0 },
  { score: 0.12, actual: 0 },
  { score: 0.06, actual: 0 },
];

const TX = 32;
const TW = 336;
const TY = 48;
const TH = 72;
const POS_Y = TY + 21;
const NEG_Y = TY + 51;

const MX = 32;
const MY = 154;
const CW = 80;
const CH = 48;
const CGAP = 6;

const RX = 236;
const RY = 154;
const RW = 132;
const RH = 102;

const scoreX = (s: number) => TX + s * TW;

function setDelay(el: Element, ms: number) {
  (el as SVGElement).style.setProperty('--delay', `${ms}ms`);
}

function confusionAt(threshold: number) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const p of points) {
    const predPos = p.score >= threshold;
    if (p.actual === 1 && predPos) tp++;
    else if (p.actual === 0 && predPos) fp++;
    else if (p.actual === 1 && !predPos) fn++;
    else tn++;
  }
  const totalPos = tp + fn || 1;
  const totalNeg = fp + tn || 1;
  return { tp, fp, fn, tn, recall: tp / totalPos, fpr: fp / totalNeg };
}

function buildRocPath(): string {
  const cutoffs = [1.01, ...points.map(p => p.score).sort((a, b) => b - a), 0];
  const coords = cutoffs.map(c => {
    const { fpr, recall } = confusionAt(c);
    return `${(RX + fpr * RW).toFixed(1)} ${(RY + RH - recall * RH).toFixed(1)}`;
  });
  return `M ${coords.join(' L ')}`;
}

export default function metricsScene() {
  let thresholdGroup: SVGGElement;
  let posShade: SVGRectElement;
  let cutoffLabel: SVGTextElement;
  let dotGroups: SVGGElement[] = [];
  let dotCircles: SVGCircleElement[] = [];
  let outcomeRings: SVGCircleElement[] = [];

  let matrixGroup: SVGGElement;
  let cellCounts: Record<'fn' | 'tp' | 'tn' | 'fp', SVGTextElement>;
  let rocGroup: SVGGElement;
  let rocCurve: SVGPathElement;
  let rocDot: SVGGElement;

  function setThresholdState(threshold: number, showOutcomes: boolean, api: SceneApi, delayMs = 0) {
    const x = scoreX(threshold);
    setDelay(thresholdGroup, delayMs);
    thresholdGroup.style.transform = `translateX(${x.toFixed(1)}px)`;

    const rightFrac = Math.max(0.01, 1 - threshold);
    setDelay(posShade, delayMs);
    posShade.style.transform = `scale(${rightFrac.toFixed(3)}, 1)`;

    cutoffLabel.textContent = api.t('cutoff').replace('{n}', threshold.toFixed(2));

    const stats = confusionAt(threshold);
    cellCounts.tp.textContent = String(stats.tp);
    cellCounts.fp.textContent = String(stats.fp);
    cellCounts.fn.textContent = String(stats.fn);
    cellCounts.tn.textContent = String(stats.tn);

    points.forEach((p, idx) => {
      const predPos = p.score >= threshold;
      const right = (p.actual === 1) === predPos;
      dotCircles[idx].setAttribute('opacity', predPos ? '1' : '0.52');
      setDelay(outcomeRings[idx], showOutcomes ? delayMs : 0);
      outcomeRings[idx].setAttribute('stroke', right ? 'var(--ok)' : 'var(--bad)');
      outcomeRings[idx].setAttribute('opacity', showOutcomes ? (right ? '0.55' : '1') : '0');
    });

    const rx = RX + stats.fpr * RW;
    const ry = RY + RH - stats.recall * RH;
    setDelay(rocDot, delayMs);
    rocDot.style.transform = `translate(${rx.toFixed(1)}px, ${ry.toFixed(1)}px)`;
  }

  function applyFrame(i: number, api: SceneApi, instant = false) {
    const d = (ms: number) => (instant ? 0 : ms);

    // Points drop onto score track in Step 1
    dotGroups.forEach((g, idx) => {
      setDelay(g, d(i === 0 ? Math.min(500, idx * 28) : 0));
      g.style.transform = 'translateY(0px)';
      g.setAttribute('opacity', '1');
    });

    const hasThreshold = i >= 1;
    const hasMatrix = i >= 2;
    const hasRoc = i >= 3;
    const threshold = i === 3 ? 0.35 : 0.50;

    setThresholdState(threshold, hasMatrix, api, d(i === 3 ? 0 : 0));

    setDelay(thresholdGroup, d(i === 1 ? 0 : 0));
    thresholdGroup.setAttribute('opacity', hasThreshold ? '1' : '0');
    setDelay(cutoffLabel, d(i === 1 ? 200 : 0));
    cutoffLabel.setAttribute('opacity', hasThreshold ? '1' : '0');

    setDelay(posShade, d(i === 1 ? 450 : 0));
    posShade.setAttribute('opacity', hasThreshold ? '0.13' : '0');

    setDelay(matrixGroup, d(i === 2 ? 450 : 0));
    matrixGroup.setAttribute('opacity', hasMatrix ? '1' : '0');

    setDelay(rocGroup, d(i === 3 ? 0 : 0));
    rocGroup.setAttribute('opacity', hasRoc ? '1' : '0.18');
    setDelay(rocCurve, d(i === 3 ? 150 : 0));
    rocCurve.setAttribute('stroke-dashoffset', hasRoc ? '0' : '1');
    setDelay(rocDot, d(i === 3 ? 150 : 0));
    rocDot.setAttribute('opacity', hasRoc ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      label(api, svg, TX, 32, t('scores'), { 'font-size': 15, 'font-weight': 700 });
      cutoffLabel = label(api, svg, TX + TW, 32, '', {
        'text-anchor': 'end', 'font-size': 14, 'font-weight': 700, opacity: 0, class: 'scene-value scene-tween',
      });

      // Top score track
      el('rect', { x: TX, y: TY, width: TW, height: TH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      posShade = el('rect', {
        x: TX, y: TY, width: TW, height: TH, rx: 8, fill: 'var(--b)', opacity: 0, class: 'scene-tween scene-slow',
      });
      posShade.style.transformOrigin = `${TX + TW}px ${TY}px`;

      line(api, svg, TX, (POS_Y + NEG_Y) / 2, TX + TW, (POS_Y + NEG_Y) / 2, { stroke: 'var(--rule)', 'stroke-dasharray': '4 4' });
      label(api, svg, TX, TY + TH + 16, '0', { fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });
      label(api, svg, TX + TW / 2, TY + TH + 16, '0.5', { 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });
      label(api, svg, TX + TW, TY + TH + 16, '1', { 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });

      // Held-out points
      dotCircles = [];
      outcomeRings = [];
      dotGroups = points.map(p => {
        const g = el('g', { class: 'scene-tween' });
        const cx = scoreX(p.score);
        const cy = p.actual === 1 ? POS_Y : NEG_Y;
        outcomeRings.push(el('circle', {
          cx, cy, r: 8.5, fill: 'none', stroke: 'var(--ok)', 'stroke-width': 2, opacity: 0, class: 'scene-tween',
        }, g));
        dotCircles.push(el('circle', {
          cx, cy, r: 5, fill: p.actual === 1 ? 'var(--b)' : 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.25, class: 'scene-tween',
        }, g));
        return g;
      });

      // Movable threshold line
      thresholdGroup = el('g', { opacity: 0, class: 'scene-tween scene-slow' });
      line(api, thresholdGroup, 0, TY - 3, 0, TY + TH + 3, { stroke: 'var(--hl)', 'stroke-width': 6, opacity: 0.7 });
      line(api, thresholdGroup, 0, TY - 3, 0, TY + TH + 3, { stroke: 'var(--ink)', 'stroke-width': 2.25 });

      // Bottom-left: 2x2 confusion matrix aligned with the track quadrants (left = pred -, right = pred +)
      matrixGroup = el('g', { opacity: 0, class: 'scene-tween' });
      const cellSpec: Array<{ key: 'fn' | 'tp' | 'tn' | 'fp'; col: number; row: number; tone: string }> = [
        { key: 'fn', col: 0, row: 0, tone: 'var(--bad)' },
        { key: 'tp', col: 1, row: 0, tone: 'var(--ok)' },
        { key: 'tn', col: 0, row: 1, tone: 'var(--ok)' },
        { key: 'fp', col: 1, row: 1, tone: 'var(--bad)' },
      ];
      const counts = {} as Record<'fn' | 'tp' | 'tn' | 'fp', SVGTextElement>;
      for (const spec of cellSpec) {
        const x = MX + spec.col * (CW + CGAP);
        const y = MY + spec.row * (CH + CGAP);
        el('rect', {
          x, y, width: CW, height: CH, rx: 8, fill: 'var(--sheet)', stroke: spec.tone, 'stroke-width': 1.5,
        }, matrixGroup);
        counts[spec.key] = label(api, matrixGroup, x + CW / 2, y + 23, '0', {
          'text-anchor': 'middle', fill: spec.tone, 'font-size': 18, 'font-weight': 700, class: 'scene-value',
        });
        label(api, matrixGroup, x + CW / 2, y + 40, t(spec.key), {
          'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13,
        });
      }
      cellCounts = counts;

      // Bottom-right: ROC curve
      rocGroup = el('g', { opacity: 0.18, class: 'scene-tween' });
      el('rect', { x: RX, y: RY, width: RW, height: RH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 }, rocGroup);
      line(api, rocGroup, RX, RY + RH, RX + RW, RY, { stroke: 'var(--muted)', 'stroke-dasharray': '4 4' });
      rocCurve = el('path', {
        d: buildRocPath(), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.25, 'stroke-linejoin': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, class: 'scene-tween scene-slow',
      }, rocGroup);
      rocDot = el('g', { opacity: 0, class: 'scene-tween scene-slow' }, rocGroup);
      el('circle', { cx: 0, cy: 0, r: 7.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5 }, rocDot);
      el('circle', { cx: 0, cy: 0, r: 4, fill: 'var(--ink)', stroke: 'var(--paper)', 'stroke-width': 1.25 }, rocDot);
      label(api, rocGroup, RX + RW / 2, RY + RH + 20, t('roc'), {
        'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13,
      });

      applyFrame(0, api, true);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api, true);
        dotGroups.forEach(g => {
          g.style.transform = 'translateY(-10px)';
          g.setAttribute('opacity', '0');
        });
      } else if (i === 3) {
        applyFrame(2, api, true);
        setThresholdState(0.90, true, api, 0);
        rocGroup.setAttribute('opacity', '1');
        rocCurve.setAttribute('stroke-dashoffset', '1');
        rocDot.setAttribute('opacity', '1');
      } else {
        applyFrame(i - 1, api, true);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 3 || api.reduced || !browser) return () => {};

      const stops = [0.65, 0.48, 0.22, 0.35];
      const timers: number[] = [];
      stops.forEach((cutoff, idx) => {
        timers.push(browser.setTimeout(() => {
          setThresholdState(cutoff, true, api, 0);
        }, 1250 + idx * 420));
      });
      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
