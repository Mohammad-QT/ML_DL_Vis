import { chain, contour, sampleGrid } from '../../engine/contour';
import { fitModel } from '../../engine/models';
import { rng } from '../../engine/random';
import { crossValidate } from '../../engine/selection';
import { PRESETS } from '../../engine/store';
import { defineScene, type SceneApi } from '../scene';
import { label } from './svg';

const cVals = [-1, 0, 1, 2]; // log10(C): 0.1, 1, 10, 100
const gVals = [-2, -1, 0, 1]; // log10(gamma): 0.01, 0.1, 1, 10

const GX = 56;
const GY = 66;
const CELL = 40;
const GAP = 4;

const BX = 246;
const BY = 66;
const BS = 128;

export default function gridScene() {
  const pts = PRESETS.circles(rng(9)).slice(0, 46);
  const scores: number[] = [];
  let bestIdx = 0;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 4 + c;
      const score = crossValidate('ksvm', { C: cVals[r], gamma: gVals[c] }, pts, 5, 9).mean;
      scores.push(score);
      if (score > scores[bestIdx]) bestIdx = idx;
    }
  }

  const bestR = Math.floor(bestIdx / 4);
  const bestC = bestIdx % 4;
  const bestScore = scores[bestIdx];
  const finalModel = fitModel('ksvm', { C: cVals[bestR], gamma: gVals[bestC] }, pts);
  const chains = chain(contour(sampleGrid((x, y) => finalModel.predict(x, y), BS, BS, 6), 0.5));

  const cells: { fill: SVGRectElement; base: SVGRectElement }[] = [];
  let scanRing: SVGRectElement;
  let boardGroup: SVGGElement;
  let boundaryPaths: SVGPathElement[] = [];
  let finalLabel: SVGTextElement;
  let status: SVGTextElement;

  const cellX = (c: number) => GX + c * CELL;
  const cellY = (r: number) => GY + r * CELL;
  const pct = (v: number) => String(Math.round(v * 100));

  function showGrid(opts: { filledThrough: number; activeIdx: number; highlightBest: boolean; showFinal: boolean; text: string }) {
    for (let idx = 0; idx < 16; idx++) {
      const filled = idx <= opts.filledThrough;
      const isWinner = opts.highlightBest && idx === bestIdx;
      const dimmed = opts.highlightBest && idx !== bestIdx;
      const s = scores[idx];
      const color = s >= bestScore - 0.035 ? 'var(--ok)' : s >= 0.78 ? 'var(--a)' : 'var(--bad)';
      const alpha = 0.25 + 0.65 * Math.max(0, Math.min(1, (s - 0.45) / 0.55));

      cells[idx].base.setAttribute('opacity', dimmed ? '0.45' : '1');
      cells[idx].fill.setAttribute('fill', color);
      cells[idx].fill.setAttribute('opacity', filled ? String(dimmed ? alpha * 0.45 : isWinner ? 0.92 : alpha) : '0');
    }

    const ringIdx = opts.highlightBest ? bestIdx : opts.activeIdx;
    if (ringIdx >= 0) {
      const r = Math.floor(ringIdx / 4);
      const c = ringIdx % 4;
      scanRing.style.transform = `translate(${cellX(c) - 1}px, ${cellY(r) - 1}px)`;
      scanRing.setAttribute('opacity', '1');
    } else {
      scanRing.setAttribute('opacity', '0');
    }

    boardGroup.setAttribute('opacity', opts.showFinal ? '1' : '0.45');
    finalLabel.setAttribute('opacity', opts.showFinal ? '1' : '0.45');
    for (const p of boundaryPaths) {
      p.setAttribute('stroke-dashoffset', opts.showFinal ? '0' : '1');
      p.setAttribute('opacity', opts.showFinal ? '1' : '0');
    }

    status.textContent = opts.text;
    status.setAttribute('opacity', opts.text ? '1' : '0');
  }

  function applyFrame(i: number, api: SceneApi) {
    if (i === 0) {
      showGrid({ filledThrough: -1, activeIdx: -1, highlightBest: false, showFinal: false, text: '' });
    } else if (i === 1) {
      showGrid({
        filledThrough: 15, activeIdx: 15, highlightBest: false, showFinal: false,
        text: api.t('cv').replace('{s}', pct(scores[15])),
      });
    } else if (i === 2) {
      showGrid({
        filledThrough: 15, activeIdx: bestIdx, highlightBest: true, showFinal: false,
        text: api.t('best').replace('{s}', pct(bestScore)),
      });
    } else {
      showGrid({
        filledThrough: 15, activeIdx: bestIdx, highlightBest: true, showFinal: true,
        text: api.t('best').replace('{s}', pct(bestScore)),
      });
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      label(api, svg, GX + (4 * CELL - GAP) / 2, 46, t('gamma'), { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });
      label(api, svg, 34, GY + (4 * CELL - GAP) / 2 + 5, t('c'), { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });

      const gridLayer = el('g');
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const x = cellX(c);
          const y = cellY(r);
          const size = CELL - GAP;
          const base = el('rect', {
            x, y, width: size, height: size, rx: 6, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5, class: 'scene-tween',
          }, gridLayer);
          const fill = el('rect', {
            x: x + 2, y: y + 2, width: size - 4, height: size - 4, rx: 4, fill: 'var(--a)', opacity: 0, class: 'scene-tween',
          }, gridLayer);
          cells.push({ base, fill });
        }
      }

      scanRing = el('rect', {
        x: 0, y: 0, width: CELL - GAP + 2, height: CELL - GAP + 2, rx: 7,
        fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      }, svg);

      // Final model board on the right
      finalLabel = label(api, svg, BX + BS / 2, 46, t('final'), {
        'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, class: 'scene-tween',
      });
      boardGroup = el('g', { class: 'scene-tween' }, svg);
      el('rect', {
        x: BX, y: BY, width: BS, height: BS, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      }, boardGroup);

      for (const p of pts) {
        el('circle', {
          cx: BX + p.x * BS, cy: BY + p.y * BS, r: 3, fill: p.c === 0 ? 'var(--a)' : 'var(--b)',
        }, boardGroup);
      }

      boundaryPaths = chains.map(poly => {
        const d = poly.map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${(BX + x).toFixed(1)},${(BY + y).toFixed(1)}`).join(' ');
        return el('path', {
          d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        }, boardGroup);
      });

      status = label(api, svg, BX + BS / 2, 224, '', {
        'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, opacity: 0, class: 'scene-value scene-tween',
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        showGrid({ filledThrough: -1, activeIdx: -1, highlightBest: false, showFinal: false, text: '' });
        for (const c of cells) c.base.setAttribute('opacity', '0');
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 1 || api.reduced || !browser) return () => {};
      const timers: number[] = [];
      const phaseMs = 140;
      for (let idx = 0; idx < 16; idx++) {
        const k = idx;
        const run = () => showGrid({
          filledThrough: k, activeIdx: k, highlightBest: false, showFinal: false,
          text: api.t('cv').replace('{s}', pct(scores[k])),
        });
        if (idx === 0) run();
        else timers.push(browser.setTimeout(run, idx * phaseMs));
      }
      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
