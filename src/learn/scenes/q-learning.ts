import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const ROWS = 3;
const COLS = 4;
const CELL_W = 64;
const CELL_H = 56;
const GAP = 6;
const GX = 63;
const GY = 58;

const WALL: [number, number] = [1, 1];
const GOAL: [number, number] = [0, 3];
const PIT: [number, number] = [2, 2];
const START: [number, number] = [2, 0];

const MOVES: readonly [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];
// Arrow paths matching MOVES: Up, Right, Down, Left.
const ARROW_PATHS = [
  'M 0,7 L 0,-7 M -4,-2 L 0,-7 L 4,-2',
  'M -7,0 L 7,0 M 2,-4 L 7,0 L 2,4',
  'M 0,-7 L 0,7 M -4,2 L 0,7 L 4,2',
  'M 7,0 L -7,0 M -2,-4 L -7,0 L -2,4',
];

const EXPLORE_PATH: readonly [number, number][] = [
  [2, 0], [2, 1], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2],
];

type QTable = number[][][];

function isCell(r: number, c: number, target: [number, number]) {
  return r === target[0] && c === target[1];
}

function cloneQ(q: QTable): QTable {
  return q.map(row => row.map(cell => [...cell]));
}

function trainQ(random: () => number): Record<number, QTable> {
  const q: QTable = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => [0, 0, 0, 0]),
  );
  const snapshots: Record<number, QTable> = {};
  const capture = new Set([1, 2, 5, 10, 20, 40, 60]);

  for (let ep = 1; ep <= 60; ep++) {
    let r = START[0];
    let c = START[1];
    for (let step = 0; step < 32; step++) {
      const vals = q[r][c];
      const maxV = Math.max(...vals);
      const best = vals.map((v, idx) => (v === maxV ? idx : -1)).filter(idx => idx >= 0);
      const eps = ep === 1 ? 0.5 : 0.25;
      const action = random() < eps
        ? Math.floor(random() * 4)
        : best[Math.floor(random() * best.length)];

      let nr = r + MOVES[action][0];
      let nc = c + MOVES[action][1];
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || isCell(nr, nc, WALL)) {
        nr = r;
        nc = c;
      }
      const atGoal = isCell(nr, nc, GOAL);
      const atPit = isCell(nr, nc, PIT);
      const reward = atGoal ? 1 : atPit ? -1 : -0.04;
      const future = atGoal || atPit ? 0 : Math.max(...q[nr][nc]);
      q[r][c][action] += 0.5 * (reward + 0.9 * future - q[r][c][action]);
      r = nr;
      c = nc;
      if (atGoal || atPit) break;
    }
    if (capture.has(ep)) snapshots[ep] = cloneQ(q);
  }
  return snapshots;
}

function cellCenter(r: number, c: number) {
  return {
    x: GX + c * (CELL_W + GAP) + CELL_W / 2,
    y: GY + r * (CELL_H + GAP) + CELL_H / 2,
  };
}

export default function qLearningScene() {
  let snapshots: Record<number, QTable> = {};
  const cellTint: SVGRectElement[][] = [];
  const zeroDots: SVGGElement[][] = [];
  const arrows: SVGPathElement[][] = [];
  let agent: SVGGElement;
  let updateRing: SVGRectElement;
  let trail: SVGPathElement;
  let greedyTrail: SVGPathElement;
  let status: SVGTextElement;

  const delay = (el: Element, ms: number) => (el as SVGElement).style.setProperty('--delay', `${ms}ms`);

  function resetDelays() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (cellTint[r][c]) delay(cellTint[r][c], 0);
        if (zeroDots[r][c]) delay(zeroDots[r][c], 0);
        if (arrows[r][c]) delay(arrows[r][c], 0);
      }
    }
    delay(agent, 0);
    delay(updateRing, 0);
    delay(trail, 0);
    delay(greedyTrail, 0);
    delay(status, 0);
  }

  function moveAgent(r: number, c: number, opacity = '1') {
    const { x, y } = cellCenter(r, c);
    agent.style.transform = `translate(${x}px, ${y}px)`;
    agent.setAttribute('opacity', opacity);
  }

  function showQ(q: QTable, highlightGreedy: boolean) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isCell(r, c, WALL) || isCell(r, c, GOAL) || isCell(r, c, PIT)) continue;
        const vals = q[r][c];
        const maxV = Math.max(...vals);
        const minV = Math.min(...vals);
        const hasInfo = Math.abs(maxV) > 0.01 || Math.abs(minV) > 0.01;
        if (maxV > 0.02) {
          cellTint[r][c].setAttribute('fill', 'var(--ok)');
          cellTint[r][c].setAttribute('opacity', String(Math.min(0.45, 0.08 + maxV * 0.42)));
        } else if (maxV < -0.02) {
          cellTint[r][c].setAttribute('fill', 'var(--bad)');
          cellTint[r][c].setAttribute('opacity', String(Math.min(0.35, 0.08 + Math.abs(maxV) * 0.35)));
        } else {
          cellTint[r][c].setAttribute('opacity', '0');
        }
        zeroDots[r][c].setAttribute('opacity', hasInfo ? '0' : '0.65');
        if (hasInfo) {
          const bestAction = vals.indexOf(maxV);
          arrows[r][c].setAttribute('d', ARROW_PATHS[bestAction]);
          arrows[r][c].setAttribute('opacity', highlightGreedy ? '1' : '0.85');
          arrows[r][c].setAttribute('stroke', maxV >= 0 ? 'var(--ink)' : 'var(--bad)');
        } else {
          arrows[r][c].setAttribute('opacity', '0');
        }
      }
    }
  }

  function clearQ() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isCell(r, c, WALL) || isCell(r, c, GOAL) || isCell(r, c, PIT)) continue;
        cellTint[r][c].setAttribute('opacity', '0');
        zeroDots[r][c].setAttribute('opacity', '0.75');
        arrows[r][c].setAttribute('opacity', '0');
      }
    }
  }

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;
    resetDelays();
    updateRing.setAttribute('opacity', '0');
    trail.setAttribute('opacity', '0');
    trail.setAttribute('stroke-dashoffset', '1');
    greedyTrail.setAttribute('opacity', '0');
    greedyTrail.setAttribute('stroke-dashoffset', '1');

    if (i === 0) {
      clearQ();
      moveAgent(START[0], START[1], '1');
      delay(agent, 450);
      status.textContent = '';
      status.setAttribute('opacity', '0');
    } else if (i === 1) {
      clearQ();
      trail.setAttribute('opacity', '0.75');
      trail.setAttribute('stroke-dashoffset', '0');
      const last = EXPLORE_PATH[EXPLORE_PATH.length - 1];
      moveAgent(last[0], last[1], '1');
      status.textContent = t('explore');
      status.setAttribute('opacity', '1');
      delay(status, 250);
    } else if (i === 2) {
      clearQ();
      cellTint[0][2].setAttribute('fill', 'var(--ok)');
      cellTint[0][2].setAttribute('opacity', '0.4');
      delay(cellTint[0][2], 600);
      zeroDots[0][2].setAttribute('opacity', '0');
      delay(zeroDots[0][2], 600);
      arrows[0][2].setAttribute('d', ARROW_PATHS[1]);
      arrows[0][2].setAttribute('stroke', 'var(--ok)');
      arrows[0][2].setAttribute('opacity', '1');
      delay(arrows[0][2], 600);
      updateRing.setAttribute('opacity', '1');
      delay(updateRing, 350);
      moveAgent(GOAL[0], GOAL[1], '1');
      status.textContent = t('update');
      status.setAttribute('opacity', '1');
      delay(status, 750);
    } else {
      showQ(snapshots[60], true);
      greedyTrail.setAttribute('opacity', '0.55');
      greedyTrail.setAttribute('stroke-dashoffset', '0');
      moveAgent(START[0], START[1], '1');
      status.textContent = t('ep').replace('{n}', '60');
      status.setAttribute('opacity', '1');
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, random, t } = api;
      snapshots = trainQ(random);

      status = label(api, svg, 340, 36, '', {
        'text-anchor': 'end', 'font-size': 14, 'font-weight': 600, opacity: 0, class: 'scene-tween',
      });

      const gridLayer = el('g');
      const overlayLayer = el('g');

      for (let r = 0; r < ROWS; r++) {
        cellTint[r] = [];
        zeroDots[r] = [];
        arrows[r] = [];
        for (let c = 0; c < COLS; c++) {
          const x = GX + c * (CELL_W + GAP);
          const y = GY + r * (CELL_H + GAP);
          const cx = x + CELL_W / 2;
          const cy = y + CELL_H / 2;
          const wall = isCell(r, c, WALL);
          const goal = isCell(r, c, GOAL);
          const pit = isCell(r, c, PIT);
          const start = isCell(r, c, START);

          el('rect', {
            x, y, width: CELL_W, height: CELL_H, rx: 8,
            fill: wall ? 'var(--muted)' : 'var(--sheet)',
            stroke: goal ? 'var(--ok)' : pit ? 'var(--bad)' : 'var(--rule)',
            'stroke-width': goal || pit ? 2 : 1.5,
            opacity: wall ? 0.45 : 1,
          }, gridLayer);

          const tint = el('rect', {
            x: x + 1, y: y + 1, width: CELL_W - 2, height: CELL_H - 2, rx: 7,
            fill: 'var(--ok)', opacity: 0, class: 'scene-tween',
          }, gridLayer);
          cellTint[r][c] = tint;

          const dots = el('g', { transform: `translate(${cx} ${cy})`, class: 'scene-tween' }, gridLayer);
          if (!wall && !goal && !pit) {
            for (const [dx, dy] of [[0, -14], [18, 0], [0, 14], [-18, 0]]) {
              el('circle', { cx: dx, cy: dy, r: 2.2, fill: 'var(--muted)' }, dots);
            }
          }
          zeroDots[r][c] = dots;

          const arrow = el('path', {
            transform: `translate(${cx} ${cy})`, d: ARROW_PATHS[1],
            fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.2,
            'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0, class: 'scene-tween',
          }, gridLayer);
          arrows[r][c] = arrow;

          if (goal) {
            el('rect', {
              x: x + 2, y: y + 2, width: CELL_W - 4, height: CELL_H - 4, rx: 6,
              fill: 'var(--ok)', opacity: 0.16,
            }, gridLayer);
            label(api, gridLayer, cx, cy + 5, '+1', {
              'text-anchor': 'middle', fill: 'var(--ok)', 'font-weight': 700, class: 'scene-value',
            });
          } else if (pit) {
            el('rect', {
              x: x + 2, y: y + 2, width: CELL_W - 4, height: CELL_H - 4, rx: 6,
              fill: 'var(--bad)', opacity: 0.16,
            }, gridLayer);
            label(api, gridLayer, cx, cy + 5, '−1', {
              'text-anchor': 'middle', fill: 'var(--bad)', 'font-weight': 700, class: 'scene-value',
            });
          } else if (start) {
            el('circle', {
              cx, cy, r: 12, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3',
            }, gridLayer);
          }
        }
      }

      const ux = GX + 2 * (CELL_W + GAP);
      const uy = GY;
      updateRing = el('rect', {
        x: ux - 3, y: uy - 3, width: CELL_W + 6, height: CELL_H + 6, rx: 10,
        fill: 'none', stroke: 'var(--hl)', 'stroke-width': 3, opacity: 0, class: 'scene-tween',
      }, overlayLayer);

      const exploreD = EXPLORE_PATH.map(([r, c], idx) => {
        const pt = cellCenter(r, c);
        return `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
      }).join(' ');
      trail = el('path', {
        d: exploreD, fill: 'none', stroke: 'var(--a)', 'stroke-width': 2.25,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }, overlayLayer);

      const greedyD = [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [0, 3]].map(([r, c], idx) => {
        const pt = cellCenter(r, c);
        return `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
      }).join(' ');
      greedyTrail = el('path', {
        d: greedyD, fill: 'none', stroke: 'var(--ok)', 'stroke-width': 2.5,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      }, overlayLayer);

      agent = el('g', { class: 'scene-tween' }, overlayLayer);
      el('circle', {
        cx: 0, cy: 0, r: 11, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5,
      }, agent);
      el('circle', {
        cx: 0, cy: 0, r: 7, fill: 'var(--a)', stroke: 'var(--paper)', 'stroke-width': 2,
      }, agent);

      // Compact bottom legend (3 items).
      const legendY = 268;
      el('circle', { cx: 68, cy: legendY - 4, r: 5, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.75 }, svg);
      label(api, svg, 80, legendY, t('start'), { fill: 'var(--muted)', 'font-size': 13 });
      el('rect', { x: 162, y: legendY - 10, width: 11, height: 11, rx: 3, fill: 'var(--ok)' }, svg);
      label(api, svg, 179, legendY, t('goal'), { fill: 'var(--muted)', 'font-size': 13 });
      el('rect', { x: 266, y: legendY - 10, width: 11, height: 11, rx: 3, fill: 'var(--bad)' }, svg);
      label(api, svg, 283, legendY, t('pit'), { fill: 'var(--muted)', 'font-size': 13 });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        agent.setAttribute('opacity', '0');
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) zeroDots[r][c]?.setAttribute('opacity', '0');
      } else if (i === 2) {
        applyFrame(1, api);
      } else {
        applyFrame(i - 1, api);
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (api.reduced || !browser) return () => {};

      const timers: number[] = [];
      if (i === 1) {
        let step = 0;
        moveAgent(EXPLORE_PATH[0][0], EXPLORE_PATH[0][1], '1');
        for (let s = 1; s < EXPLORE_PATH.length; s++) {
          timers.push(browser.setTimeout(() => {
            step = s;
            moveAgent(EXPLORE_PATH[step][0], EXPLORE_PATH[step][1], '1');
          }, s * 300));
        }
      } else if (i === 3) {
        const eps = [1, 2, 5, 10, 20, 40, 60];
        eps.forEach((ep, idx) => {
          const run = () => {
            resetDelays();
            showQ(snapshots[ep], ep === 60);
            status.textContent = api.t('ep').replace('{n}', String(ep));
            greedyTrail.setAttribute('opacity', ep === 60 ? '0.55' : '0');
            greedyTrail.setAttribute('stroke-dashoffset', ep === 60 ? '0' : '1');
          };
          if (idx === 0) run();
          else timers.push(browser.setTimeout(run, idx * 310));
        });
      }

      return () => timers.forEach(id => browser.clearTimeout(id));
    },
  });
}
