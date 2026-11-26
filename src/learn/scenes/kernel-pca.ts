import { kernelPca } from '../../engine/dimred';
import { logistic } from '../../engine/models/logistic';
import type { Sample } from '../../engine/types';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const LEFT = { x: 22, y: 66, w: 156, h: 156 };
const RIGHT = { x: 222, y: 66, w: 156, h: 156 };

interface RingPoint {
  x: number;
  y: number;
  kx: number;
  ky: number;
  c: 0 | 1;
}

function delay(el: SVGElement, ms: number) {
  el.style.setProperty('--delay', `${ms}ms`);
}

function boxX(box: { x: number; w: number }, nx: number) {
  return box.x + nx * box.w;
}

function boxY(box: { y: number; h: number }, ny: number) {
  return box.y + ny * box.h;
}

/** Extract the exact linear boundary predict(x, y) = 0.5 from a fitted logistic model. */
function logisticLine(model: { predict(x: number, y: number): number }): { x1: number; y1: number; x2: number; y2: number; f: (x: number, y: number) => number } {
  const logit = (x: number, y: number) => {
    const p = Math.min(0.9999, Math.max(0.0001, model.predict(x, y)));
    return Math.log(p / (1 - p));
  };
  const c0 = logit(0, 0);
  const ax = logit(1, 0) - c0;
  const by = logit(0, 1) - c0;
  const f = (x: number, y: number) => ax * x + by * y + c0;

  const hits: Array<[number, number]> = [];
  const add = (x: number, y: number) => {
    if (x >= -1e-6 && x <= 1 + 1e-6 && y >= -1e-6 && y <= 1 + 1e-6) {
      const cx = Math.max(0, Math.min(1, x));
      const cy = Math.max(0, Math.min(1, y));
      if (!hits.some(([hx, hy]) => Math.hypot(hx - cx, hy - cy) < 1e-4)) hits.push([cx, cy]);
    }
  };
  if (Math.abs(by) > 1e-8) {
    add(0, -c0 / by);
    add(1, -(ax + c0) / by);
  }
  if (Math.abs(ax) > 1e-8) {
    add(-c0 / ax, 0);
    add(-(by + c0) / ax, 1);
  }
  const [p1, p2] = hits.length >= 2 ? hits : [[0.5, 0], [0.5, 1]];
  return { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], f };
}

function sidePolygon(
  box: { x: number; y: number; w: number; h: number },
  bound: { x1: number; y1: number; x2: number; y2: number; f: (x: number, y: number) => number },
  positive: boolean,
): string {
  const corners: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const poly: Array<[number, number]> = [[bound.x1, bound.y1], [bound.x2, bound.y2]];
  for (const [cx, cy] of corners) {
    const val = bound.f(cx, cy);
    if (positive ? val >= 0 : val < 0) poly.push([cx, cy]);
  }
  const mx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const my = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  poly.sort((a, b) => Math.atan2(a[1] - my, a[0] - mx) - Math.atan2(b[1] - my, b[0] - mx));
  return poly.map(([nx, ny], idx) => `${idx === 0 ? 'M' : 'L'} ${boxX(box, nx).toFixed(1)} ${boxY(box, ny).toFixed(1)}`).join(' ') + ' Z';
}

export default function kernelPcaScene() {
  let pts: RingPoint[] = [];
  let simWeights: number[] = [];

  let heading: SVGTextElement;
  let rightBoard: SVGGElement;
  let arrow: SVGPathElement;
  let anchorRing: SVGCircleElement;
  let simCircle: SVGCircleElement;
  let simLinks: SVGLineElement[] = [];
  let projDots: SVGCircleElement[] = [];

  let badCut: SVGLineElement;
  let badMark: SVGGElement;
  let tintA: SVGPathElement;
  let tintB: SVGPathElement;
  let goodCut: SVGLineElement;
  let okMark: SVGGElement;

  function setProjPositions(projected: boolean) {
    pts.forEach((p, idx) => {
      const tx = projected ? boxX(RIGHT, p.kx) : boxX(LEFT, p.x);
      const ty = projected ? boxY(RIGHT, p.ky) : boxY(LEFT, p.y);
      projDots[idx].style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    });
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;
    heading.textContent =
      i === 0 ? t('original')
      : i === 1 ? t('gamma')
      : i === 2 ? t('projected')
      : t('line');

    const showLinks = i <= 1;
    delay(anchorRing, i === 0 ? 200 : 0);
    anchorRing.setAttribute('opacity', showLinks ? '1' : '0');

    delay(simCircle, i === 1 ? 150 : i === 0 ? 300 : 0);
    simCircle.setAttribute('opacity', showLinks ? '0.65' : '0');
    simCircle.style.transform = i === 1 ? 'scale(0.45)' : 'scale(1)';

    simLinks.forEach((lnk, idx) => {
      const w = simWeights[idx];
      const keep = w > 0.35;
      delay(lnk, i === 0 ? 450 : i === 1 ? 450 : 0);
      lnk.setAttribute('stroke-dashoffset', showLinks ? '0' : '1');
      if (!showLinks) {
        lnk.setAttribute('opacity', '0');
      } else if (i === 0) {
        lnk.setAttribute('opacity', String(0.18 + 0.72 * w));
        lnk.setAttribute('stroke', keep ? 'var(--ink)' : 'var(--muted)');
      } else {
        lnk.setAttribute('opacity', keep ? '0.9' : '0.07');
        lnk.setAttribute('stroke', keep ? 'var(--hl)' : 'var(--muted)');
      }
    });

    delay(rightBoard, 0);
    rightBoard.setAttribute('opacity', i >= 2 ? '1' : '0.28');

    delay(arrow, i === 2 ? 150 : 0);
    arrow.setAttribute('stroke-dashoffset', i >= 2 ? '0' : '1');
    arrow.setAttribute('opacity', i >= 2 ? '0.85' : '0');

    projDots.forEach((dot, idx) => {
      delay(dot, i === 2 ? 250 + idx * 25 : 0);
      dot.setAttribute('opacity', i >= 2 ? '1' : '0');
    });
    setProjPositions(i >= 2);

    const isSplit = i === 3;
    delay(badCut, isSplit ? 100 : 0);
    badCut.setAttribute('stroke-dashoffset', isSplit ? '0' : '1');
    badCut.setAttribute('opacity', isSplit ? '0.85' : '0');

    delay(badMark, isSplit ? 420 : 0);
    badMark.setAttribute('opacity', isSplit ? '1' : '0');

    delay(goodCut, isSplit ? 680 : 0);
    goodCut.setAttribute('stroke-dashoffset', isSplit ? '0' : '1');
    goodCut.setAttribute('opacity', isSplit ? '1' : '0');

    delay(tintA, isSplit ? 980 : 0);
    delay(tintB, isSplit ? 980 : 0);
    tintA.setAttribute('opacity', isSplit ? '0.15' : '0');
    tintB.setAttribute('opacity', isSplit ? '0.16' : '0');

    delay(okMark, isSplit ? 1080 : 0);
    okMark.setAttribute('opacity', isSplit ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      // 8 inner (Class B) + 8 outer (Class A) points
      const raw: Array<{ x: number; y: number; c: 0 | 1 }> = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.15;
        const r = 0.11 + 0.02 * (random() - 0.5);
        raw.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a), c: 1 });
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.35;
        const r = 0.38 + 0.03 * (random() - 0.5);
        raw.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a), c: 0 });
      }

      const kpca = kernelPca(raw.map(p => [p.x, p.y]), 35, 2);
      const xs = kpca.scores.map(s => s[0]);
      const ys = kpca.scores.map(s => s[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);

      pts = raw.map((p, idx) => ({
        x: p.x,
        y: p.y,
        kx: 0.12 + 0.76 * ((xs[idx] - minX) / (maxX - minX || 1)),
        ky: 0.12 + 0.76 * ((ys[idx] - minY) / (maxY - minY || 1)),
        c: p.c,
      }));

      const anchor = pts[0];
      simWeights = pts.slice(1).map(p => {
        const d2 = (p.x - anchor.x) ** 2 + (p.y - anchor.y) ** 2;
        return Math.exp(-16 * d2);
      });

      const origLog = logistic();
      origLog.fit(pts.map<Sample>(p => ({ x: p.x, y: p.y, c: p.c })));
      const origBound = logisticLine(origLog);

      const projLog = logistic();
      projLog.fit(pts.map<Sample>(p => ({ x: p.kx, y: p.ky, c: p.c })));
      const projBound = logisticLine(projLog);

      heading = label(api, svg, 200, 32, t('original'), {
        'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700,
      });

      // Left board: Original coordinates
      el('rect', {
        x: LEFT.x, y: LEFT.y, width: LEFT.w, height: LEFT.h, rx: 8,
        fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      });
      for (let k = 1; k < 4; k++) {
        line(api, svg, LEFT.x + (LEFT.w * k) / 4, LEFT.y, LEFT.x + (LEFT.w * k) / 4, LEFT.y + LEFT.h);
        line(api, svg, LEFT.x, LEFT.y + (LEFT.h * k) / 4, LEFT.x + LEFT.w, LEFT.y + (LEFT.h * k) / 4);
      }
      label(api, svg, LEFT.x + LEFT.w / 2, LEFT.y + LEFT.h + 22, t('original'), {
        'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13.5,
      });

      // Right board: KPC1 x KPC2
      rightBoard = el('g', { class: 'scene-tween', opacity: 0.28 });
      el('rect', {
        x: RIGHT.x, y: RIGHT.y, width: RIGHT.w, height: RIGHT.h, rx: 8,
        fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      }, rightBoard);

      tintA = el('path', {
        d: sidePolygon(RIGHT, projBound, false),
        fill: 'var(--a)', opacity: 0, class: 'scene-tween',
      }, rightBoard);
      tintB = el('path', {
        d: sidePolygon(RIGHT, projBound, true),
        fill: 'var(--b)', opacity: 0, class: 'scene-tween',
      }, rightBoard);

      for (let k = 1; k < 4; k++) {
        line(api, rightBoard, RIGHT.x + (RIGHT.w * k) / 4, RIGHT.y, RIGHT.x + (RIGHT.w * k) / 4, RIGHT.y + RIGHT.h);
        line(api, rightBoard, RIGHT.x, RIGHT.y + (RIGHT.h * k) / 4, RIGHT.x + RIGHT.w, RIGHT.y + (RIGHT.h * k) / 4);
      }
      el('rect', {
        x: RIGHT.x, y: RIGHT.y, width: RIGHT.w, height: RIGHT.h, rx: 8,
        fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5,
      }, rightBoard);
      label(api, rightBoard, RIGHT.x + RIGHT.w / 2, RIGHT.y + RIGHT.h + 22, t('projected'), {
        'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13.5,
      });

      // Connector arrow between boards
      arrow = el('path', {
        d: `M ${LEFT.x + LEFT.w + 8} ${LEFT.y + LEFT.h / 2} L ${RIGHT.x - 10} ${RIGHT.y + RIGHT.h / 2}`,
        fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-linecap': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0,
        class: 'scene-tween',
      });

      // RBF similarity links + circle on Left board
      const ax = boxX(LEFT, anchor.x);
      const ay = boxY(LEFT, anchor.y);
      simCircle = el('circle', {
        cx: ax, cy: ay, r: 54, fill: 'var(--hl)', 'fill-opacity': 0.14,
        stroke: 'var(--hl)', 'stroke-width': 1.75, 'stroke-dasharray': '4 3',
        opacity: 0, class: 'scene-tween scene-slow',
      });
      simCircle.style.transformOrigin = `${ax}px ${ay}px`;

      simLinks = pts.slice(1).map((p, idx) => line(api, svg, ax, ay, boxX(LEFT, p.x), boxY(LEFT, p.y), {
        stroke: 'var(--ink)', 'stroke-width': (1.1 + 1.4 * simWeights[idx]).toFixed(2),
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0,
        class: 'scene-tween',
      }));

      // Left board dots
      for (const p of pts) {
        el('circle', {
          cx: boxX(LEFT, p.x), cy: boxY(LEFT, p.y), r: 4.5,
          fill: p.c === 1 ? 'var(--b)' : 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.25,
        });
      }
      anchorRing = el('circle', {
        cx: ax, cy: ay, r: 8.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5,
        opacity: 0, class: 'scene-tween',
      });

      // Projected dots (start at left coords, glide to right coords in Frame 2)
      projDots = pts.map(p => el('circle', {
        cx: 0, cy: 0, r: 4.5,
        fill: p.c === 1 ? 'var(--b)' : 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.25,
        opacity: 0, class: 'scene-tween scene-slow',
      }));

      // Step 3 boundaries: bad cut on left, good straight cut on right
      badCut = line(
        api, svg,
        boxX(LEFT, origBound.x1), boxY(LEFT, origBound.y1),
        boxX(LEFT, origBound.x2), boxY(LEFT, origBound.y2),
        {
          stroke: 'var(--bad)', 'stroke-width': 2,
          pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0,
          class: 'scene-tween',
        },
      );
      badMark = el('g', { opacity: 0, class: 'scene-tween' });
      el('circle', { cx: LEFT.x + LEFT.w - 16, cy: LEFT.y + 16, r: 10, fill: 'var(--sheet)', stroke: 'var(--bad)', 'stroke-width': 1.5 }, badMark);
      line(api, badMark, LEFT.x + LEFT.w - 20, LEFT.y + 12, LEFT.x + LEFT.w - 12, LEFT.y + 20, { stroke: 'var(--bad)', 'stroke-width': 2 });
      line(api, badMark, LEFT.x + LEFT.w - 12, LEFT.y + 12, LEFT.x + LEFT.w - 20, LEFT.y + 20, { stroke: 'var(--bad)', 'stroke-width': 2 });

      goodCut = line(
        api, svg,
        boxX(RIGHT, projBound.x1), boxY(RIGHT, projBound.y1),
        boxX(RIGHT, projBound.x2), boxY(RIGHT, projBound.y2),
        {
          stroke: 'var(--ink)', 'stroke-width': 2.25,
          pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0,
          class: 'scene-tween',
        },
      );
      okMark = el('g', { opacity: 0, class: 'scene-tween' });
      el('circle', { cx: RIGHT.x + RIGHT.w - 16, cy: RIGHT.y + 16, r: 10, fill: 'var(--sheet)', stroke: 'var(--ok)', 'stroke-width': 1.5 }, okMark);
      el('path', {
        d: `M ${RIGHT.x + RIGHT.w - 21} ${RIGHT.y + 16} L ${RIGHT.x + RIGHT.w - 17} ${RIGHT.y + 20} L ${RIGHT.x + RIGHT.w - 11} ${RIGHT.y + 12}`,
        fill: 'none', stroke: 'var(--ok)', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, okMark);

      // Legend
      for (const [idx, x] of [108, 238].entries()) {
        el('circle', { cx: x, cy: 274, r: 5, fill: idx === 0 ? 'var(--a)' : 'var(--b)' });
        label(api, svg, x + 13, 279, t(idx === 0 ? 'classA' : 'classB'), { fill: 'var(--muted)', 'font-size': 13.5 });
      }

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        delay(anchorRing, 0);
        anchorRing.setAttribute('opacity', '0');
        delay(simCircle, 0);
        simCircle.setAttribute('opacity', '0');
        simLinks.forEach(lnk => {
          delay(lnk, 0);
          lnk.setAttribute('stroke-dashoffset', '1');
          lnk.setAttribute('opacity', '0');
        });
      } else if (i === 2) {
        applyFrame(1, api);
        projDots.forEach(dot => {
          delay(dot, 0);
          dot.setAttribute('opacity', '0.9');
        });
        setProjPositions(false);
      } else {
        applyFrame(i - 1, api);
      }
    },
  });
}
