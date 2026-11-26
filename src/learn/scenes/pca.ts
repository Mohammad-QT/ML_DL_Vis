import { pca } from '../../engine/dimred';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface Point {
  x: number;
  y: number;
}

const baseCloud: Point[] = [
  { x: -112, y: 12 }, { x: -94, y: -14 }, { x: -78, y: 20 }, { x: -62, y: -8 },
  { x: -46, y: 16 }, { x: -30, y: -22 }, { x: -16, y: 8 }, { x: -4, y: -15 },
  { x: 10, y: 22 }, { x: 24, y: -10 }, { x: 38, y: 14 }, { x: 52, y: -18 },
  { x: 68, y: 9 }, { x: 84, y: -12 }, { x: 98, y: 15 }, { x: 112, y: -9 },
];

const CLOUD_TILT = -0.56;

export default function pcaScene() {
  let centered: Point[] = [];
  let mx = 200;
  let my = 148;
  let pc1Angle = CLOUD_TILT;
  let totalVar = 1;

  let rotGroup: SVGGElement;
  let meanGroup: SVGGElement;
  let meanRing: SVGCircleElement;
  let candAxis: SVGLineElement;
  let pc2Axis: SVGLineElement;
  let rightAngle: SVGPathElement;
  let projLines: SVGLineElement[] = [];
  let projTicks: SVGCircleElement[] = [];
  let spreadLabel: SVGTextElement;
  let statusLabel: SVGTextElement;
  let pc1Tag: SVGTextElement;
  let pc2Tag: SVGTextElement;

  function varianceAt(theta: number): number {
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    let sum = 0;
    for (const p of centered) {
      const d = p.x * ux + p.y * uy;
      sum += d * d;
    }
    return totalVar > 0 ? Math.round((100 * sum) / totalVar) : 0;
  }

  function setAxis(theta: number, api: SceneApi) {
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    const len = 148;
    candAxis.setAttribute('x1', String(-len * ux));
    candAxis.setAttribute('y1', String(-len * uy));
    candAxis.setAttribute('x2', String(len * ux));
    candAxis.setAttribute('y2', String(len * uy));
    for (let i = 0; i < centered.length; i++) {
      const p = centered[i];
      const proj = p.x * ux + p.y * uy;
      const px = proj * ux;
      const py = proj * uy;
      projLines[i].setAttribute('x1', String(p.x));
      projLines[i].setAttribute('y1', String(p.y));
      projLines[i].setAttribute('x2', String(px));
      projLines[i].setAttribute('y2', String(py));
      projTicks[i].setAttribute('cx', String(px));
      projTicks[i].setAttribute('cy', String(py));
    }
    spreadLabel.textContent = api.t('spread').replace('{n}', String(varianceAt(theta)));
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;
    const deg = (pc1Angle * 180) / Math.PI;
    const ux = Math.cos(pc1Angle);
    const uy = Math.sin(pc1Angle);
    const vx = -uy;
    const vy = ux;

    rotGroup.style.transform = i === 3 ? `rotate(${-deg}deg)` : 'rotate(0deg)';
    meanGroup.setAttribute('opacity', '1');
    meanRing.setAttribute('opacity', i === 0 ? '1' : '0');

    setAxis(pc1Angle, api);
    const showPc1 = i >= 1;
    candAxis.setAttribute('opacity', showPc1 ? '1' : '0');
    candAxis.setAttribute('stroke-dashoffset', showPc1 ? '0' : '1');

    const projOpacity = i === 1 ? '0.5' : i === 2 ? '0.18' : '0';
    const tickOpacity = i === 1 ? '1' : i === 2 ? '0.35' : '0';
    for (let k = 0; k < centered.length; k++) {
      projLines[k].setAttribute('opacity', projOpacity);
      projTicks[k].setAttribute('opacity', tickOpacity);
    }

    const showPc2 = i >= 2;
    pc2Axis.setAttribute('opacity', showPc2 ? '1' : '0');
    pc2Axis.setAttribute('stroke-dashoffset', showPc2 ? '0' : '1');
    rightAngle.setAttribute('opacity', showPc2 ? (i === 3 ? '0.65' : '1') : '0');

    spreadLabel.setAttribute('opacity', i === 1 ? '1' : '0');
    statusLabel.textContent = i === 0 ? t('mean') : '';
    statusLabel.setAttribute('opacity', i === 0 ? '1' : '0');

    pc1Tag.setAttribute('opacity', showPc1 ? '1' : '0');
    if (i === 3) {
      pc1Tag.setAttribute('x', String(mx + 132));
      pc1Tag.setAttribute('y', String(my - 10));
      pc1Tag.setAttribute('text-anchor', 'end');
    } else {
      pc1Tag.setAttribute('x', String(mx + 128 * ux));
      pc1Tag.setAttribute('y', String(my + 128 * uy - 12));
      pc1Tag.setAttribute('text-anchor', 'middle');
    }

    pc2Tag.setAttribute('opacity', showPc2 ? '1' : '0');
    if (i === 3) {
      pc2Tag.setAttribute('x', String(mx + 12));
      pc2Tag.setAttribute('y', String(my - 76));
      pc2Tag.setAttribute('text-anchor', 'start');
    } else {
      pc2Tag.setAttribute('x', String(mx - 88 * vx - 14));
      pc2Tag.setAttribute('y', String(my - 88 * vy + 4));
      pc2Tag.setAttribute('text-anchor', 'end');
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;
      const grid = el('g');
      for (let x = 35; x <= 365; x += 33) line(api, grid, x, 52, x, 244);
      for (let y = 52; y <= 244; y += 32) line(api, grid, 35, y, 365, y);

      const cosT = Math.cos(CLOUD_TILT);
      const sinT = Math.sin(CLOUD_TILT);
      const rawPoints: Point[] = baseCloud.map(p => {
        const jx = p.x + 10 * (random() - 0.5);
        const jy = p.y + 10 * (random() - 0.5);
        return {
          x: 200 + jx * cosT - jy * sinT,
          y: 148 + jx * sinT + jy * cosT,
        };
      });

      const result = pca(rawPoints.map(p => [p.x, p.y]), 2, false);
      mx = result.mean[0];
      my = result.mean[1];
      let d0 = result.directions[0];
      if (d0[0] < 0) d0 = [-d0[0], -d0[1]];
      pc1Angle = Math.atan2(d0[1], d0[0]);
      centered = rawPoints.map(p => ({ x: p.x - mx, y: p.y - my }));
      totalVar = centered.reduce((s, p) => s + p.x * p.x + p.y * p.y, 0);

      spreadLabel = label(api, svg, 35, 34, '', {
        class: 'scene-value scene-tween', 'font-size': 14, 'font-weight': 600, opacity: 0,
      });
      statusLabel = label(api, svg, 365, 34, '', {
        'text-anchor': 'end', 'font-size': 15, 'font-weight': 600, opacity: 0, class: 'scene-tween',
      });

      const anchor = el('g', { transform: `translate(${mx} ${my})` }, svg);
      rotGroup = el('g', { class: 'scene-tween' }, anchor);
      rotGroup.style.transformOrigin = '0px 0px';

      const projLayer = el('g', {}, rotGroup);
      projLines = centered.map(() => line(api, projLayer, 0, 0, 0, 0, {
        stroke: 'var(--muted)', 'stroke-width': 1.25, opacity: 0, class: 'scene-tween',
      }));

      const axesLayer = el('g', {}, rotGroup);
      const ux = Math.cos(pc1Angle);
      const uy = Math.sin(pc1Angle);
      const vx = -uy;
      const vy = ux;
      const len2 = 94;

      candAxis = line(api, axesLayer, 0, 0, 0, 0, {
        stroke: 'var(--a)', 'stroke-width': 2.25, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });
      pc2Axis = line(api, axesLayer, -len2 * vx, -len2 * vy, len2 * vx, len2 * vy, {
        stroke: 'var(--b)', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      const sq = 11;
      rightAngle = el('path', {
        d: `M ${sq * ux} ${sq * uy} L ${sq * (ux - vx)} ${sq * (uy - vy)} L ${-sq * vx} ${-sq * vy}`,
        fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-linecap': 'round',
        'stroke-linejoin': 'round', opacity: 0, class: 'scene-tween',
      }, axesLayer);

      const ticksLayer = el('g', {}, rotGroup);
      projTicks = centered.map(() => el('circle', {
        cx: 0, cy: 0, r: 3.5, fill: 'var(--hl)', stroke: 'var(--ink)', 'stroke-width': 1,
        opacity: 0, class: 'scene-tween',
      }, ticksLayer));

      const cloudLayer = el('g', {}, rotGroup);
      for (const p of centered) {
        el('circle', {
          cx: p.x, cy: p.y, r: 5, fill: 'var(--ink)', stroke: 'var(--paper)', 'stroke-width': 1.5,
        }, cloudLayer);
      }

      meanGroup = el('g', { class: 'scene-tween' }, rotGroup);
      meanRing = el('circle', {
        cx: 0, cy: 0, r: 12, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      }, meanGroup);
      el('circle', {
        cx: 0, cy: 0, r: 4.5, fill: 'var(--hl)', stroke: 'var(--ink)', 'stroke-width': 1.75,
      }, meanGroup);

      pc1Tag = label(api, svg, 0, 0, t('pc1'), {
        fill: 'var(--a)', 'font-size': 14, 'font-weight': 700, opacity: 0, class: 'scene-tween',
      });
      pc2Tag = label(api, svg, 0, 0, t('pc2'), {
        fill: 'var(--b)', 'font-size': 14, 'font-weight': 700, opacity: 0, class: 'scene-tween',
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        meanGroup.setAttribute('opacity', '0');
        meanRing.setAttribute('opacity', '0');
        statusLabel.setAttribute('opacity', '0');
      } else if (i === 1) {
        applyFrame(1, api);
        candAxis.setAttribute('stroke-dashoffset', '1');
        for (let k = 0; k < centered.length; k++) {
          projLines[k].setAttribute('opacity', '0');
          projTicks[k].setAttribute('opacity', '0');
        }
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 1 || api.reduced || !browser) return () => {};

      let rafId = 0;
      const start = browser.performance.now();
      const duration = 2000;
      const startAngle = pc1Angle - 0.95;

      const tick = (now: number) => {
        const u = Math.min(1, (now - start) / duration);
        // Ease past PC1 slightly, then settle back on the direction of maximum spread.
        const ease = 1 - Math.pow(1 - u, 3);
        const overshoot = Math.sin(u * Math.PI) * 0.28;
        const theta = startAngle + (pc1Angle - startAngle) * ease + overshoot;
        setAxis(theta, api);
        if (u < 1) rafId = browser.requestAnimationFrame(tick);
      };
      rafId = browser.requestAnimationFrame(tick);

      return () => browser.cancelAnimationFrame(rafId);
    },
  });
}
