import { impute, type Cell } from '../../prep/logic';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const raw: Cell[][] = [
  [40, 60],
  [28, null],
  [null, 48],
  [34, 72],
  [null, null],
];

const TX = 30;
const TY = 50;
const COL_W = 108;
const HDR_H = 34;
const ROW_H = 38;
const MX = 278;
const MY = 108;
const MW = 92;
const MH = 86;

const rowY = (r: number) => TY + HDR_H + r * ROW_H;
const rowCy = (r: number) => rowY(r) + ROW_H / 2;
const colX = (c: number) => TX + c * COL_W;
const colCx = (c: number) => colX(c) + COL_W / 2;

const delay = (el: SVGElement, ms: number) => el.style.setProperty('--delay', `${ms}ms`);
const fmt = (v: number, col: number) => (col === 0 ? String(v) : `${v}k`);

interface CellNodes {
  bg: SVGRectElement;
  q: SVGTextElement | null;
  val: SVGTextElement;
  isBlank: boolean;
}

export default function missingScene() {
  const imputed = impute(raw, 'mean');
  const colMeans = [imputed.table[2][0] as number, imputed.table[1][1] as number];

  const colGroups: SVGGElement[] = [];
  const cells: CellNodes[][] = [];
  const gatherLines: SVGLineElement[][] = [[], []];
  const fillLines: SVGLineElement[][] = [[], []];
  let colFocus: SVGRectElement;
  let meanBox: SVGGElement;
  let meanValue: SVGTextElement;

  function setLineDraw(l: SVGLineElement, show: boolean, ms: number, opacity = 0.85) {
    delay(l, ms);
    l.setAttribute('stroke-dashoffset', show ? '0' : '1');
    l.setAttribute('opacity', show ? String(opacity) : '0');
  }

  function applyFrame(i: number, _api: SceneApi, isBeforeZero = false) {
    const activeCol = i === 3 ? 1 : 0;
    const focusShow = !isBeforeZero;

    delay(colFocus, 0);
    colFocus.style.transform = `translateX(${activeCol * COL_W}px)`;
    colFocus.setAttribute('opacity', focusShow ? '1' : '0');

    // Dim the inactive column except before step 0 or when showing col 0 already filled in step 3.
    colGroups.forEach((g, c) => {
      delay(g, 0);
      if (isBeforeZero) g.setAttribute('opacity', '1');
      else if (i === 3 && c === 0) g.setAttribute('opacity', '0.78');
      else g.setAttribute('opacity', c === activeCol ? '1' : '0.42');
    });

    // Cell states per column
    for (let c = 0; c < 2; c++) {
      const colColor = c === 0 ? 'var(--a)' : 'var(--b)';
      const isColDone = (c === 0 && i >= 2) || (c === 1 && i === 3);

      for (let r = 0; r < raw.length; r++) {
        const cell = cells[r][c];
        if (!cell.isBlank) {
          const highlightKnown =
            (c === 0 && i === 1) || (c === 1 && i === 3);
          const ms = c === 1 && i === 3 ? 300 : 0;
          delay(cell.bg, ms);
          cell.bg.setAttribute('fill', colColor);
          cell.bg.setAttribute('opacity', highlightKnown ? '1' : '0');
          cell.bg.setAttribute('stroke', highlightKnown ? colColor : 'none');
          delay(cell.val, 0);
          cell.val.setAttribute('opacity', '1');
          continue;
        }

        // Blank cell
        if (isBeforeZero) {
          delay(cell.bg, 0);
          cell.bg.setAttribute('fill', 'var(--paper)');
          cell.bg.setAttribute('opacity', '0');
          cell.bg.setAttribute('stroke', 'var(--rule)');
          if (cell.q) {
            delay(cell.q, 0);
            cell.q.setAttribute('fill', 'var(--muted)');
            cell.q.setAttribute('opacity', '1');
          }
          delay(cell.val, 0);
          cell.val.setAttribute('opacity', '0');
        } else if (isColDone) {
          const fillMs = i === 2 ? 520 : c === 1 ? 1150 : 0;
          const tintOpacity = i === 3 && c === 0 ? '0.6' : '1';
          delay(cell.bg, fillMs);
          cell.bg.setAttribute('fill', 'var(--hl)');
          cell.bg.setAttribute('opacity', tintOpacity);
          cell.bg.setAttribute('stroke', 'var(--hl)');
          if (cell.q) {
            delay(cell.q, fillMs);
            cell.q.setAttribute('opacity', '0');
          }
          delay(cell.val, fillMs);
          cell.val.setAttribute('opacity', '1');
        } else {
          const spotBlank = c === 0 && (i === 0 || i === 1);
          const ms = c === 0 && i === 0 ? 450 : 0;
          delay(cell.bg, ms);
          cell.bg.setAttribute('fill', spotBlank ? 'var(--bad)' : 'var(--paper)');
          cell.bg.setAttribute('opacity', spotBlank ? '1' : '0');
          cell.bg.setAttribute('stroke', spotBlank ? 'var(--bad)' : 'var(--rule)');
          if (cell.q) {
            delay(cell.q, ms);
            cell.q.setAttribute('fill', spotBlank ? 'var(--bad)' : 'var(--muted)');
            cell.q.setAttribute('opacity', '1');
          }
          delay(cell.val, 0);
          cell.val.setAttribute('opacity', '0');
        }
      }
    }

    // Gather and fill connector lines
    gatherLines[0].forEach(l => {
      if (i === 1) setLineDraw(l, true, 420, 0.8);
      else if (i === 2) setLineDraw(l, true, 0, 0.16);
      else setLineDraw(l, false, 0, 0);
    });
    fillLines[0].forEach(l => setLineDraw(l, i === 2, 0, 0.9));

    gatherLines[1].forEach(l => setLineDraw(l, i === 3, 450, 0.8));
    fillLines[1].forEach(l => setLineDraw(l, i === 3, 920, 0.9));

    // Mean card
    const showMean = i >= 1;
    const meanMs = i === 1 ? 850 : i === 3 ? 650 : 0;
    delay(meanBox, meanMs);
    delay(meanValue, meanMs);
    meanBox.setAttribute('opacity', showMean ? '1' : '0');
    meanValue.textContent = fmt(colMeans[activeCol], activeCol);
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      // Table sheet background
      el('rect', {
        x: TX, y: TY, width: COL_W * 2, height: HDR_H + raw.length * ROW_H,
        rx: 10, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      });

      const headers = [t('age'), t('salary')];
      for (let c = 0; c < 2; c++) {
        colGroups.push(el('g', { class: 'scene-tween' }));
      }
      for (let r = 0; r < raw.length; r++) {
        cells.push([]);
      }

      // Column headers & horizontal rules
      for (let c = 0; c < 2; c++) {
        const g = colGroups[c];
        const cx = colCx(c);
        label(api, g, cx, TY + 22, headers[c], {
          'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700,
        });
        line(api, g, colX(c) + 8, TY + HDR_H, colX(c) + COL_W - 8, TY + HDR_H);
      }

      // Vertical divider
      line(api, svg, TX + COL_W, TY + 6, TX + COL_W, TY + HDR_H + raw.length * ROW_H - 6);

      // Cells
      for (let r = 0; r < raw.length; r++) {
        const y = rowY(r);
        const cy = rowCy(r);
        if (r > 0) {
          line(api, svg, TX + 8, y, TX + COL_W * 2 - 8, y, { opacity: 0.65 });
        }
        for (let c = 0; c < 2; c++) {
          const g = colGroups[c];
          const x = colX(c);
          const cx = colCx(c);
          const v = raw[r][c];
          const isBlank = v == null;

          const bg = el('rect', {
            x: x + 6, y: y + 4, width: COL_W - 12, height: ROW_H - 8, rx: 6,
            fill: 'var(--paper)', 'fill-opacity': 0.22, opacity: 0, stroke: 'none',
            'stroke-width': 1.5, 'stroke-dasharray': isBlank ? '3 3' : 'none',
            class: 'scene-tween',
          }, g);

          const q = isBlank
            ? label(api, g, cx, cy + 5, '?', {
                'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700,
                fill: 'var(--muted)', class: 'scene-value scene-tween',
              })
            : null;

          const displayVal = fmt(imputed.table[r][c] as number, c);
          const val = label(api, g, cx, cy + 5, displayVal, {
            'text-anchor': 'middle', 'font-size': 15,
            'font-weight': isBlank ? 700 : 500,
            opacity: isBlank ? 0 : 1,
            class: 'scene-value scene-tween',
          });

          cells[r].push({ bg, q, val, isBlank });
        }
      }

      // Connector lines layer (between table and mean card)
      const links = el('g');
      const boxLeftX = MX;
      const boxMidY = MY + MH / 2;
      for (let c = 0; c < 2; c++) {
        const startX = colX(c) + COL_W - 4;
        const color = c === 0 ? 'var(--a)' : 'var(--b)';
        for (let r = 0; r < raw.length; r++) {
          const y = rowCy(r);
          if (raw[r][c] != null) {
            gatherLines[c].push(line(api, links, startX, y, boxLeftX, boxMidY, {
              stroke: color, 'stroke-width': 1.75, pathLength: 1,
              'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
            }));
          } else {
            fillLines[c].push(line(api, links, boxLeftX, boxMidY, startX, y, {
              stroke: 'var(--ok)', 'stroke-width': 2, pathLength: 1,
              'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
            }));
          }
        }
      }

      // Active column highlight frame
      colFocus = el('rect', {
        x: TX, y: TY, width: COL_W, height: HDR_H + raw.length * ROW_H,
        rx: 10, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5,
        opacity: 0, class: 'scene-tween scene-slow',
      });

      // Mean summary card on the right
      meanBox = el('g', { opacity: 0, class: 'scene-tween' });
      el('rect', {
        x: MX, y: MY, width: MW, height: MH, rx: 12,
        fill: 'var(--sheet)', stroke: 'var(--hl)', 'stroke-width': 2.2,
      }, meanBox);
      label(api, meanBox, MX + MW / 2, MY + 28, t('mean'), {
        'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 14, 'font-weight': 600,
      });
      meanValue = label(api, meanBox, MX + MW / 2, MY + 64, '34', {
        'text-anchor': 'middle', 'font-size': 24, 'font-weight': 700,
        class: 'scene-value scene-tween',
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
