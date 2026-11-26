import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const TRUE_RATES = [0.25, 0.72, 0.45];
const AD_X = [105, 200, 295];
const BASE_Y = 236;
const PX_PER_UNIT = 70;
const BAR_W = 38;
const TOTAL_ROUNDS = 30;

interface RoundSnapshot {
  round: number;
  plays: number[];
  wins: number[];
  chosen: number;
  click: boolean;
}

function simulateUcb(random: () => number): RoundSnapshot[] {
  const plays = [1, 1, 1];
  // Start with a realistic early miss on the best ad and a lucky first click on Ad 3.
  const wins = [0, 0, 1];
  const snapshots: RoundSnapshot[] = [
    { round: 3, plays: [...plays], wins: [...wins], chosen: 2, click: true },
  ];

  for (let t = 4; t <= TOTAL_ROUNDS; t++) {
    let best = 0;
    let bestScore = -Infinity;
    for (let a = 0; a < 3; a++) {
      const score = wins[a] / plays[a] + Math.sqrt((2 * Math.log(t)) / plays[a]);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    const click = t === 4 ? false : random() < TRUE_RATES[best];
    plays[best] += 1;
    wins[best] += click ? 1 : 0;
    snapshots.push({ round: t, plays: [...plays], wins: [...wins], chosen: best, click });
  }
  return snapshots;
}

export default function ucbScene() {
  let history: RoundSnapshot[] = [];
  const bars: SVGRectElement[] = [];
  const whiskers: SVGLineElement[] = [];
  const caps: SVGLineElement[] = [];
  const rings: SVGCircleElement[] = [];
  const counts: SVGTextElement[] = [];
  let status: SVGTextElement;
  let legendMean: SVGGElement;
  let legendBonus: SVGGElement;

  function renderSnapshot(snap: RoundSnapshot, opts: { showBars: boolean; showWhiskers: boolean; highlight: number }, api: SceneApi) {
    const scores = snap.plays.map((n, a) => {
      const mean = snap.wins[a] / n;
      const bonus = Math.sqrt((2 * Math.log(snap.round)) / n);
      return { mean, bonus, top: mean + bonus };
    });

    for (let a = 0; a < 3; a++) {
      const { mean, top } = scores[a];
      const barH = Math.max(2, mean * PX_PER_UNIT);
      const meanY = BASE_Y - mean * PX_PER_UNIT;
      const topY = Math.max(48, BASE_Y - top * PX_PER_UNIT);

      bars[a].setAttribute('y', String(BASE_Y - barH));
      bars[a].setAttribute('height', String(barH));
      bars[a].style.transform = opts.showBars ? 'scale(1, 1)' : 'scale(1, 0)';
      bars[a].setAttribute('opacity', opts.showBars ? '1' : '0');

      whiskers[a].setAttribute('y1', String(meanY));
      whiskers[a].setAttribute('y2', String(topY));
      whiskers[a].setAttribute('stroke-dashoffset', opts.showWhiskers ? '0' : '1');
      whiskers[a].setAttribute('opacity', opts.showWhiskers ? '1' : '0');

      caps[a].setAttribute('y1', String(topY));
      caps[a].setAttribute('y2', String(topY));
      caps[a].setAttribute('opacity', opts.showWhiskers ? '1' : '0');

      rings[a].setAttribute('cy', String(topY));
      rings[a].setAttribute('opacity', opts.showWhiskers && opts.highlight === a ? '1' : '0');

      counts[a].textContent = `${snap.wins[a]}/${snap.plays[a]}`;
    }
    status.textContent = api.t('round').replace('{n}', String(snap.round));
  }

  function highestTop(snap: RoundSnapshot): number {
    let best = 0;
    let bestScore = -Infinity;
    for (let a = 0; a < 3; a++) {
      const score = snap.wins[a] / snap.plays[a] + Math.sqrt((2 * Math.log(snap.round)) / snap.plays[a]);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
  }

  function applyFrame(i: number, api: SceneApi) {
    if (i === 0) {
      renderSnapshot(history[0], { showBars: false, showWhiskers: false, highlight: -1 }, api);
      bars.forEach(b => b.setAttribute('opacity', '0'));
      counts.forEach(c => c.setAttribute('opacity', '1'));
      legendMean.setAttribute('opacity', '0');
      legendBonus.setAttribute('opacity', '0');
    } else if (i === 1) {
      renderSnapshot(history[0], { showBars: true, showWhiskers: false, highlight: -1 }, api);
      counts.forEach(c => c.setAttribute('opacity', '1'));
      legendMean.setAttribute('opacity', '1');
      legendBonus.setAttribute('opacity', '0');
    } else if (i === 2) {
      const snap = history[0];
      renderSnapshot(snap, { showBars: true, showWhiskers: true, highlight: highestTop(snap) }, api);
      counts.forEach(c => c.setAttribute('opacity', '1'));
      legendMean.setAttribute('opacity', '1');
      legendBonus.setAttribute('opacity', '1');
    } else {
      const last = history[history.length - 1];
      renderSnapshot(last, { showBars: true, showWhiskers: true, highlight: highestTop(last) }, api);
      counts.forEach(c => c.setAttribute('opacity', '1'));
      legendMean.setAttribute('opacity', '1');
      legendBonus.setAttribute('opacity', '1');
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;
      history = simulateUcb(random);

      // Background scale lines: 0.0, 1.0 (dashed), 2.0.
      line(api, svg, 42, BASE_Y, 358, BASE_Y, { stroke: 'var(--muted)', 'stroke-width': 1.5 });
      line(api, svg, 42, BASE_Y - PX_PER_UNIT, 358, BASE_Y - PX_PER_UNIT, {
        stroke: 'var(--rule)', 'stroke-dasharray': '4 4',
      });
      line(api, svg, 42, BASE_Y - 2 * PX_PER_UNIT, 358, BASE_Y - 2 * PX_PER_UNIT, {
        stroke: 'var(--rule)',
      });
      label(api, svg, 35, BASE_Y + 4, '0', { 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });
      label(api, svg, 35, BASE_Y - PX_PER_UNIT + 4, '1', { 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value' });

      status = label(api, svg, 358, 32, '', {
        'text-anchor': 'end', 'font-size': 14, 'font-weight': 600, class: 'scene-value',
      });

      legendMean = el('g', { class: 'scene-tween' }, svg);
      el('rect', { x: 42, y: 20, width: 12, height: 12, rx: 3, fill: 'var(--a)' }, legendMean);
      label(api, legendMean, 60, 31, t('mean'), { fill: 'var(--muted)', 'font-size': 13 });

      legendBonus = el('g', { class: 'scene-tween' }, svg);
      line(api, legendBonus, 148, 20, 148, 32, { stroke: 'var(--ink)', 'stroke-width': 2 });
      line(api, legendBonus, 142, 20, 154, 20, { stroke: 'var(--ink)', 'stroke-width': 2 });
      label(api, legendBonus, 161, 31, t('bonus'), { fill: 'var(--muted)', 'font-size': 13 });

      const adKeys = ['ad1', 'ad2', 'ad3'];
      const adColors = ['var(--a)', 'var(--ok)', 'var(--b)'];

      for (let a = 0; a < 3; a++) {
        const cx = AD_X[a];
        const bar = el('rect', {
          x: cx - BAR_W / 2, y: BASE_Y, width: BAR_W, height: 2, rx: 5,
          fill: adColors[a], opacity: 0, class: 'scene-tween',
        }, svg);
        bar.style.transformOrigin = `${cx}px ${BASE_Y}px`;
        bars.push(bar);

        const whisker = line(api, svg, cx, BASE_Y, cx, BASE_Y, {
          stroke: 'var(--ink)', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        });
        whiskers.push(whisker);

        const cap = line(api, svg, cx - 11, BASE_Y, cx + 11, BASE_Y, {
          stroke: 'var(--ink)', 'stroke-width': 2.25, opacity: 0, class: 'scene-tween',
        });
        caps.push(cap);

        const ring = el('circle', {
          cx, cy: BASE_Y, r: 10, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.75,
          opacity: 0, class: 'scene-tween',
        }, svg);
        rings.push(ring);

        label(api, svg, cx, 258, t(adKeys[a]), {
          'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600,
        });
        counts.push(label(api, svg, cx, 277, '', {
          'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value scene-tween',
        }));
      }

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        counts.forEach(c => c.setAttribute('opacity', '0'));
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 3 || api.reduced || !browser) return () => {};

      const timers: number[] = [];
      const steps = history.slice(1);
      const stepMs = Math.min(85, Math.floor(2200 / steps.length));
      steps.forEach((snap, idx) => {
        const draw = () => {
          renderSnapshot(snap, { showBars: true, showWhiskers: true, highlight: highestTop(snap) }, api);
        };
        if (idx === 0) draw();
        else timers.push(browser.setTimeout(draw, idx * stepMs));
      });

      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
