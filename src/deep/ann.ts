// Play tab and hero figure for the neural-network lesson: a board whose boundary is redrawn while an MLP trains,
// a network diagram whose edges follow the weights, and a loss chart.
import { Board } from '../engine/board';
import { activate, Mlp, type Activation } from '../engine/mlp';
import { Store } from '../engine/store';
import type { Label, Point } from '../engine/types';
import { annPoints, toInputs, type AnnPreset } from './data';

const SEED = 42;
const NET_SEED = 7;
const MAX_POINTS = 300;
/** Training stops by itself here so a forgotten tab does not keep the CPU busy. */
export const MAX_EPOCHS = 5000;
const BATCH = 16;
const FRAME_MS = 14;
const EPOCHS_PER_FRAME = 5;
const ns = 'http://www.w3.org/2000/svg';
const clamp = (v: number) => Math.max(0.02, Math.min(0.98, v));

export interface AnnSettings { layers: number; units: number; activation: Activation; rate: number }

const svg = (tag: string, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

export const buildNet = (s: AnnSettings) =>
  new Mlp({ inputs: 2, hidden: Array.from({ length: s.layers }, () => s.units), activation: s.activation, seed: NET_SEED });

export const asModel = (net: Mlp) => ({ predict: (x: number, y: number) => net.prob1(toInputs(x, y)) });

const dataset = (points: Point[]) => ({ X: points.map(p => toInputs(p.x, p.y)), y: points.map(p => p.c as number) });

/** Draws the layers as columns of nodes; edge colour is the weight's sign and width its size. */
class NetDiagram {
  private edges: SVGLineElement[][] = [];
  constructor(private root: SVGSVGElement, private ui: Record<string, string>, private format: (n: number) => string) {}

  build(net: Mlp) {
    const sizes = [net.layers[0].inputs, ...net.layers.map(l => l.units)];
    const W = 300, H = 190, top = 30, bottom = H - 10;
    const xs = sizes.map((_, i) => 24 + (i * (W - 48)) / (sizes.length - 1));
    const ys = sizes.map(n => Array.from({ length: n }, (_, j) => top + ((j + 0.5) * (bottom - top)) / n));
    const edgeGroup = svg('g', { 'stroke-linecap': 'round' });
    this.edges = net.layers.map((layer, l) => Array.from({ length: layer.units * layer.inputs }, (_, k) => {
      const o = Math.floor(k / layer.inputs), i = k % layer.inputs;
      const line = svg('line', { x1: xs[l], y1: ys[l][i], x2: xs[l + 1], y2: ys[l + 1][o] }) as SVGLineElement;
      edgeGroup.append(line);
      return line;
    }));
    const nodes = svg('g', { fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': 1.5 });
    sizes.forEach((n, l) => ys[l].forEach(y => nodes.append(svg('circle', { cx: xs[l], cy: y, r: n > 6 ? 5 : 6.5 }))));
    const labels = svg('g', { fill: 'var(--muted)', 'font-size': 10.5, 'text-anchor': 'middle', 'font-family': 'var(--body)' });
    // Top row: "Inputs", one shared "Hidden layers" caption, "Output". Second row: the hidden layers' numbers.
    const text = (x: number, y: number, value: string) => { const t = svg('text', { x, y }); t.textContent = value; labels.append(t); };
    const last = sizes.length - 1;
    text(xs[0], 9, this.ui.inputs);
    text(xs[last], 9, this.ui.output);
    text((xs[1] + xs[last - 1]) / 2, 9, this.ui.layers);
    for (let l = 1; l < last; l++) text(xs[l], 20, this.format(l));
    const io = svg('g', { fill: 'var(--ink)', 'font-size': 10, 'font-family': 'var(--mono)', 'text-anchor': 'end' });
    ['x', 'y'].forEach((name, i) => {
      const t = svg('text', { x: xs[0] - 10, y: ys[0][i] + 3.5 });
      t.textContent = name;
      io.append(t);
    });
    this.root.replaceChildren(edgeGroup, nodes, labels, io);
    this.update(net);
  }

  update(net: Mlp) {
    let max = 1e-9;
    for (const layer of net.layers) for (const w of layer.w) max = Math.max(max, Math.abs(w));
    net.layers.forEach((layer, l) => this.edges[l].forEach((line, k) => {
      const w = layer.w[k], m = Math.abs(w) / max;
      line.setAttribute('stroke', w >= 0 ? 'var(--a)' : 'var(--b)');
      line.setAttribute('stroke-width', (0.4 + 3.6 * m).toFixed(2));
      line.setAttribute('stroke-opacity', (0.2 + 0.75 * m).toFixed(2));
    }));
  }
}

export function mountAnn(root: HTMLElement) {
  const get = <T extends Element = HTMLElement>(name: string) => root.querySelector<T>(`[data-ann-${name}]`)!;
  const figure = root.hasAttribute('data-ann-figure');
  const ui: Record<string, string> = JSON.parse(root.dataset.annUi ?? '{}');
  const lang = root.dataset.annLang;
  const store = new Store({ testFrac: figure ? 0 : 0.25 });
  let label: Label = 0;

  if (figure) {
    // Hero: a network trained up front on the circles, drawn once.
    const board = new Board(get<HTMLCanvasElement>('board'), store, { static: true, dot: 2.7, cell: 4, tint: 0.24 });
    store.load(annPoints('circles', SEED), SEED);
    const net = buildNet({ layers: 2, units: 6, activation: 'relu', rate: 0.1 });
    const { X, y } = dataset(store.points);
    for (let e = 0; e < 150; e++) net.epoch(X, y, 0.1, BATCH);
    board.setModel(asModel(net));
    return;
  }

  const status = get('status');
  const board = new Board(get<HTMLCanvasElement>('board'), store, {
    dot: 4.2,
    onAdd: (p, e) => {
      if (store.points.length >= MAX_POINTS) { status.textContent = ui.limit; return; }
      store.add(clamp(p.x), clamp(p.y), (e.shiftKey ? 1 - label : label) as Label);
    },
  });
  const diagram = new NetDiagram(get<SVGSVGElement>('net'), ui, n => new Intl.NumberFormat(lang).format(n));
  const layers = get<HTMLInputElement>('layers');
  const units = get<HTMLInputElement>('units');
  const rate = get<HTMLInputElement>('rate');
  const train = get<HTMLButtonElement>('train');
  const step = get<HTMLButtonElement>('step');
  const trace = get<SVGPolylineElement>('loss-trace');
  const curve = get<SVGPathElement>('curve-line');
  const pct = new Intl.NumberFormat(lang, { style: 'percent' });
  const num = new Intl.NumberFormat(lang, { maximumFractionDigits: 3, minimumFractionDigits: 3 });
  const int = new Intl.NumberFormat(lang);
  let activation: Activation = 'relu';
  let preset: AnnPreset = 'xor';
  let net = buildNet(settings());
  let epochs = 0;
  let losses: number[] = [];
  let frame = 0;
  let running = false;

  function settings(): AnnSettings {
    return { layers: Number(layers.value), units: Number(units.value), activation, rate: 10 ** Number(rate.value) };
  }
  const say = (name: string, text: string) => { const el = get(name); if (el.textContent !== text) el.textContent = text; };

  function render() {
    const fitData = dataset(store.train()), testData = dataset(store.test());
    const loss = net.loss(fitData.X, fitData.y);
    const trainAcc = net.accuracy(fitData.X, fitData.y), testAcc = net.accuracy(testData.X, testData.y);
    board.setModel(asModel(net));
    diagram.update(net);
    say('epoch', ui.epoch.replace('{n}', int.format(epochs)));
    say('loss', ui.loss.replace('{n}', num.format(loss)));
    say('train-acc', ui.train_acc.replace('{n}', trainAcc === null ? '–' : pct.format(trainAcc)));
    say('test-acc', ui.test_acc.replace('{n}', testAcc === null ? '–' : pct.format(testAcc)));
    // Loss chart: every epoch's loss, thinned to at most 300 points, scaled to the largest loss so far.
    const shown = losses.length > 300 ? Array.from({ length: 300 }, (_, i) => losses[Math.floor((i * losses.length) / 300)]) : losses;
    const peak = Math.max(1e-9, ...shown);
    trace.setAttribute('points', shown.map((l, i) => `${(8 + (284 * i) / Math.max(1, shown.length - 1)).toFixed(1)},${(52 - (44 * l) / peak).toFixed(1)}`).join(' '));
    get('hint').hidden = Number(units.value) !== 1;
    get('layers-value').textContent = int.format(Number(layers.value));
    get('units-value').textContent = int.format(Number(units.value));
    get('rate-value').textContent = new Intl.NumberFormat(lang, { maximumSignificantDigits: 2 }).format(settings().rate);
    train.textContent = running ? ui.pause : ui.train;
    train.setAttribute('aria-pressed', String(running));
    step.disabled = running;
  }

  function runEpoch() {
    const { X, y } = dataset(store.train());
    if (!X.length) return false;
    losses.push(net.epoch(X, y, settings().rate, BATCH));
    epochs++;
    return true;
  }

  function stop() { running = false; cancelAnimationFrame(frame); render(); }
  function tick() {
    // A few epochs per frame: fast enough to finish in seconds, slow enough to watch the boundary bend.
    const start = performance.now();
    let trained = false, done = 0;
    do { trained = runEpoch(); done++; } while (trained && done < EPOCHS_PER_FRAME && epochs < MAX_EPOCHS && performance.now() - start < FRAME_MS);
    if (!trained || epochs >= MAX_EPOCHS) { stop(); return; }
    render();
    frame = requestAnimationFrame(tick);
  }

  function drawCurve() {
    const d: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const z = -4 + (8 * i) / 40;
      const x = 60 + 13 * z;
      const y = Math.max(4, Math.min(60, 32 - 13 * activate(activation, z)));
      d.push(`${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    curve.setAttribute('d', d.join(' '));
  }

  function reset() {
    net = buildNet(settings());
    epochs = 0;
    losses = [];
    diagram.build(net);
    status.textContent = '';
    render();
  }

  const pick = (buttons: HTMLButtonElement[], on: HTMLButtonElement) => buttons.forEach(b => {
    b.classList.toggle('on', b === on);
    b.setAttribute('aria-pressed', String(b === on));
  });
  const presets = [...root.querySelectorAll<HTMLButtonElement>('[data-ann-preset]')];
  presets.forEach(b => b.addEventListener('click', () => {
    preset = b.dataset.annPreset as AnnPreset;
    pick(presets, b);
    store.load(annPoints(preset, SEED), SEED);
    reset();
  }));
  const classes = [...root.querySelectorAll<HTMLButtonElement>('[data-ann-class]')];
  classes.forEach(b => b.addEventListener('click', () => { label = Number(b.dataset.annClass) as Label; pick(classes, b); }));
  const acts = [...root.querySelectorAll<HTMLButtonElement>('[data-ann-act]')];
  acts.forEach(b => b.addEventListener('click', () => {
    activation = b.dataset.annAct as Activation;
    pick(acts, b);
    drawCurve();
    reset();
  }));
  layers.addEventListener('input', reset);
  units.addEventListener('input', reset);
  rate.addEventListener('input', render);
  train.addEventListener('click', () => {
    if (running) { stop(); return; }
    if (epochs >= MAX_EPOCHS) reset();
    running = true;
    render();
    frame = requestAnimationFrame(tick);
  });
  step.addEventListener('click', () => { if (runEpoch()) render(); });
  get('reset').addEventListener('click', () => { stop(); reset(); });
  // New points: refresh scores and boundary now when paused; a running loop picks them up on the next frame.
  store.subscribe(() => { if (!running) render(); });

  drawCurve();
  diagram.build(net);
  store.load(annPoints(preset, SEED), SEED);
}
