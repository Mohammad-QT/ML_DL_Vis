import { fitReg } from '../../engine/regression';
import type { Label, Sample } from '../../engine/types';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const BX = 22;
const BY = 52;
const BW = 204;
const BH = 196;

// 16 points arranged in 4 ascending plateaus so depth-1 splits cleanly at the middle and depth-2 splits each half.
const RAW_GROUPS: Array<{ y: number; xs: number[] }> = [
  { y: 0.16, xs: [0.08, 0.13, 0.18, 0.23] },
  { y: 0.36, xs: [0.30, 0.36, 0.41, 0.46] },
  { y: 0.64, xs: [0.54, 0.59, 0.65, 0.70] },
  { y: 0.86, xs: [0.77, 0.83, 0.88, 0.93] },
];

const QUERY_X = 0.84;

const TREE_ROOT = { x: 306, y: 78 };
const TREE_NODE_L = { x: 268, y: 146 };
const TREE_NODE_R = { x: 344, y: 146 };
const TREE_LEAF_LL = { x: 246, y: 214 };
const TREE_LEAF_LR = { x: 290, y: 214 };
const TREE_LEAF_RL = { x: 322, y: 214 };
const TREE_LEAF_RR = { x: 366, y: 214 };

interface Segment {
  x0: number;
  x1: number;
  y: number;
}

function px(x: number) { return BX + x * BW; }
function py(y: number) { return BY + (1 - y) * BH; }

function setDelay(el: SVGElement, ms: number) {
  el.style.setProperty('--delay', `${ms}ms`);
}

function extractSegments(predict: (x: number) => number, samples: Sample[]): { segments: Segment[]; cuts: number[] } {
  const xs = samples.map(s => s.x).sort((a, b) => a - b);
  const mids = [0, ...xs.slice(0, -1).map((x, idx) => (x + xs[idx + 1]) / 2), 1];
  const segments: Segment[] = [];
  const cuts: number[] = [];

  for (let i = 0; i < mids.length - 1; i++) {
    const x0 = mids[i];
    const x1 = mids[i + 1];
    const val = predict((x0 + x1) / 2);
    const prev = segments[segments.length - 1];
    if (prev && Math.abs(prev.y - val) < 1e-6) {
      prev.x1 = x1;
    } else {
      if (prev) cuts.push(x0);
      segments.push({ x0, x1, y: val });
    }
  }
  return { segments, cuts };
}

export default function regTreeScene() {
  let samples: Sample[] = [];
  let cut1X = 0.5;
  let cut2Xs: number[] = [];
  let segs1: Segment[] = [];
  let segs2: Segment[] = [];
  let queryY = 0.8;

  let badge: SVGTextElement;
  let probeGroup: SVGGElement;
  let split1Glow: SVGLineElement;
  let split1Line: SVGLineElement;
  let split2Glows: SVGLineElement[] = [];
  let split2Lines: SVGLineElement[] = [];
  let step1Lines: SVGLineElement[] = [];
  let step2Lines: SVGLineElement[] = [];
  let residTicks: SVGLineElement[] = [];

  let queryAxisDot: SVGCircleElement;
  let queryDropLine: SVGLineElement;
  let queryPredRing: SVGCircleElement;
  let queryPredDot: SVGCircleElement;
  let avgBadge: SVGTextElement;

  let treeGroup: SVGGElement;
  let branchDepth2: SVGGElement;
  let treePathGlow: SVGPathElement;
  let leafRing: SVGCircleElement;
  let traveler: SVGCircleElement;

  function setProbe(x: number, show: boolean) {
    probeGroup.style.transform = `translate(${px(x).toFixed(1)}px, 0px)`;
    probeGroup.setAttribute('opacity', show ? '1' : '0');
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;

    setDelay(probeGroup, 0);
    setProbe(0.58, i === 0);

    // Split 1 (depth 1)
    const hasSplit1 = i >= 1;
    setDelay(split1Glow, i === 1 ? 0 : 0);
    split1Glow.setAttribute('opacity', i === 1 ? '0.65' : '0');
    setDelay(split1Line, i === 1 ? 80 : 0);
    split1Line.setAttribute('stroke-dashoffset', hasSplit1 ? '0' : '1');
    split1Line.setAttribute('opacity', hasSplit1 ? '1' : '0');

    // Depth-1 flat average lines
    step1Lines.forEach((l, idx) => {
      setDelay(l, i === 1 ? 450 + idx * 120 : 0);
      l.setAttribute('stroke-dashoffset', i === 1 || i === 2 ? '0' : '1');
      l.setAttribute('opacity', i === 1 ? '1' : i === 2 ? '0.35' : '0');
      l.setAttribute('stroke', i === 1 ? 'var(--a)' : 'var(--muted)');
      l.setAttribute('stroke-dasharray', i === 1 ? '1 1' : '0.05 0.04');
    });

    residTicks.forEach((tick, idx) => {
      setDelay(tick, i === 1 ? 760 + idx * 15 : 0);
      tick.setAttribute('stroke-dashoffset', i === 1 ? '0' : '1');
      tick.setAttribute('opacity', i === 1 ? '0.45' : '0');
    });

    // Depth-2 splits + 4 flat steps
    const hasSplit2 = i >= 2;
    split2Glows.forEach((g, idx) => {
      setDelay(g, i === 2 ? 150 + idx * 100 : 0);
      g.setAttribute('opacity', i === 2 ? '0.65' : '0');
    });
    split2Lines.forEach((l, idx) => {
      setDelay(l, i === 2 ? 200 + idx * 120 : 0);
      l.setAttribute('stroke-dashoffset', hasSplit2 ? '0' : '1');
      l.setAttribute('opacity', hasSplit2 ? '1' : '0');
    });
    step2Lines.forEach((l, idx) => {
      const isTarget = i === 3 && idx === step2Lines.length - 1;
      setDelay(l, i === 2 ? 600 + idx * 90 : 0);
      l.setAttribute('stroke-dashoffset', hasSplit2 ? '0' : '1');
      l.setAttribute('opacity', hasSplit2 ? '1' : '0');
      l.setAttribute('stroke', isTarget ? 'var(--b)' : 'var(--ink)');
      l.setAttribute('stroke-width', isTarget ? '3.2' : '2.5');
    });

    // Query prediction in step 3
    const isQuery = i === 3;
    setDelay(queryAxisDot, 0);
    queryAxisDot.setAttribute('opacity', isQuery ? '1' : '0');

    setDelay(queryDropLine, isQuery ? 350 : 0);
    queryDropLine.setAttribute('stroke-dashoffset', isQuery ? '0' : '1');
    queryDropLine.setAttribute('opacity', isQuery ? '1' : '0');

    setDelay(queryPredRing, isQuery ? 750 : 0);
    queryPredRing.setAttribute('opacity', isQuery ? '1' : '0');
    setDelay(queryPredDot, isQuery ? 750 : 0);
    queryPredDot.setAttribute('opacity', isQuery ? '1' : '0');

    setDelay(avgBadge, isQuery ? 850 : 0);
    avgBadge.setAttribute('opacity', isQuery ? '1' : '0');

    // Right mini-tree
    setDelay(treeGroup, 0);
    treeGroup.setAttribute('opacity', i === 0 ? '0.28' : '1');
    setDelay(branchDepth2, i === 2 ? 250 : 0);
    branchDepth2.setAttribute('opacity', hasSplit2 ? '1' : '0.28');
    setDelay(treePathGlow, isQuery ? 350 : 0);
    treePathGlow.setAttribute('stroke-dashoffset', isQuery ? '0' : '1');
    treePathGlow.setAttribute('opacity', isQuery ? '1' : '0');
    setDelay(leafRing, isQuery ? 750 : 0);
    leafRing.setAttribute('opacity', isQuery ? '1' : '0');
    traveler.setAttribute('opacity', '0');

    setDelay(badge, i === 0 ? 0 : 850);
    badge.textContent = i === 1 ? t('step1') : i === 2 ? t('step2') : i === 3 ? t('avg') : '';
    badge.setAttribute('opacity', i >= 1 ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      samples = RAW_GROUPS.flatMap(g =>
        g.xs.map(x => ({
          x,
          y: Math.max(0.08, Math.min(0.92, g.y + 0.05 * (random() - 0.5))),
          c: 0 as Label,
        })),
      );

      const m1 = fitReg('tree', { depth: 1 }, samples);
      const m2 = fitReg('tree', { depth: 2 }, samples);
      const d1 = extractSegments(m1.predict, samples);
      const d2 = extractSegments(m2.predict, samples);

      segs1 = d1.segments;
      cut1X = d1.cuts[0] ?? 0.5;
      segs2 = d2.segments;
      cut2Xs = d2.cuts.filter(c => Math.abs(c - cut1X) > 1e-4);
      queryY = m2.predict(QUERY_X);

      badge = label(api, svg, BX + BW, 33, '', {
        'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, opacity: 0, class: 'scene-tween',
      });

      // Left regression board
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const grid = el('g');
      for (let k = 1; k < 4; k++) {
        line(api, grid, BX + (BW * k) / 4, BY, BX + (BW * k) / 4, BY + BH);
        line(api, grid, BX, BY + (BH * k) / 4, BX + BW, BY + (BH * k) / 4);
      }

      // Split lines
      split1Glow = line(api, svg, px(cut1X), BY, px(cut1X), BY + BH, {
        stroke: 'var(--hl)', 'stroke-width': 7, opacity: 0, class: 'scene-tween',
      });
      split1Line = line(api, svg, px(cut1X), BY, px(cut1X), BY + BH, {
        stroke: 'var(--muted)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      split2Glows = cut2Xs.map(c => line(api, svg, px(c), BY, px(c), BY + BH, {
        stroke: 'var(--hl)', 'stroke-width': 7, opacity: 0, class: 'scene-tween',
      }));
      split2Lines = cut2Xs.map(c => line(api, svg, px(c), BY, px(c), BY + BH, {
        stroke: 'var(--muted)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }));

      // Probe line for Frame 0
      probeGroup = el('g', { opacity: 0, class: 'scene-tween scene-slow' });
      line(api, probeGroup, 0, BY, 0, BY + BH, {
        stroke: 'var(--muted)', 'stroke-width': 1.75, 'stroke-dasharray': '5 4',
      });
      label(api, probeGroup, 0, BY - 8, t('ask'), {
        'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--muted)',
      });

      // Residual ticks for depth 1
      residTicks = samples.map(s => line(api, svg, px(s.x), py(s.y), px(s.x), py(m1.predict(s.x)), {
        stroke: 'var(--muted)', 'stroke-width': 1.25, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }));

      // Step lines
      step1Lines = segs1.map(seg => line(api, svg, px(seg.x0), py(seg.y), px(seg.x1), py(seg.y), {
        stroke: 'var(--a)', 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }));

      step2Lines = segs2.map(seg => line(api, svg, px(seg.x0), py(seg.y), px(seg.x1), py(seg.y), {
        stroke: 'var(--ink)', 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }));

      // Data points
      for (const s of samples) {
        el('circle', { cx: px(s.x), cy: py(s.y), r: 4.5, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.4 });
      }

      // Query drop in Frame 3
      const qxPx = px(QUERY_X);
      const qyPx = py(queryY);
      queryDropLine = line(api, svg, qxPx, BY + BH, qxPx, qyPx, {
        stroke: 'var(--b)', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });
      queryAxisDot = el('circle', {
        cx: qxPx, cy: BY + BH, r: 5, fill: 'var(--b)', stroke: 'var(--paper)', 'stroke-width': 1.5,
        opacity: 0, class: 'scene-tween',
      });
      queryPredRing = el('circle', {
        cx: qxPx, cy: qyPx, r: 10, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5,
        opacity: 0, class: 'scene-tween',
      });
      queryPredDot = el('circle', {
        cx: qxPx, cy: qyPx, r: 5.5, fill: 'var(--b)', stroke: 'var(--paper)', 'stroke-width': 1.5,
        opacity: 0, class: 'scene-tween',
      });
      avgBadge = label(api, svg, BX + 8, BY + 20, 'x → ŷ', {
        'font-size': 13, 'font-weight': 700, fill: 'var(--b)', opacity: 0, class: 'scene-value scene-tween',
      });

      // Mini flowchart tree on the right
      treeGroup = el('g', { class: 'scene-tween' });
      line(api, treeGroup, TREE_ROOT.x, TREE_ROOT.y, TREE_NODE_L.x, TREE_NODE_L.y, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, treeGroup, TREE_ROOT.x, TREE_ROOT.y, TREE_NODE_R.x, TREE_NODE_R.y, { stroke: 'var(--ink)', 'stroke-width': 1.75 });

      branchDepth2 = el('g', { class: 'scene-tween' }, treeGroup);
      line(api, branchDepth2, TREE_NODE_L.x, TREE_NODE_L.y, TREE_LEAF_LL.x, TREE_LEAF_LL.y, { stroke: 'var(--ink)', 'stroke-width': 1.5 });
      line(api, branchDepth2, TREE_NODE_L.x, TREE_NODE_L.y, TREE_LEAF_LR.x, TREE_LEAF_LR.y, { stroke: 'var(--ink)', 'stroke-width': 1.5 });
      line(api, branchDepth2, TREE_NODE_R.x, TREE_NODE_R.y, TREE_LEAF_RL.x, TREE_LEAF_RL.y, { stroke: 'var(--ink)', 'stroke-width': 1.5 });
      line(api, branchDepth2, TREE_NODE_R.x, TREE_NODE_R.y, TREE_LEAF_RR.x, TREE_LEAF_RR.y, { stroke: 'var(--ink)', 'stroke-width': 1.5 });

      treePathGlow = el('path', {
        d: `M ${TREE_ROOT.x} ${TREE_ROOT.y} L ${TREE_NODE_R.x} ${TREE_NODE_R.y} L ${TREE_LEAF_RR.x} ${TREE_LEAF_RR.y}`,
        fill: 'none', stroke: 'var(--hl)', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }, treeGroup);

      el('circle', { cx: TREE_ROOT.x, cy: TREE_ROOT.y, r: 11, fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': 2 }, treeGroup);
      el('circle', { cx: TREE_NODE_L.x, cy: TREE_NODE_L.y, r: 9.5, fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': 1.75 }, treeGroup);
      el('circle', { cx: TREE_NODE_R.x, cy: TREE_NODE_R.y, r: 9.5, fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': 1.75 }, treeGroup);

      leafRing = el('circle', {
        cx: TREE_LEAF_RR.x, cy: TREE_LEAF_RR.y, r: 13, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5,
        opacity: 0, class: 'scene-tween',
      }, treeGroup);
      for (const [idx, leaf] of [TREE_LEAF_LL, TREE_LEAF_LR, TREE_LEAF_RL, TREE_LEAF_RR].entries()) {
        el('circle', {
          cx: leaf.x, cy: leaf.y, r: 8.5, fill: idx === 3 ? 'var(--b)' : 'var(--a)',
          stroke: 'var(--paper)', 'stroke-width': 1.75,
        }, branchDepth2);
      }

      traveler = el('circle', { cx: 0, cy: 0, r: 5.5, fill: 'var(--hl)', stroke: 'var(--ink)', 'stroke-width': 1.5, opacity: 0 }, treeGroup);

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        setProbe(0.24, true);
      } else if (i === 3) {
        applyFrame(2, api);
        queryAxisDot.setAttribute('opacity', '1');
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (api.reduced || !browser) return () => {};

      if (i === 0) {
        const positions = [0.24, 0.49, 0.74, 0.58];
        let idx = 0;
        const id = browser.setInterval(() => {
          idx = (idx + 1) % positions.length;
          setProbe(positions[idx], true);
        }, 720);
        return () => browser.clearInterval(id);
      }

      if (i === 3) {
        const anim = traveler.animate?.([
          { transform: `translate(${TREE_ROOT.x}px, ${TREE_ROOT.y}px)`, opacity: 1 },
          { transform: `translate(${TREE_NODE_R.x}px, ${TREE_NODE_R.y}px)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${TREE_LEAF_RR.x}px, ${TREE_LEAF_RR.y}px)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${TREE_LEAF_RR.x}px, ${TREE_LEAF_RR.y}px)`, opacity: 0 },
        ], { duration: 1500, delay: 250, iterations: Infinity });
        return () => anim?.cancel();
      }

      return () => {};
    },
  });
}
