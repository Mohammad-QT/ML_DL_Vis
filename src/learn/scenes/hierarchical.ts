import { cutWard, ward, type Sample, type WardNode } from '../../engine/clustering';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const colors = ['var(--a)', 'var(--b)', 'var(--ok)'];

const samples: Sample[] = [
  { x: 0.18, y: 0.24 },
  { x: 0.30, y: 0.31 },
  { x: 0.44, y: 0.78 },
  { x: 0.62, y: 0.72 },
  { x: 0.74, y: 0.25 },
  { x: 0.87, y: 0.43 },
];

const toBoard = (point: Sample) => ({
  x: 24 + point.x * 160,
  y: 54 + point.y * 184,
});

interface LayoutNode {
  node: WardNode;
  x: number;
  y: number;
  left?: LayoutNode;
  right?: LayoutNode;
}

interface MergeStep {
  layout: LayoutNode;
  join: SVGPathElement;
  link: SVGLineElement;
  leafIds: number[];
  nodeBelowCut: boolean;
}

function collectLeaves(node: WardNode, out: number[] = []): number[] {
  if (node.children) {
    collectLeaves(node.children[0], out);
    collectLeaves(node.children[1], out);
  } else {
    out.push(node.id);
  }
  return out;
}

export default function hierarchicalScene() {
  const root = ward(samples)!;
  const maxHeight = root.height || 1;
  const baseY = 238;
  const treeSpan = 160;
  const leafX = (slot: number) => 244 + slot * 24;
  const heightY = (h: number) => baseY - (h / maxHeight) * treeSpan;

  let leafSlot = 0;
  const leavesById = new Map<number, LayoutNode>();
  const internals: LayoutNode[] = [];

  function buildLayout(node: WardNode): LayoutNode {
    if (!node.children) {
      const laid: LayoutNode = { node, x: leafX(leafSlot++), y: baseY };
      leavesById.set(node.id, laid);
      return laid;
    }
    const left = buildLayout(node.children[0]);
    const right = buildLayout(node.children[1]);
    const laid: LayoutNode = {
      node,
      x: (left.x + right.x) / 2,
      y: heightY(node.height),
      left,
      right,
    };
    internals.push(laid);
    return laid;
  }

  buildLayout(root);
  internals.sort((a, b) => a.node.height - b.node.height);

  // Pick a cut right inside the wide gap before the top two merges so 3 clusters stand out.
  const cutHeight = (internals[2].node.height + internals[3].node.height) / 2;
  const cutResult = cutWard(root, cutHeight);
  const cutY = heightY(cutHeight);

  let dots: SVGCircleElement[] = [];
  let dotRings: SVGCircleElement[] = [];
  let leafDots: SVGCircleElement[] = [];
  let merges: MergeStep[] = [];
  let cutLine: SVGLineElement;
  let cutMarks: SVGCircleElement[] = [];
  let cutLegend: SVGLineElement;
  let cutLegendText: SVGTextElement;
  let countNum: SVGTextElement;

  function showTreeThrough(mergeIndex: number, clusterCount: number, highlightMerge: number) {
    merges.forEach((merge, idx) => {
      const visible = idx <= mergeIndex;
      const active = idx === highlightMerge;
      merge.join.setAttribute('stroke-dashoffset', visible ? '0' : '1');
      merge.join.setAttribute('opacity', visible ? '1' : '0');
      merge.join.setAttribute('stroke', active ? 'var(--a)' : 'var(--ink)');
      merge.join.setAttribute('stroke-width', active ? '2.5' : '2');

      merge.link.setAttribute('stroke-dashoffset', visible ? '0' : '1');
      merge.link.setAttribute('opacity', visible ? (idx <= 2 ? '0.65' : '0.4') : '0');
      merge.link.setAttribute('stroke', active ? 'var(--a)' : 'var(--muted)');
    });

    const mergedLeaves = new Set<number>();
    merges.slice(0, mergeIndex + 1).forEach(m => m.leafIds.forEach(id => mergedLeaves.add(id)));

    dots.forEach((dot, id) => {
      const inHighlight = highlightMerge >= 0 && merges[highlightMerge].leafIds.includes(id);
      const inAny = mergedLeaves.has(id);
      dot.setAttribute('fill', inHighlight ? 'var(--a)' : inAny ? 'var(--ink)' : 'var(--muted)');
      dot.setAttribute('opacity', highlightMerge >= 0 && !inHighlight ? '0.65' : '1');
      dot.setAttribute('transform', 'scale(1)');
      dotRings[id].setAttribute('opacity', inHighlight ? '1' : mergeIndex < 0 ? '0.45' : '0');
    });

    leafDots.forEach((leaf, id) => {
      const inHighlight = highlightMerge >= 0 && merges[highlightMerge].leafIds.includes(id);
      const inAny = mergedLeaves.has(id);
      leaf.setAttribute('fill', inHighlight ? 'var(--a)' : inAny ? 'var(--ink)' : 'var(--muted)');
      leaf.setAttribute('opacity', '1');
      leaf.setAttribute('transform', 'scale(1)');
    });

    cutLine.setAttribute('stroke-dashoffset', '1');
    cutLine.setAttribute('opacity', '0');
    cutMarks.forEach(mark => mark.setAttribute('opacity', '0'));
    cutLegend.setAttribute('opacity', '0');
    cutLegendText.setAttribute('opacity', '0');
    countNum.textContent = String(clusterCount);
  }

  function showCut() {
    merges.forEach(merge => {
      const belowCut = merge.nodeBelowCut;
      const cluster = belowCut ? cutResult.labels[merge.leafIds[0]] : -1;
      merge.join.setAttribute('stroke-dashoffset', '0');
      merge.join.setAttribute('opacity', belowCut ? '1' : '0.28');
      merge.join.setAttribute('stroke', belowCut ? colors[cluster] : 'var(--muted)');
      merge.join.setAttribute('stroke-width', belowCut ? '2.25' : '1.75');

      merge.link.setAttribute('stroke-dashoffset', belowCut ? '0' : '1');
      merge.link.setAttribute('opacity', belowCut ? '0.55' : '0');
      if (belowCut) merge.link.setAttribute('stroke', colors[cluster]);
    });

    dots.forEach((dot, id) => {
      const c = cutResult.labels[id];
      dot.setAttribute('fill', colors[c]);
      dot.setAttribute('opacity', '1');
      dot.setAttribute('transform', 'scale(1)');
      dotRings[id].setAttribute('opacity', '0');
    });

    leafDots.forEach((leaf, id) => {
      leaf.setAttribute('fill', colors[cutResult.labels[id]]);
      leaf.setAttribute('opacity', '1');
      leaf.setAttribute('transform', 'scale(1)');
    });

    cutLine.setAttribute('stroke-dashoffset', '0');
    cutLine.setAttribute('opacity', '1');
    cutMarks.forEach(mark => mark.setAttribute('opacity', '1'));
    cutLegend.setAttribute('opacity', '1');
    cutLegendText.setAttribute('opacity', '1');
    countNum.textContent = String(cutResult.count);
  }

  function applyFrame(i: number, _api: SceneApi) {
    if (i === 0) showTreeThrough(-1, samples.length, -1);
    else if (i === 1) showTreeThrough(0, samples.length - 1, 0);
    else if (i === 2) showTreeThrough(merges.length - 1, 1, -1);
    else showCut();
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;
      const grid = el('g');
      for (let x = 24; x <= 184; x += 32) line(api, grid, x, 54, x, 238);
      for (let y = 54; y <= 238; y += 46) line(api, grid, 24, y, 184, y);

      label(api, svg, 104, 32, t('points'), { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });
      label(api, svg, 304, 32, t('tree'), { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });

      // Cost axis beside the dendrogram.
      line(api, svg, 218, baseY, 218, 62, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      line(api, svg, 214, 69, 218, 62, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      line(api, svg, 222, 69, 218, 62, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      line(api, svg, 224, baseY, 376, baseY, { stroke: 'var(--rule)', 'stroke-width': 1.5 });
      label(api, svg, 226, 62, t('cost'), { fill: 'var(--muted)', 'font-size': 13 });

      const linksLayer = el('g');
      const pointsLayer = el('g');
      const treeLayer = el('g');
      const cutLayer = el('g');

      const boardPoints = samples.map(toBoard);
      merges = internals.map(laid => {
        const leftBoard = toBoard(laid.left!.node);
        const rightBoard = toBoard(laid.right!.node);
        const isTop = laid.node.height > cutHeight;
        const link = line(api, linksLayer, leftBoard.x, leftBoard.y, rightBoard.x, rightBoard.y, {
          stroke: 'var(--muted)', 'stroke-width': 1.75, pathLength: 1, 'stroke-dasharray': isTop ? '3 4' : '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        });
        const l = laid.left!;
        const r = laid.right!;
        const d = `M ${l.x} ${l.y} V ${laid.y} H ${r.x} V ${r.y}`;
        const join = el('path', {
          d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        }, treeLayer);
        return {
          layout: laid,
          join,
          link,
          leafIds: collectLeaves(laid.node),
          nodeBelowCut: laid.node.height <= cutHeight,
        };
      });

      dotRings = [];
      dots = boardPoints.map(pt => {
        const ring = el('circle', {
          cx: pt.x, cy: pt.y, r: 10.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.25,
          opacity: 0, class: 'scene-tween',
        }, pointsLayer);
        dotRings.push(ring);
        const dot = el('circle', {
          cx: pt.x, cy: pt.y, r: 5.5, fill: 'var(--muted)', stroke: 'var(--paper)', 'stroke-width': 1.5,
          class: 'scene-tween',
        }, pointsLayer);
        dot.style.transformOrigin = `${pt.x}px ${pt.y}px`;
        return dot;
      });

      leafDots = samples.map((_, id) => {
        const leaf = leavesById.get(id)!;
        const dot = el('circle', {
          cx: leaf.x, cy: baseY, r: 4, fill: 'var(--muted)', stroke: 'var(--paper)', 'stroke-width': 1.2,
          class: 'scene-tween',
        }, treeLayer);
        dot.style.transformOrigin = `${leaf.x}px ${baseY}px`;
        return dot;
      });

      cutLine = line(api, cutLayer, 224, cutY, 376, cutY, {
        stroke: 'var(--ink)', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      // The 3 branches crossed at cutHeight correspond to the 3 pair merges (internals 0..2).
      const crossedRoots = internals.slice(0, 3).sort((a, b) => a.x - b.x);
      cutMarks = crossedRoots.map((branch, idx) => {
        const cluster = cutResult.labels[collectLeaves(branch.node)[0]];
        const mark = el('circle', {
          cx: branch.x, cy: cutY, r: 5, fill: colors[cluster], stroke: 'var(--hl)', 'stroke-width': 2.5,
          opacity: 0, class: 'scene-tween', 'data-branch': idx,
        }, cutLayer);
        mark.style.transformOrigin = `${branch.x}px ${cutY}px`;
        return mark;
      });

      label(api, svg, 24, 274, t('clusters'), { fill: 'var(--muted)', 'font-size': 14 });
      countNum = label(api, svg, 118, 274, String(samples.length), {
        class: 'scene-value', 'font-size': 15, 'font-weight': 700,
      });

      cutLegend = line(api, svg, 244, 269, 270, 269, {
        stroke: 'var(--ink)', 'stroke-width': 2, opacity: 0, class: 'scene-tween',
      });
      cutLegendText = label(api, svg, 278, 274, t('cut'), {
        fill: 'var(--muted)', 'font-size': 14, opacity: 0, class: 'scene-tween',
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        dots.forEach((dot, id) => {
          dot.setAttribute('opacity', '0');
          dot.setAttribute('transform', 'scale(0.5)');
          dotRings[id].setAttribute('opacity', '0');
        });
        leafDots.forEach(leaf => {
          leaf.setAttribute('opacity', '0');
          leaf.setAttribute('transform', 'scale(0.5)');
        });
        merges.forEach(m => {
          m.join.setAttribute('stroke-dashoffset', '1');
          m.join.setAttribute('opacity', '0');
          m.link.setAttribute('stroke-dashoffset', '1');
          m.link.setAttribute('opacity', '0');
        });
        cutLine.setAttribute('stroke-dashoffset', '1');
        cutLine.setAttribute('opacity', '0');
        cutMarks.forEach(m => m.setAttribute('opacity', '0'));
        cutLegend.setAttribute('opacity', '0');
        cutLegendText.setAttribute('opacity', '0');
        countNum.textContent = String(samples.length);
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (api.reduced || !browser) return () => {};

      if (i === 2) {
        const timers: number[] = [];
        const stepMs = 460;
        showTreeThrough(0, samples.length - 1, 0);
        for (let m = 1; m < merges.length; m++) {
          timers.push(browser.setTimeout(() => {
            showTreeThrough(m, samples.length - m - 1, m);
          }, m * stepMs));
        }
        timers.push(browser.setTimeout(() => showTreeThrough(merges.length - 1, 1, -1), merges.length * stepMs));
        return () => timers.forEach(id => browser.clearTimeout(id));
      }

      if (i === 3) {
        const animations: Animation[] = [];
        cutMarks.forEach((mark, idx) => {
          const anim = mark.animate?.(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
            { duration: 900, delay: idx * 140, fill: 'both' },
          );
          if (anim) animations.push(anim);
        });
        return () => animations.forEach(a => a.cancel());
      }

      return () => {};
    },
  });
}
