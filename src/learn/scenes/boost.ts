import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface Point {
  x: number;
  y: number;
}

interface Stump {
  split: number;
  leftVal: number;
  rightVal: number;
}

interface BoostRound {
  preds: number[];
  stump: Stump | null;
}

const points: Point[] = [
  { x: 0.10, y: 0.20 },
  { x: 0.19, y: 0.25 },
  { x: 0.28, y: 0.19 },
  { x: 0.40, y: 0.60 },
  { x: 0.50, y: 0.54 },
  { x: 0.60, y: 0.64 },
  { x: 0.70, y: 0.56 },
  { x: 0.80, y: 0.85 },
  { x: 0.88, y: 0.89 },
  { x: 0.94, y: 0.83 },
];

const LR = 0.45;
const ROUNDS = 6;

// Top plot bounds
const PX = 34;
const PW = 332;
const PY = 48;
const PH = 128;

// Bottom stump panel bounds
const TY = 196;
const TH = 70;
const TZ = TY + TH / 2;

function fitStump(residuals: number[]): Stump {
  let bestErr = Infinity;
  let best: Stump = { split: 0.5, leftVal: 0, rightVal: 0 };
  for (let i = 1; i < points.length; i++) {
    let ls = 0;
    for (let j = 0; j < i; j++) ls += residuals[j];
    let rs = 0;
    for (let j = i; j < points.length; j++) rs += residuals[j];
    const lv = ls / i;
    const rv = rs / (points.length - i);
    let err = 0;
    for (let j = 0; j < i; j++) err += (residuals[j] - lv) ** 2;
    for (let j = i; j < points.length; j++) err += (residuals[j] - rv) ** 2;
    if (err < bestErr) {
      bestErr = err;
      best = { split: (points[i - 1].x + points[i].x) / 2, leftVal: lv, rightVal: rv };
    }
  }
  return best;
}

function buildRounds(): BoostRound[] {
  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
  let preds = points.map(() => meanY);
  const rounds: BoostRound[] = [{ preds: [...preds], stump: null }];

  for (let r = 0; r < ROUNDS; r++) {
    const residuals = points.map((p, i) => p.y - preds[i]);
    const stump = fitStump(residuals);
    preds = points.map((p, i) => preds[i] + LR * (p.x <= stump.split ? stump.leftVal : stump.rightVal));
    rounds.push({ preds: [...preds], stump });
  }
  return rounds;
}

const mapX = (x: number) => PX + x * PW;
const mapY = (y: number) => PY + PH - y * PH;

// Interval edges between consecutive points so every prediction plateau translates smoothly.
const edges: number[] = [0.03];
for (let i = 1; i < points.length; i++) edges.push((points[i - 1].x + points[i].x) / 2);
edges.push(0.98);

export default function boostScene() {
  const rounds = buildRounds();
  const segments: SVGLineElement[] = [];
  const joins: SVGRectElement[] = [];
  const residBars: SVGRectElement[] = [];
  let stumpGroup: SVGGElement;
  let stumpLeft: SVGRectElement;
  let stumpRight: SVGRectElement;
  let stumpSplit: SVGLineElement;
  let bottomLabel: SVGTextElement;
  let status: SVGTextElement;

  function setModelCurve(preds: number[]) {
    const ys = preds.map(mapY);
    for (let i = 0; i < ys.length; i++) {
      segments[i].style.transform = `translateY(${ys[i]}px)`;
    }
    for (let i = 0; i < joins.length; i++) {
      const top = Math.min(ys[i], ys[i + 1]);
      const h = Math.max(0.1, Math.abs(ys[i + 1] - ys[i]));
      joins[i].style.transform = `translateY(${top}px) scale(1, ${h})`;
      joins[i].setAttribute('opacity', h > 1.5 ? '1' : '0');
    }
  }

  function setResiduals(preds: number[], visible: boolean) {
    for (let i = 0; i < points.length; i++) {
      const yPt = mapY(points[i].y);
      const yPred = mapY(preds[i]);
      const top = Math.min(yPt, yPred);
      const h = Math.max(0.5, Math.abs(yPt - yPred));
      residBars[i].style.transform = `translateY(${top}px) scale(1, ${h})`;
      residBars[i].setAttribute('opacity', visible ? '0.85' : '0');
    }
  }

  function setStump(stump: Stump | null, scale: number, visible: boolean) {
    if (!stump || !visible) {
      stumpGroup.setAttribute('opacity', '0');
      return;
    }
    stumpGroup.setAttribute('opacity', '1');
    const sx = mapX(stump.split);
    const leftW = Math.max(4, sx - mapX(0.03));
    const rightW = Math.max(4, mapX(0.98) - sx);
    const valToH = (v: number) => Math.max(2, Math.min(TH * 0.46, Math.abs(v) * scale * 78));

    const lh = valToH(stump.leftVal);
    stumpLeft.setAttribute('x', String(mapX(0.03)));
    stumpLeft.setAttribute('width', String(leftW));
    stumpLeft.setAttribute('fill', stump.leftVal >= 0 ? 'var(--b)' : 'var(--a)');
    stumpLeft.style.transform = `translateY(${stump.leftVal >= 0 ? TZ - lh : TZ}px) scale(1, ${lh})`;

    const rh = valToH(stump.rightVal);
    stumpRight.setAttribute('x', String(sx));
    stumpRight.setAttribute('width', String(rightW));
    stumpRight.setAttribute('fill', stump.rightVal >= 0 ? 'var(--b)' : 'var(--a)');
    stumpRight.style.transform = `translateY(${stump.rightVal >= 0 ? TZ - rh : TZ}px) scale(1, ${rh})`;

    stumpSplit.setAttribute('x1', String(sx));
    stumpSplit.setAttribute('x2', String(sx));
  }

  function applyFrame(i: number, api: SceneApi) {
    if (i === 0) {
      setModelCurve(rounds[0].preds);
      setResiduals(rounds[0].preds, false);
      setStump(null, 1, false);
      bottomLabel.setAttribute('opacity', '0');
      status.textContent = '';
      status.setAttribute('opacity', '0');
    } else if (i === 1) {
      setModelCurve(rounds[0].preds);
      setResiduals(rounds[0].preds, true);
      setStump(rounds[1].stump, 1, true);
      bottomLabel.textContent = api.t('tree');
      bottomLabel.setAttribute('opacity', '1');
      status.textContent = api.t('errors');
      status.setAttribute('opacity', '1');
    } else if (i === 2) {
      setModelCurve(rounds[1].preds);
      setResiduals(rounds[1].preds, true);
      setStump(rounds[1].stump, LR, true);
      bottomLabel.textContent = api.t('lr');
      bottomLabel.setAttribute('opacity', '1');
      status.textContent = api.t('round').replace('{n}', '1');
      status.setAttribute('opacity', '1');
    } else {
      const last = rounds[rounds.length - 1];
      setModelCurve(last.preds);
      setResiduals(last.preds, true);
      setStump(last.stump, LR, true);
      bottomLabel.textContent = api.t('lr');
      bottomLabel.setAttribute('opacity', '1');
      status.textContent = api.t('done');
      status.setAttribute('opacity', '1');
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      // Top panel grid
      const grid = el('g');
      for (let x = PX; x <= PX + PW; x += 41.5) line(api, grid, x, PY, x, PY + PH);
      for (let y = PY; y <= PY + PH; y += 32) line(api, grid, PX, y, PX + PW, y);

      label(api, svg, PX, 30, t('model'), { 'font-size': 15, 'font-weight': 700 });
      status = label(api, svg, PX + PW, 30, '', {
        'text-anchor': 'end', 'font-size': 15, 'font-weight': 600, opacity: 0, class: 'scene-value scene-tween',
      });

      // Residual bars (scale vertically via transform)
      const residLayer = el('g');
      for (const p of points) {
        const bar = el('rect', {
          x: mapX(p.x) - 1.25, y: 0, width: 2.5, height: 1, rx: 1, fill: 'var(--bad)',
          opacity: 0, class: 'scene-tween',
        }, residLayer);
        bar.style.transformOrigin = '0 0';
        residBars.push(bar);
      }

      // Model step curve segments + vertical joins
      const curveLayer = el('g');
      for (let i = 0; i < points.length; i++) {
        segments.push(line(api, curveLayer, mapX(edges[i]), 0, mapX(edges[i + 1]), 0, {
          stroke: 'var(--ink)', 'stroke-width': 2.25, class: 'scene-tween',
        }));
        if (i < points.length - 1) {
          const join = el('rect', {
            x: mapX(edges[i + 1]) - 1, y: 0, width: 2, height: 1, fill: 'var(--ink)',
            opacity: 0, class: 'scene-tween',
          }, curveLayer);
          join.style.transformOrigin = '0 0';
          joins.push(join);
        }
      }

      // Data points
      for (const p of points) {
        el('circle', {
          cx: mapX(p.x), cy: mapY(p.y), r: 5, fill: p.y > 0.5 ? 'var(--b)' : 'var(--a)',
          stroke: 'var(--paper)', 'stroke-width': 1.5,
        }, svg);
      }

      // Bottom panel for the new small tree
      el('rect', {
        x: PX, y: TY, width: PW, height: TH, rx: 8, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      }, svg);
      line(api, svg, PX + 8, TZ, PX + PW - 8, TZ, { stroke: 'var(--muted)', 'stroke-dasharray': '3 4' });
      bottomLabel = label(api, svg, PX, TY - 6, t('tree'), {
        'font-size': 13, fill: 'var(--muted)', opacity: 0, class: 'scene-tween',
      });

      stumpGroup = el('g', { opacity: 0, class: 'scene-tween' }, svg);
      stumpLeft = el('rect', { x: PX, y: 0, width: 100, height: 1, opacity: 0.45, class: 'scene-tween' }, stumpGroup);
      stumpLeft.style.transformOrigin = '0 0';
      stumpRight = el('rect', { x: PX, y: 0, width: 100, height: 1, opacity: 0.45, class: 'scene-tween' }, stumpGroup);
      stumpRight.style.transformOrigin = '0 0';
      stumpSplit = line(api, stumpGroup, 200, TY + 6, 200, TY + TH - 6, {
        stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', class: 'scene-tween',
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        setModelCurve(points.map(() => 0.1));
        setResiduals(rounds[0].preds, false);
        setStump(null, 1, false);
        bottomLabel.setAttribute('opacity', '0');
        status.setAttribute('opacity', '0');
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 3 || api.reduced || !browser) return () => {};
      const timers: number[] = [];
      const phaseMs = 420;
      for (let r = 2; r <= ROUNDS; r++) {
        const idx = r;
        const text = idx === ROUNDS ? api.t('done') : api.t('round').replace('{n}', String(idx));
        const run = () => {
          setModelCurve(rounds[idx].preds);
          setResiduals(rounds[idx].preds, true);
          setStump(rounds[idx].stump, LR, true);
          bottomLabel.textContent = api.t('lr');
          bottomLabel.setAttribute('opacity', '1');
          status.textContent = text;
          status.setAttribute('opacity', '1');
        };
        if (r === 2) run();
        else timers.push(browser.setTimeout(run, (r - 2) * phaseMs));
      }
      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
