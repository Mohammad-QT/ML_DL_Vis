// ML Visual sketch engine: shared dataset store, 7 classifiers in plain JS, a board renderer,
// and the theme/language chrome. Throwaway quality, but the models are real (fit + predict).
(function () {
  // ---------- randomness & data ----------
  function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }

  const PRESETS = {
    blobs(r) { const p = []; for (let i = 0; i < 40; i++) { p.push({ x: .3 + gauss(r) * .11, y: .36 + gauss(r) * .11, c: 0 }); p.push({ x: .68 + gauss(r) * .11, y: .64 + gauss(r) * .11, c: 1 }); } return p; },
    moons(r) { const p = []; for (let i = 0; i < 45; i++) { const t = Math.PI * r(), u = Math.PI * r(); p.push({ x: .36 + .25 * Math.cos(t) + gauss(r) * .035, y: .56 - .3 * Math.sin(t) + gauss(r) * .035, c: 0 }); p.push({ x: .62 - .25 * Math.cos(u) + gauss(r) * .035, y: .42 + .3 * Math.sin(u) + gauss(r) * .035, c: 1 }); } return p; },
    circles(r) { const p = []; for (let i = 0; i < 90; i++) { const t = 2 * Math.PI * r(), inner = i % 2 === 0, rad = (inner ? .13 : .34) + gauss(r) * .035; p.push({ x: .5 + rad * Math.cos(t), y: .5 + rad * Math.sin(t) * 1.15, c: inner ? 1 : 0 }); } return p; },
    xor(r) { const p = []; for (let i = 0; i < 90; i++) { const x = .07 + r() * .86, y = .07 + r() * .86; p.push({ x, y, c: (x > .5) !== (y > .5) ? 1 : 0 }); } return p; },
  };
  const clamp01 = v => Math.min(.985, Math.max(.015, v));

  function Store(opts = {}) {
    const subs = [];
    const s = {
      points: [], testFrac: opts.testFrac ?? .25, presetName: opts.preset || 'blobs',
      subscribe(fn) { subs.push(fn); },
      emit() { subs.forEach(f => f(s)); },
      preset(name, seed) {
        s.presetName = name; const r = rng(seed ?? (Math.random() * 1e9 | 0) + 1);
        s.points = PRESETS[name](r).map(p => ({ x: clamp01(p.x), y: clamp01(p.y), c: p.c, test: false }));
        s.split(r); s.emit();
      },
      split(r = rng(Math.random() * 1e9 | 0)) { s.points.forEach(p => p.test = r() < s.testFrac); },
      resplit() { s.split(); s.emit(); },
      add(x, y, c) { s.points.push({ x, y, c, test: false }); s.emit(); },
      clear() { s.points = []; s.emit(); },
      train() { return s.points.filter(p => !p.test); },
      test() { return s.points.filter(p => p.test); },
    };
    return s;
  }

  // ---------- models: make(params) -> { fit(train), predict(x,y) -> P(class B) } ----------
  const sig = z => 1 / (1 + Math.exp(-z));

  function knn(p) {
    let tr = [];
    const near = (x, y) => tr.map((q, i) => ({ i, d: (q.x - x) ** 2 + (q.y - y) ** 2 })).sort((a, b) => a.d - b.d).slice(0, p.k);
    return {
      fit(t) { tr = t; },
      predict(x, y) { const nb = near(x, y); return nb.reduce((s, n) => s + tr[n.i].c, 0) / Math.max(nb.length, 1); },
      neighbours(x, y) { return near(x, y).map(n => tr[n.i]); },
    };
  }

  function logistic() {
    let w = [0, 0], b = 0, m = [0, 0], sd = [1, 1];
    return {
      fit(t) {
        const n = t.length; ['x', 'y'].forEach((f, j) => { m[j] = t.reduce((s, q) => s + q[f], 0) / n; sd[j] = Math.sqrt(t.reduce((s, q) => s + (q[f] - m[j]) ** 2, 0) / n) || 1; });
        const X = t.map(q => [(q.x - m[0]) / sd[0], (q.y - m[1]) / sd[1]]); w = [0, 0]; b = 0;
        for (let it = 0; it < 400; it++) {
          let g0 = 0, g1 = 0, gb = 0;
          X.forEach((x, i) => { const e = sig(w[0] * x[0] + w[1] * x[1] + b) - t[i].c; g0 += e * x[0]; g1 += e * x[1]; gb += e; });
          w[0] -= (g0 / n + .01 * w[0]); w[1] -= (g1 / n + .01 * w[1]); b -= gb / n;
        }
      },
      predict(x, y) { return sig(w[0] * (x - m[0]) / sd[0] + w[1] * (y - m[1]) / sd[1] + b); },
    };
  }

  function naiveBayes() {
    let st = null;
    return {
      fit(t) {
        st = [0, 1].map(c => {
          const g = t.filter(q => q.c === c), n = g.length || 1;
          const mx = g.reduce((s, q) => s + q.x, 0) / n, my = g.reduce((s, q) => s + q.y, 0) / n;
          return { prior: n / t.length, mx, my, vx: g.reduce((s, q) => s + (q.x - mx) ** 2, 0) / n + 1e-3, vy: g.reduce((s, q) => s + (q.y - my) ** 2, 0) / n + 1e-3 };
        });
      },
      predict(x, y) {
        const ll = st.map(s => Math.log(s.prior) - .5 * (Math.log(s.vx) + Math.log(s.vy)) - (x - s.mx) ** 2 / (2 * s.vx) - (y - s.my) ** 2 / (2 * s.vy));
        return sig(ll[1] - ll[0]);
      },
    };
  }

  function buildTree(pts, depth, maxDepth, pickFeat) {
    const n = pts.length, ones = pts.reduce((s, q) => s + q.c, 0);
    if (depth >= maxDepth || ones === 0 || ones === n || n < 2) return { p: ones / n };
    let best = null;
    for (const f of pickFeat ? [pickFeat()] : ['x', 'y']) {
      const s = pts.slice().sort((a, b) => a[f] - b[f]); let lo = 0;
      for (let i = 1; i < n; i++) {
        lo += s[i - 1].c; if (s[i - 1][f] === s[i][f]) continue;
        const ro = ones - lo, nl = i, nr = n - i;
        const g = nl * (1 - (lo / nl) ** 2 - (1 - lo / nl) ** 2) + nr * (1 - (ro / nr) ** 2 - (1 - ro / nr) ** 2);
        if (!best || g < best.g) best = { g, f, t: (s[i - 1][f] + s[i][f]) / 2 };
      }
    }
    if (!best) return { p: ones / n };
    return { f: best.f, t: best.t, l: buildTree(pts.filter(q => q[best.f] <= best.t), depth + 1, maxDepth, pickFeat), r: buildTree(pts.filter(q => q[best.f] > best.t), depth + 1, maxDepth, pickFeat) };
  }
  const walk = (nd, x, y) => { while (nd.f) nd = (nd.f === 'x' ? x : y) <= nd.t ? nd.l : nd.r; return nd.p; };

  function tree(p) { let root; return { fit(t) { root = buildTree(t, 0, p.depth); }, predict(x, y) { return walk(root, x, y); } }; }
  function forest(p) {
    let trees = [];
    return {
      fit(t) {
        const r = rng(42); trees = [];
        for (let k = 0; k < p.trees; k++) {
          const boot = t.map(() => t[Math.floor(r() * t.length)]);
          trees.push(buildTree(boot, 0, 8, () => (r() < .5 ? 'x' : 'y')));
        }
      },
      predict(x, y) { return trees.reduce((s, nd) => s + walk(nd, x, y), 0) / trees.length; },
    };
  }

  // Simplified SMO (Platt) — fine for a few hundred points. Coordinates mapped to [-1, 1].
  function svm(kernelName, p) {
    const C = kernelName === 'linear' ? Math.pow(10, p.C) : 10, gamma = Math.pow(10, p.gamma ?? 1);
    const K = kernelName === 'linear' ? (a, b) => a[0] * b[0] + a[1] * b[1] : (a, b) => Math.exp(-gamma * ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2));
    const map = (x, y) => [x * 2 - 1, y * 2 - 1];
    let sv = [], b = 0;
    return {
      fit(t) {
        const X = t.map(q => map(q.x, q.y)), Y = t.map(q => q.c ? 1 : -1), n = X.length, r = rng(7);
        const Kc = new Float64Array(n * n); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Kc[i * n + j] = K(X[i], X[j]);
        const a = new Float64Array(n); b = 0; let passes = 0, iter = 0;
        const f = i => { let s = b; for (let j = 0; j < n; j++) if (a[j]) s += a[j] * Y[j] * Kc[j * n + i]; return s; };
        while (passes < 8 && iter++ < 150) {
          let changed = 0;
          for (let i = 0; i < n; i++) {
            const Ei = f(i) - Y[i];
            if (!((Y[i] * Ei < -1e-3 && a[i] < C) || (Y[i] * Ei > 1e-3 && a[i] > 0))) continue;
            let j = Math.floor(r() * (n - 1)); if (j >= i) j++;
            const Ej = f(j) - Y[j], ai = a[i], aj = a[j];
            const L = Y[i] !== Y[j] ? Math.max(0, aj - ai) : Math.max(0, ai + aj - C), H = Y[i] !== Y[j] ? Math.min(C, C + aj - ai) : Math.min(C, ai + aj);
            if (L === H) continue;
            const eta = 2 * Kc[i * n + j] - Kc[i * n + i] - Kc[j * n + j]; if (eta >= 0) continue;
            let nj = Math.min(H, Math.max(L, aj - Y[j] * (Ei - Ej) / eta)); if (Math.abs(nj - aj) < 1e-5) continue;
            const ni = ai + Y[i] * Y[j] * (aj - nj);
            const b1 = b - Ei - Y[i] * (ni - ai) * Kc[i * n + i] - Y[j] * (nj - aj) * Kc[i * n + j];
            const b2 = b - Ej - Y[i] * (ni - ai) * Kc[i * n + j] - Y[j] * (nj - aj) * Kc[j * n + j];
            a[i] = ni; a[j] = nj; b = ni > 0 && ni < C ? b1 : nj > 0 && nj < C ? b2 : (b1 + b2) / 2; changed++;
          }
          passes = changed ? 0 : passes + 1;
        }
        sv = []; for (let i = 0; i < n; i++) if (a[i] > 1e-6) sv.push({ x: X[i], w: a[i] * Y[i] });
      },
      predict(x, y) { const q = map(x, y); let s = b; for (const v of sv) s += v.w * K(v.x, q); return sig(2.5 * s); },
    };
  }

  const MODELS = {
    knn:      { make: knn, params: { k: { min: 1, max: 25, step: 1, def: 5 } } },
    logistic: { make: logistic, params: {} },
    svm:      { make: p => svm('linear', p), params: { C: { min: -1, max: 3, step: .1, def: 1, log: true } } },
    ksvm:     { make: p => svm('rbf', p), params: { gamma: { min: 0, max: 2.3, step: .05, def: 1.2, log: true } } },
    nb:       { make: naiveBayes, params: {} },
    tree:     { make: tree, params: { depth: { min: 1, max: 12, step: 1, def: 4 } } },
    forest:   { make: forest, params: { trees: { min: 1, max: 40, step: 1, def: 10 } } },
  };
  const defaults = name => Object.fromEntries(Object.entries(MODELS[name].params).map(([k, v]) => [k, v.def]));

  // Fit a model on the store's training points. Fewer than 2 classes -> a constant guess.
  function fitModel(name, params, train) {
    const has = new Set(train.map(p => p.c));
    if (has.size < 2) { const c = has.size ? [...has][0] : .5; return { predict: () => c, constant: true }; }
    const m = MODELS[name].make({ ...defaults(name), ...params }); m.fit(train); return m;
  }
  function score(model, pts) { if (!pts.length) return null; let ok = 0; pts.forEach(p => { if ((model.predict(p.x, p.y) > .5 ? 1 : 0) === p.c) ok++; }); return ok / pts.length; }

  // ---------- theme colours from CSS variables ----------
  function cssColor(name) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const c = document.createElement('canvas').getContext('2d'); c.fillStyle = v; const h = c.fillStyle;
    if (h[0] === '#') return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const m = h.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  }
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // ---------- board: draws a fitted model + the store's points ----------
  function Board(canvas, store, opts = {}) {
    const ctx = canvas.getContext('2d'), field = document.createElement('canvas'), prev = document.createElement('canvas');
    let W = 0, H = 0, dpr = 1, model = null, ghost = null, fade = 1, colors;
    const cell = opts.cell || 5;
    function readColors() { colors = { a: cssColor('--a'), b: cssColor('--b'), sheet: cssColor('--sheet'), ink: cssColor('--ink'), grid: cssColor('--muted') }; }

    function renderField() {
      field.width = W * dpr; field.height = H * dpr;
      const f = field.getContext('2d'); f.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.fillStyle = rgb(colors.sheet); f.fillRect(0, 0, W, H);
      f.strokeStyle = rgb(colors.grid, .12); f.lineWidth = 1; f.beginPath();
      for (let i = 1; i < 10; i++) { f.moveTo(i * W / 10 + .5, 0); f.lineTo(i * W / 10 + .5, H); f.moveTo(0, i * H / 10 + .5); f.lineTo(W, i * H / 10 + .5); }
      f.stroke();
      if (!model) return;
      // sample P(class B) on grid corners, shade each cell by the mean, then trace the 0.5 contour
      const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), C1 = cols + 1, v = new Float32Array(C1 * (rows + 1));
      for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) v[r * C1 + q] = model.predict(q * cell / W, r * cell / H);
      const tint = opts.tint ?? .2;
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const p = (v[r * C1 + q] + v[r * C1 + q + 1] + v[(r + 1) * C1 + q] + v[(r + 1) * C1 + q + 1]) / 4;
        f.fillStyle = rgb(p > .5 ? colors.b : colors.a, tint * (.35 + 1.3 * Math.abs(p - .5)));
        f.fillRect(q * cell, r * cell, cell, cell);
      }
      if (model.constant) return;
      // the line itself (marching squares with linear interpolation, so it stays smooth)
      f.strokeStyle = rgb(colors.ink, .78); f.lineWidth = opts.line || 1.8; f.lineCap = 'round'; f.lineJoin = 'round'; f.beginPath();
      const lerp = (a, b) => (.5 - a) / (b - a);
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const tl = v[r * C1 + q], tr = v[r * C1 + q + 1], br = v[(r + 1) * C1 + q + 1], bl = v[(r + 1) * C1 + q];
        const x0 = q * cell, y0 = r * cell, pts = [];
        if ((tl > .5) !== (tr > .5)) pts.push([x0 + lerp(tl, tr) * cell, y0]);
        if ((tr > .5) !== (br > .5)) pts.push([x0 + cell, y0 + lerp(tr, br) * cell]);
        if ((bl > .5) !== (br > .5)) pts.push([x0 + lerp(bl, br) * cell, y0 + cell]);
        if ((tl > .5) !== (bl > .5)) pts.push([x0, y0 + lerp(tl, bl) * cell]);
        for (let i = 0; i + 1 < pts.length; i += 2) { f.moveTo(pts[i][0], pts[i][1]); f.lineTo(pts[i + 1][0], pts[i + 1][1]); }
      }
      f.stroke();
    }
    function draw() {
      if (!W) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (fade < 1 && prev.width) { ctx.drawImage(prev, 0, 0); ctx.globalAlpha = fade; }
      ctx.drawImage(field, 0, 0); ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = opts.dot || 5;
      if (ghost && model && model.neighbours && !opts.static) {
        ctx.lineWidth = 1.4;
        model.neighbours(ghost.x, ghost.y).forEach(p => { ctx.strokeStyle = rgb(p.c ? colors.b : colors.a, .6); ctx.beginPath(); ctx.moveTo(ghost.x * W, ghost.y * H); ctx.lineTo(p.x * W, p.y * H); ctx.stroke(); });
      }
      for (const p of store.points) {
        const col = p.c ? colors.b : colors.a;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.test ? R - .5 : R, 0, 7);
        if (p.test) { ctx.fillStyle = rgb(colors.sheet); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = rgb(col); ctx.stroke(); }
        else { ctx.fillStyle = rgb(col); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgb(colors.sheet); ctx.stroke(); }
      }
      if (ghost && model && !opts.static) {
        const c = model.predict(ghost.x, ghost.y) > .5;
        ctx.beginPath(); ctx.arc(ghost.x * W, ghost.y * H, 9, 0, 7); ctx.setLineDash([3, 3]); ctx.lineWidth = 2;
        ctx.strokeStyle = rgb(c ? colors.b : colors.a); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    function resize() {
      dpr = window.devicePixelRatio || 1; W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = W * dpr; canvas.height = H * dpr; readColors(); renderField(); draw();
    }
    const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    if (!opts.static) {
      canvas.addEventListener('click', e => { const p = pos(e); opts.onAdd && opts.onAdd(p, e); });
      canvas.addEventListener('mousemove', e => { ghost = pos(e); draw(); opts.onHover && opts.onHover(ghost); });
      canvas.addEventListener('mouseleave', () => { ghost = null; draw(); opts.onHover && opts.onHover(null); });
    }
    new ResizeObserver(resize).observe(canvas);
    addEventListener('themechange', () => { if (W) { readColors(); renderField(); draw(); } });

    return {
      setModel(m, animate) {
        if (animate && W && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          prev.width = field.width; prev.height = field.height; prev.getContext('2d').drawImage(field, 0, 0);
          model = m; renderField(); fade = 0;
          const t0 = performance.now(); (function step(t) { fade = Math.min(1, (t - t0) / 650); draw(); if (fade < 1) requestAnimationFrame(step); })(t0);
        } else { model = m; if (W) { renderField(); draw(); } }
      },
      setGhost(g) { ghost = g; draw(); },
      get model() { return model; },
    };
  }

  // ---------- chrome: theme + language ----------
  function setLang(dict, lang) {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => { const t = dict[lang][el.dataset.i18n]; if (t !== undefined) el.innerHTML = t; });
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  }
  function initChrome(dict, onLang) {
    const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
    let lang = store('mlv-lang') || 'en';
    document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next; store('mlv-theme', next); dispatchEvent(new Event('themechange'));
    }));
    document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; store('mlv-lang', lang); setLang(dict, lang); onLang && onLang(lang); }));
    document.querySelectorAll('a[href="#colab"]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); const t = document.getElementById('toast'); if (!t) return; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200);
    }));
    setLang(dict, lang); onLang && onLang(lang);
    return { get lang() { return lang; }, t: k => dict[lang][k] };
  }

  window.MLV = { Store, MODELS, defaults, fitModel, score, Board, initChrome, setLang, rng };
})();
