// The four Part 1 interactives, built from plain DOM and SVG. Each reads its words from `ui` (lesson front matter).
import { randomSeed } from '../engine/random';
import { AGE_SALARY, PEOPLE, SPLIT_POINTS } from './data';
import { columnMean, impute, labelEncode, nearest, oneHot, shuffleSplit, standardize, type Cell } from './logic';

type UI = Record<string, string>;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
const num = (v: Cell, digits = 0) => (v == null ? '' : v.toLocaleString('en-US', { maximumFractionDigits: digits }));

/** Row of toggle chips; calls `on(value)` and marks the active one. */
function chips(host: HTMLElement, items: Array<[string, string]>, on: (v: string) => void, start = items[0][0]) {
  host.innerHTML = items.map(([v, label]) => `<button class="chip${v === start ? ' on' : ''}" data-v="${v}">${label}</button>`).join('');
  host.querySelectorAll<HTMLElement>('.chip').forEach(b => b.addEventListener('click', () => {
    host.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    on(b.dataset.v!);
  }));
}

function missing(root: HTMLElement, ui: UI) {
  const raw: Cell[][] = PEOPLE.map(p => [p.age, p.salary]);
  root.innerHTML = `<div class="chips" data-chips></div><div class="dwrap"><table class="dt"><thead><tr><th>${ui.col_country}</th><th>${ui.col_age}</th><th>${ui.col_salary}</th></tr></thead><tbody data-body></tbody></table>
    <div class="dstats"><div class="stat"><small>${ui.rows}</small><b data-rows></b></div><div class="stat"><small>${ui.mean_age}</small><b data-ma></b></div><div class="stat"><small>${ui.mean_salary}</small><b data-ms></b></div></div></div><p class="dnote" data-note></p>`;
  const q = (s: string) => root.querySelector<HTMLElement>(s)!;
  const draw = (mode: string) => {
    const r = mode === 'none' ? { table: raw, keep: raw.map(() => true), filled: raw.map(() => [false, false]) } : impute(raw, mode as never);
    q('[data-body]').innerHTML = PEOPLE.map((p, i) => {
      const cell = (j: number) => r.table[i][j] == null ? `<td class="blank">${ui.blank}</td>` : `<td class="${r.filled[i][j] ? 'fill' : ''}">${num(r.table[i][j], j === 0 ? 1 : 0)}</td>`;
      return `<tr class="${r.keep[i] ? '' : 'gone'}"><td>${ui['c_' + p.country] ?? p.country}</td>${cell(0)}${cell(1)}</tr>`;
    }).join('');
    q('[data-rows]').textContent = `${r.keep.filter(Boolean).length} / ${raw.length}`;
    q('[data-ma]').textContent = num(columnMean(r.table, r.keep, 0), 1);
    q('[data-ms]').textContent = num(columnMean(r.table, r.keep, 1));
    q('[data-note]').textContent = ui['note_' + mode];
  };
  chips(q('[data-chips]'), [['none', ui.none], ['drop', ui.drop], ['mean', ui.mean], ['median', ui.median]], draw);
  draw('none');
}

function categories(root: HTMLElement, ui: UI) {
  const countries = PEOPLE.map(p => p.country);
  root.innerHTML = `<div class="chips" data-chips></div><div class="dwrap"><table class="dt"><thead data-head></thead><tbody data-body></tbody></table><div class="dstats" data-order></div></div><p class="dnote" data-note></p>`;
  const q = (s: string) => root.querySelector<HTMLElement>(s)!;
  const name = (c: string) => ui['c_' + c] ?? c;
  const draw = (mode: string) => {
    if (mode === 'label') {
      const { classes, codes } = labelEncode(countries);
      q('[data-head]').innerHTML = `<tr><th>${ui.col_country}</th><th>${ui.col_code}</th></tr>`;
      q('[data-body]').innerHTML = countries.map((c, i) => `<tr><td>${name(c)}</td><td class="fill">${codes[i]}</td></tr>`).join('');
      q('[data-order]').innerHTML = `<div class="stat"><small>${ui.order}</small><b class="ord">${classes.map((c, i) => `${name(c)} = ${i}`).join('<br>')}</b></div>`;
    } else {
      const { classes, rows } = oneHot(countries);
      q('[data-head]').innerHTML = `<tr><th>${ui.col_country}</th>${classes.map(c => `<th>${name(c)}</th>`).join('')}</tr>`;
      q('[data-body]').innerHTML = countries.map((c, i) => `<tr><td>${name(c)}</td>${rows[i].map(v => `<td class="${v ? 'fill' : 'zero'}">${v}</td>`).join('')}</tr>`).join('');
      q('[data-order]').innerHTML = `<div class="stat"><small>${ui.order}</small><b class="ord">${ui.no_order}</b></div>`;
    }
    q('[data-note]').textContent = ui['note_' + mode];
  };
  chips(q('[data-chips]'), [['label', ui.label], ['onehot', ui.onehot]], draw);
  draw('label');
}

const color = (c: number) => (c ? 'var(--b)' : 'var(--a)');

function split(root: HTMLElement, ui: UI) {
  root.innerHTML = `<div class="dsplit"><svg class="plot" viewBox="0 0 400 300" role="img" aria-label="${ui.alt}"></svg><div class="dside">
    <label class="box"><span class="label">${ui.share} · <b data-pct></b></span><input type="range" min="10" max="50" step="5" value="25" data-share></label>
    <div class="box dstats"><div class="stat"><small>${ui.train}</small><b data-ntrain></b></div><div class="stat"><small>${ui.test}</small><b data-ntest></b></div></div>
    <div class="box"><span class="label"><code>random_state</code></span><input class="num" type="number" min="0" max="9999" step="1" data-seed><button class="chip" data-shuffle>${ui.shuffle}</button></div>
    <p class="legend"><span class="swatch a"></span><span class="swatch b"></span>${ui.legend} <span class="swatch ring"></span>${ui.legend_test}</p></div></div>`;
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const svg = q<HTMLElement>('svg.plot') as unknown as SVGSVGElement;
  const share = q<HTMLInputElement>('[data-share]'), seed = q<HTMLInputElement>('[data-seed]');
  seed.value = '42';
  const draw = () => {
    const frac = Number(share.value) / 100, s = Math.max(0, Math.floor(Number(seed.value) || 0));
    const { test } = shuffleSplit(SPLIT_POINTS.length, frac, s + 1);
    const isTest = new Set(test);
    svg.innerHTML = SPLIT_POINTS.map(([x, y, c], i) => {
      const cx = (x * 400).toFixed(1), cy = (y * 300).toFixed(1);
      return `<circle cx="${cx}" cy="${cy}" r="6" fill="${color(c)}"/>` + (isTest.has(i) ? `<circle cx="${cx}" cy="${cy}" r="10.5" fill="none" stroke="var(--ink)" stroke-width="2"/>` : '');
    }).join('');
    q('[data-pct]').textContent = `${share.value}%`;
    q('[data-ntrain]').textContent = String(SPLIT_POINTS.length - test.length);
    q('[data-ntest]').textContent = String(test.length);
  };
  share.addEventListener('input', draw);
  seed.addEventListener('input', draw);
  q('[data-shuffle]').addEventListener('click', () => { seed.value = String(randomSeed() % 10000); draw(); });
  draw();
}

function scaling(root: HTMLElement, ui: UI) {
  const raw = AGE_SALARY;
  const zs = standardize(raw.map(p => p[0])).values, zy = standardize(raw.map(p => p[1])).values;
  const scaled = zs.map((v, i) => [v, zy[i]]);
  // start on a person whose nearest neighbour changes with scaling, so the first view already shows the point
  let sel = Math.max(0, raw.findIndex((_, i) => nearest(raw, i) !== nearest(scaled, i)));
  const ext = (pts: number[][], k: number) => [Math.min(...pts.map(p => p[k])), Math.max(...pts.map(p => p[k]))];
  const W = 300, H = 240, pad = 18;
  const view = (title: string, cap: string, key: string) => `<figure class="sheet pane"><figcaption><b>${title}</b><span>${cap}</span></figcaption><svg class="plot" viewBox="0 0 ${W} ${H}" data-${key}></svg></figure>`;
  const [a0, a1] = ext(raw, 0), [s0, s1] = ext(raw, 1);
  root.innerHTML = `<div class="dscale">${view(ui.raw, `${ui.age} ${a0}–${a1} · ${ui.salary} ${num(s0)}–${num(s1)}`, 'raw')}${view(ui.scaled, ui.scaled_cap, 'scaled')}</div><div class="dreadout" data-out></div>`;
  const q = (s: string) => root.querySelector<HTMLElement>(s)!;
  const paint = (key: string, pts: number[][]) => {
    const svg = q(`[data-${key}]`);
    const [x0, x1] = ext(pts, 0), [y0, y1] = ext(pts, 1);
    const px = (p: number[]) => pad + ((p[0] - x0) / (x1 - x0)) * (W - 2 * pad);
    const py = (p: number[]) => H - pad - ((p[1] - y0) / (y1 - y0)) * (H - 2 * pad);
    const nn = nearest(pts, sel);
    svg.innerHTML = `<line x1="${px(pts[sel])}" y1="${py(pts[sel])}" x2="${px(pts[nn])}" y2="${py(pts[nn])}" stroke="var(--ok)" stroke-width="2.5" stroke-dasharray="5 4"/>` +
      pts.map((p, i) => {
        const cx = px(p).toFixed(1), cy = py(p).toFixed(1), me = i === sel, near = i === nn;
        return `<g data-i="${i}" class="pt"><circle cx="${cx}" cy="${cy}" r="14" fill="transparent"/><circle cx="${cx}" cy="${cy}" r="${me || near ? 7 : 5}" fill="${me ? 'var(--ink)' : near ? 'var(--ok)' : 'var(--muted)'}"/></g>`;
      }).join('');
    return nn;
  };
  const draw = () => {
    const n1 = paint('raw', raw), n2 = paint('scaled', scaled);
    const p = raw[sel], d = (j: number) => Math.abs(raw[j][0] - p[0]);
    const line = (j: number, key: string) => fill(ui[key], { age: raw[j][0], salary: num(raw[j][1]), da: d(j), ds: num(Math.abs(raw[j][1] - p[1])) });
    q('[data-out]').innerHTML = `<p><b>${fill(ui.you, { age: p[0], salary: num(p[1]) })}</b></p><p>${line(n1, 'raw_line')}</p><p>${line(n2, 'scaled_line')}</p>` +
      `<p class="verdict ${n1 === n2 ? '' : 'diff'}">${n1 === n2 ? ui.same : ui.differs}</p>`;
  };
  root.addEventListener('click', e => {
    const g = (e.target as Element).closest<SVGElement>('g.pt');
    if (g) { sel = Number(g.dataset.i); draw(); }
  });
  draw();
}

const DEMOS: Record<string, (root: HTMLElement, ui: UI) => void> = { missing, categories, split, scaling };

export function mountDemos() {
  document.querySelectorAll<HTMLElement>('[data-demo]').forEach(el => DEMOS[el.dataset.demo!]?.(el, JSON.parse(el.dataset.ui!)));
}
