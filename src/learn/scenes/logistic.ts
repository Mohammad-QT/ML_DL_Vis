import { logistic, sigmoid } from '../../engine/models/logistic';
import type { Sample } from '../../engine/types';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface BoardPoint {
  u: number;
  v: number;
  c: 0 | 1;
}

interface LinearBoundary {
  w0: number;
  w1: number;
  b: number;
  mu: number;
  mv: number;
  sdu: number;
  sdv: number;
}

const BX = 26;
const BY = 52;
const BW = 172;
const BH = 172;
const BCX = BX + BW / 2;
const BCY = BY + BH / 2;

const SX = 228;
const SY = 58;
const SW = 146;
const SH = 160;
const Z_RANGE = 4;

const rawClassA: Array<[number, number]> = [
  [0.16, 0.78], [0.24, 0.60], [0.28, 0.84], [0.36, 0.69], [0.44, 0.80], [0.47, 0.56],
];
const rawClassB: Array<[number, number]> = [
  [0.54, 0.42], [0.60, 0.24], [0.68, 0.38], [0.76, 0.18], [0.84, 0.34], [0.73, 0.27],
];
const FOCUS_INDEX = rawClassA.length + rawClassB.length - 1; // (0.73, 0.27), Class B

const boardX = (u: number) => BX + u * BW;
const boardY = (v: number) => BY + v * BH;
const scoreX = (z: number) => SX + ((Math.max(-Z_RANGE, Math.min(Z_RANGE, z)) + Z_RANGE) / (2 * Z_RANGE)) * SW;
const probY = (p: number) => SY + (1 - p) * SH;

function setDelay(el: Element, ms: number) {
  (el as SVGElement).style.setProperty('--delay', `${ms}ms`);
}

function fitBoundary(samples: Sample[], iterations: number): LinearBoundary {
  const n = samples.length;
  const mu = samples.reduce((s, p) => s + p.x, 0) / n;
  const mv = samples.reduce((s, p) => s + p.y, 0) / n;
  const sdu = Math.sqrt(samples.reduce((s, p) => s + (p.x - mu) ** 2, 0) / n) || 1;
  const sdv = Math.sqrt(samples.reduce((s, p) => s + (p.y - mv) ** 2, 0) / n) || 1;
  const X = samples.map(p => [(p.x - mu) / sdu, (p.y - mv) / sdv]);

  // Start from a skewed initial guess so training visibly tilts the boundary into place.
  let w0 = 1.35;
  let w1 = -0.35;
  let b = -0.15;
  for (let it = 0; it < iterations; it++) {
    let g0 = 0;
    let g1 = 0;
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const e = sigmoid(w0 * X[i][0] + w1 * X[i][1] + b) - samples[i].c;
      g0 += e * X[i][0];
      g1 += e * X[i][1];
      gb += e;
    }
    w0 -= g0 / n + 0.01 * w0;
    w1 -= g1 / n + 0.01 * w1;
    b -= gb / n;
  }
  return { w0, w1, b, mu, mv, sdu, sdv };
}

function evalScore(bnd: LinearBoundary, u: number, v: number): number {
  return bnd.w0 * ((u - bnd.mu) / bnd.sdu) + bnd.w1 * ((v - bnd.mv) / bnd.sdv) + bnd.b;
}

function boundaryTransform(bnd: LinearBoundary): string {
  // z(px, py) = ax * px + by * py + c in SVG pixel coordinates
  const ax = bnd.w0 / (bnd.sdu * BW);
  const ay = bnd.w1 / (bnd.sdv * BH);
  const c = bnd.b - ax * (BX + bnd.mu * BW) - ay * (BY + bnd.mv * BH);
  const mag = Math.hypot(ax, ay) || 1;
  const nx = ax / mag;
  const ny = ay / mag;
  const d0 = (ax * BCX + ay * BCY + c) / mag;
  const cx = BCX - d0 * nx;
  const cy = BCY - d0 * ny;
  const deg = (Math.atan2(ny, nx) * 180) / Math.PI;
  return `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) rotate(${deg.toFixed(2)}deg)`;
}

export default function logisticScene() {
  let pts: BoardPoint[] = [];
  let earlyBnd: LinearBoundary;
  let fitBnd: LinearBoundary;
  let focusProb = 0.85;

  let boundaryGroup: SVGGElement;
  let boundaryLine: SVGLineElement;
  let tintA: SVGRectElement;
  let tintB: SVGRectElement;
  let dots: SVGCircleElement[] = [];
  let focusGuides: SVGLineElement[] = [];
  let focusRing: SVGCircleElement;
  let linkArrow: SVGLineElement;

  let sCurve: SVGPathElement;
  let cutoffLine: SVGLineElement;
  let curveTintA: SVGRectElement;
  let curveTintB: SVGRectElement;
  let vDrop: SVGLineElement;
  let hRead: SVGLineElement;
  let scoreDots: SVGGElement[] = [];
  let focusCurveDot: SVGGElement;
  let focusCurveCircle: SVGCircleElement;
  let rightNote: SVGTextElement;

  function placeCurveDots(bnd: LinearBoundary, opacity: string, delayMs: number) {
    pts.forEach((p, idx) => {
      if (idx === FOCUS_INDEX) return;
      const z = evalScore(bnd, p.u, p.v);
      const pr = sigmoid(z);
      const g = scoreDots[idx];
      setDelay(g, delayMs);
      g.style.transform = `translate(${scoreX(z).toFixed(1)}px, ${probY(pr).toFixed(1)}px)`;
      g.setAttribute('opacity', opacity);
    });
  }

  function applyFrame(i: number, api: SceneApi, instant = false) {
    const { t } = api;
    const focus = pts[FOCUS_INDEX];
    const bnd = i >= 3 ? fitBnd : earlyBnd;
    const fz = evalScore(bnd, focus.u, focus.v);
    const fp = i >= 3 ? focusProb : sigmoid(fz);
    const fx = scoreX(fz);
    const fy = probY(fp);
    const d = (ms: number) => (instant ? 0 : ms);

    // Board focus guides & link (Step 1)
    const showGuides = i === 0;
    focusGuides.forEach(g => {
      setDelay(g, d(0));
      g.setAttribute('stroke-dashoffset', showGuides ? '0' : '1');
      g.setAttribute('opacity', showGuides ? '0.7' : '0');
    });
    setDelay(linkArrow, d(350));
    linkArrow.setAttribute('stroke-dashoffset', i === 0 ? '0' : '1');
    linkArrow.setAttribute('opacity', i === 0 ? '0.85' : '0');

    setDelay(focusRing, d(0));
    focusRing.setAttribute('opacity', i <= 2 ? '1' : '0');

    // Board points
    dots.forEach((dot, idx) => {
      setDelay(dot, d(i === 2 ? 750 : 0));
      if (i === 0) {
        dot.setAttribute('fill', idx === FOCUS_INDEX ? 'var(--ink)' : 'var(--muted)');
        dot.setAttribute('opacity', idx === FOCUS_INDEX ? '1' : '0.45');
      } else if (i === 1) {
        dot.setAttribute('fill', idx === FOCUS_INDEX ? 'var(--ink)' : 'var(--muted)');
        dot.setAttribute('opacity', idx === FOCUS_INDEX ? '1' : '0.35');
      } else {
        dot.setAttribute('fill', pts[idx].c === 0 ? 'var(--a)' : 'var(--b)');
        dot.setAttribute('opacity', '1');
      }
    });

    // Board boundary & side tints (Steps 3 & 4)
    const showBoardSplit = i >= 2;
    setDelay(boundaryGroup, d(i === 2 ? 400 : 0));
    boundaryGroup.style.transform = boundaryTransform(bnd);
    boundaryGroup.setAttribute('opacity', showBoardSplit ? '1' : '0');
    setDelay(boundaryLine, d(i === 2 ? 400 : 0));
    boundaryLine.setAttribute('stroke-dashoffset', showBoardSplit ? '0' : '1');
    setDelay(tintA, d(i === 2 ? 750 : 0));
    setDelay(tintB, d(i === 2 ? 750 : 0));
    tintA.setAttribute('opacity', showBoardSplit ? '0.13' : '0');
    tintB.setAttribute('opacity', showBoardSplit ? '0.13' : '0');

    // S-curve & threshold (Steps 2–4)
    setDelay(sCurve, d(0));
    sCurve.setAttribute('stroke-dashoffset', i >= 1 ? '0' : '1');
    sCurve.setAttribute('opacity', i >= 1 ? '1' : '0');

    setDelay(cutoffLine, d(0));
    cutoffLine.setAttribute('opacity', i >= 2 ? '1' : '0');
    setDelay(curveTintA, d(i === 2 ? 300 : 0));
    setDelay(curveTintB, d(i === 2 ? 300 : 0));
    curveTintA.setAttribute('opacity', i >= 2 ? '0.1' : '0');
    curveTintB.setAttribute('opacity', i >= 2 ? '0.1' : '0');

    // Focus dot on right panel
    setDelay(focusCurveDot, d(i === 0 ? 700 : i === 1 ? 450 : 350));
    focusCurveDot.style.transform = `translate(${fx.toFixed(1)}px, ${(i === 0 ? SY + SH : fy).toFixed(1)}px)`;
    focusCurveDot.setAttribute('opacity', '1');
    setDelay(focusCurveCircle, d(i === 2 ? 750 : 350));
    focusCurveCircle.setAttribute('fill', i >= 2 ? 'var(--b)' : 'var(--ink)');

    // Projection ticks for Step 2
    setDelay(vDrop, d(450));
    vDrop.setAttribute('x1', fx.toFixed(1));
    vDrop.setAttribute('x2', fx.toFixed(1));
    vDrop.setAttribute('y1', String(SY + SH));
    vDrop.setAttribute('y2', fy.toFixed(1));
    vDrop.setAttribute('stroke-dashoffset', i === 1 ? '0' : '1');
    vDrop.setAttribute('opacity', i === 1 ? '0.85' : '0');

    setDelay(hRead, d(850));
    hRead.setAttribute('x1', fx.toFixed(1));
    hRead.setAttribute('x2', String(SX));
    hRead.setAttribute('y1', fy.toFixed(1));
    hRead.setAttribute('y2', fy.toFixed(1));
    hRead.setAttribute('stroke-dashoffset', i === 1 ? '0' : '1');
    hRead.setAttribute('opacity', i === 1 ? '0.85' : '0');

    // All training points on the S-curve (Steps 3–4)
    if (i < 2) {
      placeCurveDots(earlyBnd, '0', 0);
    } else if (i === 2) {
      placeCurveDots(earlyBnd, '0.45', d(700));
    } else {
      placeCurveDots(fitBnd, '0.95', d(350));
    }

    // Status / numeric label
    setDelay(rightNote, d(i === 0 ? 950 : i === 1 ? 1050 : i === 2 ? 800 : 950));
    if (i === 0) {
      rightNote.textContent = `${t('score')}: ${fz >= 0 ? '+' : ''}${fz.toFixed(1)}`;
    } else if (i === 1) {
      rightNote.textContent = `${t('prob')}: ${fp.toFixed(2)}`;
    } else if (i === 2) {
      rightNote.textContent = `> ${t('cutoff')} → ${t('classB')}`;
    } else {
      rightNote.textContent = t('train');
    }
    rightNote.setAttribute('opacity', '1');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      const makePts = (raw: Array<[number, number]>, c: 0 | 1): BoardPoint[] =>
        raw.map(([u, v], idx) => ({
          u: idx === raw.length - 1 && c === 1 ? u : u + 0.04 * (random() - 0.5),
          v: idx === raw.length - 1 && c === 1 ? v : v + 0.04 * (random() - 0.5),
          c,
        }));
      pts = [...makePts(rawClassA, 0), ...makePts(rawClassB, 1)];
      const samples: Sample[] = pts.map(p => ({ x: p.u, y: p.v, c: p.c }));

      earlyBnd = fitBoundary(samples, 0);
      fitBnd = fitBoundary(samples, 400);
      const realModel = logistic();
      realModel.fit(samples);
      focusProb = realModel.predict(pts[FOCUS_INDEX].u, pts[FOCUS_INDEX].v);

      // Left panel: 2D board
      const defs = el('defs');
      const clip = el('clipPath', { id: 'logistic-board-clip' }, defs);
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8 }, clip);

      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const clipped = el('g', { 'clip-path': 'url(#logistic-board-clip)' });

      boundaryGroup = el('g', { class: 'scene-tween scene-slow', opacity: 0 }, clipped);
      boundaryGroup.style.transformOrigin = '0px 0px';
      tintA = el('rect', { x: -300, y: -300, width: 300, height: 600, fill: 'var(--a)', opacity: 0, class: 'scene-tween' }, boundaryGroup);
      tintB = el('rect', { x: 0, y: -300, width: 300, height: 600, fill: 'var(--b)', opacity: 0, class: 'scene-tween' }, boundaryGroup);
      boundaryLine = line(api, boundaryGroup, 0, -300, 0, 300, {
        stroke: 'var(--ink)', 'stroke-width': 2.25, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, class: 'scene-tween',
      });

      const grid = el('g', {}, clipped);
      for (let k = 1; k < 4; k++) {
        line(api, grid, BX + (BW * k) / 4, BY, BX + (BW * k) / 4, BY + BH);
        line(api, grid, BX, BY + (BH * k) / 4, BX + BW, BY + (BH * k) / 4);
      }
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5 });

      const focus = pts[FOCUS_INDEX];
      const fpx = boardX(focus.u);
      const fpy = boardY(focus.v);
      focusGuides = [
        line(api, svg, fpx, fpy, fpx, BY + BH, {
          stroke: 'var(--muted)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        }),
        line(api, svg, fpx, fpy, BX, fpy, {
          stroke: 'var(--muted)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        }),
      ];

      focusRing = el('circle', {
        cx: fpx, cy: fpy, r: 10.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      });
      dots = pts.map(p => el('circle', {
        cx: boardX(p.u), cy: boardY(p.v), r: 5, fill: 'var(--muted)', stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
      }));

      // Connector arrow from board focus point toward the score axis
      const earlyFz = evalScore(earlyBnd, focus.u, focus.v);
      linkArrow = line(api, svg, fpx + 12, fpy + 4, scoreX(earlyFz) - 8, SY + SH - 6, {
        stroke: 'var(--hl)', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      // Right panel: score -> S-curve
      curveTintB = el('rect', { x: SX, y: SY, width: SW, height: SH / 2, rx: 4, fill: 'var(--b)', opacity: 0, class: 'scene-tween' });
      curveTintA = el('rect', { x: SX, y: SY + SH / 2, width: SW, height: SH / 2, rx: 4, fill: 'var(--a)', opacity: 0, class: 'scene-tween' });

      line(api, svg, SX, SY, SX, SY + SH, { stroke: 'var(--rule)', 'stroke-width': 1.5 });
      line(api, svg, SX, SY + SH, SX + SW, SY + SH, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      line(api, svg, SX + SW / 2, SY, SX + SW / 2, SY + SH, { stroke: 'var(--rule)', 'stroke-dasharray': '3 4' });

      cutoffLine = line(api, svg, SX, SY + SH / 2, SX + SW, SY + SH / 2, {
        stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4', opacity: 0, class: 'scene-tween',
      });

      // Axis ticks on right panel
      label(api, svg, SX - 5, SY + 4, '1', { 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });
      label(api, svg, SX - 5, SY + SH / 2 + 4, t('cutoff'), { 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });
      label(api, svg, SX - 5, SY + SH + 4, '0', { 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });
      label(api, svg, SX + SW / 2, SY + SH + 20, t('score'), { 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13 });

      const curveD: string[] = [];
      for (let k = 0; k <= 40; k++) {
        const z = -Z_RANGE + (2 * Z_RANGE * k) / 40;
        curveD.push(`${k === 0 ? 'M' : 'L'} ${scoreX(z).toFixed(1)} ${probY(sigmoid(z)).toFixed(1)}`);
      }
      sCurve = el('path', {
        d: curveD.join(' '), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.25, 'stroke-linecap': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween scene-slow',
      });

      vDrop = line(api, svg, SX, SY + SH, SX, SY + SH, {
        stroke: 'var(--muted)', 'stroke-width': 1.5, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });
      hRead = line(api, svg, SX, SY, SX, SY, {
        stroke: 'var(--hl)', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      scoreDots = pts.map(p => {
        const g = el('g', { opacity: 0, class: 'scene-tween scene-slow' });
        el('circle', {
          cx: 0, cy: 0, r: 3.75, fill: p.c === 0 ? 'var(--a)' : 'var(--b)', stroke: 'var(--paper)', 'stroke-width': 1,
        }, g);
        return g;
      });

      focusCurveDot = el('g', { opacity: 0, class: 'scene-tween scene-slow' });
      el('circle', { cx: 0, cy: 0, r: 9.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.25 }, focusCurveDot);
      focusCurveCircle = el('circle', {
        cx: 0, cy: 0, r: 5, fill: 'var(--ink)', stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
      }, focusCurveDot);

      rightNote = label(api, svg, 374, 34, '', {
        'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, opacity: 0, class: 'scene-tween',
      });

      // Bottom legend
      for (const [idx, x] of [52, 168].entries()) {
        el('circle', { cx: x, cy: 274, r: 5.5, fill: idx === 0 ? 'var(--a)' : 'var(--b)' });
        label(api, svg, x + 13, 279, t(idx === 0 ? 'classA' : 'classB'), { fill: 'var(--muted)', 'font-size': 14 });
      }

      applyFrame(0, api, true);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api, true);
        focusGuides.forEach(g => {
          g.setAttribute('stroke-dashoffset', '1');
          g.setAttribute('opacity', '0');
        });
        linkArrow.setAttribute('stroke-dashoffset', '1');
        linkArrow.setAttribute('opacity', '0');
        focusCurveDot.setAttribute('opacity', '0');
        rightNote.setAttribute('opacity', '0');
      } else {
        applyFrame(i - 1, api, true);
      }
    },
  });
}
