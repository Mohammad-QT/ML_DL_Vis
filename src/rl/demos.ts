import { createBandit, hiddenRates, type Arm } from '../engine/bandit';
import { randomSeed } from '../engine/random';
import type { BanditLesson } from './lessons';

const ns = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number>) {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}

function board(host: HTMLElement, width: number, height: number) {
  const plot = svg('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', 'aria-hidden': 'true' });
  host.replaceChildren(plot);
  return plot;
}

function point(plot: SVGElement, x: number, y: number, fill: string) {
  plot.append(svg('circle', { cx: x, cy: y, r: 3, fill }));
}

function line(plot: SVGElement, x1: number, y1: number, x2: number, y2: number, stroke: string, width = 1) {
  plot.append(svg('line', { x1, y1, x2, y2, stroke, 'stroke-width': width }));
}

function curve(plot: SVGElement, points: string[], stroke: string, dash = '') {
  plot.append(svg('polyline', {
    points: points.join(' '), fill: 'none', stroke, 'stroke-width': 2,
    'stroke-dasharray': dash, 'vector-effect': 'non-scaling-stroke',
  }));
}

const left = 5, right = 55, bottom = 54, top = 6;

function drawArm(plot: SVGElement, demo: BanditLesson, arm: Arm, score: number | undefined, ceiling: number) {
  plot.replaceChildren();
  line(plot, left, bottom, right, bottom, 'var(--muted)');
  if (demo === 'ucb') {
    if (!arm.plays || score === undefined) return;
    const y = (value: number) => bottom - value / ceiling * (bottom - top);
    line(plot, 30, y(arm.wins / arm.plays), 30, y(score), 'var(--a)', 4);
    line(plot, 24, y(score), 36, y(score), 'var(--a)', 2);
    point(plot, 30, y(arm.wins / arm.plays), 'var(--ink)');
  } else {
    const losses = arm.plays - arm.wins;
    const mode = arm.plays ? arm.wins / arm.plays : 0.5;
    const logDensity = (value: number) => (arm.wins ? arm.wins * Math.log(value) : 0)
      + (losses ? losses * Math.log1p(-value) : 0);
    const peak = logDensity(mode);
    const y = (value: number) => bottom - Math.exp(logDensity(value) - peak) * (bottom - top);
    const x = (value: number) => left + value * (right - left);
    const domain = [...Array.from({ length: 61 }, (_, index) => index / 60), mode];
    if (score !== undefined) domain.push(score);
    curve(plot, domain.sort((a, b) => a - b).map(value => `${x(value)},${y(value)}`), 'var(--a)');
    if (score !== undefined) {
      line(plot, x(score), bottom, x(score), y(score), 'var(--ink)');
      point(plot, x(score), y(score), 'var(--ink)');
    }
  }
}

export function mountBandit(root: HTMLElement) {
  const demo = root.dataset.bandit as BanditLesson;
  const figure = root.hasAttribute('data-bandit-figure');
  const ui: Record<string, string> = JSON.parse(root.dataset.banditUi!);
  const lang = root.dataset.banditLang;
  const format = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 });
  const fill = (message: string, ...values: (number | string)[]) =>
    message.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
  const get = <T extends HTMLElement = HTMLElement>(part: string) => root.querySelector<T>(`[data-bandit-${part}]`)!;
  const policyIds = demo === 'ucb' ? ['ucb', 'random', 'oracle'] as const : ['thompson', 'ucb', 'random'] as const;
  const colors = ['var(--a)', 'var(--b)', 'var(--ok)'];
  let seed = figure ? 2026 : randomSeed();
  let rates = hiddenRates(seed);
  let policies = policyIds.map(policy => createBandit(rates, seed, policy));
  let human = createBandit(rates, seed, 'human');
  let manual = !figure && demo === 'ucb';
  let revealed = false;
  const columns = [...root.querySelectorAll<HTMLElement>('[data-bandit-arm]')];
  const armPlots = columns.map(column => board(column.querySelector<HTMLElement>('[data-bandit-plot]')!, 60, 60));
  const chart = figure ? null : board(get('chart'), 480, 146);

  function render() {
    const active = manual ? human : policies[0];
    const last = active.last;
    const ceiling = Math.max(3, ...(last?.scores.filter(Number.isFinite) ?? []));
    const rounds = active.rewards.length - 1;
    columns.forEach((column, index) => {
      const current = active.arms[index];
      const previous = last?.before[index] ?? current;
      const score = last?.scores[index];
      const selected = last?.chosen === index;
      column.classList.toggle('picked', selected);
      column.querySelector('[data-bandit-tally]')!.textContent = fill(ui.tally, format.format(current.wins), format.format(current.plays));
      column.querySelector('[data-bandit-value]')!.textContent = manual ? '' : demo === 'ucb'
        ? previous.plays && score !== undefined ? fill(ui.bound, format.format(score)) : ui.unplayed
        : score === undefined ? '' : fill(ui.sample, percent.format(score));
      column.querySelector('[data-bandit-rate]')!.textContent = revealed ? percent.format(rates[index]) : '';
      armPlots[index].toggleAttribute('hidden', manual);
      if (!manual) drawArm(armPlots[index], demo, previous, score, ceiling);
      if (!figure) {
        const button = column.querySelector('button')!;
        button.hidden = !manual;
        button.disabled = rounds >= 30;
      }
    });
    if (figure || !chart) return;
    get('hint').textContent = manual ? ui.manualHint : ui.plotHint;
    get('status').textContent = [
      fill(manual ? ui.humanScore : ui.score, format.format(rounds), format.format(active.rewards[rounds])),
      last ? fill(last.reward ? ui.click : ui.miss, format.format(last.chosen + 1)) : '',
    ].filter(Boolean).join(' · ');
    get<HTMLButtonElement>('start').hidden = !manual || rounds < 30;
    get('actions').hidden = manual;
    get('comparison').hidden = manual;
    get<HTMLButtonElement>('reveal').textContent = revealed ? ui.hide : ui.reveal;
    get<HTMLButtonElement>('reveal').setAttribute('aria-pressed', String(revealed));
    if (manual) return;

    chart.replaceChildren();
    const max = Math.max(1, ...policies.map(policy => policy.rewards[rounds]));
    for (const y of [10, 74, 138]) line(chart, 6, y, 474, y, 'var(--muted)');
    const stride = Math.max(1, Math.ceil(rounds / 300));
    policies.forEach((policy, index) => {
      const coord = (round: number) => `${6 + 468 * round / Math.max(1, rounds)},${138 - 128 * policy.rewards[round] / max}`;
      const points = [];
      for (let round = 0; round < rounds; round += stride) points.push(coord(round));
      points.push(coord(rounds));
      curve(chart, points, colors[index], ['', '6 3', '2 3'][index]);
      const [x, y] = coord(rounds).split(',').map(Number);
      point(chart, x, y, colors[index]);
      root.querySelectorAll('[data-bandit-legend]')[index].textContent = `${ui[policyIds[index]]}: ${format.format(policy.rewards[rounds])}`;
    });
    get('axes').textContent = fill(ui.axes, format.format(max), format.format(rounds));
  }

  if (figure) policies[0].run(40);
  else {
    columns.forEach((column, index) => column.querySelector('button')!.addEventListener('click', () => {
      if (!manual || human.rewards.length > 30) return;
      human.step(index);
      render();
      if (human.rewards.length === 31) get<HTMLButtonElement>('start').focus();
    }));
    get('start').addEventListener('click', () => {
      manual = false;
      get('your-score').textContent = fill(ui.yourScore, format.format(human.rewards[30]));
      render();
      get<HTMLButtonElement>('run').focus();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-bandit-run]').forEach(button => button.addEventListener('click', () => {
      policies.forEach(policy => policy.run(Number(button.dataset.banditRun)));
      render();
    }));
    get('reset').addEventListener('click', () => {
      seed = randomSeed();
      rates = hiddenRates(seed);
      policies = policyIds.map(policy => createBandit(rates, seed, policy));
      human = createBandit(rates, seed, 'human');
      revealed = false;
      get('your-score').textContent = '';
      render();
      if (manual) columns[0].querySelector('button')!.focus();
    });
    get('reveal').addEventListener('click', () => { revealed = !revealed; render(); });
  }
  render();
}
