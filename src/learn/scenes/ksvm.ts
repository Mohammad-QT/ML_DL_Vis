import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface RingPt { u: number; v: number; c: 0 | 1; z: number }

const CX = 200;
const FLAT_CY = 152;
const FLAT_SX = 110;
const FLAT_SY = 92;

const ISO_CY = 198;
const LIFT_H = 98;
const CUT_Z = 0.5;
const CUT_R = Math.sqrt(Math.log(1 / CUT_Z) / 2.6); // ~0.516

// Deterministic inner Class B ring + outer Class A ring
const rawPts: Array<[number, number, 0 | 1]> = [
  // Inner Class B (c = 1)
  [0.0, 0.0, 1],
  [0.24, -0.14, 1], [-0.22, -0.18, 1], [0.28, 0.16, 1],
  [-0.26, 0.14, 1], [0.05, 0.30, 1], [-0.04, -0.32, 1],
  // Outer Class A (c = 0)
  [-0.78, -0.32, 0], [-0.42, -0.76, 0], [0.28, -0.78, 0], [0.76, -0.36, 0],
  [0.82, 0.22, 0], [0.56, 0.70, 0], [-0.08, 0.82, 0], [-0.68, 0.60, 0],
  [-0.86, 0.14, 0], [0.72, -0.66, 0],
];

function bumpHeight(u: number, v: number) {
  return Math.exp(-2.6 * (u * u + v * v));
}

function flatXY(u: number, v: number): [number, number] {
  return [CX + FLAT_SX * u, FLAT_CY + FLAT_SY * v];
}

function isoXY(u: number, v: number, z: number): [number, number] {
  return [
    CX + 110 * u - 54 * v,
    ISO_CY + 26 * u + 36 * v - LIFT_H * z,
  ];
}

function isoPoly(corners: Array<[number, number]>, z: number): string {
  return corners.map(([u, v], idx) => {
    const [x, y] = isoXY(u, v, z);
    return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

function bumpCurve(vConst: number, steps = 28): string {
  let d = '';
  for (let s = 0; s <= steps; s++) {
    const u = -0.95 + (1.9 * s) / steps;
    const [x, y] = isoXY(u, vConst, bumpHeight(u, vConst));
    d += `${s === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}

function bumpCrossCurve(uConst: number, steps = 28): string {
  let d = '';
  for (let s = 0; s <= steps; s++) {
    const v = -0.95 + (1.9 * s) / steps;
    const [x, y] = isoXY(uConst, v, bumpHeight(uConst, v));
    d += `${s === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}

function isoCirclePath(r: number, z: number, steps = 36): string {
  let d = '';
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const [x, y] = isoXY(r * Math.cos(a), r * Math.sin(a), z);
    d += `${s === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d + 'Z';
}

export default function ksvmScene() {
  let pts: RingPt[] = [];
  let heading: SVGTextElement;
  let flatGroup: SVGGElement;
  let badLine: SVGLineElement;
  let badCross: SVGGElement;
  let simRings: SVGEllipseElement[] = [];
  let circleTintA: SVGRectElement;
  let circleTintMask: SVGEllipseElement;
  let circleTintB: SVGEllipseElement;
  let circleCut: SVGPathElement;

  let isoGroup: SVGGElement;
  let bumpSurface: SVGGElement;
  let stems: SVGLineElement[] = [];
  let shadows: SVGCircleElement[] = [];
  let planeGroup: SVGGElement;
  let dotGroups: SVGGElement[] = [];
  let dots: SVGCircleElement[] = [];

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function resetDelays() {
    delay(heading, 0);
    delay(flatGroup, 0);
    delay(badLine, 0);
    delay(badCross, 0);
    simRings.forEach(r => delay(r, 0));
    delay(circleTintA, 0);
    delay(circleTintMask, 0);
    delay(circleTintB, 0);
    delay(circleCut, 0);
    delay(isoGroup, 0);
    delay(bumpSurface, 0);
    stems.forEach(s => delay(s, 0));
    shadows.forEach(s => delay(s, 0));
    delay(planeGroup, 0);
    dotGroups.forEach(g => delay(g, 0));
    dots.forEach(d => delay(d, 0));
  }

  function positionDots(isometric: boolean, liftFactor: number) {
    pts.forEach((p, idx) => {
      const [x, y] = isometric ? isoXY(p.u, p.v, p.z * liftFactor) : flatXY(p.u, p.v);
      dotGroups[idx].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;
    resetDelays();
    const isFlat = i === 0 || i === 3;
    const isCut = i === 2;
    const isCircle = i === 3;

    heading.textContent = i === 1 ? t('kernel') : i === 2 ? t('plane') : i === 3 ? t('circle') : '';
    heading.setAttribute('opacity', i === 0 ? '0' : '1');

    flatGroup.setAttribute('opacity', isFlat ? '1' : '0');
    badLine.setAttribute('opacity', i === 0 ? '0.75' : '0');
    delay(badLine, i === 0 ? 300 : 0);
    badCross.setAttribute('opacity', i === 0 ? '1' : '0');
    delay(badCross, i === 0 ? 650 : 0);
    simRings.forEach(r => r.setAttribute('opacity', i === 0 ? '0.45' : '0'));

    circleTintA.setAttribute('opacity', isCircle ? '0.14' : '0');
    delay(circleTintA, isCircle ? 950 : 0);
    circleTintMask.setAttribute('opacity', isCircle ? '1' : '0');
    delay(circleTintMask, isCircle ? 950 : 0);
    circleTintB.setAttribute('opacity', isCircle ? '0.16' : '0');
    delay(circleTintB, isCircle ? 950 : 0);
    circleCut.setAttribute('stroke-dashoffset', isCircle ? '0' : '1');
    circleCut.setAttribute('opacity', isCircle ? '1' : '0');
    delay(circleCut, isCircle ? 650 : 0);

    isoGroup.setAttribute('opacity', isFlat ? '0' : '1');
    bumpSurface.setAttribute('opacity', isFlat ? '0' : '0.55');
    delay(bumpSurface, i === 1 ? 300 : 0);
    stems.forEach(s => {
      s.setAttribute('opacity', isFlat ? '0' : '0.45');
      delay(s, i === 1 ? 300 : 0);
    });
    shadows.forEach(s => s.setAttribute('opacity', isFlat ? '0' : '0.3'));

    planeGroup.setAttribute('opacity', isCut ? '1' : '0');
    planeGroup.style.transform = isCut ? 'translateY(0px)' : 'translateY(-24px)';
    delay(planeGroup, isCut ? 250 : 0);

    // Slightly dim points below the translucent cutting plane in frame 2 for depth.
    dots.forEach((d, idx) => {
      d.setAttribute('opacity', isCut && pts[idx].z < CUT_Z ? '0.55' : '1');
      delay(d, isCut ? 750 : 0);
    });

    dotGroups.forEach(g => delay(g, i === 1 ? 350 : i === 3 ? 150 : 0));
    positionDots(!isFlat, 1);
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      pts = rawPts.map(([u, v, c]) => {
        const ju = u + 0.05 * (random() - 0.5);
        const jv = v + 0.05 * (random() - 0.5);
        return { u: ju, v: jv, c, z: bumpHeight(ju, jv) };
      });

      heading = label(api, svg, 200, 31, '', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, opacity: 0, class: 'scene-tween' });

      // Flat 2D board (Frames 0 and 3)
      flatGroup = el('g', { class: 'scene-tween' });
      const bx = CX - FLAT_SX;
      const by = FLAT_CY - FLAT_SY;
      const bw = FLAT_SX * 2;
      const bh = FLAT_SY * 2;
      el('rect', { x: bx, y: by, width: bw, height: bh, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 }, flatGroup);

      circleTintA = el('rect', { x: bx, y: by, width: bw, height: bh, rx: 8, fill: 'var(--a)', opacity: 0, class: 'scene-tween' }, flatGroup);
      circleTintMask = el('ellipse', { cx: CX, cy: FLAT_CY, rx: CUT_R * FLAT_SX, ry: CUT_R * FLAT_SY, fill: 'var(--sheet)', opacity: 0, class: 'scene-tween' }, flatGroup);
      circleTintB = el('ellipse', { cx: CX, cy: FLAT_CY, rx: CUT_R * FLAT_SX, ry: CUT_R * FLAT_SY, fill: 'var(--b)', opacity: 0, class: 'scene-tween' }, flatGroup);

      for (let k = 1; k < 4; k++) {
        line(api, flatGroup, bx + (bw * k) / 4, by, bx + (bw * k) / 4, by + bh);
        line(api, flatGroup, bx, by + (bh * k) / 4, bx + bw, by + (bh * k) / 4);
      }
      el('rect', { x: bx, y: by, width: bw, height: bh, rx: 8, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5 }, flatGroup);

      simRings = [0.28, 0.52].map(r => el('ellipse', {
        cx: CX, cy: FLAT_CY, rx: r * FLAT_SX, ry: r * FLAT_SY,
        fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.25, 'stroke-dasharray': '4 4', opacity: 0, class: 'scene-tween',
      }, flatGroup));

      badLine = line(api, flatGroup, bx + 18, by + bh - 24, bx + bw - 18, by + 24, {
        stroke: 'var(--bad)', 'stroke-width': 2, 'stroke-dasharray': '6 4', opacity: 0, class: 'scene-tween',
      });
      badLine.style.transformOrigin = `${CX}px ${FLAT_CY}px`;
      badCross = el('g', { opacity: 0, class: 'scene-tween' }, flatGroup);
      line(api, badCross, bx + bw - 34, by + 18, bx + bw - 20, by + 32, { stroke: 'var(--bad)', 'stroke-width': 2.2 });
      line(api, badCross, bx + bw - 20, by + 18, bx + bw - 34, by + 32, { stroke: 'var(--bad)', 'stroke-width': 2.2 });

      // Projected 2D circle boundary (ellipse in screen coords because FLAT_SX != FLAT_SY, visually circular)
      const rx = CUT_R * FLAT_SX;
      const ry = CUT_R * FLAT_SY;
      circleCut = el('path', {
        d: `M ${CX - rx} ${FLAT_CY} A ${rx} ${ry} 0 1 0 ${CX + rx} ${FLAT_CY} A ${rx} ${ry} 0 1 0 ${CX - rx} ${FLAT_CY} Z`,
        fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.3,
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }, flatGroup);
      circleCut.style.transformOrigin = `${CX}px ${FLAT_CY}px`;

      // Isometric 3D group (Frames 1 and 2)
      isoGroup = el('g', { opacity: 0, class: 'scene-tween' });
      const baseCorners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      el('path', {
        d: isoPoly(baseCorners, 0), fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      }, isoGroup);

      // Subtle isometric floor grid
      for (const g of [-0.5, 0, 0.5]) {
        const [ax, ay] = isoXY(g, -1, 0);
        const [bx2, by2] = isoXY(g, 1, 0);
        line(api, isoGroup, ax, ay, bx2, by2);
        const [cx2, cy2] = isoXY(-1, g, 0);
        const [dx2, dy2] = isoXY(1, g, 0);
        line(api, isoGroup, cx2, cy2, dx2, dy2);
      }

      // Wireframe bump arches showing the similarity lift
      bumpSurface = el('g', { opacity: 0, class: 'scene-tween' }, isoGroup);
      for (const v of [-0.4, 0, 0.4]) {
        el('path', { d: bumpCurve(v), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.25 }, bumpSurface);
      }
      for (const u of [-0.4, 0, 0.4]) {
        el('path', { d: bumpCrossCurve(u), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.25 }, bumpSurface);
      }

      // Shadow dots + vertical lift stems on the isometric floor
      shadows = pts.map(p => {
        const [sx, sy] = isoXY(p.u, p.v, 0);
        return el('circle', { cx: sx, cy: sy, r: 2.5, fill: 'var(--muted)', opacity: 0, class: 'scene-tween' }, isoGroup);
      });
      stems = pts.map(p => {
        const [x0, y0] = isoXY(p.u, p.v, 0);
        const [x1, y1] = isoXY(p.u, p.v, p.z);
        return line(api, isoGroup, x0, y0, x1, y1, {
          stroke: 'var(--muted)', 'stroke-width': 1.2, 'stroke-dasharray': '2 3', opacity: 0, class: 'scene-tween',
        });
      });

      // Flat cutting plane at z = CUT_Z
      planeGroup = el('g', { opacity: 0, class: 'scene-tween' }, isoGroup);
      el('path', {
        d: isoPoly(baseCorners, CUT_Z), fill: 'var(--hl)', 'fill-opacity': 0.22, stroke: 'var(--ink)', 'stroke-width': 1.5,
      }, planeGroup);
      el('path', {
        d: isoCirclePath(CUT_R, CUT_Z), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.2,
      }, planeGroup);

      // Shared data dots (animated smoothly between 2D and 3D positions)
      const cloud = el('g');
      dots = [];
      dotGroups = pts.map(p => {
        const g = el('g', { class: 'scene-tween scene-slow' }, cloud);
        dots.push(el('circle', {
          cx: 0, cy: 0, r: 5.5, fill: p.c === 1 ? 'var(--b)' : 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
        }, g));
        return g;
      });

      // Bottom legend
      for (const [idx, x] of [92, 232].entries()) {
        el('circle', { cx: x, cy: 276, r: 5.5, fill: idx === 0 ? 'var(--a)' : 'var(--b)' });
        label(api, svg, x + 14, 281, t(idx === 0 ? 'classA' : 'classB'), { fill: 'var(--muted)', 'font-size': 14 });
      }

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 1) {
        // Replay Step 2 by starting flat on the isometric floor, then lifting along the bump.
        applyFrame(1, api);
        bumpSurface.setAttribute('opacity', '0');
        stems.forEach(s => s.setAttribute('opacity', '0'));
        positionDots(true, 0);
      } else if (i === 2) {
        applyFrame(1, api);
      } else {
        applyFrame(i === 0 ? 0 : i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (api.reduced || !browser) return () => {};

      if (i === 0) {
        let angle = 0;
        const angles = [0, 35, -35];
        const id = browser.setInterval(() => {
          delay(badLine, 0);
          angle = (angle + 1) % angles.length;
          badLine.style.transform = `rotate(${angles[angle]}deg)`;
        }, 850);
        return () => {
          browser.clearInterval(id);
          badLine.style.transform = 'rotate(0deg)';
        };
      }

      if (i === 3) {
        const anim = circleCut.animate?.([
          { transform: 'scale(1)' },
          { transform: 'scale(1.06)' },
          { transform: 'scale(1)' },
        ], { duration: 1500, delay: 1100, iterations: Infinity });
        return () => anim?.cancel();
      }

      return () => {};
    },
  });
}
