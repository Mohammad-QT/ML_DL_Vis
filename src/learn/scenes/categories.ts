import { oneHot } from '../../prep/logic';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const rawCountries = ['France', 'Spain', 'Germany', 'France'];
const catKey = (c: string) => c.toLowerCase();
const catColor: Record<string, string> = {
  France: 'var(--a)',
  Germany: 'var(--ok)',
  Spain: 'var(--b)',
};

const OX = 24;
const OH_X = 148;
const TY = 56;
const HDR_H = 36;
const ROW_H = 44;
const OW = 104;
const COL_W = 76;

const rowY = (r: number) => TY + HDR_H + r * ROW_H;
const rowCy = (r: number) => rowY(r) + ROW_H / 2;

const delay = (el: SVGElement, ms: number) => el.style.setProperty('--delay', `${ms}ms`);

interface OneHotCell {
  bg: SVGRectElement;
  txt: SVGTextElement;
  val: number;
  row: number;
  col: number;
}

export default function categoriesScene() {
  const { classes, rows } = oneHot(rawCountries);

  let origGroup: SVGGElement;
  const origDots: SVGCircleElement[] = [];
  let dropLine: SVGLineElement;

  let azTag: SVGTextElement;
  let ohGroup: SVGGElement;
  const hdrPills: SVGRectElement[] = [];
  const hdrTexts: SVGTextElement[] = [];
  const colBodies: SVGRectElement[] = [];
  const ohCells: OneHotCell[] = [];

  function applyFrame(i: number, _api: SceneApi, isBeforeZero = false) {
    // Original text column
    delay(origGroup, i === 3 ? 420 : 0);
    if (isBeforeZero) {
      origGroup.style.transform = 'translateX(124px)';
      origGroup.setAttribute('opacity', '1');
    } else if (i === 3) {
      origGroup.style.transform = 'translateX(-18px)';
      origGroup.setAttribute('opacity', '0');
    } else {
      origGroup.style.transform = 'translateX(0px)';
      origGroup.setAttribute('opacity', '1');
    }

    origDots.forEach((dot, r) => {
      delay(dot, 0);
      dot.setAttribute('fill', isBeforeZero ? 'var(--muted)' : catColor[rawCountries[r]]);
    });

    delay(dropLine, 0);
    dropLine.setAttribute('stroke-dashoffset', i === 3 ? '0' : '1');
    dropLine.setAttribute('opacity', i === 3 ? '0.9' : '0');

    // A -> Z tag on frame 0 only
    delay(azTag, i === 0 && !isBeforeZero ? 520 : 0);
    azTag.setAttribute('opacity', i === 0 && !isBeforeZero ? '1' : '0');

    // One-hot table shifts gently to center once original column drops
    delay(ohGroup, i === 3 ? 450 : 0);
    ohGroup.style.transform = i === 3 ? 'translateX(-62px)' : 'translateX(0px)';
    ohGroup.setAttribute('opacity', isBeforeZero ? '0' : '1');

    // Column header pills appear in frame 0 (500ms) and remain visible
    const showHeaders = !isBeforeZero;
    const hdrDelay = i === 0 ? 500 : 0;
    classes.forEach((c, idx) => {
      const pill = hdrPills[idx];
      const txt = hdrTexts[idx];
      delay(pill, hdrDelay);
      delay(txt, hdrDelay);
      pill.setAttribute('opacity', showHeaders ? '1' : '0');
      txt.setAttribute('opacity', showHeaders ? '1' : '0');
      pill.setAttribute('stroke', i === 0 ? catColor[c] : 'var(--rule)');
    });

    // Empty column bodies appear in frame 1
    const showBodies = i >= 1;
    const bodyDelay = i === 1 ? 300 : 0;
    colBodies.forEach(body => {
      delay(body, bodyDelay);
      body.style.transform = showBodies ? 'scaleY(1)' : 'scaleY(0)';
      body.setAttribute('opacity', showBodies ? '1' : '0');
    });

    // 1s and 0s fill in frame 2 (staggered by row) and stay in frame 3
    const showValues = i >= 2;
    ohCells.forEach(cell => {
      const isOne = cell.val === 1;
      const ms = i === 2 ? (isOne ? cell.row * 180 : 860) : 0;
      delay(cell.bg, ms);
      delay(cell.txt, ms);
      cell.bg.setAttribute('opacity', showValues && isOne ? '1' : '0');
      cell.bg.setAttribute('stroke', showValues && isOne ? catColor[classes[cell.col]] : 'none');
      cell.txt.setAttribute('opacity', showValues ? (isOne ? '1' : '0.72') : '0');
    });
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, t } = api;
      const totalH = HDR_H + rawCountries.length * ROW_H;

      // Original Country column
      origGroup = el('g', { class: 'scene-tween scene-slow' });
      el('rect', {
        x: OX, y: TY, width: OW, height: totalH, rx: 10,
        fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      }, origGroup);
      label(api, origGroup, OX + OW / 2, TY + 23, t('country'), {
        'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700,
      });
      line(api, origGroup, OX + 8, TY + HDR_H, OX + OW - 8, TY + HDR_H);

      rawCountries.forEach((country, r) => {
        if (r > 0) line(api, origGroup, OX + 8, rowY(r), OX + OW - 8, rowY(r), { opacity: 0.65 });
        const cy = rowCy(r);
        origDots.push(el('circle', {
          cx: OX + 18, cy, r: 4.5, fill: 'var(--muted)', class: 'scene-tween',
        }, origGroup));
        label(api, origGroup, OX + 30, cy + 5, t(catKey(country)), {
          'font-size': 14, 'font-weight': 500,
        });
      });

      dropLine = line(api, origGroup, OX + 12, TY + 12, OX + OW - 12, TY + totalH - 12, {
        stroke: 'var(--bad)', 'stroke-width': 2.5, pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      // Right-hand One-Hot columns group
      ohGroup = el('g', { class: 'scene-tween scene-slow' });
      azTag = label(api, ohGroup, OH_X + (COL_W * 3) / 2, TY - 14, 'A → Z', {
        'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13, 'font-weight': 600,
        opacity: 0, class: 'scene-value scene-tween',
      });

      classes.forEach((country, c) => {
        const cx = OH_X + c * COL_W;
        const body = el('rect', {
          x: cx + 2, y: TY + HDR_H, width: COL_W - 4, height: rawCountries.length * ROW_H,
          rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
          opacity: 0, class: 'scene-tween scene-slow',
        }, ohGroup);
        body.style.transformOrigin = `${cx + COL_W / 2}px ${TY + HDR_H}px`;
        colBodies.push(body);

        for (let r = 1; r < rawCountries.length; r++) {
          line(api, ohGroup, cx + 8, rowY(r), cx + COL_W - 8, rowY(r), { opacity: 0.55 });
        }

        const pill = el('rect', {
          x: cx + 2, y: TY, width: COL_W - 4, height: HDR_H - 4, rx: 8,
          fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.75,
          opacity: 0, class: 'scene-tween',
        }, ohGroup);
        hdrPills.push(pill);

        const txt = label(api, ohGroup, cx + COL_W / 2, TY + 21, t(catKey(country)), {
          'text-anchor': 'middle', fill: catColor[country], 'font-size': 13, 'font-weight': 700,
          opacity: 0, class: 'scene-tween',
        });
        hdrTexts.push(txt);
      });

      // Cells (0 / 1)
      rows.forEach((rowVals, r) => {
        rowVals.forEach((val, c) => {
          const x = OH_X + c * COL_W;
          const y = rowY(r);
          const color = catColor[classes[c]];
          const bg = el('rect', {
            x: x + 8, y: y + 5, width: COL_W - 16, height: ROW_H - 10, rx: 6,
            fill: color, 'fill-opacity': 0.2, opacity: 0, stroke: 'none', 'stroke-width': 1.5,
            class: 'scene-tween',
          }, ohGroup);
          const txt = label(api, ohGroup, x + COL_W / 2, rowCy(r) + 5, String(val), {
            'text-anchor': 'middle',
            fill: val === 1 ? 'var(--ink)' : 'var(--muted)',
            'font-size': 15,
            'font-weight': val === 1 ? 700 : 500,
            opacity: 0,
            class: 'scene-value scene-tween',
          });
          ohCells.push({ bg, txt, val, row: r, col: c });
        });
      });

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
