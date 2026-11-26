import { fitReg, type RegModel } from '../../engine/regression';
import { rng } from '../../engine/random';
import type { Sample } from '../../engine/types';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const MAIN = { x: 22, y: 48, w: 186, h: 184 };
const MINIS = [
  { x: 244, y: 48, w: 134, h: 52 },
  { x: 244, y: 114, w: 134, h: 52 },
  { x: 244, y: 180, w: 134, h: 52 },
];
const TREE_COLORS = ['var(--a)', 'var(--b)', 'var(--ok)'];
const QUERY_X = 0.64;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function curvePath(fn: (x: number) => number, box: { x: number; y: number; w: number; h: number }, steps = 160): string {
  let d = '';
  for (let s = 0; s <= steps; s++) {
    const nx = 0.02 + (0.96 * s) / steps;
    const ny = clamp(fn(nx), 0.04, 0.96);
    const px = box.x + nx * box.w;
    const py = box.y + ny * box.h;
    d += `${s === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)} `;
  }
  return d.trim();
}

function delay(el: SVGElement, ms: number) {
  el.style.setProperty('--delay', `${ms}ms`);
}

export default function forestRegScene() {
  let heading: SVGTextElement;
  let arrows: SVGPathElement[] = [];
  let miniBorders: SVGRectElement[] = [];
  let miniDots: SVGGElement[] = [];
  let repeatRings: SVGCircleElement[][] = [];
  let miniCurves: SVGPathElement[] = [];
  let mainCurves: SVGPathElement[] = [];
  let avgCurve: SVGPathElement;
  let queryLine: SVGLineElement;
  let miniQueryDots: SVGCircleElement[] = [];
  let mainTreeDots: SVGCircleElement[] = [];
  let avgRing: SVGCircleElement;
  let avgDot: SVGCircleElement;
  let avgBar: SVGGElement;
  let barAvgRing: SVGCircleElement;

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;
    heading.textContent =
      i === 0 ? t('bootstrap')
      : i === 1 ? t('treeN').replace('{n}', '1')
      : i === 2 ? t('trees')
      : t('avg');

    arrows.forEach((a, idx) => {
      delay(a, i === 0 ? idx * 140 : 0);
      a.setAttribute('stroke-dashoffset', '0');
      a.setAttribute('opacity', i === 0 ? '0.85' : '0.2');
    });

    miniDots.forEach((g, idx) => {
      delay(g, i === 0 ? 420 + idx * 140 : 0);
      g.setAttribute('opacity', '1');
    });

    repeatRings.forEach((rings, idx) => {
      rings.forEach(r => {
        delay(r, i === 0 ? 860 + idx * 80 : 0);
        r.setAttribute('opacity', i === 0 ? '1' : '0.45');
      });
    });

    miniBorders.forEach((b, idx) => {
      const lit = (i === 1 && idx === 0) || (i === 2 && idx > 0);
      delay(b, i === 2 && idx === 2 ? 420 : 0);
      b.setAttribute('opacity', lit ? '1' : '0');
    });

    miniCurves.forEach((p, idx) => {
      const shown = (i === 1 && idx === 0) || (i >= 2);
      const ms = i === 1 ? 260 : i === 2 ? (idx === 1 ? 140 : idx === 2 ? 580 : 0) : 0;
      delay(p, ms);
      p.setAttribute('stroke-dashoffset', shown ? '0' : '1');
      p.setAttribute('opacity', shown ? '1' : '0');
    });

    mainCurves.forEach((p, idx) => {
      const shown = (i === 1 && idx === 0) || (i >= 2);
      const ms = i === 1 ? 680 : i === 2 ? (idx === 1 ? 360 : idx === 2 ? 820 : 0) : 0;
      delay(p, ms);
      p.setAttribute('stroke-dashoffset', shown ? '0' : '1');
      p.setAttribute('opacity', shown ? (i === 3 ? '0.32' : '0.92') : '0');
    });

    const isAvg = i === 3;
    delay(queryLine, 0);
    queryLine.setAttribute('stroke-dashoffset', isAvg ? '0' : '1');
    queryLine.setAttribute('opacity', isAvg ? '0.85' : '0');

    miniQueryDots.forEach(d => {
      delay(d, isAvg ? 320 : 0);
      d.setAttribute('opacity', isAvg ? '1' : '0');
    });

    mainTreeDots.forEach(d => {
      delay(d, isAvg ? 320 : 0);
      d.setAttribute('opacity', isAvg ? '1' : '0');
    });

    delay(avgCurve, isAvg ? 620 : 0);
    avgCurve.setAttribute('stroke-dashoffset', isAvg ? '0' : '1');
    avgCurve.setAttribute('opacity', isAvg ? '1' : '0');

    delay(avgDot, isAvg ? 1050 : 0);
    delay(avgRing, isAvg ? 1050 : 0);
    avgDot.setAttribute('opacity', isAvg ? '1' : '0');
    avgRing.setAttribute('opacity', isAvg ? '1' : '0');

    delay(avgBar, isAvg ? 1050 : 0);
    avgBar.setAttribute('opacity', isAvg ? '1' : '0');
    delay(barAvgRing, 0);
    barAvgRing.setAttribute('opacity', isAvg ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;
      const r = rng(11);

      const samples: Sample[] = Array.from({ length: 16 }, (_, idx) => {
        const x = 0.06 + (0.88 * idx) / 15;
        const y = clamp(0.5 - 0.28 * Math.sin(2 * Math.PI * x) + (r() - 0.5) * 0.14, 0.1, 0.9);
        return { x, y, c: 0 as const };
      });

      const boots: number[][] = [];
      const models: RegModel[] = [];
      for (let k = 0; k < 3; k++) {
        const counts = new Array<number>(samples.length).fill(0);
        const boot: Sample[] = [];
        for (let m = 0; m < samples.length; m++) {
          const pick = Math.floor(r() * samples.length);
          counts[pick]++;
          boot.push(samples[pick]);
        }
        boots.push(counts);
        models.push(fitReg('tree', { depth: 3 }, boot));
      }

      const avgPredict = (x: number) => models.reduce((sum, m) => sum + m.predict(x), 0) / models.length;
      const yTrees = models.map(m => clamp(m.predict(QUERY_X), 0.06, 0.94));
      const yAvg = clamp(avgPredict(QUERY_X), 0.06, 0.94);

      heading = label(api, svg, 200, 30, t('bootstrap'), {
        'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700,
      });

      // Main regression board
      el('rect', {
        x: MAIN.x, y: MAIN.y, width: MAIN.w, height: MAIN.h, rx: 8,
        fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      });
      const mainGrid = el('g');
      for (let k = 1; k < 4; k++) {
        line(api, mainGrid, MAIN.x + (MAIN.w * k) / 4, MAIN.y, MAIN.x + (MAIN.w * k) / 4, MAIN.y + MAIN.h);
        line(api, mainGrid, MAIN.x, MAIN.y + (MAIN.h * k) / 4, MAIN.x + MAIN.w, MAIN.y + (MAIN.h * k) / 4);
      }

      mainCurves = models.map((m, idx) => el('path', {
        d: curvePath(x => m.predict(x), MAIN),
        fill: 'none', stroke: TREE_COLORS[idx], 'stroke-width': 1.9,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0,
        class: 'scene-tween',
      }));

      avgCurve = el('path', {
        d: curvePath(avgPredict, MAIN),
        fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.6,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0,
        class: 'scene-tween scene-slow',
      });

      const qxMain = MAIN.x + QUERY_X * MAIN.w;
      queryLine = line(api, svg, qxMain, MAIN.y + 4, qxMain, MAIN.y + MAIN.h - 4, {
        stroke: 'var(--muted)', 'stroke-width': 1.5, pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      for (const s of samples) {
        el('circle', {
          cx: MAIN.x + s.x * MAIN.w, cy: MAIN.y + s.y * MAIN.h, r: 4,
          fill: 'var(--muted)', stroke: 'var(--paper)', 'stroke-width': 1.2,
        });
      }

      mainTreeDots = yTrees.map((yv, idx) => el('circle', {
        cx: qxMain, cy: MAIN.y + yv * MAIN.h, r: 4.5,
        fill: TREE_COLORS[idx], stroke: 'var(--paper)', 'stroke-width': 1.25,
        opacity: 0, class: 'scene-tween',
      }));

      const qyAvg = MAIN.y + yAvg * MAIN.h;
      avgRing = el('circle', {
        cx: qxMain, cy: qyAvg, r: 9.5, fill: 'none',
        stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      });
      avgDot = el('circle', {
        cx: qxMain, cy: qyAvg, r: 5.5, fill: 'var(--ink)',
        stroke: 'var(--paper)', 'stroke-width': 1.5, opacity: 0, class: 'scene-tween',
      });

      // Arrows & 3 mini regression boards
      arrows = MINIS.map(box => el('path', {
        d: `M ${MAIN.x + MAIN.w + 4} ${MAIN.y + MAIN.h / 2} C ${MAIN.x + MAIN.w + 18} ${MAIN.y + MAIN.h / 2}, ${box.x - 18} ${box.y + box.h / 2}, ${box.x - 4} ${box.y + box.h / 2}`,
        fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-linecap': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, class: 'scene-tween',
      }));

      miniDots = [];
      repeatRings = [];
      miniCurves = [];
      miniBorders = [];
      miniQueryDots = [];

      MINIS.forEach((box, idx) => {
        el('rect', {
          x: box.x, y: box.y, width: box.w, height: box.h, rx: 6,
          fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
        });

        const dotGroup = el('g', { class: 'scene-tween' });
        const rings: SVGCircleElement[] = [];
        samples.forEach((s, pIdx) => {
          const count = boots[idx][pIdx];
          if (count === 0) return;
          const cx = box.x + s.x * box.w;
          const cy = box.y + s.y * box.h;
          if (count >= 2) {
            rings.push(el('circle', {
              cx, cy, r: 5.5, fill: 'none', stroke: 'var(--hl)',
              'stroke-width': 1.5, opacity: 1, class: 'scene-tween',
            }, dotGroup));
          }
          el('circle', { cx, cy, r: 2.6, fill: 'var(--muted)' }, dotGroup);
        });
        miniDots.push(dotGroup);
        repeatRings.push(rings);

        miniCurves.push(el('path', {
          d: curvePath(x => models[idx].predict(x), box),
          fill: 'none', stroke: TREE_COLORS[idx], 'stroke-width': 1.85,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0,
          class: 'scene-tween',
        }));

        miniQueryDots.push(el('circle', {
          cx: box.x + QUERY_X * box.w, cy: box.y + yTrees[idx] * box.h, r: 4,
          fill: TREE_COLORS[idx], stroke: 'var(--paper)', 'stroke-width': 1.25,
          opacity: 0, class: 'scene-tween',
        }));

        miniBorders.push(el('rect', {
          x: box.x - 2, y: box.y - 2, width: box.w + 4, height: box.h + 4, rx: 8,
          fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
        }));
      });

      // Bottom averaging strip (frame 3)
      avgBar = el('g', { opacity: 0, class: 'scene-tween' });
      [0, 1, 2].forEach(idx => {
        el('circle', { cx: 108 + idx * 32, cy: 266, r: 6.5, fill: TREE_COLORS[idx] }, avgBar);
      });
      line(api, avgBar, 194, 266, 224, 266, { stroke: 'var(--muted)', 'stroke-width': 1.75 });
      line(api, avgBar, 218, 261, 224, 266, { stroke: 'var(--muted)', 'stroke-width': 1.75 });
      line(api, avgBar, 218, 271, 224, 266, { stroke: 'var(--muted)', 'stroke-width': 1.75 });
      barAvgRing = el('circle', {
        cx: 244, cy: 266, r: 12, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5,
        opacity: 0, class: 'scene-tween',
      }, avgBar);
      el('circle', { cx: 244, cy: 266, r: 8, fill: 'var(--ink)' }, avgBar);
      label(api, avgBar, 264, 271, t('avg'), { 'font-size': 14, 'font-weight': 600 });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        arrows.forEach(a => {
          delay(a, 0);
          a.setAttribute('stroke-dashoffset', '1');
        });
        miniDots.forEach(g => {
          delay(g, 0);
          g.setAttribute('opacity', '0');
        });
        repeatRings.forEach(rings => rings.forEach(r => {
          delay(r, 0);
          r.setAttribute('opacity', '0');
        }));
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
        miniBorders.forEach((b, idx) => {
          delay(b, 0);
          b.setAttribute('opacity', idx === active ? '1' : '0');
        });
        barAvgRing.setAttribute('opacity', active === 3 ? '1' : '0.4');
      }, 620);
      return () => {
        browser.clearInterval(id);
        miniBorders.forEach(b => b.setAttribute('opacity', '0'));
        barAvgRing.setAttribute('opacity', '1');
      };
    },
  });
}
