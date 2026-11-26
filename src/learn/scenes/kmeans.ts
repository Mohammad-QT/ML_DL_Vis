import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

interface Point {
  x: number;
  y: number;
}

interface RoundState {
  centres: Point[];
  assign: number[];
}

const colors = ['var(--a)', 'var(--b)', 'var(--ok)'];
const groups: Point[][] = [
  [{ x: 68, y: 96 }, { x: 88, y: 76 }, { x: 112, y: 86 }, { x: 78, y: 122 }, { x: 106, y: 114 }, { x: 124, y: 102 }],
  [{ x: 166, y: 200 }, { x: 184, y: 222 }, { x: 196, y: 184 }, { x: 212, y: 212 }, { x: 236, y: 192 }, { x: 198, y: 228 }],
  [{ x: 276, y: 114 }, { x: 296, y: 90 }, { x: 322, y: 102 }, { x: 288, y: 142 }, { x: 316, y: 134 }, { x: 338, y: 116 }],
];
// Start from poor initial centres so the multi-round shift is clearly visible.
const initCentres: Point[] = [
  { x: 85, y: 85 },
  { x: 132, y: 132 },
  { x: 280, y: 155 },
];

function nearest(point: Point, centres: Point[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centres.length; i++) {
    const dx = point.x - centres[i].x;
    const dy = point.y - centres[i].y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      best = i;
    }
  }
  return best;
}

function runKMeans(points: Point[]): RoundState[] {
  const states: RoundState[] = [
    { centres: initCentres, assign: points.map(point => nearest(point, initCentres)) },
  ];
  for (let step = 0; step < 8; step++) {
    const prev = states[states.length - 1];
    const nextCentres = prev.centres.map((fallback, c) => {
      let sx = 0;
      let sy = 0;
      let count = 0;
      for (let i = 0; i < points.length; i++) {
        if (prev.assign[i] === c) {
          sx += points[i].x;
          sy += points[i].y;
          count++;
        }
      }
      return count > 0 ? { x: sx / count, y: sy / count } : fallback;
    });
    const moved = nextCentres.some((centre, i) =>
      Math.hypot(centre.x - prev.centres[i].x, centre.y - prev.centres[i].y) > 0.25,
    );
    if (!moved) break;
    states.push({
      centres: nextCentres,
      assign: points.map(point => nearest(point, nextCentres)),
    });
  }
  return states;
}

export default function kmeansScene() {
  let points: Point[] = [];
  let states: RoundState[] = [];
  let dots: SVGCircleElement[] = [];
  let edges: SVGLineElement[] = [];
  let trails: { step: number; line: SVGLineElement; mark: SVGCircleElement }[] = [];
  let centres: { group: SVGGElement; ring: SVGCircleElement }[] = [];
  let status: SVGTextElement;

  function setDelay(el: Element, ms: number) {
    (el as SVGElement).style.setProperty('--delay', `${ms}ms`);
  }

  function resetDelays() {
    dots.forEach(d => setDelay(d, 0));
    edges.forEach(e => setDelay(e, 0));
    trails.forEach(tr => {
      setDelay(tr.line, 0);
      setDelay(tr.mark, 0);
    });
    centres.forEach(({ group, ring }) => {
      setDelay(group, 0);
      setDelay(ring, 0);
    });
    setDelay(status, 0);
  }

  function setTrails(visibleThroughStep: number, opacity: string) {
    for (const trail of trails) {
      const show = trail.step <= visibleThroughStep;
      trail.line.setAttribute('opacity', show ? opacity : '0');
      trail.mark.setAttribute('opacity', show ? opacity : '0');
    }
  }

  function setCentres(positions: Point[], ringOpacity: string, yOffset = 0, opacity = '1') {
    centres.forEach(({ group, ring }, c) => {
      group.style.transform = `translate(${positions[c].x}px, ${positions[c].y + yOffset}px)`;
      group.setAttribute('opacity', opacity);
      ring.setAttribute('opacity', ringOpacity);
    });
  }

  function showAssign(roundIndex: number, text: string, edgeOpacity = '0.45', staged = false) {
    resetDelays();
    const state = states[roundIndex];
    for (let i = 0; i < points.length; i++) {
      const c = state.assign[i];
      dots[i].setAttribute('fill', colors[c]);
      dots[i].setAttribute('opacity', '1');
      edges[i].setAttribute('x1', String(state.centres[c].x));
      edges[i].setAttribute('y1', String(state.centres[c].y));
      edges[i].setAttribute('x2', String(points[i].x));
      edges[i].setAttribute('y2', String(points[i].y));
      edges[i].setAttribute('stroke', colors[c]);
      edges[i].setAttribute('stroke-dashoffset', '0');
      edges[i].setAttribute('opacity', edgeOpacity);
      if (staged) {
        setDelay(edges[i], i * 20);
        setDelay(dots[i], 550);
      }
    }
    setTrails(roundIndex - 1, '0.55');
    setCentres(state.centres, '0');
    status.textContent = text;
    status.setAttribute('opacity', '1');
    if (staged) setDelay(status, 850);
  }

  function showMove(roundIndex: number, text: string, staged = false) {
    resetDelays();
    const prev = states[roundIndex];
    const next = states[roundIndex + 1];
    for (let i = 0; i < points.length; i++) {
      dots[i].setAttribute('fill', colors[prev.assign[i]]);
      dots[i].setAttribute('opacity', '0.85');
      edges[i].setAttribute('stroke-dashoffset', '1');
      edges[i].setAttribute('opacity', '0');
    }
    setTrails(roundIndex, '0.6');
    setCentres(next.centres, '1');
    if (staged) {
      trails.forEach(tr => {
        if (tr.step <= roundIndex) {
          setDelay(tr.line, 250);
          setDelay(tr.mark, 250);
        }
      });
      centres.forEach(({ group, ring }) => {
        setDelay(group, 350);
        setDelay(ring, 350);
      });
    }
    status.textContent = text;
    status.setAttribute('opacity', '1');
  }

  function showDrop(yOffset: number, opacity: string, staged = false) {
    resetDelays();
    for (let i = 0; i < points.length; i++) {
      dots[i].setAttribute('fill', 'var(--muted)');
      dots[i].setAttribute('opacity', '1');
      edges[i].setAttribute('stroke-dashoffset', '1');
      edges[i].setAttribute('opacity', '0');
    }
    setTrails(-1, '0');
    setCentres(states[0].centres, '0', yOffset, opacity);
    if (staged) centres.forEach(({ group }, c) => setDelay(group, c * 180));
    status.textContent = '';
    status.setAttribute('opacity', '0');
  }

  function applyFrame(i: number, api: SceneApi, staged = true) {
    if (i === 0) showDrop(0, '1', staged);
    else if (i === 1) showAssign(0, api.t('round').replace('{n}', '1'), '0.45', staged);
    else if (i === 2) showMove(0, api.t('round').replace('{n}', '1'), staged);
    else showAssign(states.length - 1, api.t('done'), '0.4', false);
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;
      const grid = el('g');
      for (let x = 35; x <= 365; x += 30) line(api, grid, x, 52, x, 242);
      for (let y = 52; y <= 242; y += 38) line(api, grid, 35, y, 365, y);

      label(api, svg, 35, 33, t('k'), { class: 'scene-value', 'font-size': 15, 'font-weight': 700 });
      status = label(api, svg, 365, 33, '', { 'text-anchor': 'end', 'font-size': 15, 'font-weight': 600, opacity: 0, class: 'scene-tween' });

      line(api, svg, 36, 269, 48, 269, { stroke: 'var(--ink)', 'stroke-width': 2 });
      line(api, svg, 42, 263, 42, 275, { stroke: 'var(--ink)', 'stroke-width': 2 });
      label(api, svg, 57, 274, t('centre'), { fill: 'var(--muted)', 'font-size': 14 });

      points = groups.flatMap(group => group.map(point => ({
        x: point.x + 6 * (random() - 0.5),
        y: point.y + 6 * (random() - 0.5),
      })));
      states = runKMeans(points);

      const trailsLayer = el('g');
      const edgesLayer = el('g');
      const cloudLayer = el('g');
      const centresLayer = el('g');

      trails = [];
      for (let r = 0; r < states.length - 1; r++) {
        for (let c = 0; c < initCentres.length; c++) {
          const from = states[r].centres[c];
          const to = states[r + 1].centres[c];
          trails.push({
            step: r,
            mark: el('circle', {
              cx: from.x, cy: from.y, r: 3, fill: 'var(--paper)', stroke: colors[c],
              'stroke-width': 1.5, opacity: 0, class: 'scene-tween',
            }, trailsLayer),
            line: line(api, trailsLayer, from.x, from.y, to.x, to.y, {
              stroke: colors[c], 'stroke-width': 1.75, 'stroke-dasharray': '3 4', opacity: 0, class: 'scene-tween',
            }),
          });
        }
      }

      edges = points.map(point => line(api, edgesLayer, point.x, point.y, point.x, point.y, {
        stroke: 'var(--muted)', 'stroke-width': 1.35, pathLength: 1, 'stroke-dasharray': '1 1',
        'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }));

      dots = points.map(point => el('circle', {
        cx: point.x, cy: point.y, r: 5.5, fill: 'var(--muted)', stroke: 'var(--paper)',
        'stroke-width': 1.5, class: 'scene-tween',
      }, cloudLayer));

      centres = initCentres.map((_, c) => {
        const group = el('g', { class: 'scene-tween scene-slow' }, centresLayer);
        const ring = el('circle', {
          cx: 0, cy: 0, r: 13, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
        }, group);
        line(api, group, -7, 0, 7, 0, { stroke: 'var(--paper)', 'stroke-width': 5 });
        line(api, group, 0, -7, 0, 7, { stroke: 'var(--paper)', 'stroke-width': 5 });
        line(api, group, -7, 0, 7, 0, { stroke: colors[c], 'stroke-width': 2.5 });
        line(api, group, 0, -7, 0, 7, { stroke: colors[c], 'stroke-width': 2.5 });
        return { group, ring };
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) showDrop(-14, '0');
      else applyFrame(i - 1, api);
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (i !== 3 || api.reduced || !browser || states.length <= 2) return () => {};

      const timers: number[] = [];
      const moveRounds = states.length - 2;
      const phaseMs = Math.min(480, Math.floor(2000 / (moveRounds * 2)));
      let elapsed = 0;

      for (let r = 1; r <= moveRounds; r++) {
        const roundLabel = api.t('round').replace('{n}', String(r + 1));
        if (r === 1) showAssign(r, roundLabel);
        else timers.push(browser.setTimeout(() => showAssign(r, roundLabel), elapsed));
        elapsed += phaseMs;
        timers.push(browser.setTimeout(() => showMove(r, roundLabel), elapsed));
        elapsed += phaseMs;
      }
      timers.push(browser.setTimeout(() => applyFrame(3, api, false), elapsed));

      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
