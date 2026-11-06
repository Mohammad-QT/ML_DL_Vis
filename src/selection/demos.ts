// The three Part 10 interactives, built from plain DOM and SVG. Each reads its words from `ui` (lesson front matter).
import { Board } from '../engine/board';
import { randomSeed } from '../engine/random';
import {
  MODELS, MODEL_NAMES, PRESETS, BOOST_DEFAULTS, crossValidate, defaults, fitBoost, fitModel, foldIds, jitter, pct,
  rng, score, type ModelName, type Params, type PresetName, type Point,
} from '../engine';

type UI = Record<string, string>;
const fill = (s: string, v: Record<string, string | number>) => (s ?? '').replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
const clamp = (v: number) => Math.min(0.985, Math.max(0.015, v));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A messy copy of a preset: points are nudged by Gaussian noise so the classes overlap a little. */
function makeData(preset: PresetName, seed: number, noise: number): Point[] {
  return jitter(PRESETS[preset](rng(seed)), noise, seed + 1).map(p => ({ x: clamp(p.x), y: clamp(p.y), c: p.c, test: false }));
}

const specOf = (name: ModelName) => {
  const specs: Record<string, { min: number; max: number; step: number; def: number; log?: boolean }> = MODELS[name].params;
  const key = Object.keys(specs)[0];
  return key ? { key, ...specs[key] } : null;
};
const showVal = (v: number, log?: boolean) => (log ? String(Number((10 ** v).toPrecision(2))) : String(v));

/** Run `jobs` a few milliseconds per animation frame so the page stays responsive. Returns a cancel function. */
function runChunked(jobs: Array<() => void>, onTick: (done: number) => void, onEnd: () => void): () => void {
  let i = 0, stop = false;
  const frame = () => {
    if (stop) return;
    const t0 = performance.now();
    while (i < jobs.length && performance.now() - t0 < 10) jobs[i++]();
    onTick(i);
    if (i < jobs.length) requestAnimationFrame(frame); else onEnd();
  };
  requestAnimationFrame(frame);
  return () => { stop = true; };
}

const frame = (h: number) => `<div class="frame"><canvas class="board" style="height:${h}px"></canvas></div>`;
const svgNS = (w: number, h: number, body: string) => `<svg class="plot" viewBox="0 0 ${w} ${h}" role="img">${body}</svg>`;

/** Bar strip of scores in [0,1] on a 40-100% axis, with an optional mean line and ± std band. */
function strip(scores: Array<number | null>, o: { cur?: number; avg?: number; sd?: number; labels?: string[]; empty?: string; slots?: number }) {
  const W = 360, H = 170, L = 34, T = 12, B = 26, lo = 0.4, n = Math.max(o.slots ?? scores.length, 1);
  const y = (v: number) => T + (H - T - B) * (1 - (Math.max(lo, v) - lo) / (1 - lo));
  const slot = (W - L - 8) / n, bw = Math.min(30, slot * 0.62);
  let s = [0.5, 0.75, 1].map(g => `<line x1="${L}" x2="${W - 8}" y1="${y(g)}" y2="${y(g)}" stroke="var(--rule)"/><text x="${L - 6}" y="${y(g) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${Math.round(g * 100)}</text>`).join('');
  if (o.avg != null && o.sd != null) {
    s += `<rect x="${L}" width="${W - L - 8}" y="${y(Math.min(1, o.avg + o.sd))}" height="${Math.max(2, y(Math.max(lo, o.avg - o.sd)) - y(Math.min(1, o.avg + o.sd)))}" fill="var(--ok)" opacity=".16"/>`
      + `<line x1="${L}" x2="${W - 8}" y1="${y(o.avg)}" y2="${y(o.avg)}" stroke="var(--ok)" stroke-width="2" stroke-dasharray="5 4"/>`;
  }
  scores.forEach((v, i) => {
    const cx = L + slot * (i + 0.5);
    if (v != null) {
      s += `<rect x="${cx - bw / 2}" y="${y(v)}" width="${bw}" height="${H - B - y(v)}" rx="4" fill="${i === o.cur ? 'var(--hl)' : 'var(--a)'}" ${i === o.cur ? 'stroke="var(--ink)" stroke-width="1.5"' : 'opacity=".85"'}/>`
        + `<text x="${cx}" y="${y(v) - 4}" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="var(--ink)">${Math.round(v * 100)}</text>`;
    }
    s += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="var(--muted)">${o.labels?.[i] ?? i + 1}</text>`;
  });
  if (!scores.some(v => v != null) && o.empty) s += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="var(--muted)">${o.empty}</text>`;
  return svgNS(W, H, s);
}

/** Line chart of one or two series over integer x values; y is zoomed to the data. `mark` is the best x, `cur` the current x. */
function lines(xs: number[], series: Array<{ ys: number[]; dash?: boolean; color: string; name: string }>, o: { mark?: number; cur?: number; xlabel: string }) {
  const W = 420, H = 210, L = 38, R = 12, T = 14, B = 40;
  const all = series.flatMap(s => s.ys), lo = Math.floor(Math.min(...all) * 20) / 20 - 0.02, hi = Math.min(1.0, Math.max(...all) + 0.03);
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const X = (v: number) => L + ((v - x0) / Math.max(1, x1 - x0)) * (W - L - R), Y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  let s = '';
  for (let g = Math.ceil(lo * 10) / 10; g <= hi + 1e-9; g += 0.1) s += `<line x1="${L}" x2="${W - R}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--rule)"/><text x="${L - 6}" y="${Y(g) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${Math.round(g * 100)}</text>`;
  const step = Math.ceil(xs.length / 8);
  xs.forEach((v, i) => { if (i % step === 0 || i === xs.length - 1) s += `<text x="${X(v)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="var(--mono)">${v}</text>`; });
  s += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="var(--muted)">${o.xlabel}</text>`;
  if (o.cur != null) s += `<line x1="${X(o.cur)}" x2="${X(o.cur)}" y1="${T}" y2="${H - B}" stroke="var(--ink)" stroke-width="1.5" opacity=".5"/>`;
  for (const se of series) s += `<polyline fill="none" stroke="${se.color}" stroke-width="2.4" stroke-linejoin="round" ${se.dash ? 'stroke-dasharray="6 4"' : ''} points="${xs.map((v, i) => `${X(v)},${Y(se.ys[i])}`).join(' ')}"/>`;
  if (o.mark != null) { const sc = series[series.length - 1]; s += `<circle cx="${X(o.mark)}" cy="${Y(sc.ys[xs.indexOf(o.mark)])}" r="6" fill="var(--hl)" stroke="var(--ink)" stroke-width="2"/>`; }
  const legend = series.map(se => `<span class="lg"><i style="background:${se.color}"></i>${se.name}</span>`).join('');
  return `${svgNS(W, H, s)}<div class="lgs">${legend}</div>`;
}

// ---------- 1. k-fold cross-validation ----------

function cv(root: HTMLElement, ui: UI) {
  const state = { model: 'knn' as ModelName, params: defaults('knn') as Params, preset: 'moons' as PresetName, k: 5, fold: 0, cvSeed: 3, splits: [] as number[], mode: 'cv' as 'cv' | 'split' };
  let pts = makeData(state.preset, 12, 0.07), result = crossValidate(state.model, state.params, pts, state.k, state.cvSeed), timer = 0;
  root.innerHTML = `<div class="dsplit"><div>${frame(400)}<p class="legend"><span class="swatch ring"></span> ${ui.legend_test}</p></div>
    <div class="dside">
      <label class="box"><span class="label">${ui.model}</span><select data-model>${MODEL_NAMES.map(n => `<option value="${n}">${ui['m_' + n]}</option>`).join('')}</select></label>
      <label class="box" data-setting-box><span class="label"><span data-sname></span> · <b data-sval></b></span><input type="range" data-setting></label>
      <label class="box"><span class="label">${ui.k} · <b data-kval>${state.k}</b></span><input type="range" min="3" max="10" step="1" value="${state.k}" data-k></label>
      <div class="chips"><button class="btn" data-step>${ui.step}</button><button class="chip" data-anim>${ui.animate}</button><button class="chip" data-data>${ui.new_data}</button></div>
    </div></div>
    <p class="dnote" data-fold aria-live="polite"></p>
    <div class="dstrips"><figure class="sheet pane"><figcaption><b>${ui.strip_cv}</b><span data-cvsum></span></figcaption><div data-cvstrip></div></figure>
    <figure class="sheet pane"><figcaption><b>${ui.strip_one}</b><span data-onesum></span></figcaption><div data-onestrip></div><div class="chips"><button class="btn ghost" data-split>${ui.split_btn}</button></div></figure></div>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const store = { points: pts };
  const board = new Board(q<HTMLCanvasElement>('canvas'), store, { static: true, cell: 5 });
  let ids = foldIds(pts.length, state.k, state.cvSeed), revealed = 1;

  const drawFold = () => {
    if (state.mode === 'cv') {
      store.points.forEach((p, i) => (p.test = ids[i] === state.fold));
      const train = store.points.filter(p => !p.test), test = store.points.filter(p => p.test);
      board.setModel(fitModel(state.model, state.params, train), true);
      q('[data-fold]').textContent = fill(ui.fold_of, { i: state.fold + 1, k: state.k, n: test.length, s: pct(result.scores[state.fold]) });
    }
    const done = revealed >= state.k;
    q('[data-cvstrip]').innerHTML = strip(result.scores.map((v, i) => (i < revealed ? v : null)), { cur: state.mode === 'cv' ? state.fold : -1, avg: done ? result.mean : undefined, sd: done ? result.std : undefined, labels: result.scores.map((_, i) => 'F' + (i + 1)), slots: state.k });
    q('[data-cvsum]').textContent = done ? fill(ui.mean_std, { m: pct(result.mean), s: Math.round(result.std * 100) }) : fill(ui.revealing, { i: revealed, k: state.k });
    const sp = state.splits;
    q('[data-onestrip]').innerHTML = strip([...sp, ...Array(Math.max(0, 5 - sp.length)).fill(null)], { labels: [...sp.map((_, i) => 'S' + (i + 1)), ...Array(5).fill('')], slots: Math.max(5, sp.length), empty: ui.one_hint });
    q('[data-onesum]').textContent = sp.length > 1 ? fill(ui.one_range, { n: sp.length, lo: pct(Math.min(...sp)), hi: pct(Math.max(...sp)) }) : '';
  };
  const recompute = (resetFold = true) => {
    result = crossValidate(state.model, state.params, pts, state.k, state.cvSeed);
    ids = foldIds(pts.length, state.k, state.cvSeed);
    if (resetFold) { state.fold = 0; revealed = 1; }
    state.mode = 'cv'; state.splits = [];
    drawFold();
  };
  const stopAnim = () => { clearInterval(timer); timer = 0; q('[data-anim]').textContent = ui.animate; q('[data-anim]').classList.remove('on'); };
  const stepFold = () => {
    state.mode = 'cv';
    state.fold = (state.fold + 1) % state.k;
    revealed = Math.max(revealed, state.fold + 1);
    drawFold();
  };

  const setting = () => {
    const sp = specOf(state.model), box = q('[data-setting-box]');
    box.hidden = !sp;
    if (!sp) return;
    const inp = q<HTMLInputElement>('[data-setting]');
    inp.min = String(sp.min); inp.max = String(sp.max); inp.step = String(sp.step); inp.value = String(state.params[sp.key]);
    q('[data-sname]').textContent = ui['p_' + state.model];
    q('[data-sval]').textContent = showVal(state.params[sp.key], sp.log);
  };
  q<HTMLSelectElement>('[data-model]').addEventListener('change', e => {
    stopAnim();
    state.model = (e.target as HTMLSelectElement).value as ModelName;
    state.params = defaults(state.model);
    setting(); recompute();
  });
  q<HTMLInputElement>('[data-setting]').addEventListener('input', e => {
    const sp = specOf(state.model)!;
    state.params = { ...state.params, [sp.key]: Number((e.target as HTMLInputElement).value) };
    q('[data-sval]').textContent = showVal(state.params[sp.key], sp.log);
    recompute(false);
  });
  q<HTMLInputElement>('[data-k]').addEventListener('input', e => {
    stopAnim();
    state.k = Number((e.target as HTMLInputElement).value);
    q('[data-kval]').textContent = String(state.k);
    recompute();
  });
  q('[data-step]').addEventListener('click', () => { stopAnim(); stepFold(); });
  q('[data-anim]').addEventListener('click', () => {
    if (timer) { stopAnim(); return; }
    state.mode = 'cv'; state.fold = -1; revealed = 0;
    q('[data-anim]').textContent = ui.pause; q('[data-anim]').classList.add('on');
    const tick = () => { stepFold(); if (revealed >= state.k) stopAnim(); };
    tick();
    timer = window.setInterval(tick, reduced() ? 1200 : 1000);
  });
  q('[data-data]').addEventListener('click', () => {
    stopAnim();
    pts = makeData(state.preset, randomSeed(), 0.07);
    store.points = pts;
    recompute();
  });
  q('[data-split]').addEventListener('click', () => {
    stopAnim();
    state.mode = 'split';
    const r = rng(randomSeed());
    store.points.forEach(p => (p.test = r() < 0.25));
    const train = store.points.filter(p => !p.test), test = store.points.filter(p => p.test);
    const m = fitModel(state.model, state.params, train), s = score(m, test) ?? 0;
    board.setModel(m, true);
    state.splits = [...state.splits, s].slice(-8);
    q('[data-fold]').textContent = fill(ui.split_of, { i: state.splits.length, n: test.length, s: pct(s) });
    drawFold();
  });
  setting();
  drawFold();
}

// ---------- 2. grid search ----------

const GRID_C = [-1, -0.5, 0, 1, 2, 3], GRID_G = [-1, -0.3, 0.4, 1.1, 1.8, 2.5];

function grid(root: HTMLElement, ui: UI) {
  const K = 5;
  let pts = makeData('moons', 21, 0.05), cancel = () => {}, pinned = { r: 0, c: 0 };
  type Cell = { cv: number; train: number } | null;
  let cells: Cell[][] = [];
  root.innerHTML = `<div class="dsplit gsplit"><div>
      <p class="label">${ui.heat_h}</p><div class="heat" dir="ltr" data-heat></div>
      <div class="prog"><i data-prog></i></div><p class="legend" data-status aria-live="polite"></p></div>
    <div>${frame(300)}<div class="box scores3" aria-live="polite"><div><small>${ui.train}</small><b data-tr>–</b></div><div><small>${ui.cv}</small><b data-cvs>–</b></div><div><small>${ui.gap}</small><b data-gap>–</b></div></div>
    <p class="dnote" data-verdict>${ui.hover_hint}</p></div></div>
    <div class="chips"><button class="chip" data-data>${ui.new_data}</button></div>
    <h3 class="display">${ui.chart_h}</h3>
    <div class="chips" data-which></div>
    <figure class="sheet pane" style="max-width:520px"><div data-chart></div><figcaption data-chartnote></figcaption></figure>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const store = { points: pts };
  const board = new Board(q<HTMLCanvasElement>('canvas'), store, { static: true, cell: 5 });
  const modelCache = new Map<string, ReturnType<typeof fitModel>>();
  const fmtC = (v: number) => String(Number((10 ** v).toPrecision(2)));

  const heat = q('[data-heat]');
  heat.style.setProperty('--n', String(GRID_G.length));
  heat.innerHTML = `<span class="ax corner">${ui.axis_c} ↓ ${ui.axis_g} →</span>` + GRID_G.map(g => `<span class="ax">${fmtC(g)}</span>`).join('')
    + GRID_C.map((c, r) => `<span class="ax">${fmtC(c)}</span>` + GRID_G.map((_, j) => `<button class="cell" data-r="${r}" data-c="${j}"><b>…</b></button>`).join('')).join('');
  const cellEl = (r: number, c: number) => heat.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`)!;
  const params = (r: number, c: number): Params => ({ C: GRID_C[r], gamma: GRID_G[c] });

  const best = (): { r: number; c: number } | null => {
    let b: { r: number; c: number; v: number } | null = null;
    cells.forEach((row, r) => row.forEach((x, c) => { if (x && (!b || x.cv > b.v + 1e-9)) b = { r, c, v: x.cv }; }));
    return b;
  };
  const preview = (r: number, c: number) => {
    const x = cells[r]?.[c];
    if (!x) return;
    const key = `${r},${c}`;
    if (!modelCache.has(key)) modelCache.set(key, fitModel('ksvm', params(r, c), pts));
    board.setModel(modelCache.get(key)!);
    const gap = Math.round((x.train - x.cv) * 100);
    q('[data-tr]').textContent = pct(x.train); q('[data-cvs]').textContent = pct(x.cv); q('[data-gap]').textContent = `${gap} ${ui.pts}`;
    const v = gap >= 8 ? ui.v_over : x.cv < 0.8 ? ui.v_under : ui.v_good;
    q('[data-verdict]').textContent = `C = ${fmtC(GRID_C[r])}, gamma = ${fmtC(GRID_G[c])}. ${v}`;
    heat.querySelectorAll('.cell').forEach(e => e.classList.toggle('pin', e === cellEl(pinned.r, pinned.c)));
  };
  const paint = () => {
    const done = cells.flat().filter(Boolean) as Array<{ cv: number }>;
    if (!done.length) return;
    const lo = Math.min(...done.map(x => x.cv)), hi = Math.max(...done.map(x => x.cv)), b = best();
    cells.forEach((row, r) => row.forEach((x, c) => {
      const el = cellEl(r, c);
      if (!x) return;
      el.style.setProperty('--w', String(Math.round(((x.cv - lo) / Math.max(hi - lo, 0.01)) * 85)));
      el.querySelector('b')!.textContent = String(Math.round(x.cv * 100));
      el.setAttribute('aria-label', `C ${fmtC(GRID_C[r])}, gamma ${fmtC(GRID_G[c])}: ${pct(x.cv)}`);
      el.classList.toggle('best', !!b && b.r === r && b.c === c);
    }));
  };
  const compute = () => {
    cancel();
    modelCache.clear();
    cells = GRID_C.map(() => GRID_G.map(() => null));
    heat.querySelectorAll<HTMLElement>('.cell').forEach(e => { e.style.removeProperty('--w'); e.classList.remove('best', 'pin'); e.querySelector('b')!.textContent = '…'; });
    const jobs = GRID_C.flatMap((_, r) => GRID_G.map((_, c) => () => { const x = crossValidate('ksvm', params(r, c), pts, K, 3); cells[r][c] = { cv: x.mean, train: x.trainMean }; }));
    const total = jobs.length, bar = q('[data-prog]');
    q('[data-status]').textContent = fill(ui.computing, { n: 0, t: total });
    cancel = runChunked(jobs, n => {
      bar.style.width = `${(n / total) * 100}%`;
      q('[data-status]').textContent = n < total ? fill(ui.computing, { n, t: total }) : fill(ui.grid_done, { k: K });
      paint();
    }, () => {
      const b = best();
      if (b) { pinned = { r: b.r, c: b.c }; preview(b.r, b.c); }
    });
  };
  heat.querySelectorAll<HTMLElement>('.cell').forEach(el => {
    const at = () => [Number(el.dataset.r), Number(el.dataset.c)] as const;
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') preview(...at()); });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') preview(pinned.r, pinned.c); });
    el.addEventListener('focus', () => preview(...at()));
    el.addEventListener('click', () => { const [r, c] = at(); pinned = { r, c }; preview(r, c); });
  });

  // 1-D scans: K-NN's k and the tree's depth
  let which: 'knn' | 'tree' = 'knn';
  const chart = (w: 'knn' | 'tree') => {
    which = w;
    const xs = Array.from({ length: w === 'knn' ? 25 : 12 }, (_, i) => i + 1);
    const res = xs.map(v => crossValidate(w, w === 'knn' ? { k: v } : { depth: v }, pts, K, 3));
    const bestI = res.reduce((b, x, i) => (x.mean > res[b].mean + 1e-9 ? i : b), 0);
    q('[data-chart]').innerHTML = lines(xs, [
      { ys: res.map(x => x.trainMean), color: 'var(--muted)', dash: true, name: ui.line_train },
      { ys: res.map(x => x.mean), color: 'var(--b)', name: ui.line_cv },
    ], { mark: xs[bestI], xlabel: ui['x_' + w] });
    q('[data-chartnote]').textContent = fill(ui.best_at, { x: xs[bestI], s: pct(res[bestI].mean) });
  };
  const chips = q('[data-which]');
  chips.innerHTML = (['knn', 'tree'] as const).map((w, i) => `<button class="chip${i ? '' : ' on'}" data-w="${w}">${ui['chip_' + w]}</button>`).join('');
  chips.querySelectorAll<HTMLElement>('.chip').forEach(b => b.addEventListener('click', () => {
    chips.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    chart(b.dataset.w as 'knn' | 'tree');
  }));
  q('[data-data]').addEventListener('click', () => { pts = makeData('moons', randomSeed(), 0.05); store.points = pts; compute(); chart(which); });
  compute();
  chart('knn');
}

// ---------- 3. gradient boosting ----------

function boost(root: HTMLElement, ui: UI) {
  const MAX = 60;
  const state = { lr: BOOST_DEFAULTS.lr, depth: BOOST_DEFAULTS.depth, round: 1, seed: 8 };
  let pts: Point[] = [], timer = 0;
  const store = { points: pts };
  const load = () => {
    pts = makeData('blobs', state.seed, 0.16);
    const r = rng(state.seed + 5);
    pts.forEach(p => (p.test = r() < 0.3));
    store.points = pts;
  };
  load();
  root.innerHTML = `<div class="dsplit"><div>${frame(400)}<p class="legend"><span class="swatch ring"></span> ${ui.legend_test}</p></div>
    <div class="dside">
      <div class="box scores" aria-live="polite"><div><small>${ui.train}</small><b data-tr>–</b></div><div><small>${ui.test}</small><b data-te>–</b></div></div>
      <label class="box"><span class="label">${ui.round} · <b data-rval></b> / ${MAX}</span><input type="range" min="0" max="${MAX}" step="1" data-round></label>
      <div class="chips"><button class="chip" data-prev>${ui.prev}</button><button class="btn" data-next>${ui.next}</button><button class="chip" data-play>${ui.play}</button></div>
      <label class="box"><span class="label">${ui.lr} · <b data-lval></b></span><input type="range" min="0.05" max="1" step="0.05" value="${state.lr}" data-lr></label>
      <label class="box"><span class="label">${ui.depth} · <b data-dval></b></span><input type="range" min="1" max="5" step="1" value="${state.depth}" data-depth></label>
      <div class="chips"><button class="chip" data-data>${ui.new_data}</button></div>
    </div></div>
    <figure class="sheet pane" style="max-width:560px;margin-top:16px"><figcaption><b>${ui.chart_h}</b></figcaption><div data-chart></div><figcaption data-best aria-live="polite"></figcaption></figure>
    <p class="dnote">${ui.note}</p>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const board = new Board(q<HTMLCanvasElement>('canvas'), store, { static: true, cell: 5 });
  let fit = fitBoost([], { rounds: 1, lr: state.lr, depth: state.depth }), curves = { tr: [] as number[], te: [] as number[], best: 0 };

  const show = () => {
    const r = state.round;
    board.setModel(fit.at(r), true);
    q<HTMLInputElement>('[data-round]').value = String(r);
    q('[data-rval]').textContent = String(r);
    q('[data-tr]').textContent = pct(curves.tr[r]); q('[data-te]').textContent = pct(curves.te[r]);
    q('[data-chart]').innerHTML = lines(curves.tr.map((_, i) => i), [
      { ys: curves.tr, color: 'var(--muted)', dash: true, name: ui.line_train },
      { ys: curves.te, color: 'var(--b)', name: ui.line_test },
    ], { mark: curves.best, cur: r, xlabel: ui.round });
    q('[data-best]').textContent = fill(ui.best_round, { r: curves.best, s: pct(curves.te[curves.best]) });
  };
  const refit = () => {
    const train = pts.filter(p => !p.test), test = pts.filter(p => p.test);
    fit = fitBoost(train, { rounds: MAX, lr: state.lr, depth: state.depth });
    const rs = Array.from({ length: MAX + 1 }, (_, i) => i);
    const tr = rs.map(r => score(fit.at(r), train) ?? 0), te = rs.map(r => score(fit.at(r), test) ?? 0);
    let b = 0;
    te.forEach((v, i) => { if (v > te[b] + 1e-9) b = i; });
    curves = { tr, te, best: b };
    show();
  };
  const stop = () => { clearInterval(timer); timer = 0; q('[data-play]').textContent = ui.play; q('[data-play]').classList.remove('on'); };
  const go = (r: number) => { state.round = Math.max(0, Math.min(MAX, r)); show(); };
  q('[data-round]').addEventListener('input', e => { stop(); go(Number((e.target as HTMLInputElement).value)); });
  q('[data-next]').addEventListener('click', () => { stop(); go(state.round + 1); });
  q('[data-prev]').addEventListener('click', () => { stop(); go(state.round - 1); });
  q('[data-play]').addEventListener('click', () => {
    if (timer) { stop(); return; }
    if (state.round >= MAX) state.round = 0;
    q('[data-play]').textContent = ui.pause; q('[data-play]').classList.add('on');
    timer = window.setInterval(() => { go(state.round + 1); if (state.round >= MAX) stop(); }, reduced() ? 500 : 280);
  });
  q('[data-lr]').addEventListener('input', e => { state.lr = Number((e.target as HTMLInputElement).value); q('[data-lval]').textContent = String(state.lr); refit(); });
  q('[data-depth]').addEventListener('input', e => { state.depth = Number((e.target as HTMLInputElement).value); q('[data-dval]').textContent = String(state.depth); refit(); });
  q('[data-data]').addEventListener('click', () => { stop(); state.seed = randomSeed(); load(); refit(); });
  q('[data-lval]').textContent = String(state.lr); q('[data-dval]').textContent = String(state.depth);
  refit();
}

export function mountSelection() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-demo]')) {
    const ui: UI = JSON.parse(root.dataset.ui ?? '{}');
    const kind = root.dataset.demo;
    if (kind === 'cv') cv(root, ui); else if (kind === 'grid') grid(root, ui); else if (kind === 'boost') boost(root, ui);
  }
}
