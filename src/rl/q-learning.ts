import { ACTIONS, DEFAULT_TRAINING, EPISODE_CAP, gridWorld, type Episode } from '../engine/q-learning';

const ARROWS = ['↑', '→', '↓', '←'];
const MARKS = { start: '○', goal: '+1', pit: '−1', wall: '■', open: '' };

export function mountQLearning(root: HTMLElement) {
  const ui = JSON.parse(root.dataset.qUi ?? '{}') as Record<string, string>;
  const number = new Intl.NumberFormat(root.dataset.qLang, { maximumFractionDigits: 2 });
  const squares = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-q-cell]'));
  const markers = squares.map(cell => cell.querySelector<HTMLElement>('[data-q-mark]')!);
  const arrows = squares.map(cell => cell.querySelector<HTMLElement>('[data-q-arrow]')!);
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('[data-q-setting]'));
  const status = root.querySelector<HTMLElement>('[data-q-status]')!;
  const stepsLine = root.querySelector('[data-q-steps]')!;
  const averageLine = root.querySelector('[data-q-average]')!;
  const latest = root.querySelector('[data-q-latest]')!;
  const settings = { ...DEFAULT_TRAINING };
  let world = gridWorld();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let history: number[] = [];
  let total = 0;

  function drawGrid(agent: number) {
    squares.forEach((square, state) => {
      const tile = world.cells[state];
      const canEdit = tile === 'open' || tile === 'wall';
      const action = world.bestAction(state);
      const seen = (tile === 'open' || tile === 'start') && world.visited[state];
      const value = world.table[state][action];
      square.dataset.qTile = tile;
      square.toggleAttribute('data-q-agent', state === agent);
      if (canEdit) square.setAttribute('aria-pressed', String(tile === 'wall'));
      square.style.setProperty('--q-tint', `${Math.round(Math.min(1, Math.abs(value)) * 55)}%`);
      square.style.setProperty('--q-color', `var(${value < 0 ? '--b' : '--ok'})`);
      markers[state].textContent = MARKS[tile];
      arrows[state].textContent = seen ? ARROWS[action] : '';
      const position = `${number.format(Math.floor(state / world.width) + 1)}, ${number.format(state % world.width + 1)}`;
      square.setAttribute('aria-label', [position, ui[tile], seen && ui[ACTIONS[action]], seen && `${ui.value}: ${number.format(value)}`, state === agent && ui.agent].filter(Boolean).join(' · '));
    });
  }

  function drawChart() {
    const coordinate = (steps: number, index: number) => [
      8 + 344 * index / Math.max(1, history.length - 1),
      102 - 94 * steps / EPISODE_CAP,
    ];
    stepsLine.setAttribute('points', history.map(coordinate).join(' '));
    averageLine.setAttribute('points', history.map((_, index) => {
      const window = history.slice(Math.max(0, index - 9), index + 1);
      return coordinate(window.reduce((sum, steps) => sum + steps, 0) / window.length, index);
    }).join(' '));
    latest.setAttribute('visibility', history.length ? 'visible' : 'hidden');
    if (history.length) {
      const [x, y] = coordinate(history[history.length - 1], history.length - 1);
      latest.setAttribute('cx', String(x));
      latest.setAttribute('cy', String(y));
    }
  }

  function setStatus(episode: Episode) {
    status.textContent = ui.result.replace('{total}', number.format(total))
      .replace('{steps}', number.format(episode.steps)).replace('{outcome}', ui[`outcome_${episode.outcome}`]);
  }

  function track(episode: Episode) {
    total++;
    history.push(episode.steps);
    if (history.length > 300) history.shift();
  }

  function clear(worldMap?: readonly string[]) {
    clearTimeout(timer);
    world = gridWorld(worldMap);
    history = [];
    total = 0;
    drawGrid(world.start);
    drawChart();
    status.textContent = worldMap ? ui.edited : ui.ready;
  }

  inputs.forEach(input => {
    const name = input.dataset.qSetting as keyof typeof settings;
    const display = root.querySelector<HTMLOutputElement>(`[data-q-output="${name}"]`)!;
    input.addEventListener('input', () => {
      settings[name] = Number(input.value);
      display.value = number.format(settings[name]);
    });
  });

  squares.forEach((square, state) => square.addEventListener('click', () => {
    const tile = world.cells[state];
    if (tile !== 'open' && tile !== 'wall') return;
    const map = world.cells.map((cell, index) => index === state ? (tile === 'wall' ? '.' : '#') :
      ({ open: '.', wall: '#', start: 'S', goal: 'G', pit: 'X' })[cell]);
    clear(Array.from({ length: map.length / world.width }, (_, row) => map.slice(row * world.width, (row + 1) * world.width).join('')));
  }));

  root.querySelector('[data-q-reset]')!.addEventListener('click', () => {
    inputs.forEach(input => {
      input.value = input.defaultValue;
      input.dispatchEvent(new Event('input'));
    });
    clear();
  });

  root.querySelector('[data-q-train="1"]')!.addEventListener('click', () => {
    clearTimeout(timer);
    const episode = world.episode(settings);
    track(episode);
    drawChart();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      drawGrid(episode.path[episode.path.length - 1]);
      setStatus(episode);
      return;
    }
    let index = 0;
    status.textContent = ui.running;
    const frame = () => {
      drawGrid(episode.path[index++]);
      if (index < episode.path.length) timer = setTimeout(frame, 105);
      else setStatus(episode);
    };
    frame();
  });

  root.querySelector('[data-q-train="100"]')!.addEventListener('click', () => {
    clearTimeout(timer);
    for (let index = 0; index < 99; index++) track(world.episode(settings));
    const last = world.episode(settings);
    track(last);
    drawGrid(last.path[last.path.length - 1]);
    drawChart();
    setStatus(last);
  });

  drawGrid(world.start);
  drawChart();
}
