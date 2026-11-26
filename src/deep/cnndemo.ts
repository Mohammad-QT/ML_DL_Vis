// Play tab and hero figure for the CNN lesson: draw a digit, see what the network sees, its guess and its first-layer maps.
import { cssColor, rgb, type RGB } from '../engine/board';
import { MAP, SIZE, featureMap, infer, kernel, parseCnn, rasterize, type Cnn, type Inference, type Stroke } from './cnn';
import { EXAMPLES } from './digits';

const models = new Map<string, Promise<Cnn>>();
/** Fetch and parse the weights once per page, however many demos ask for them. */
export function loadModel(url: string): Promise<Cnn> {
  if (!models.has(url)) {
    models.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).then(parseCnn));
    models.get(url)!.catch(() => models.delete(url));
  }
  return models.get(url)!;
}

interface Colors { ink: RGB; sheet: RGB; a: RGB; b: RGB; muted: RGB }
const readColors = (): Colors => ({ ink: cssColor('--ink'), sheet: cssColor('--sheet'), a: cssColor('--a'), b: cssColor('--b'), muted: cssColor('--muted') });

/** Size the canvas backing store to its CSS box (sharp on high-DPI screens). Returns the CSS size. */
function fit(canvas: HTMLCanvasElement): number {
  const w = canvas.clientWidth || 280;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr); }
  canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
  return w;
}

/** Paint a size × size grid of values (0 = background) as ink on paper, scaled to the canvas. */
function paintGrid(canvas: HTMLCanvasElement, values: ArrayLike<number>, size: number, colors: Colors, max = 1) {
  const w = fit(canvas), ctx = canvas.getContext('2d')!, cell = w / size;
  ctx.fillStyle = rgb(colors.sheet);
  ctx.fillRect(0, 0, w, w);
  const top = Math.max(max, 1e-6);
  for (let i = 0; i < size * size; i++) {
    const v = values[i] / top;
    if (v <= 0.02) continue;
    ctx.fillStyle = rgb(colors.ink, Math.min(1, v));
    ctx.fillRect((i % size) * cell, Math.floor(i / size) * cell, cell + 0.5, cell + 0.5);
  }
}

function paintPad(canvas: HTMLCanvasElement, strokes: Stroke[], colors: Colors) {
  const w = fit(canvas), ctx = canvas.getContext('2d')!;
  ctx.fillStyle = rgb(colors.sheet);
  ctx.fillRect(0, 0, w, w);
  ctx.strokeStyle = rgb(colors.muted, 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 10; i++) { ctx.moveTo((i * w) / 10, 0); ctx.lineTo((i * w) / 10, w); ctx.moveTo(0, (i * w) / 10); ctx.lineTo(w, (i * w) / 10); }
  ctx.stroke();
  ctx.strokeStyle = rgb(colors.ink);
  ctx.fillStyle = rgb(colors.ink);
  ctx.lineWidth = w * 0.06;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.length) continue;
    ctx.beginPath();
    if (s.length === 1) { ctx.arc(s[0].x * w, s[0].y * w, ctx.lineWidth / 2, 0, 2 * Math.PI); ctx.fill(); continue; }
    ctx.moveTo(s[0].x * w, s[0].y * w);
    for (const p of s.slice(1)) ctx.lineTo(p.x * w, p.y * w);
    ctx.stroke();
  }
}

export function mountCnn(root: HTMLElement) {
  const get = <T extends Element = HTMLElement>(name: string) => root.querySelector<T>(`[data-cnn-${name}]`)!;
  const figure = root.hasAttribute('data-cnn-figure');
  const ui: Record<string, string> = JSON.parse(root.dataset.cnnUi ?? '{}');
  const lang = root.dataset.cnnLang;
  const pct = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 });
  const digit = new Intl.NumberFormat(lang);
  const pad = get<HTMLCanvasElement>('pad');
  const input = get<HTMLCanvasElement>('input');
  const bars = [...root.querySelectorAll<HTMLElement>('[data-cnn-bar]')];
  const status = figure ? null : get('status');
  const maps = [...root.querySelectorAll<HTMLButtonElement>('[data-cnn-map]')];
  let colors: Colors | null = null;
  let model: Cnn | null = null;
  let strokes: Stroke[] = figure ? EXAMPLES[3] : [];
  let image: Float32Array | null = null;
  let result: Inference | null = null;
  let selected = 0;
  let example = 0;
  let frame = 0;

  function paintFilter() {
    if (figure || !model || !colors) return;
    const k = selected;
    get('filter-name').textContent = ui.filter.replace('{n}', digit.format(k + 1));
    const w = kernel(model, k), max = Math.max(...w.map(Math.abs), 1e-6);
    const svg = get<SVGSVGElement>('kernel');
    svg.replaceChildren(...w.flatMap((v, i) => {
      const ns = 'http://www.w3.org/2000/svg';
      const rect = document.createElementNS(ns, 'rect');
      const x = (i % 3) * 30, y = Math.floor(i / 3) * 30;
      Object.entries({ x: x + 1, y: y + 1, width: 28, height: 28, rx: 4, fill: v >= 0 ? 'var(--a)' : 'var(--b)', 'fill-opacity': (0.15 + 0.85 * Math.abs(v) / max).toFixed(2) })
        .forEach(([a, val]) => rect.setAttribute(a, String(val)));
      const text = document.createElementNS(ns, 'text');
      Object.entries({ x: x + 15, y: y + 19, 'text-anchor': 'middle', 'font-size': 9, 'font-family': 'var(--mono)', fill: 'var(--ink)' })
        .forEach(([a, val]) => text.setAttribute(a, String(val)));
      text.textContent = (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
      return [rect, text];
    }));
    const values = result ? featureMap(result.conv1, k) : new Float32Array(MAP * MAP);
    paintGrid(get<HTMLCanvasElement>('bigmap'), values, MAP, colors, Math.max(...values));
  }

  function paint() {
    frame = 0;
    colors ??= readColors();
    paintPad(pad, strokes, colors);
    image = rasterize(strokes);
    result = model && image ? infer(model, image) : null;
    paintGrid(input, image ?? new Float32Array(SIZE * SIZE), SIZE, colors);
    const probs = result?.probs;
    const best = probs ? probs.indexOf(Math.max(...probs)) : -1;
    bars.forEach((bar, d) => {
      const p = probs ? probs[d] : 0;
      bar.classList.toggle('best', d === best);
      bar.querySelector<HTMLElement>('.track i')!.style.width = `${(p * 100).toFixed(1)}%`;
      bar.querySelector('output')!.textContent = probs ? pct.format(p) : '';
    });
    if (figure) return;
    get('guess').textContent = probs ? ui.guess.replace('{d}', digit.format(best)) : ui.empty;
    get('confidence').textContent = probs ? ui.confidence.replace('{n}', pct.format(probs[best])) : '';
    // Each small map is scaled to the brightest map, so you can compare how strongly the filters respond.
    const top = result ? Math.max(...result.conv1) : 1;
    maps.forEach((button, k) => paintGrid(button.querySelector('canvas')!, result ? featureMap(result.conv1, k) : new Float32Array(MAP * MAP), MAP, colors!, top));
    paintFilter();
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };

  if (!figure) {
    let drawing: { id: number; stroke: Stroke } | null = null;
    const at = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
    };
    pad.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { pad.setPointerCapture(e.pointerId); } catch { /* the stroke still works without capture */ }
      drawing = { id: e.pointerId, stroke: [at(e)] };
      strokes.push(drawing.stroke);
      schedule();
    });
    pad.addEventListener('pointermove', e => {
      if (!drawing || drawing.id !== e.pointerId) return;
      const p = at(e), last = drawing.stroke[drawing.stroke.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.006) return;
      drawing.stroke.push(p);
      schedule();
    });
    const end = (e: PointerEvent) => { if (drawing?.id === e.pointerId) drawing = null; };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    get('clear').addEventListener('click', () => { strokes = []; schedule(); });
    get('example').addEventListener('click', () => {
      strokes = EXAMPLES[example].map(s => s.map(p => ({ ...p })));
      example = (example + 1) % EXAMPLES.length;
      schedule();
    });
    maps.forEach((button, k) => button.addEventListener('click', () => {
      selected = k;
      maps.forEach((b, j) => { b.classList.toggle('on', j === k); b.setAttribute('aria-pressed', String(j === k)); });
      paintFilter();
    }));
  }

  addEventListener('themechange', () => { colors = null; schedule(); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(pad);
  if (status) status.textContent = status.dataset.loading ?? '';
  paint();
  return loadModel(root.dataset.cnnModel!).then(m => {
    model = m;
    if (status) status.textContent = '';
    paint();
  }, () => { if (status) status.textContent = status.dataset.error ?? ''; });
}
