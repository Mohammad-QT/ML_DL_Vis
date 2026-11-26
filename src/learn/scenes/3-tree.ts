import { buildTree } from '../../engine/models/tree';
import type { Sample } from '../../engine/types';
import { defineScene } from '../scene';
import { label, line } from './svg';

const BX = 22;
const BY = 50;
const BW = 204;
const BH = 196;

// Three clean clusters so CART picks x first, then y inside the right half.
const rawGroups: Array<{ c: 0 | 1; pts: Array<[number, number]> }> = [
  {
    c: 0,
    pts: [
      [0.14, 0.22], [0.24, 0.18], [0.34, 0.29], [0.16, 0.45],
      [0.31, 0.51], [0.15, 0.71], [0.28, 0.78], [0.37, 0.68],
    ],
  },
  {
    c: 1,
    pts: [
      [0.58, 0.16], [0.71, 0.20], [0.85, 0.15],
      [0.62, 0.34], [0.77, 0.31], [0.88, 0.38],
    ],
  },
  {
    c: 0,
    pts: [
      [0.59, 0.63], [0.74, 0.61], [0.86, 0.70], [0.68, 0.83],
    ],
  },
];

const QUERY_PT = { x: 0.74, y: 0.24 };

const TREE_ROOT = { x: 306, y: 82 };
const TREE_LEAF_L = { x: 268, y: 150 };
const TREE_NODE_R = { x: 344, y: 150 };
const TREE_LEAF_RL = { x: 312, y: 218 };
const TREE_LEAF_RR = { x: 374, y: 218 };

export default function treeScene() {
  let sx1 = BX + BW * 0.47;
  let sy2 = BY + BH * 0.49;

  let probeGroup: SVGGElement;
  let probeLine: SVGLineElement;
  let probeText: SVGTextElement;
  let split1: SVGLineElement;
  let split1Glow: SVGLineElement;
  let split2: SVGLineElement;
  let split2Glow: SVGLineElement;
  let regLeft: SVGRectElement;
  let regTopRight: SVGRectElement;
  let regBotRight: SVGRectElement;
  let pureBadge: SVGTextElement;
  let dots: SVGCircleElement[] = [];
  let queryRing: SVGCircleElement;
  let queryDot: SVGCircleElement;

  let treeGroup: SVGGElement;
  let branchRGroup: SVGGElement;
  let treePathGlow: SVGPathElement;
  let traveler: SVGCircleElement;
  let leafRing: SVGCircleElement;

  function px(nx: number) { return BX + nx * BW; }
  function py(ny: number) { return BY + ny * BH; }

  function setProbe(vertical: boolean, pos: number, show: boolean) {
    probeGroup.setAttribute('opacity', show ? '1' : '0');
    if (vertical) {
      probeLine.setAttribute('x1', '0');
      probeLine.setAttribute('y1', String(BY));
      probeLine.setAttribute('x2', '0');
      probeLine.setAttribute('y2', String(BY + BH));
      probeText.setAttribute('x', '0');
      probeText.setAttribute('y', String(BY - 8));
      probeGroup.style.transform = `translate(${(BX + pos * BW).toFixed(1)}px, 0px)`;
    } else {
      probeLine.setAttribute('x1', String(BX));
      probeLine.setAttribute('y1', '0');
      probeLine.setAttribute('x2', String(BX + BW));
      probeLine.setAttribute('y2', '0');
      probeText.setAttribute('x', String(BX + BW * 0.5));
      probeText.setAttribute('y', '-8');
      probeGroup.style.transform = `translate(0px, ${(BY + pos * BH).toFixed(1)}px)`;
    }
  }

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function applyFrame(i: number) {
    setProbe(true, 0.58, i === 0);
    delay(probeGroup, 0);

    const hasSplit1 = i >= 1;
    const hasSplit2 = i >= 2;
    split1.setAttribute('stroke-dashoffset', hasSplit1 ? '0' : '1');
    split1.setAttribute('opacity', hasSplit1 ? '1' : '0');
    delay(split1, 0);
    split1Glow.setAttribute('opacity', i === 1 ? '0.65' : '0');
    delay(split1Glow, 0);

    split2.setAttribute('stroke-dashoffset', hasSplit2 ? '0' : '1');
    split2.setAttribute('opacity', hasSplit2 ? '1' : '0');
    delay(split2, 0);
    split2Glow.setAttribute('opacity', i === 2 ? '0.65' : '0');
    delay(split2Glow, 0);

    regLeft.setAttribute('opacity', hasSplit1 ? '0.15' : '0');
    delay(regLeft, i === 1 ? 500 : 0);
    regTopRight.setAttribute('opacity', hasSplit2 ? '0.16' : '0');
    delay(regTopRight, i === 2 ? 500 : 0);
    regBotRight.setAttribute('opacity', hasSplit2 ? '0.15' : '0');
    delay(regBotRight, i === 2 ? 500 : 0);
    pureBadge.setAttribute('opacity', i === 1 ? '1' : '0');
    delay(pureBadge, i === 1 ? 750 : 0);

    const isQuery = i === 3;
    dots.forEach(dot => {
      dot.setAttribute('opacity', isQuery ? '0.55' : '1');
      delay(dot, 0);
    });
    queryDot.setAttribute('opacity', isQuery ? '1' : '0');
    queryDot.setAttribute('fill', isQuery ? 'var(--b)' : 'var(--muted)');
    delay(queryDot, isQuery ? 1000 : 0);
    queryRing.setAttribute('opacity', isQuery ? '1' : '0');
    delay(queryRing, 0);

    treeGroup.setAttribute('opacity', i === 0 ? '0.28' : '1');
    delay(treeGroup, i === 1 ? 500 : 0);
    branchRGroup.setAttribute('opacity', hasSplit2 ? '1' : '0.3');
    delay(branchRGroup, i === 2 ? 500 : 0);
    treePathGlow.setAttribute('stroke-dashoffset', isQuery ? '0' : '1');
    treePathGlow.setAttribute('opacity', isQuery ? '1' : '0');
    delay(treePathGlow, isQuery ? 350 : 0);
    leafRing.setAttribute('opacity', isQuery ? '1' : '0');
    delay(leafRing, isQuery ? 1000 : 0);
    traveler.setAttribute('opacity', '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      const samples: Sample[] = rawGroups.flatMap(g =>
        g.pts.map(([x, y]) => ({
          x: x + 0.03 * (random() - 0.5),
          y: y + 0.03 * (random() - 0.5),
          c: g.c,
        })),
      );
      const root = buildTree(samples, 0, 2);
      if ('f' in root) {
        sx1 = px(root.t);
        if ('f' in root.r) sy2 = py(root.r.t);
      }

      // Board base
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const regions = el('g');
      regLeft = el('rect', { x: BX, y: BY, width: sx1 - BX, height: BH, fill: 'var(--a)', opacity: 0, class: 'scene-tween' }, regions);
      regTopRight = el('rect', { x: sx1, y: BY, width: BX + BW - sx1, height: sy2 - BY, fill: 'var(--b)', opacity: 0, class: 'scene-tween' }, regions);
      regBotRight = el('rect', { x: sx1, y: sy2, width: BX + BW - sx1, height: BY + BH - sy2, fill: 'var(--a)', opacity: 0, class: 'scene-tween' }, regions);

      const grid = el('g');
      for (let k = 1; k < 4; k++) {
        line(api, grid, BX + (BW * k) / 4, BY, BX + (BW * k) / 4, BY + BH);
        line(api, grid, BX, BY + (BH * k) / 4, BX + BW, BY + (BH * k) / 4);
      }
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5 });

      pureBadge = label(api, svg, (BX + sx1) / 2, BY + BH - 12, t('pure'), {
        'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--a)', opacity: 0, class: 'scene-tween',
      });

      // Split lines
      split1Glow = line(api, svg, sx1, BY, sx1, BY + BH, { stroke: 'var(--hl)', 'stroke-width': 7, opacity: 0, class: 'scene-tween' });
      split1 = line(api, svg, sx1, BY, sx1, BY + BH, {
        stroke: 'var(--ink)', 'stroke-width': 2.2, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });
      split2Glow = line(api, svg, sx1, sy2, BX + BW, sy2, { stroke: 'var(--hl)', 'stroke-width': 7, opacity: 0, class: 'scene-tween' });
      split2 = line(api, svg, sx1, sy2, BX + BW, sy2, {
        stroke: 'var(--ink)', 'stroke-width': 2.2, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      probeGroup = el('g', { opacity: 0, class: 'scene-tween' });
      probeLine = line(api, probeGroup, 0, BY, 0, BY + BH, {
        stroke: 'var(--muted)', 'stroke-width': 1.75, 'stroke-dasharray': '5 4',
      });
      probeText = label(api, probeGroup, 0, BY - 8, t('ask'), {
        'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--muted)',
      });

      const cloud = el('g');
      dots = samples.map(s => el('circle', {
        cx: px(s.x), cy: py(s.y), r: 5, fill: s.c === 0 ? 'var(--a)' : 'var(--b)',
        stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
      }, cloud));

      const qx = px(QUERY_PT.x);
      const qy = py(QUERY_PT.y);
      queryRing = el('circle', { cx: qx, cy: qy, r: 10.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween' });
      queryDot = el('circle', { cx: qx, cy: qy, r: 6.5, fill: 'var(--muted)', stroke: 'var(--paper)', 'stroke-width': 1.75, opacity: 0, class: 'scene-tween' });

      // Mini flowchart tree on the right
      treeGroup = el('g', { class: 'scene-tween' });
      line(api, treeGroup, TREE_ROOT.x, TREE_ROOT.y, TREE_LEAF_L.x, TREE_LEAF_L.y, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, treeGroup, TREE_ROOT.x, TREE_ROOT.y, TREE_NODE_R.x, TREE_NODE_R.y, { stroke: 'var(--ink)', 'stroke-width': 1.75 });

      branchRGroup = el('g', { class: 'scene-tween' }, treeGroup);
      line(api, branchRGroup, TREE_NODE_R.x, TREE_NODE_R.y, TREE_LEAF_RL.x, TREE_LEAF_RL.y, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, branchRGroup, TREE_NODE_R.x, TREE_NODE_R.y, TREE_LEAF_RR.x, TREE_LEAF_RR.y, { stroke: 'var(--ink)', 'stroke-width': 1.75 });

      treePathGlow = el('path', {
        d: `M ${TREE_ROOT.x} ${TREE_ROOT.y} L ${TREE_NODE_R.x} ${TREE_NODE_R.y} L ${TREE_LEAF_RL.x} ${TREE_LEAF_RL.y}`,
        fill: 'none', stroke: 'var(--hl)', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }, treeGroup);

      label(api, treeGroup, (TREE_ROOT.x + TREE_LEAF_L.x) / 2 - 12, (TREE_ROOT.y + TREE_LEAF_L.y) / 2 - 2, t('yes'), {
        'text-anchor': 'middle', 'font-size': 13, fill: 'var(--muted)',
      });
      label(api, treeGroup, (TREE_ROOT.x + TREE_NODE_R.x) / 2 + 12, (TREE_ROOT.y + TREE_NODE_R.y) / 2 - 2, t('no'), {
        'text-anchor': 'middle', 'font-size': 13, fill: 'var(--muted)',
      });

      // Nodes
      el('circle', { cx: TREE_ROOT.x, cy: TREE_ROOT.y, r: 12, fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': 2 }, treeGroup);
      el('circle', { cx: TREE_LEAF_L.x, cy: TREE_LEAF_L.y, r: 10, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 2 }, treeGroup);
      el('circle', { cx: TREE_NODE_R.x, cy: TREE_NODE_R.y, r: 11, fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': 2 }, branchRGroup);

      leafRing = el('circle', {
        cx: TREE_LEAF_RL.x, cy: TREE_LEAF_RL.y, r: 14, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      }, treeGroup);
      el('circle', { cx: TREE_LEAF_RL.x, cy: TREE_LEAF_RL.y, r: 10, fill: 'var(--b)', stroke: 'var(--paper)', 'stroke-width': 2 }, branchRGroup);
      el('circle', { cx: TREE_LEAF_RR.x, cy: TREE_LEAF_RR.y, r: 10, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 2 }, branchRGroup);

      traveler = el('circle', { cx: 0, cy: 0, r: 5.5, fill: 'var(--hl)', stroke: 'var(--ink)', 'stroke-width': 1.5, opacity: 0 }, treeGroup);

      // Legend
      for (const [idx, x] of [56, 224].entries()) {
        el('circle', { cx: x, cy: 274, r: 5.5, fill: idx === 0 ? 'var(--a)' : 'var(--b)' });
        label(api, svg, x + 14, 279, t(idx === 0 ? 'classA' : 'classB'), { fill: 'var(--muted)', 'font-size': 14 });
      }

      applyFrame(0);
    },
    frame(i) {
      applyFrame(i);
    },
    before(i) {
      if (i === 0) {
        applyFrame(0);
        setProbe(true, 0.25, true);
      } else if (i === 3) {
        applyFrame(2);
        dots.forEach(dot => dot.setAttribute('opacity', '0.55'));
        queryRing.setAttribute('opacity', '1');
        queryDot.setAttribute('opacity', '1');
        queryDot.setAttribute('fill', 'var(--muted)');
      } else {
        applyFrame(i - 1);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (api.reduced || !browser) return () => {};

      if (i === 0) {
        const probes: Array<[boolean, number]> = [[true, 0.24], [false, 0.34], [true, 0.58], [false, 0.65]];
        let idx = 0;
        const id = browser.setInterval(() => {
          idx = (idx + 1) % probes.length;
          setProbe(probes[idx][0], probes[idx][1], true);
        }, 680);
        return () => browser.clearInterval(id);
      }

      if (i === 3) {
        const anim = traveler.animate?.([
          { transform: `translate(${TREE_ROOT.x}px, ${TREE_ROOT.y}px)`, opacity: 1 },
          { transform: `translate(${TREE_NODE_R.x}px, ${TREE_NODE_R.y}px)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${TREE_LEAF_RL.x}px, ${TREE_LEAF_RL.y}px)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${TREE_LEAF_RL.x}px, ${TREE_LEAF_RL.y}px)`, opacity: 0 },
        ], { duration: 1500, delay: 350, iterations: Infinity });
        return () => anim?.cancel();
      }

      return () => {};
    },
  });
}
