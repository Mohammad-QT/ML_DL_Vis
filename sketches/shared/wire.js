// Connects the shared playground + copy to whatever DOM a sketch provides (ids/data-attrs below).
window.wireLesson = function (opts = {}) {
  const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
  let lang = 'en';
  const t = key => LESSON[lang][key];
  const kHint = () => { const k = +$('#k').value; const el = $('#khint'); if (el) el.innerHTML = k <= 3 ? t('k_small') : k >= 15 ? t('k_big') : '&nbsp;'; };

  const pg = KNNPlayground({
    canvas: $('#board'),
    colors: opts.colors, background: opts.background, tint: opts.tint, k: 5,
    onUpdate(s) {
      $('#kval').textContent = s.k;
      $('#acc').textContent = s.accuracy == null ? '–' : Math.round(s.accuracy * 100) + '%';
      $('#npts').textContent = s.n;
      opts.onUpdate && opts.onUpdate(s);
    },
    onHover(v) {
      const el = $('#hover'); if (!el) return;
      el.innerHTML = v ? `${t('hover_pred')}: <b class="c${v.c}">${t(v.c ? 'cls_b' : 'cls_a')}</b> · ${Math.round(v.conf * 100)}%` : '&nbsp;';
    },
  });

  $('#k').addEventListener('input', e => { pg.setK(e.target.value); kHint(); });
  $$('[data-cls]').forEach(b => b.addEventListener('click', () => {
    pg.setClass(+b.dataset.cls); $$('[data-cls]').forEach(x => x.classList.toggle('on', x === b));
  }));
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
    pg.preset(b.dataset.preset); $$('[data-preset]').forEach(x => x.classList.toggle('on', x === b));
  }));
  $('#clear').addEventListener('click', () => { pg.clear(); $$('[data-preset]').forEach(x => x.classList.remove('on')); });

  $$('[data-ans]').forEach(b => b.addEventListener('click', () => {
    const ok = b.dataset.ans === 'a1';
    $$('[data-ans]').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    const fb = $('#feedback'); fb.dataset.key = ok ? 'right' : 'wrong'; fb.innerHTML = t(fb.dataset.key); fb.className = ok ? 'fb right' : 'fb wrong';
    opts.onAnswer && opts.onAnswer(ok);
  }));

  $$('[data-lang]').forEach(b => b.addEventListener('click', () => {
    lang = b.dataset.lang; setLang(LESSON, lang); kHint();
    const fb = $('#feedback'); if (fb.dataset.key) fb.innerHTML = t(fb.dataset.key);
  }));
  $$('a[href="#colab"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); const toast = $('#toast'); if (!toast) return;
    toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200);
  }));
  setLang(LESSON, 'en'); kHint();
  return pg;
};
