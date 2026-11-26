import { lda } from '../../engine/dimred';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface Point {
  x: number;
  y: number;
  c: 0 | 1;
}

const CLOUD_TILT = -0.38;
const WRONG_TILT = -0.34;
const ROW_OFFSET = 37;
const LONG_OFFSETS = [-92, -66, -40, -14, 14, 40, 66, 92];

function setDelay(el: Element, ms: number) {
  (el as SVGElement).style.setProperty('--delay', `${ms}ms`);
}

export default function ldaScene() {
  let centered: Point[] = [];
  let classCentres: Array<{ x: number; y: number }> = [];
  let mx = 200;
  let my = 148;
  let ldaAngle = 1.19;
  let ldaDeg = 68;
  let wrongDeg = -19.5;

  let rotGroup: SVGGElement;
  let axisRot: SVGGElement;
  let spiderLines: SVGLineElement[] = [];
  let centreMarks: SVGGElement[] = [];
  let gapGroup: SVGGElement;
  let spreadEllipses: SVGEllipseElement[] = [];
  let ld1Line: SVGLineElement;
  let projLines: SVGLineElement[] = [];
  let projTicks: SVGCircleElement[] = [];
  let cloudDots: SVGCircleElement[] = [];
  let cutTick: SVGLineElement;
  let ld1Tag: SVGTextElement;
  let statusLabel: SVGTextElement;

  function applyFrame(i: number, api: SceneApi, instant = false) {
    const { t } = api;
    const d = (ms: number) => (instant ? 0 : ms);

    // Step 4 rotates the entire cloud so LD1 becomes horizontal
    setDelay(rotGroup, d(0));
    rotGroup.style.transform = i === 3 ? `rotate(${(-ldaDeg).toFixed(2)}deg)` : 'rotate(0deg)';

    // Step 3 rotates the candidate axis from the overlapping direction to the LD1 direction
    setDelay(axisRot, d(0));
    axisRot.style.transform = `rotate(${(i >= 2 ? ldaDeg : wrongDeg).toFixed(2)}deg)`;

    // Step 1: spider lines & class centres
    spiderLines.forEach(s => {
      setDelay(s, d(0));
      s.setAttribute('stroke-dashoffset', i === 0 ? '0' : '1');
      s.setAttribute('opacity', i === 0 ? '0.45' : '0');
    });
    centreMarks.forEach(m => {
      setDelay(m, d(i === 0 ? 450 : 0));
      m.setAttribute('opacity', i <= 2 ? '1' : '0.35');
    });

    // Step 2: gap between centres + within-class spread
    setDelay(gapGroup, d(i === 1 ? 0 : 0));
    gapGroup.setAttribute('opacity', i === 1 ? '1' : '0');
    spreadEllipses.forEach(e => {
      setDelay(e, d(i === 1 ? 450 : 0));
      e.setAttribute('opacity', i === 1 ? '0.9' : i === 2 ? '0.35' : '0');
    });

    // Step 3–4: LD1 axis & projections
    const showAxis = i >= 2;
    setDelay(ld1Line, d(0));
    ld1Line.setAttribute('opacity', showAxis ? '1' : '0');

    projLines.forEach(p => {
      setDelay(p, d(i === 2 ? 450 : 0));
      p.setAttribute('stroke-dashoffset', i === 2 ? '0' : '1');
      p.setAttribute('opacity', i === 2 ? '0.55' : i === 3 ? '0.25' : '0');
    });
    projTicks.forEach(tick => {
      setDelay(tick, d(i === 2 ? 550 : i === 3 ? 400 : 0));
      tick.setAttribute('opacity', showAxis ? '1' : '0');
      tick.setAttribute('r', i === 3 ? '5.25' : '4');
    });

    cloudDots.forEach(dot => {
      setDelay(dot, d(i === 3 ? 400 : 0));
      dot.setAttribute('opacity', i === 3 ? '0.22' : '1');
    });

    setDelay(cutTick, d(i === 3 ? 800 : 0));
    cutTick.setAttribute('opacity', i === 3 ? '0.9' : '0');

    // Tags
    setDelay(ld1Tag, d(i === 2 ? 900 : 0));
    ld1Tag.setAttribute('opacity', showAxis ? '1' : '0');
    if (i === 3) {
      ld1Tag.setAttribute('x', String(mx + 132));
      ld1Tag.setAttribute('y', String(my - 12));
      ld1Tag.setAttribute('text-anchor', 'end');
    } else {
      ld1Tag.setAttribute('x', String(mx + 82 * Math.cos(ldaAngle) + 14));
      ld1Tag.setAttribute('y', String(my + 82 * Math.sin(ldaAngle) + 4));
      ld1Tag.setAttribute('text-anchor', 'start');
    }

    setDelay(statusLabel, d(i === 0 ? 850 : i === 1 ? 900 : i === 2 ? 950 : 900));
    statusLabel.textContent = i === 0 ? t('centres') : i === 1 ? t('gap') : i === 3 ? t('coords') : '';
    statusLabel.setAttribute('opacity', i === 2 ? '0' : '1');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;

      const grid = el('g');
      for (let x = 35; x <= 365; x += 33) line(api, grid, x, 50, x, 244);
      for (let y = 50; y <= 244; y += 32) line(api, grid, 35, y, 365, y);

      const cosT = Math.cos(CLOUD_TILT);
      const sinT = Math.sin(CLOUD_TILT);
      const rawPoints: Point[] = [];
      for (const c of [0, 1] as const) {
        const perp = c === 0 ? -ROW_OFFSET : ROW_OFFSET;
        for (const along of LONG_OFFSETS) {
          const lx = along + 8 * (random() - 0.5);
          const ly = perp + 9 * (random() - 0.5);
          rawPoints.push({
            x: 200 + lx * cosT - ly * sinT,
            y: 148 + lx * sinT + ly * cosT,
            c,
          });
        }
      }

      const result = lda(rawPoints.map(p => [p.x, p.y]), rawPoints.map(p => p.c), 1);
      mx = result.mean[0];
      my = result.mean[1];
      let dir = result.directions[0] ?? [Math.sin(CLOUD_TILT), -Math.cos(CLOUD_TILT)];

      centered = rawPoints.map(p => ({ x: p.x - mx, y: p.y - my, c: p.c }));
      classCentres = [0, 1].map(c => {
        const g = centered.filter(p => p.c === c);
        return {
          x: g.reduce((s, p) => s + p.x, 0) / g.length,
          y: g.reduce((s, p) => s + p.y, 0) / g.length,
        };
      });

      // Orient LD1 from Class A centre toward Class B centre so Class A sits left in Step 4.
      const abx = classCentres[1].x - classCentres[0].x;
      const aby = classCentres[1].y - classCentres[0].y;
      if (abx * dir[0] + aby * dir[1] < 0) dir = [-dir[0], -dir[1]];
      ldaAngle = Math.atan2(dir[1], dir[0]);
      ldaDeg = (ldaAngle * 180) / Math.PI;
      wrongDeg = (WRONG_TILT * 180) / Math.PI;

      statusLabel = label(api, svg, 365, 33, '', {
        'text-anchor': 'end', 'font-size': 15, 'font-weight': 600, opacity: 0, class: 'scene-tween',
      });

      const anchor = el('g', { transform: `translate(${mx.toFixed(1)} ${my.toFixed(1)})` });
      rotGroup = el('g', { class: 'scene-tween scene-slow' }, anchor);
      rotGroup.style.transformOrigin = '0px 0px';

      const colors = ['var(--a)', 'var(--b)'];

      // Within-class spread ellipses
      const cloudDeg = (CLOUD_TILT * 180) / Math.PI;
      spreadEllipses = classCentres.map((ctr, c) =>
        el('ellipse', {
          cx: 0, cy: 0, rx: 102, ry: 17, fill: colors[c], 'fill-opacity': 0.1,
          stroke: colors[c], 'stroke-width': 1.5, 'stroke-dasharray': '4 3', opacity: 0,
          transform: `translate(${ctr.x.toFixed(1)} ${ctr.y.toFixed(1)}) rotate(${cloudDeg.toFixed(1)})`,
          class: 'scene-tween',
        }, rotGroup),
      );

      // Spider lines from each point to its class centre (Step 1)
      spiderLines = centered.map(p =>
        line(api, rotGroup, p.x, p.y, classCentres[p.c].x, classCentres[p.c].y, {
          stroke: colors[p.c], 'stroke-width': 1.25, pathLength: 1, 'stroke-dasharray': '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        }),
      );

      // Between-class gap bar (Step 2)
      gapGroup = el('g', { opacity: 0, class: 'scene-tween' }, rotGroup);
      line(api, gapGroup, classCentres[0].x, classCentres[0].y, classCentres[1].x, classCentres[1].y, {
        stroke: 'var(--hl)', 'stroke-width': 7, opacity: 0.65,
      });
      line(api, gapGroup, classCentres[0].x, classCentres[0].y, classCentres[1].x, classCentres[1].y, {
        stroke: 'var(--ink)', 'stroke-width': 2.25,
      });

      // Projection lines + candidate/LD1 axis
      const ux = Math.cos(ldaAngle);
      const uy = Math.sin(ldaAngle);
      projLines = centered.map(p => {
        const proj = p.x * ux + p.y * uy;
        return line(api, rotGroup, p.x, p.y, proj * ux, proj * uy, {
          stroke: 'var(--muted)', 'stroke-width': 1.25, pathLength: 1, 'stroke-dasharray': '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        });
      });

      axisRot = el('g', { class: 'scene-tween scene-slow' }, rotGroup);
      axisRot.style.transformOrigin = '0px 0px';
      ld1Line = line(api, axisRot, -136, 0, 136, 0, {
        stroke: 'var(--ink)', 'stroke-width': 2.25, opacity: 0, class: 'scene-tween',
      });
      cutTick = line(api, axisRot, 0, -14, 0, 14, {
        stroke: 'var(--hl)', 'stroke-width': 3, opacity: 0, class: 'scene-tween',
      });

      // 2D cloud dots
      cloudDots = centered.map(p =>
        el('circle', {
          cx: p.x, cy: p.y, r: 4.5, fill: colors[p.c], stroke: 'var(--paper)', 'stroke-width': 1.25, class: 'scene-tween',
        }, rotGroup),
      );

      // Class centres
      centreMarks = classCentres.map((ctr, c) => {
        const g = el('g', { opacity: 0, class: 'scene-tween' }, rotGroup);
        el('circle', { cx: ctr.x, cy: ctr.y, r: 9.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5 }, g);
        el('circle', { cx: ctr.x, cy: ctr.y, r: 4.5, fill: colors[c], stroke: 'var(--ink)', 'stroke-width': 1.5 }, g);
        return g;
      });

      // Projected ticks along LD1
      projTicks = centered.map(p => {
        const proj = p.x * ux + p.y * uy;
        return el('circle', {
          cx: proj * ux, cy: proj * uy, r: 4, fill: colors[p.c], stroke: 'var(--paper)', 'stroke-width': 1.5,
          opacity: 0, class: 'scene-tween',
        }, rotGroup);
      });

      ld1Tag = label(api, svg, 0, 0, t('ld1'), {
        'font-size': 14, 'font-weight': 700, opacity: 0, class: 'scene-tween',
      });

      // Legend
      for (const [idx, x] of [56, 224].entries()) {
        el('circle', { cx: x, cy: 276, r: 5.5, fill: colors[idx] });
        label(api, svg, x + 14, 281, t(idx === 0 ? 'classA' : 'classB'), { fill: 'var(--muted)', 'font-size': 14 });
      }

      applyFrame(0, api, true);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api, true);
        spiderLines.forEach(s => {
          s.setAttribute('stroke-dashoffset', '1');
          s.setAttribute('opacity', '0');
        });
        centreMarks.forEach(m => m.setAttribute('opacity', '0'));
        statusLabel.setAttribute('opacity', '0');
      } else if (i === 2) {
        applyFrame(1, api, true);
        axisRot.style.transform = `rotate(${wrongDeg.toFixed(2)}deg)`;
        ld1Line.setAttribute('opacity', '0.75');
      } else {
        applyFrame(i - 1, api, true);
      }
    },
  });
}
