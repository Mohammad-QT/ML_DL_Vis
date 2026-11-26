import { rng } from '../../engine/random';
import { crossValidate, jitter } from '../../engine/selection';
import { PRESETS } from '../../engine/store';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const K = 5;
const BAR_X = 32;
const FOLD_W = 61;
const FOLD_GAP = 8;
const FOLD_Y = 56;
const FOLD_H = 38;
const TRACK_Y = 114;
const TRACK_H = 54;
const AXIS_X1 = 60;
const AXIS_X2 = 340;
const AXIS_Y = 228;

export default function cvScene() {
  const pts = jitter(PRESETS.moons(rng(9)), 0.085, 9);
  const cv = crossValidate('knn', { k: 5 }, pts, K, 9);

  const folds: { group: SVGGElement; box: SVGRectElement; ring: SVGRectElement; num: SVGTextElement }[] = [];
  const bars: { fill: SVGRectElement; text: SVGTextElement; track: SVGRectElement }[] = [];
  let legend: SVGGElement;
  let summary: SVGGElement;
  let status: SVGTextElement;

  const foldX = (f: number) => BAR_X + f * (FOLD_W + FOLD_GAP);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  function showFolds(opts: { testFold: number; scoredThrough: number; bunched: boolean; neutral: boolean }) {
    for (let f = 0; f < K; f++) {
      const isTest = f === opts.testFold;
      const offset = opts.bunched ? (2 - f) * 6 : 0;
      folds[f].group.style.transform = `translateX(${offset}px)`;

      if (opts.neutral) {
        folds[f].box.setAttribute('fill', 'var(--sheet)');
        folds[f].box.setAttribute('stroke', 'var(--rule)');
        folds[f].num.setAttribute('fill', 'var(--ink)');
        folds[f].ring.setAttribute('opacity', '0');
      } else {
        folds[f].box.setAttribute('fill', isTest ? 'var(--b)' : 'var(--a)');
        folds[f].box.setAttribute('stroke', isTest ? 'var(--b)' : 'var(--a)');
        folds[f].num.setAttribute('fill', 'var(--paper)');
        folds[f].ring.setAttribute('opacity', isTest ? '1' : '0');
      }

      const showBar = f <= opts.scoredThrough;
      bars[f].track.setAttribute('opacity', opts.scoredThrough >= 0 ? '1' : '0');
      bars[f].fill.setAttribute('opacity', showBar ? '1' : '0');
      bars[f].fill.style.transform = `scale(1, ${showBar ? Math.max(0.1, (cv.scores[f] - 0.4) / 0.6) : 0.05})`;
      bars[f].fill.setAttribute('fill', isTest ? 'var(--b)' : 'var(--ok)');
      bars[f].text.setAttribute('opacity', showBar ? '1' : '0');
    }
  }

  function applyFrame(i: number, api: SceneApi) {
    if (i === 0) {
      showFolds({ testFold: -1, scoredThrough: -1, bunched: false, neutral: true });
      legend.setAttribute('opacity', '0');
      summary.setAttribute('opacity', '0');
      status.textContent = api.t('data');
      status.setAttribute('opacity', '1');
    } else if (i === 1) {
      showFolds({ testFold: 0, scoredThrough: 0, bunched: false, neutral: false });
      legend.setAttribute('opacity', '1');
      summary.setAttribute('opacity', '0');
      status.textContent = api.t('fold').replace('{n}', '1');
      status.setAttribute('opacity', '1');
    } else if (i === 2) {
      showFolds({ testFold: K - 1, scoredThrough: K - 1, bunched: false, neutral: false });
      legend.setAttribute('opacity', '1');
      summary.setAttribute('opacity', '0');
      status.textContent = api.t('fold').replace('{n}', String(K));
      status.setAttribute('opacity', '1');
    } else {
      showFolds({ testFold: -1, scoredThrough: K - 1, bunched: false, neutral: true });
      legend.setAttribute('opacity', '0');
      summary.setAttribute('opacity', '1');
      status.textContent = api.t('mean');
      status.setAttribute('opacity', '1');
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      label(api, svg, BAR_X, 34, t('k'), { class: 'scene-value', 'font-size': 15, 'font-weight': 700 });
      status = label(api, svg, BAR_X + K * FOLD_W + (K - 1) * FOLD_GAP, 34, '', {
        'text-anchor': 'end', 'font-size': 15, 'font-weight': 600, opacity: 0, class: 'scene-tween',
      });

      const foldsLayer = el('g');
      const barsLayer = el('g');
      for (let f = 0; f < K; f++) {
        const x = foldX(f);
        const group = el('g', { class: 'scene-tween' }, foldsLayer);
        const ring = el('rect', {
          x: x - 4, y: FOLD_Y - 4, width: FOLD_W + 8, height: FOLD_H + 8, rx: 11,
          fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
        }, group);
        const box = el('rect', {
          x, y: FOLD_Y, width: FOLD_W, height: FOLD_H, rx: 8,
          fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5, class: 'scene-tween',
        }, group);
        const num = label(api, group, x + FOLD_W / 2, FOLD_Y + 25, String(f + 1), {
          'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, class: 'scene-value scene-tween',
        });
        folds.push({ group, box, ring, num });

        const cx = x + FOLD_W / 2;
        const track = el('rect', {
          x: cx - 10, y: TRACK_Y, width: 20, height: TRACK_H, rx: 5, fill: 'var(--rule)', opacity: 0, class: 'scene-tween',
        }, barsLayer);
        const fill = el('rect', {
          x: cx - 10, y: TRACK_Y, width: 20, height: TRACK_H, rx: 5, fill: 'var(--ok)', opacity: 0, class: 'scene-tween',
        }, barsLayer);
        fill.style.transformOrigin = `${cx}px ${TRACK_Y + TRACK_H}px`;
        const text = label(api, barsLayer, cx, TRACK_Y + TRACK_H + 18, pct(cv.scores[f]), {
          'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, opacity: 0, class: 'scene-value scene-tween',
        });
        bars.push({ fill, text, track });
      }

      // Legend for frames 1-2
      legend = el('g', { opacity: 0, class: 'scene-tween' }, svg);
      el('circle', { cx: 120, cy: 256, r: 5.5, fill: 'var(--a)' }, legend);
      label(api, legend, 132, 261, t('train'), { fill: 'var(--muted)', 'font-size': 14 });
      el('circle', { cx: 226, cy: 256, r: 5.5, fill: 'var(--b)' }, legend);
      label(api, legend, 238, 261, t('test'), { fill: 'var(--muted)', 'font-size': 14 });

      // Mean ± spread summary axis for frame 3
      summary = el('g', { opacity: 0, class: 'scene-tween' }, svg);
      const scaleX = (score: number) => AXIS_X1 + Math.max(0, Math.min(1, (score - 0.5) / 0.5)) * (AXIS_X2 - AXIS_X1);
      line(api, summary, AXIS_X1, AXIS_Y, AXIS_X2, AXIS_Y, { stroke: 'var(--rule)', 'stroke-width': 2 });

      const lo = scaleX(cv.mean - cv.std);
      const hi = scaleX(cv.mean + cv.std);
      line(api, summary, lo, AXIS_Y, hi, AXIS_Y, { stroke: 'var(--hl)', 'stroke-width': 8 });

      for (const s of cv.scores) {
        el('circle', { cx: scaleX(s), cy: AXIS_Y, r: 4.5, fill: 'var(--ok)', stroke: 'var(--paper)', 'stroke-width': 1.5 }, summary);
      }

      const meanX = scaleX(cv.mean);
      line(api, summary, meanX, AXIS_Y - 12, meanX, AXIS_Y + 12, { stroke: 'var(--ink)', 'stroke-width': 2.5 });
      label(api, summary, 200, 266, `${pct(cv.mean)} ± ${pct(cv.std)}`, {
        'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, class: 'scene-value',
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        showFolds({ testFold: -1, scoredThrough: -1, bunched: true, neutral: true });
        legend.setAttribute('opacity', '0');
        summary.setAttribute('opacity', '0');
        status.setAttribute('opacity', '0');
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 2 || api.reduced || !browser) return () => {};
      const timers: number[] = [];
      const phaseMs = 500;
      for (let f = 0; f < K; f++) {
        const fold = f;
        const run = () => {
          showFolds({ testFold: fold, scoredThrough: fold, bunched: false, neutral: false });
          status.textContent = api.t('fold').replace('{n}', String(fold + 1));
          status.setAttribute('opacity', '1');
        };
        if (f === 0) run();
        else timers.push(browser.setTimeout(run, f * phaseMs));
      }
      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
