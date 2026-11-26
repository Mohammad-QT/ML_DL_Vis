import { chain, contour, sampleGrid } from '../../engine/contour';
import { buildTree, walk } from '../../engine/models/tree';
import { rng } from '../../engine/random';
import type { Sample } from '../../engine/types';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

type TreeNode = ReturnType<typeof buildTree>;

interface RectSpec { x: number; y: number; w: number; h: number; c: 0 | 1 }
interface SegSpec { x1: number; y1: number; x2: number; y2: number }

const MAIN = { x: 22, y: 48, w: 180, h: 180 };
const MINIS = [
  { x: 242, y: 48, w: 134, h: 52 },
  { x: 242, y: 112, w: 134, h: 52 },
  { x: 242, y: 176, w: 134, h: 52 },
];

// Interlocking curved clusters so individual trees make staircases while their vote smooths them.
const baseData: Array<[number, number, 0 | 1]> = [
  [0.14, 0.24, 0], [0.26, 0.16, 0], [0.42, 0.20, 0], [0.58, 0.28, 0],
  [0.20, 0.46, 0], [0.36, 0.42, 0], [0.16, 0.68, 0],
  [0.84, 0.30, 1], [0.74, 0.50, 1], [0.56, 0.54, 1], [0.42, 0.72, 1],
  [0.64, 0.76, 1], [0.82, 0.78, 1], [0.32, 0.86, 1],
];

const QUERY_PT = { x: 0.48, y: 0.46 };

function collectTreeParts(
  node: TreeNode, x0: number, y0: number, x1: number, y1: number,
  rects: RectSpec[], segs: SegSpec[],
) {
  if (!('f' in node)) {
    rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, c: node.p >= 0.5 ? 1 : 0 });
    return;
  }
  if (node.f === 'x') {
    const t = Math.max(x0, Math.min(x1, node.t));
    segs.push({ x1: t, y1: y0, x2: t, y2: y1 });
    collectTreeParts(node.l, x0, y0, t, y1, rects, segs);
    collectTreeParts(node.r, t, y0, x1, y1, rects, segs);
  } else {
    const t = Math.max(y0, Math.min(y1, node.t));
    segs.push({ x1: x0, y1: t, x2: x1, y2: t });
    collectTreeParts(node.l, x0, y0, x1, t, rects, segs);
    collectTreeParts(node.r, x0, t, x1, y1, rects, segs);
  }
}

export default function forestScene() {
  let heading: SVGTextElement;
  let mainDots: SVGCircleElement[] = [];
  let arrows: SVGPathElement[] = [];
  let miniDotGroups: SVGGElement[] = [];
  let miniSplitGroups: SVGGElement[] = [];
  let miniRings: SVGRectElement[] = [];
  let overlaySplits: SVGLineElement[][] = [];
  let ensembleRegions: SVGRectElement[] = [];
  let ensembleContours: SVGPathElement[] = [];
  let queryRing: SVGCircleElement;
  let queryDot: SVGCircleElement;
  let voteBar: SVGGElement;
  let voteRings: SVGCircleElement[] = [];
  let voteMajRing: SVGCircleElement;
  let treeVotes: number[] = [0, 0, 0];
  let majorityClass = 0;

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;
    heading.textContent = i === 0 ? t('sample') : i <= 2 ? t('trees') : t('majority');

    mainDots.forEach(d => {
      d.setAttribute('opacity', i === 1 ? '0.42' : i === 3 ? '0.68' : '1');
      delay(d, 0);
    });
    arrows.forEach((a, idx) => {
      a.setAttribute('stroke-dashoffset', i === 0 ? '0' : '1');
      a.setAttribute('opacity', i === 0 ? '0.85' : '0.2');
      delay(a, i === 0 ? idx * 150 : 0);
    });

    miniDotGroups.forEach((g, idx) => {
      g.setAttribute('opacity', '1');
      delay(g, i === 0 ? 500 + idx * 150 : 0);
    });
    miniSplitGroups.forEach((g, idx) => {
      g.setAttribute('opacity', i >= 1 ? '1' : '0');
      delay(g, i === 1 ? 200 + idx * 350 : 0);
    });
    miniRings.forEach(r => {
      r.setAttribute('opacity', '0');
      delay(r, 0);
    });

    overlaySplits.forEach((segs, tIdx) => segs.forEach(lineEl => {
      lineEl.setAttribute('stroke-dashoffset', i >= 2 ? '0' : '1');
      lineEl.setAttribute('opacity', i === 2 ? '0.72' : i === 3 ? '0.2' : '0');
      delay(lineEl, i === 2 ? tIdx * 400 : 0);
    }));

    ensembleRegions.forEach(r => {
      r.setAttribute('opacity', i === 3 ? '0.16' : '0');
      delay(r, i === 3 ? 200 : 0);
    });
    ensembleContours.forEach(p => {
      p.setAttribute('stroke-dashoffset', i === 3 ? '0' : '1');
      p.setAttribute('opacity', i === 3 ? '1' : '0');
      delay(p, i === 3 ? 350 : 0);
    });

    const showVote = i === 3;
    queryRing.setAttribute('opacity', showVote ? '1' : '0');
    delay(queryRing, showVote ? 750 : 0);
    queryDot.setAttribute('opacity', showVote ? '1' : '0');
    queryDot.setAttribute('fill', majorityClass === 1 ? 'var(--b)' : 'var(--a)');
    delay(queryDot, showVote ? 750 : 0);
    voteBar.setAttribute('opacity', showVote ? '1' : '0');
    delay(voteBar, showVote ? 950 : 0);
    voteRings.forEach(r => {
      r.setAttribute('opacity', '0');
      delay(r, 0);
    });
    voteMajRing.setAttribute('opacity', showVote ? '1' : '0');
    delay(voteMajRing, showVote ? 1200 : 0);
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;
      const r = rng(19);

      const samples: Sample[] = baseData.map(([x, y, c]) => ({ x, y, c }));
      const boots: number[][] = [];
      const trees: TreeNode[] = [];
      for (let k = 0; k < 3; k++) {
        const counts = new Array<number>(samples.length).fill(0);
        const boot: Sample[] = [];
        for (let m = 0; m < samples.length; m++) {
          const pick = Math.floor(r() * samples.length);
          counts[pick]++;
          boot.push(samples[pick]);
        }
        boots.push(counts);
        trees.push(buildTree(boot, 0, 3, () => (r() < 0.5 ? 'x' : 'y')));
      }

      heading = label(api, svg, 200, 31, t('sample'), { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });

      // Main board background + ensemble regions
      el('rect', { x: MAIN.x, y: MAIN.y, width: MAIN.w, height: MAIN.h, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const regionLayer = el('g');
      const cols = 12;
      const cellW = MAIN.w / cols;
      const cellH = MAIN.h / cols;
      const voteAt = (x: number, y: number) => {
        const sum = trees.reduce((acc, tr) => acc + (walk(tr, x, y) >= 0.5 ? 1 : 0), 0);
        return sum >= 2 ? 1 : 0;
      };
      for (let row = 0; row < cols; row++) {
        for (let col = 0; col < cols; col++) {
          const cx = (col + 0.5) / cols;
          const cy = (row + 0.5) / cols;
          const c = voteAt(cx, cy);
          ensembleRegions.push(el('rect', {
            x: MAIN.x + col * cellW, y: MAIN.y + row * cellH, width: cellW + 0.4, height: cellH + 0.4,
            fill: c === 1 ? 'var(--b)' : 'var(--a)', opacity: 0, class: 'scene-tween',
          }, regionLayer));
        }
      }

      const mainGrid = el('g');
      for (let k = 1; k < 4; k++) {
        line(api, mainGrid, MAIN.x + (MAIN.w * k) / 4, MAIN.y, MAIN.x + (MAIN.w * k) / 4, MAIN.y + MAIN.h);
        line(api, mainGrid, MAIN.x, MAIN.y + (MAIN.h * k) / 4, MAIN.x + MAIN.w, MAIN.y + (MAIN.h * k) / 4);
      }
      el('rect', { x: MAIN.x, y: MAIN.y, width: MAIN.w, height: MAIN.h, rx: 8, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5 });

      // Overlaid boundaries from the 3 trees
      const treeParts = trees.map(tr => {
        const rects: RectSpec[] = [];
        const segs: SegSpec[] = [];
        collectTreeParts(tr, 0, 0, 1, 1, rects, segs);
        return { rects, segs };
      });
      const overlayColors = ['var(--a)', 'var(--b)', 'var(--ink)'];
      overlaySplits = treeParts.map(({ segs }, tIdx) =>
        segs.map(s => line(
          api, svg,
          MAIN.x + s.x1 * MAIN.w, MAIN.y + s.y1 * MAIN.h,
          MAIN.x + s.x2 * MAIN.w, MAIN.y + s.y2 * MAIN.h,
          {
            stroke: overlayColors[tIdx], 'stroke-width': 1.75,
            pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
          },
        )),
      );

      // Smooth majority contour
      const sampled = sampleGrid(voteAt, MAIN.w, MAIN.h, 6);
      const chains = chain(contour(sampled, 0.5));
      ensembleContours = chains.map(pts => {
        const d = pts.map(([px, py], idx) => `${idx === 0 ? 'M' : 'L'} ${(MAIN.x + px).toFixed(1)} ${(MAIN.y + py).toFixed(1)}`).join(' ');
        return el('path', {
          d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        });
      });

      // Main dots + query dot
      mainDots = samples.map(s => el('circle', {
        cx: MAIN.x + s.x * MAIN.w, cy: MAIN.y + s.y * MAIN.h, r: 4.5,
        fill: s.c === 0 ? 'var(--a)' : 'var(--b)', stroke: 'var(--paper)', 'stroke-width': 1.25, class: 'scene-tween',
      }));

      treeVotes = trees.map(tr => (walk(tr, QUERY_PT.x, QUERY_PT.y) >= 0.5 ? 1 : 0));
      majorityClass = treeVotes.reduce((a, b) => a + b, 0) >= 2 ? 1 : 0;

      const qx = MAIN.x + QUERY_PT.x * MAIN.w;
      const qy = MAIN.y + QUERY_PT.y * MAIN.h;
      queryRing = el('circle', { cx: qx, cy: qy, r: 9.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween' });
      queryDot = el('circle', { cx: qx, cy: qy, r: 5.5, fill: 'var(--muted)', stroke: 'var(--paper)', 'stroke-width': 1.5, opacity: 0, class: 'scene-tween' });

      // Arrows & 3 mini boards
      arrows = MINIS.map(box => el('path', {
        d: `M ${MAIN.x + MAIN.w + 4} ${MAIN.y + MAIN.h / 2} C ${MAIN.x + MAIN.w + 20} ${MAIN.y + MAIN.h / 2}, ${box.x - 18} ${box.y + box.h / 2}, ${box.x - 4} ${box.y + box.h / 2}`,
        fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-linecap': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, class: 'scene-tween',
      }));

      MINIS.forEach((box, idx) => {
        el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 6, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
        const splitGroup = el('g', { opacity: 0, class: 'scene-tween' });
        miniSplitGroups.push(splitGroup);

        for (const rect of treeParts[idx].rects) {
          el('rect', {
            x: box.x + rect.x * box.w, y: box.y + rect.y * box.h, width: rect.w * box.w, height: rect.h * box.h,
            fill: rect.c === 1 ? 'var(--b)' : 'var(--a)', opacity: 0.16,
          }, splitGroup);
        }
        for (const s of treeParts[idx].segs) {
          line(api, splitGroup,
            box.x + s.x1 * box.w, box.y + s.y1 * box.h,
            box.x + s.x2 * box.w, box.y + s.y2 * box.h,
            { stroke: 'var(--ink)', 'stroke-width': 1.4 });
        }

        const dotGroup = el('g', { class: 'scene-tween' });
        miniDotGroups.push(dotGroup);
        samples.forEach((s, pIdx) => {
          const count = boots[idx][pIdx];
          if (count === 0) return;
          const cx = box.x + s.x * box.w;
          const cy = box.y + s.y * box.h;
          if (count >= 2) {
            el('circle', { cx, cy, r: 5.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 1.6 }, dotGroup);
          }
          el('circle', { cx, cy, r: 3, fill: s.c === 0 ? 'var(--a)' : 'var(--b)' }, dotGroup);
        });

        miniRings.push(el('rect', {
          x: box.x - 2, y: box.y - 2, width: box.w + 4, height: box.h + 4, rx: 8,
          fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
        }));
      });

      // Bottom vote tally (visible on frame 3)
      voteBar = el('g', { opacity: 0, class: 'scene-tween' });
      label(api, voteBar, 40, 270, t('votes'), { fill: 'var(--muted)', 'font-size': 14 });
      voteRings = [0, 1, 2].map(idx => {
        const cx = 122 + idx * 42;
        const ring = el('circle', { cx, cy: 265, r: 12, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.2, opacity: 0, class: 'scene-tween' }, voteBar);
        el('circle', { cx, cy: 265, r: 7, fill: treeVotes[idx] === 1 ? 'var(--b)' : 'var(--a)' }, voteBar);
        return ring;
      });
      line(api, voteBar, 240, 265, 266, 265, { stroke: 'var(--muted)', 'stroke-width': 1.75 });
      line(api, voteBar, 260, 260, 266, 265, { stroke: 'var(--muted)', 'stroke-width': 1.75 });
      line(api, voteBar, 260, 270, 266, 265, { stroke: 'var(--muted)', 'stroke-width': 1.75 });
      voteMajRing = el('circle', { cx: 288, cy: 265, r: 13, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween' }, voteBar);
      el('circle', { cx: 288, cy: 265, r: 8.5, fill: majorityClass === 1 ? 'var(--b)' : 'var(--a)' }, voteBar);
      label(api, voteBar, 308, 270, t('majority'), { 'font-size': 14, 'font-weight': 600 });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        arrows.forEach(a => a.setAttribute('stroke-dashoffset', '1'));
        miniDotGroups.forEach(g => g.setAttribute('opacity', '0'));
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 3 || api.reduced || !browser) return () => {};
      let active = -1;
      const id = browser.setInterval(() => {
        active = (active + 1) % 4;
        miniRings.forEach((r, idx) => r.setAttribute('opacity', idx === active ? '1' : '0'));
        voteRings.forEach((r, idx) => r.setAttribute('opacity', idx === active ? '1' : '0'));
      }, 620);
      return () => {
        browser.clearInterval(id);
        miniRings.forEach(r => r.setAttribute('opacity', '0'));
        voteRings.forEach(r => r.setAttribute('opacity', '0'));
      };
    },
  });
}
