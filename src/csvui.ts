import { buildDataset, CsvError, describeColumns, detectTask, loadTable, type ColumnInfo, type Dataset, type Features, type Table } from './engine';

const MAX_BYTES = 5 * 1024 * 1024;
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ''));

/**
 * Wires up the CSV upload panel (markup in `CsvUpload.astro`). The file is read with FileReader and never leaves the browser.
 * `onData` gets the scaled dataset, or null when there is nothing valid to show.
 */
export function mountCsv(root: HTMLElement, S: Record<string, string>, onData: (d: Dataset | null) => void) {
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const file = $<HTMLInputElement>('input[type=file]'), fields = $<HTMLElement>('.csv-fields'), msg = $<HTMLElement>('.csv-msg'), err = $<HTMLElement>('.csv-err');
  const sel = { t: $<HTMLSelectElement>('.csv-t'), f1: $<HTMLSelectElement>('.csv-f1'), f2: $<HTMLSelectElement>('.csv-f2') };
  const pcaBox = $<HTMLInputElement>('.csv-pca'), name = $<HTMLElement>('.csv-name'), task = $<HTMLElement>('.csv-task');
  let table: Table | null = null, cols: ColumnInfo[] = [];

  const showError = (e: unknown) => {
    const code = e instanceof CsvError ? e.code : 'other';
    err.textContent = fill(S[`e_${code}`] ?? S.e_other, e instanceof CsvError ? e.params : {});
    err.hidden = false; msg.hidden = true; onData(null);
  };
  const opts = (idx: number[]) => idx.map(i => `<option value="${i}">${cols[i].name.replace(/[<&"]/g, c => `&#${c.charCodeAt(0)};`)}</option>`).join('');

  /** Offer every column as the target and the numeric ones (except the target) as features. */
  function populate(keepTarget?: number) {
    const all = cols.map((_, i) => i);
    const t = keepTarget ?? all[all.length - 1];
    sel.t.innerHTML = opts(all); sel.t.value = String(t);
    const nums = all.filter(i => cols[i].numeric && i !== t);
    const prev = [sel.f1.value, sel.f2.value];
    for (const s of [sel.f1, sel.f2]) s.innerHTML = opts(nums);
    sel.f1.value = nums.map(String).includes(prev[0]) ? prev[0] : String(nums[0] ?? '');
    sel.f2.value = nums.map(String).includes(prev[1]) && prev[1] !== sel.f1.value ? prev[1] : String(nums.find(i => String(i) !== sel.f1.value) ?? '');
    return nums.length;
  }

  function run() {
    if (!table) return;
    err.hidden = true;
    const t = Number(sel.t.value), usePca = pcaBox.checked;
    sel.f1.disabled = sel.f2.disabled = usePca;
    const kind = detectTask(cols[t]);
    task.textContent = kind === 'reg' ? S.c_task_reg : S.c_task_cls;
    const nums = cols.filter((c, i) => c.numeric && i !== t).length;
    if (nums < 2) return showError(new CsvError('few_numeric', { n: nums }));
    const features: Features = usePca ? 'pca' : { cols: [Number(sel.f1.value), Number(sel.f2.value)] };
    try {
      const d = buildDataset(table, t, features);
      const i = d.info, lines: string[] = [];
      lines.push(d.task === 'cls' ? fill(S.c_cls, { a: d.classes![0], b: d.classes![1], t: cols[t].name }) : fill(S.c_reg, { t: cols[t].name }));
      lines.push(fill(S.c_used, { n: i.used, m: i.read }));
      if (i.droppedMissing) lines.push(fill(S.c_dropped_missing, { n: i.droppedMissing }));
      if (i.droppedRagged) lines.push(fill(S.c_dropped_ragged, { n: i.droppedRagged }));
      if (i.droppedClasses) lines.push(fill(S.c_dropped_classes, { n: i.droppedClasses }));
      if (i.sampledFrom) lines.push(fill(S.c_sampled, { n: i.used, m: i.sampledFrom }));
      if (i.pcaExplained) lines.push(fill(S.c_pca_explained, { p: Math.round((i.pcaExplained[0] + (i.pcaExplained[1] ?? 0)) * 100) }));
      if (d.task === 'reg') lines.push(fill(S.c_reg_axes, { x: d.axes[0], y: cols[t].name }) + (i.pcaNote ? ' ' + fill(S.c_reg_note, { f: d.axes[0] }) : ''));
      else lines.push(fill(S.c_axes, { x: d.axes[0], y: d.axes[1] }));
      lines.push(S.c_scaled);
      msg.innerHTML = lines.map(l => `<li></li>`).join('');
      msg.querySelectorAll('li').forEach((li, k) => (li.textContent = lines[k]));
      msg.hidden = false;
      onData(d);
    } catch (e) { showError(e); }
  }

  async function read(f: File) {
    err.hidden = true;
    try {
      if (f.size > MAX_BYTES) throw new CsvError('big', { mb: Math.round(f.size / 1048576) });
      if (!f.size) throw new CsvError('empty');
      table = loadTable(await f.text());
    } catch (e) { table = null; fields.hidden = true; return showError(e); }
    cols = describeColumns(table);
    name.textContent = f.name;
    fields.hidden = false;
    populate();
    run();
  }

  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) read(f); file.value = ''; });
  sel.t.addEventListener('change', () => { populate(Number(sel.t.value)); run(); });
  sel.f1.addEventListener('change', run); sel.f2.addEventListener('change', run); pcaBox.addEventListener('change', run);

  /** Load a sample file from the site (same origin, so it is fetched like any asset). */
  root.querySelectorAll<HTMLAnchorElement>('[data-sample]').forEach(a => a.addEventListener('click', async ev => {
    ev.preventDefault();
    try { const r = await fetch(a.href); read(new File([await r.text()], a.dataset.sample!)); } catch { showError(new CsvError('other')); }
  }));

  return { reset() { fields.hidden = true; msg.hidden = true; err.hidden = true; table = null; } };
}
