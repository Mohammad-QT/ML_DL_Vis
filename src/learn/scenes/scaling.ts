import { nearest, standardize } from '../../prep/logic';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

// Reference point is index 2 (age 38, salary 52,000).
// In raw units, index 4 (age 54, salary 53,000) is nearest; after scaling, index 3 (age 39, salary 58,000) wins.
const trainRaw: number[][] = [
  [24, 34000],
  [28, 42000],
  [38, 52000],
  [39, 58000],
  [54, 53000],
  [48, 72000],
  [56, 84000],
  [33, 45000],
];

const testRaw: number[][] = [
  [30, 46000],
  [50, 74000],
];

const QUERY_IDX = 2;

const PX = 42;
const PY = 44;
const PW = 316;
const PH = 200;
const OX = 200;
const OY = 144;

const RAW_CX = 265;
const RAW_CY = 128;
const SX_RAW = 0.6;
const SY_RAW = 2.3; // per $1,000
const SX_STD = 72;
const SY_STD = 46;

const delay = (el: SVGElement, ms: number) => el.style.setProperty('--delay', `${ms}ms`);

export default function scalingScene() {
  const zAge = standardize(trainRaw.map(p => p[0]));
  const zSal = standardize(trainRaw.map(p => p[1]));
  const trainScaled = zAge.values.map((x, i) => [x, zSal.values[i]]);
  const testScaled = testRaw.map(([a, s]) => [(a - zAge.mean) / zAge.sd, (s - zSal.mean) / zSal.sd]);

  const rawNNIdx = nearest(trainRaw, QUERY_IDX);
  const scaledNNIdx = nearest(trainScaled, QUERY_IDX);

  const rawPt = ([a, s]: number[]): [number, number] => [
    RAW_CX + (a - zAge.mean) * SX_RAW,
    RAW_CY - ((s - zSal.mean) / 1000) * SY_RAW,
  ];
  const centPt = ([a, s]: number[]): [number, number] => [
    OX + (a - zAge.mean) * SX_RAW,
    OY - ((s - zSal.mean) / 1000) * SY_RAW,
  ];
  const stdPt = ([za, zs]: number[]): [number, number] => [
    OX + za * SX_STD,
    OY - zs * SY_STD,
  ];

  const trainDots: SVGGElement[] = [];
  const testGroups: SVGGElement[] = [];
  const testRings: SVGCircleElement[] = [];
  let queryRing: SVGCircleElement;
  let nnRingRaw: SVGCircleElement;
  let nnRingStd: SVGCircleElement;
  let rawEdgeGroup: SVGGElement;
  let rawEdge: SVGLineElement;
  let stdEdge: SVGLineElement;
  let spreadGroup: SVGGElement;
  let spreadBox: SVGRectElement;
  let meanLines: SVGGElement;
  let formulaTag: SVGTextElement;
  let zeroMark: SVGTextElement;
  let testLegend: SVGGElement;

  function applyFrame(i: number, api: SceneApi, isBeforeZero = false) {
    const posAt = (idx: number) =>
      i === 0 ? rawPt(trainRaw[idx]) : i === 1 ? centPt(trainRaw[idx]) : stdPt(trainScaled[idx]);

    const moveMs = isBeforeZero || i === 0 ? 0 : i === 1 || i === 2 ? 320 : 0;

    trainDots.forEach((g, idx) => {
      const [x, y] = posAt(idx);
      delay(g, moveMs);
      g.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });

    // Mean crosshairs & ±1σ spread box (animated smoothly via transform)
    const boxCx = i === 0 ? RAW_CX : OX;
    const boxCy = i === 0 ? RAW_CY : OY;
    const halfW = i <= 1 ? zAge.sd * SX_RAW : SX_STD;
    const halfH = i <= 1 ? (zSal.sd / 1000) * SY_RAW : SY_STD;
    const boxDelay = isBeforeZero ? 0 : i === 0 ? 450 : i === 1 || i === 2 ? 320 : 0;

    delay(meanLines, boxDelay);
    meanLines.style.transform = `translate(${boxCx}px, ${boxCy}px)`;
    meanLines.setAttribute('opacity', isBeforeZero ? '0' : '0.85');

    delay(spreadGroup, boxDelay);
    spreadGroup.style.transform = `translate(${boxCx}px, ${boxCy}px) scale(${(halfW / 50).toFixed(3)}, ${(halfH / 50).toFixed(3)})`;
    delay(spreadBox, boxDelay);
    spreadBox.setAttribute('opacity', isBeforeZero ? '0' : i === 3 ? '0.45' : '1');
    spreadBox.setAttribute('stroke', i === 2 ? 'var(--ok)' : 'var(--hl)');

    // Query & nearest-neighbour rings
    const [qx, qy] = posAt(QUERY_IDX);
    delay(queryRing, moveMs);
    queryRing.style.transform = `translate(${qx.toFixed(1)}px, ${qy.toFixed(1)}px)`;
    queryRing.setAttribute('opacity', i === 3 ? '0.45' : '1');

    const [ax, ay] = posAt(rawNNIdx);
    delay(nnRingRaw, moveMs);
    nnRingRaw.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
    nnRingRaw.setAttribute('opacity', i <= 1 ? '1' : '0');

    const [bx, by] = posAt(scaledNNIdx);
    delay(nnRingStd, i === 2 ? 950 : 0);
    nnRingStd.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
    nnRingStd.setAttribute('opacity', i === 2 ? '1' : '0');

    // Raw NN edge translates with the cloud from RAW_CX,RAW_CY to OX,OY
    const edgeShiftX = i === 0 ? RAW_CX : OX;
    const edgeShiftY = i === 0 ? RAW_CY : OY;
    delay(rawEdgeGroup, isBeforeZero ? 0 : i === 1 ? 320 : 0);
    rawEdgeGroup.style.transform = `translate(${edgeShiftX}px, ${edgeShiftY}px)`;
    delay(rawEdge, isBeforeZero ? 0 : i === 1 ? 320 : 0);
    rawEdge.setAttribute('stroke-dashoffset', i <= 1 ? '0' : '1');
    rawEdge.setAttribute('opacity', i <= 1 ? '1' : '0');

    // Scaled NN edge draws in step 2
    delay(stdEdge, i === 2 ? 950 : 0);
    stdEdge.setAttribute('stroke-dashoffset', i === 2 ? '0' : '1');
    stdEdge.setAttribute('opacity', i === 2 ? '1' : '0');

    // Origin 0 label appears when centred
    delay(zeroMark, i === 1 ? 750 : 0);
    zeroMark.setAttribute('opacity', i >= 1 ? '1' : '0');

    // Top-right formula pill
    const formulas = ['μ, σ', 'x − μ', '(x − μ) / σ', `μ, σ → ${api.t('test')}`];
    formulaTag.textContent = formulas[i];
    delay(formulaTag, isBeforeZero ? 0 : i === 0 ? 450 : 250);
    formulaTag.setAttribute('opacity', isBeforeZero ? '0' : '1');

    // Test points (appear at raw coords in step 3 at 0ms, then slide to scaled coords at 360ms)
    const showTest = i === 3;
    testGroups.forEach((g, idx) => {
      const [tx, ty] = showTest ? stdPt(testScaled[idx]) : rawPt(testRaw[idx]);
      delay(g, showTest ? 360 : 0);
      g.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    });
    testRings.forEach(c => {
      delay(c, 0);
      c.setAttribute('opacity', showTest ? '1' : '0');
    });
    delay(testLegend, 0);
    testLegend.setAttribute('opacity', showTest ? '1' : '0.38');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      // Plot frame and subtle grid
      el('rect', {
        x: PX, y: PY, width: PW, height: PH, rx: 10,
        fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      });
      line(api, svg, PX, OY, PX + PW, OY, { stroke: 'var(--rule)', 'stroke-dasharray': '4 4' });
      line(api, svg, OX, PY, OX, PY + PH, { stroke: 'var(--rule)', 'stroke-dasharray': '4 4' });

      // Labels
      label(api, svg, PX, 32, t('salary'), { fill: 'var(--muted)', 'font-size': 13, 'font-weight': 600 });
      formulaTag = label(api, svg, PX + PW, 32, 'μ, σ', {
        'text-anchor': 'end', 'font-size': 14, 'font-weight': 700, class: 'scene-value scene-tween',
      });
      label(api, svg, PX + PW, PY + PH + 18, t('age'), {
        'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, 'font-weight': 600,
      });
      zeroMark = label(api, svg, OX - 8, OY + 16, '0', {
        'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, opacity: 0, class: 'scene-value scene-tween',
      });

      // Mean crosshairs & ±1σ spread box
      meanLines = el('g', { class: 'scene-tween scene-slow', opacity: 0 });
      line(api, meanLines, -28, 0, 28, 0, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      line(api, meanLines, 0, -28, 0, 28, { stroke: 'var(--muted)', 'stroke-width': 1.5 });

      spreadGroup = el('g', { class: 'scene-tween scene-slow' });
      spreadBox = el('rect', {
        x: -50, y: -50, width: 100, height: 100, rx: 6,
        fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2, 'stroke-dasharray': '5 4',
        'vector-effect': 'non-scaling-stroke', opacity: 0, class: 'scene-tween',
      }, spreadGroup);

      // Nearest-neighbour lines (raw edge in cloud-local coords so it translates smoothly with the cloud)
      const [r0x, r0y] = centPt(trainRaw[QUERY_IDX]);
      const [r1x, r1y] = centPt(trainRaw[rawNNIdx]);
      rawEdgeGroup = el('g', { class: 'scene-tween scene-slow' });
      rawEdge = line(api, rawEdgeGroup, r0x - OX, r0y - OY, r1x - OX, r1y - OY, {
        stroke: 'var(--bad)', 'stroke-width': 2.2, pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      const [s0x, s0y] = stdPt(trainScaled[QUERY_IDX]);
      const [s1x, s1y] = stdPt(trainScaled[scaledNNIdx]);
      stdEdge = line(api, svg, s0x, s0y, s1x, s1y, {
        stroke: 'var(--ok)', 'stroke-width': 2.5, pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      // Rings
      queryRing = el('circle', {
        cx: 0, cy: 0, r: 10, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.2, class: 'scene-tween scene-slow',
      });
      nnRingRaw = el('circle', {
        cx: 0, cy: 0, r: 10, fill: 'none', stroke: 'var(--bad)', 'stroke-width': 2, class: 'scene-tween scene-slow',
      });
      nnRingStd = el('circle', {
        cx: 0, cy: 0, r: 10, fill: 'none', stroke: 'var(--ok)', 'stroke-width': 2.2, opacity: 0, class: 'scene-tween',
      });

      // Training dots
      const trainLayer = el('g');
      trainRaw.forEach((_, idx) => {
        const g = el('g', { class: 'scene-tween scene-slow' }, trainLayer);
        const isQuery = idx === QUERY_IDX;
        el('circle', {
          cx: 0, cy: 0, r: isQuery ? 6 : 5,
          fill: isQuery ? 'var(--ink)' : 'var(--a)',
          stroke: 'var(--paper)', 'stroke-width': 1.5,
        }, g);
        trainDots.push(g);
      });

      // Test dots (ringed)
      const testLayer = el('g');
      testRaw.forEach(() => {
        const g = el('g', { class: 'scene-tween scene-slow' }, testLayer);
        const dot = el('circle', {
          cx: 0, cy: 0, r: 6, fill: 'var(--b)', stroke: 'var(--ink)', 'stroke-width': 2.2,
          opacity: 0, class: 'scene-tween',
        }, g);
        testGroups.push(g);
        testRings.push(dot);
      });

      // Bottom legend
      el('circle', { cx: 48, cy: 278, r: 5, fill: 'var(--a)' });
      label(api, svg, 60, 283, t('train'), { fill: 'var(--muted)', 'font-size': 13 });

      testLegend = el('g', { class: 'scene-tween' });
      el('circle', { cx: 152, cy: 278, r: 5, fill: 'var(--b)', stroke: 'var(--ink)', 'stroke-width': 2 }, testLegend);
      label(api, testLegend, 164, 283, t('test'), { fill: 'var(--muted)', 'font-size': 13 });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) applyFrame(0, api, true);
      else applyFrame(i - 1, api);
    },
  });
}
