import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const BX = 36;
const BY = 46;
const BW = 328;
const BH = 198;

// Optimal line: 0.8 * x + 0.6 * y = 247, centered at (200, 145), half-margin = 44.
const CX = 200;
const CY = 145;
const NX = 0.8;
const NY = 0.6;
const MARGIN = 44;

const classA: Array<{ x: number; y: number; sv?: boolean }> = [
  { x: 84, y: 92 },
  { x: 112, y: 78 },
  { x: 74, y: 140 },
  { x: 110, y: 126 },
  { x: 96, y: 176 },
  { x: 141, y: 150, sv: true },
  { x: 190, y: 85, sv: true },
];

const classB: Array<{ x: number; y: number; sv?: boolean }> = [
  { x: 240, y: 165, sv: true },
  { x: 270, y: 125, sv: true },
  { x: 298, y: 154 },
  { x: 322, y: 118 },
  { x: 288, y: 200 },
  { x: 332, y: 178 },
  { x: 256, y: 214 },
];

// One stray Class A point inside the wide street to show what C controls.
const STRAY = { x: 208, y: 156 };

function lineEnds(cx: number, cy: number, angleDeg: number, halfLen: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * halfLen;
  const dy = Math.sin(rad) * halfLen;
  return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
}

export default function svmScene() {
  let status: SVGTextElement;
  let bottomNote: SVGTextElement;
  let candidates: SVGLineElement[] = [];
  let streetGroup: SVGGElement;
  let streetBand: SVGRectElement;
  let marginRailTop: SVGLineElement;
  let marginRailBot: SVGLineElement;
  let gapArrow: SVGGElement;
  let dotsA: SVGCircleElement[] = [];
  let dotsB: SVGCircleElement[] = [];
  let svRings: SVGCircleElement[] = [];
  let strayDot: SVGCircleElement;
  let strayRing: SVGCircleElement;

  const optimalDeg = (Math.atan2(NX, -NY) * 180) / Math.PI; // ~126.87 deg, line vector (-0.6, 0.8)

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function resetDelays() {
    delay(status, 0);
    delay(bottomNote, 0);
    candidates.forEach(c => delay(c, 0));
    delay(streetGroup, 0);
    delay(streetBand, 0);
    delay(marginRailTop, 0);
    delay(marginRailBot, 0);
    delay(gapArrow, 0);
    dotsA.forEach(d => delay(d, 0));
    dotsB.forEach(d => delay(d, 0));
    svRings.forEach(r => delay(r, 0));
    delay(strayDot, 0);
    delay(strayRing, 0);
  }

  function setStreet(degOffset: number, shiftX: number, shiftY: number, halfWidth: number, bandOpacity: string) {
    const scale = halfWidth / MARGIN;
    streetGroup.style.transform = `translate(${shiftX}px, ${shiftY}px) rotate(${degOffset}deg)`;
    streetBand.setAttribute('opacity', bandOpacity);
    streetBand.style.transform = `scaleY(${scale})`;
    marginRailTop.style.transform = `translateY(${-halfWidth}px)`;
    marginRailBot.style.transform = `translateY(${halfWidth}px)`;
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;
    resetDelays();

    candidates.forEach((c, idx) => {
      c.setAttribute('opacity', i === 0 ? '0.65' : '0');
      delay(c, i === 0 ? idx * 250 : 0);
    });
    streetGroup.setAttribute('opacity', i === 0 ? '0' : '1');
    gapArrow.setAttribute('opacity', i === 1 ? '1' : '0');

    if (i === 0) {
      setStreet(0, 0, 0, MARGIN, '0');
      status.setAttribute('opacity', '0');
      bottomNote.setAttribute('opacity', '0');
    } else if (i === 1) {
      setStreet(0, 0, 0, MARGIN, '0.14');
      delay(streetBand, 200);
      delay(marginRailTop, 200);
      delay(marginRailBot, 200);
      delay(gapArrow, 750);
      status.textContent = t('margin');
      status.setAttribute('opacity', '1');
      delay(status, 750);
      bottomNote.setAttribute('opacity', '0');
    } else if (i === 2) {
      setStreet(0, 0, 0, MARGIN, '0.16');
      status.textContent = t('margin');
      status.setAttribute('opacity', '1');
      bottomNote.textContent = t('sv');
      bottomNote.setAttribute('opacity', '1');
      delay(bottomNote, 750);
    } else {
      // Frame 3: Small C — wide street keeps the stray point inside the gap
      setStreet(0, 0, 0, MARGIN, '0.16');
      status.textContent = t('cLow');
      status.setAttribute('opacity', '1');
      bottomNote.setAttribute('opacity', '0');
    }

    const fadeNonSv = i === 2;
    classA.forEach((pt, idx) => dotsA[idx].setAttribute('opacity', fadeNonSv && !pt.sv ? '0.32' : '1'));
    classB.forEach((pt, idx) => dotsB[idx].setAttribute('opacity', fadeNonSv && !pt.sv ? '0.32' : '1'));
    svRings.forEach(r => {
      r.setAttribute('opacity', i === 2 ? '1' : '0');
      delay(r, i === 2 ? 400 : 0);
    });

    strayDot.setAttribute('opacity', i === 3 ? '1' : '0');
    strayRing.setAttribute('opacity', i === 3 ? '1' : '0');
    delay(strayRing, i === 3 ? 700 : 0);
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      status = label(api, svg, 364, 32, '', { 'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, opacity: 0, class: 'scene-tween' });

      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5 });
      const grid = el('g');
      for (let x = BX + 41; x < BX + BW; x += 41) line(api, grid, x, BY, x, BY + BH);
      for (let y = BY + 40; y < BY + BH; y += 40) line(api, grid, BX, y, BX + BW, y);

      const defs = el('defs');
      const clip = el('clipPath', { id: 'svm-board-clip' }, defs);
      el('rect', { x: BX, y: BY, width: BW, height: BH, rx: 8 }, clip);

      const clipped = el('g', { 'clip-path': 'url(#svm-board-clip)' });

      // Candidate lines for Step 1
      const angles = [optimalDeg - 18, optimalDeg + 15, optimalDeg - 7];
      candidates = angles.map((deg, idx) => {
        const ends = lineEnds(CX + (idx - 1) * 6, CY + (idx === 1 ? -6 : 4), deg, 160);
        return line(api, clipped, ends.x1, ends.y1, ends.x2, ends.y2, {
          stroke: idx === 2 ? 'var(--ink)' : 'var(--muted)',
          'stroke-width': idx === 2 ? 2 : 1.5,
          'stroke-dasharray': idx === 2 ? 'none' : '5 4',
          opacity: 0, class: 'scene-tween',
        });
      });

      // Street group centered at (CX, CY), rotated so local X runs along the boundary and local Y is the normal!
      const streetAnchor = el('g', { transform: `translate(${CX} ${CY}) rotate(${optimalDeg - 90})` }, clipped);
      streetGroup = el('g', { class: 'scene-tween scene-slow' }, streetAnchor);
      streetBand = el('rect', {
        x: -180, y: -MARGIN, width: 360, height: MARGIN * 2,
        fill: 'var(--hl)', opacity: 0, class: 'scene-tween',
      }, streetGroup);
      streetBand.style.transformOrigin = '0px 0px';

      marginRailTop = line(api, streetGroup, -180, 0, 180, 0, {
        stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4', opacity: 0.75, class: 'scene-tween',
      });
      marginRailBot = line(api, streetGroup, -180, 0, 180, 0, {
        stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4', opacity: 0.75, class: 'scene-tween',
      });
      line(api, streetGroup, -180, 0, 180, 0, {
        stroke: 'var(--ink)', 'stroke-width': 2.25,
      });

      // Margin width arrow along local Y (normal to the street)
      gapArrow = el('g', { opacity: 0, class: 'scene-tween' }, streetGroup);
      line(api, gapArrow, 46, -MARGIN + 2, 46, MARGIN - 2, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, gapArrow, 41, -MARGIN + 9, 46, -MARGIN + 2, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, gapArrow, 51, -MARGIN + 9, 46, -MARGIN + 2, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, gapArrow, 41, MARGIN - 9, 46, MARGIN - 2, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, gapArrow, 51, MARGIN - 9, 46, MARGIN - 2, { stroke: 'var(--ink)', 'stroke-width': 1.75 });

      const cloud = el('g');
      svRings = [];
      dotsA = classA.map(pt => {
        if (pt.sv) {
          svRings.push(el('circle', {
            cx: pt.x, cy: pt.y, r: 10.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
          }, cloud));
        }
        return el('circle', {
          cx: pt.x, cy: pt.y, r: 5.5, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
        }, cloud);
      });
      dotsB = classB.map(pt => {
        if (pt.sv) {
          svRings.push(el('circle', {
            cx: pt.x, cy: pt.y, r: 10.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
          }, cloud));
        }
        return el('circle', {
          cx: pt.x, cy: pt.y, r: 5.5, fill: 'var(--b)', stroke: 'var(--paper)', 'stroke-width': 1.5, class: 'scene-tween',
        }, cloud);
      });

      strayRing = el('circle', {
        cx: STRAY.x, cy: STRAY.y, r: 10.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      }, cloud);
      strayDot = el('circle', {
        cx: STRAY.x, cy: STRAY.y, r: 5.5, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 1.5, opacity: 0, class: 'scene-tween',
      }, cloud);

      // Legend + right-aligned note at bottom
      for (const [idx, x] of [54, 152].entries()) {
        el('circle', { cx: x, cy: 272, r: 5.5, fill: idx === 0 ? 'var(--a)' : 'var(--b)' });
        label(api, svg, x + 13, 277, t(idx === 0 ? 'classA' : 'classB'), { fill: 'var(--muted)', 'font-size': 14 });
      }
      bottomNote = label(api, svg, 364, 277, '', { 'text-anchor': 'end', 'font-size': 14, 'font-weight': 600, opacity: 0, class: 'scene-tween' });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        candidates.forEach(c => c.setAttribute('opacity', '0'));
      } else if (i === 1) {
        applyFrame(1, api);
        setStreet(0, 0, 0, 2, '0');
        gapArrow.setAttribute('opacity', '0');
      } else if (i === 3) {
        applyFrame(3, api);
        // Start from Large C (strict narrow tilted street pushing stray point out)
        setStreet(-20, 14, 10, 12, '0.16');
        status.textContent = api.t('cHigh');
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (api.reduced || !browser) return () => {};

      if (i === 0) {
        let step = 0;
        const id = browser.setInterval(() => {
          step = (step + 1) % 3;
          candidates.forEach((c, idx) => {
            delay(c, 0);
            c.setAttribute('opacity', idx === step ? '1' : '0.35');
            c.setAttribute('stroke', idx === step ? 'var(--ink)' : 'var(--muted)');
          });
        }, 750);
        return () => browser.clearInterval(id);
      }

      if (i === 3) {
        let strict = false;
        const id = browser.setInterval(() => {
          resetDelays();
          strict = !strict;
          if (strict) {
            setStreet(-20, 14, 10, 12, '0.16');
            status.textContent = api.t('cHigh');
          } else {
            setStreet(0, 0, 0, MARGIN, '0.16');
            status.textContent = api.t('cLow');
          }
        }, 1400);
        return () => browser.clearInterval(id);
      }

      return () => {};
    },
  });
}
