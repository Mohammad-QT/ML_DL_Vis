// Paints progress into server-rendered markup. Hooks are plain data attributes so any page can use them:
//   [data-lesson="3/knn"]            gets data-state="none|started|done"; a [data-st] child gets the state in words
//   [data-count][data-keys][data-tpl] text like "3 of 7" (tpl uses {d} and {n})
//   [data-bar][data-keys]            width = share of those lessons that are done
import { countDone, lessonState, load, type Progress } from './progress';

export const PROGRESS_EVENT = 'mlv:progress';

const keysOf = (el: HTMLElement) => (el.dataset.keys ?? '').split(',').filter(Boolean);

export function paint(p: Progress = load(), root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-lesson]').forEach(el => {
    const st = lessonState(p, el.dataset.lesson!);
    el.dataset.state = st;
    const sr = el.querySelector<HTMLElement>('[data-st]');
    const words = el.closest<HTMLElement>('[data-st-none]')?.dataset;
    if (sr && words) sr.textContent = words[`st${st[0].toUpperCase()}${st.slice(1)}`] ?? '';
  });
  root.querySelectorAll<HTMLElement>('[data-count]').forEach(el => {
    const keys = keysOf(el);
    el.textContent = (el.dataset.tpl ?? '{d}/{n}').replace('{d}', String(countDone(p, keys))).replace('{n}', String(keys.length));
  });
  root.querySelectorAll<HTMLElement>('[data-bar]').forEach(el => {
    const keys = keysOf(el);
    el.style.width = `${keys.length ? (countDone(p, keys) / keys.length) * 100 : 0}%`;
  });
}

/** Repaint when progress changes on this page or in another tab. */
export function watch(cb: () => void = () => paint()) {
  addEventListener(PROGRESS_EVENT, cb);
  addEventListener('storage', e => { if (!e.key || e.key === 'mlv-progress') cb(); });
  addEventListener('pageshow', e => { if (e.persisted) cb(); }); // back/forward cache
}

export const changed = () => dispatchEvent(new Event(PROGRESS_EVENT));
