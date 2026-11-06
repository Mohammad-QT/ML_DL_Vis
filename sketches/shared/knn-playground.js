// Throwaway sketch helper: a tiny in-browser K-NN playground + EN/AR toggle.
// Shared by the three design variants so they differ only in design, not behaviour.
(function () {
  const PRESETS = {
    blobs(rand) {
      const p = [];
      for (let i = 0; i < 30; i++) p.push({ x: 0.3 + gauss(rand) * 0.1, y: 0.35 + gauss(rand) * 0.1, c: 0 });
      for (let i = 0; i < 30; i++) p.push({ x: 0.68 + gauss(rand) * 0.1, y: 0.65 + gauss(rand) * 0.1, c: 1 });
      return p;
    },
    moons(rand) {
      const p = [];
      for (let i = 0; i < 35; i++) {
        const t = Math.PI * rand();
        p.push({ x: 0.35 + 0.25 * Math.cos(t) + gauss(rand) * 0.03, y: 0.55 - 0.3 * Math.sin(t) + gauss(rand) * 0.03, c: 0 });
        const u = Math.PI * rand();
        p.push({ x: 0.6 - 0.25 * Math.cos(u) + gauss(rand) * 0.03, y: 0.42 + 0.3 * Math.sin(u) + gauss(rand) * 0.03, c: 1 });
      }
      return p;
    },
    circles(rand) {
      const p = [];
      for (let i = 0; i < 70; i++) {
        const t = 2 * Math.PI * rand(), inner = i % 2 === 0, r = (inner ? 0.12 : 0.34) + gauss(rand) * 0.03;
        p.push({ x: 0.5 + r * Math.cos(t), y: 0.5 + r * Math.sin(t) * 1.2, c: inner ? 1 : 0 });
      }
      return p;
    },
    xor(rand) {
      const p = [];
      for (let i = 0; i < 70; i++) {
        const x = 0.08 + rand() * 0.84, y = 0.08 + rand() * 0.84;
        p.push({ x, y, c: (x > 0.5) !== (y > 0.5) ? 1 : 0 });
      }
      return p;
    },
  };

  function gauss(rand) { return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand()); }
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

  window.KNNPlayground = function (opts) {
    const canvas = opts.canvas, ctx = canvas.getContext('2d');
    const colors = opts.colors || [[37, 99, 235], [220, 38, 38]];
    const bg = opts.background || '#ffffff';
    const tint = opts.tint ?? 0.16;
    let points = PRESETS.blobs(rng(7));
    let k = opts.k || 5, cls = 0, hover = null, W = 0, H = 0, dpr = 1;
    const field = document.createElement('canvas');

    function neighbours(x, y, skip) {
      const d = [];
      for (let i = 0; i < points.length; i++) {
        if (i === skip) continue;
        const p = points[i];
        d.push({ i, d: (p.x - x) ** 2 + (p.y - y) ** 2 });
      }
      d.sort((a, b) => a.d - b.d);
      return d.slice(0, k);
    }
    function vote(nb) {
      let ones = 0;
      for (const n of nb) ones += points[n.i].c;
      return { c: ones * 2 > nb.length ? 1 : 0, conf: Math.max(ones, nb.length - ones) / Math.max(nb.length, 1) };
    }
    function accuracy() { // leave-one-out: each point is judged by its neighbours, not itself
      if (points.length <= k) return null;
      let ok = 0;
      points.forEach((p, i) => { if (vote(neighbours(p.x, p.y, i)).c === p.c) ok++; });
      return ok / points.length;
    }

    function renderField() {
      const cell = 5, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
      field.width = W * dpr; field.height = H * dpr;
      const f = field.getContext('2d');
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.fillStyle = bg; f.fillRect(0, 0, W, H);
      if (!points.length) return;
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const v = vote(neighbours((q + 0.5) * cell / W, (r + 0.5) * cell / H));
        const [R, G, B] = colors[v.c];
        f.fillStyle = `rgba(${R},${G},${B},${tint * (0.4 + 0.6 * v.conf)})`;
        f.fillRect(q * cell, r * cell, cell, cell);
      }
    }
    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(field, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (hover && points.length) {
        const nb = neighbours(hover.x, hover.y);
        ctx.lineWidth = 1.5;
        for (const n of nb) {
          const p = points[n.i];
          ctx.strokeStyle = `rgba(${colors[p.c].join(',')},0.55)`;
          ctx.beginPath(); ctx.moveTo(hover.x * W, hover.y * H); ctx.lineTo(p.x * W, p.y * H); ctx.stroke();
        }
      }
      for (const p of points) {
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 5.5, 0, 7);
        ctx.fillStyle = `rgb(${colors[p.c].join(',')})`; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = bg; ctx.stroke();
      }
      if (hover && points.length) {
        const v = vote(neighbours(hover.x, hover.y));
        ctx.beginPath(); ctx.arc(hover.x * W, hover.y * H, 8, 0, 7);
        ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeStyle = `rgb(${colors[v.c].join(',')})`; ctx.stroke(); ctx.setLineDash([]);
      }
    }
    function update() {
      if (W && H) { renderField(); draw(); }
      opts.onUpdate && opts.onUpdate({ k, n: points.length, accuracy: accuracy(), cls });
    }
    function resize() {
      dpr = window.devicePixelRatio || 1;
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      update();
    }
    function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }

    canvas.addEventListener('click', e => { const p = pos(e); points.push({ ...p, c: e.shiftKey ? 1 - cls : cls }); update(); });
    canvas.addEventListener('mousemove', e => {
      hover = pos(e); if (W && H) draw();
      if (opts.onHover && points.length) { const v = vote(neighbours(hover.x, hover.y)); opts.onHover(v); }
    });
    canvas.addEventListener('mouseleave', () => { hover = null; if (W && H) draw(); opts.onHover && opts.onHover(null); });
    new ResizeObserver(resize).observe(canvas);

    return {
      setK(v) { k = +v; update(); },
      setClass(c) { cls = c; update(); },
      preset(name) { points = PRESETS[name](rng(Math.floor(Math.random() * 1e6) + 1)); update(); },
      clear() { points = []; update(); },
    };
  };

  // Minimal EN/AR switcher: elements carry data-i18n="key"; dict = { en: {...}, ar: {...} }.
  window.setLang = function (dict, lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const t = dict[lang][el.dataset.i18n];
      if (t !== undefined) el.innerHTML = t;
    });
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  };
})();
