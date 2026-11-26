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
const PY = 42;
const PH = 120;

// Bottom stump panel bounds
const TY = 198;
const TH = 76;
const TZ = TY + TH / 2;
const CW = 124;
const CARD_PAD = 6;
const FULL_CENTER_X = PX + (PW - CW) / 2;
const SCALED_X = PX + PW - CW;
const FULL_SHIFT_X = PX - FULL_CENTER_X;

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

interface StumpCard {
  group: SVGGElement;
  left: SVGRectElement;
  right: SVGRectElement;
  split: SVGLineElement;
  baseX: number;
}

export default function boostScene() {
  const rounds = buildRounds();
  const segments: SVGLineElement[] = [];
  const joins: SVGRectElement[] = [];
  const residBars: SVGRectElement[] = [];
  let fullCard: StumpCard;
  let scaledCard: StumpCard;
  let scaleBadge: SVGGElement;
  let bottomLabel: SVGTextElement;
  let status: SVGTextElement;

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function resetDelays() {
    segments.forEach(s => delay(s, 0));
    joins.forEach(j => delay(j, 0));
    residBars.forEach(b => delay(b, 0));
    [fullCard, scaledCard].forEach(c => {
      delay(c.group, 0);
      delay(c.left, 0);
      delay(c.right, 0);
      delay(c.split, 0);
    });
    delay(scaleBadge, 0);
    delay(bottomLabel, 0);
    delay(status, 0);
  }

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

  function setCardStump(card: StumpCard, stump: Stump, scale: number, barOpacity: number) {
    const innerW = CW - CARD_PAD * 2;
    const ratio = (stump.split - 0.03) / 0.95;
    const leftW = Math.max(4, ratio * innerW);
    const rightW = Math.max(4, innerW - leftW);
    const leftX = card.baseX + CARD_PAD;
    const sx = leftX + leftW;
    const valToH = (v: number) => Math.max(2, Math.min(TH * 0.44, Math.abs(v) * scale * 92));

    const lh = valToH(stump.leftVal);
    card.left.setAttribute('x', String(leftX));
    card.left.setAttribute('width', String(leftW));
    card.left.setAttribute('fill', stump.leftVal >= 0 ? 'var(--b)' : 'var(--a)');
    card.left.setAttribute('opacity', String(barOpacity));
    card.left.style.transform = `translateY(${stump.leftVal >= 0 ? TZ - lh : TZ}px) scale(1, ${lh})`;

    const rh = valToH(stump.rightVal);
    card.right.setAttribute('x', String(sx));
    card.right.setAttribute('width', String(rightW));
    card.right.setAttribute('fill', stump.rightVal >= 0 ? 'var(--b)' : 'var(--a)');
    card.right.setAttribute('opacity', String(barOpacity));
    card.right.style.transform = `translateY(${stump.rightVal >= 0 ? TZ - rh : TZ}px) scale(1, ${rh})`;

    card.split.setAttribute('x1', String(sx));
    card.split.setAttribute('x2', String(sx));
  }

  function setStumpComparison(stump: Stump | null, mode: 'hidden' | 'full' | 'scaled') {
    if (!stump || mode === 'hidden') {
      fullCard.group.setAttribute('opacity', '0');
      fullCard.group.style.transform = 'translateX(0px)';
      scaledCard.group.setAttribute('opacity', '0');
      scaleBadge.setAttribute('opacity', '0');
      return;
    }

    fullCard.group.setAttribute('opacity', '1');
    if (mode === 'full') {
      fullCard.group.style.transform = 'translateX(0px)';
      setCardStump(fullCard, stump, 1, 0.85);
      scaledCard.group.setAttribute('opacity', '0');
      scaleBadge.setAttribute('opacity', '0');
    } else {
      fullCard.group.style.transform = `translateX(${FULL_SHIFT_X}px)`;
      setCardStump(fullCard, stump, 1, 0.28);
      setCardStump(scaledCard, stump, LR, 0.92);
      scaledCard.group.setAttribute('opacity', '1');
      scaleBadge.setAttribute('opacity', '1');
    }
  }

  function applyFrame(i: number, api: SceneApi) {
    resetDelays();
    if (i === 0) {
      setModelCurve(rounds[0].preds);
      setResiduals(rounds[0].preds, false);
      setStumpComparison(null, 'hidden');
      bottomLabel.setAttribute('opacity', '0');
      status.textContent = '';
      status.setAttribute('opacity', '0');
    } else if (i === 1) {
      setModelCurve(rounds[0].preds);
      setResiduals(rounds[0].preds, true);
      setStumpComparison(rounds[1].stump, 'full');
      delay(fullCard.group, 450);
      delay(fullCard.left, 750);
      delay(fullCard.right, 750);
      bottomLabel.textContent = api.t('tree');
      bottomLabel.setAttribute('opacity', '1');
      delay(bottomLabel, 450);
      status.textContent = api.t('errors');
      status.setAttribute('opacity', '1');
      delay(status, 450);
    } else if (i === 2) {
      setModelCurve(rounds[1].preds);
      setResiduals(rounds[1].preds, true);
      setStumpComparison(rounds[1].stump, 'scaled');
      delay(scaleBadge, 450);
      delay(scaledCard.group, 650);
      delay(scaledCard.left, 850);
      delay(scaledCard.right, 850);
      segments.forEach(s => delay(s, 1000));
      joins.forEach(j => delay(j, 1000));
      residBars.forEach(b => delay(b, 1000));
      bottomLabel.textContent = api.t('scaledTree');
      bottomLabel.setAttribute('opacity', '1');
      delay(bottomLabel, 650);
      status.textContent = api.t('round').replace('{n}', '1');
      status.setAttribute('opacity', '1');
    } else {
      const last = rounds[rounds.length - 1];
      setModelCurve(last.preds);
      setResiduals(last.preds, true);
      setStumpComparison(last.stump, 'scaled');
      bottomLabel.textContent = api.t('scaledTree');
      bottomLabel.setAttribute('opacity', '1');
      status.textContent = api.t('done');
      status.setAttribute('opacity', '1');
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      function createStumpCard(baseX: number, stroke: string, strokeWidth: number, slow = false): StumpCard {
        const group = el('g', { opacity: 0, class: slow ? 'scene-tween scene-slow' : 'scene-tween' }, svg);
        el('rect', {
          x: baseX, y: TY, width: CW, height: TH, rx: 8, fill: 'var(--sheet)', stroke, 'stroke-width': strokeWidth,
        }, group);
        line(api, group, baseX + CARD_PAD, TZ, baseX + CW - CARD_PAD, TZ, {
          stroke: 'var(--muted)', 'stroke-dasharray': '3 4',
        });
        const left = el('rect', { x: baseX + CARD_PAD, y: 0, width: 40, height: 1, opacity: 0.85, class: 'scene-tween' }, group);
        left.style.transformOrigin = '0 0';
        const right = el('rect', { x: baseX + CARD_PAD, y: 0, width: 40, height: 1, opacity: 0.85, class: 'scene-tween' }, group);
        right.style.transformOrigin = '0 0';
        const split = line(api, group, baseX + CW / 2, TY + 6, baseX + CW / 2, TY + TH - 6, {
          stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', class: 'scene-tween',
        });
        return { group, left, right, split, baseX };
      }

      // Top panel grid
      const grid = el('g');
      for (let x = PX; x <= PX + PW; x += 41.5) line(api, grid, x, PY, x, PY + PH);
      for (let y = PY; y <= PY + PH; y += 30) line(api, grid, PX, y, PX + PW, y);

      label(api, svg, PX, 28, t('model'), { 'font-size': 15, 'font-weight': 700 });
      status = label(api, svg, PX + PW, 28, '', {
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

      // Bottom comparison: full tree step (faint) × learning rate -> scaled step (solid)
      bottomLabel = label(api, svg, 200, TY - 12, t('tree'), {
        'text-anchor': 'middle', 'font-size': 13, fill: 'var(--muted)', opacity: 0, class: 'scene-tween',
      });

      fullCard = createStumpCard(FULL_CENTER_X, 'var(--rule)', 1.5, true);

      scaleBadge = el('g', { opacity: 0, class: 'scene-tween' }, svg);
      label(api, scaleBadge, 200, 230, `× ${LR}`, {
        'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, class: 'scene-value',
      });
      line(api, scaleBadge, 182, 244, 218, 244, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, scaleBadge, 212, 239, 218, 244, { stroke: 'var(--ink)', 'stroke-width': 1.75 });
      line(api, scaleBadge, 212, 249, 218, 244, { stroke: 'var(--ink)', 'stroke-width': 1.75 });

      scaledCard = createStumpCard(SCALED_X, 'var(--hl)', 2);

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        setModelCurve(points.map(() => 0.1));
        setResiduals(rounds[0].preds, false);
        setStumpComparison(null, 'hidden');
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
          resetDelays();
          setModelCurve(rounds[idx].preds);
          setResiduals(rounds[idx].preds, true);
          setStumpComparison(rounds[idx].stump, 'scaled');
          bottomLabel.textContent = api.t('scaledTree');
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
