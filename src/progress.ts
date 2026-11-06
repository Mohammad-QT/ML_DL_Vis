// Course progress, kept in the learner's browser only. Pure functions plus thin storage helpers:
// every storage access sits in try/catch so the site works when storage is blocked or full.

export const PROGRESS_KEY = 'mlv-progress';
export const RUN_KEY = 'mlv-run';
export const STEPS = 4; // Learn, Play, Check, Code
const ALL_STEPS = (1 << STEPS) - 1;

export interface LessonRecord {
  /** Bitmask of the steps the learner has opened (bit 0 = Learn … bit 3 = Code). */
  s: number;
  /** 1 once every quiz question on the page was answered right. */
  q?: 1;
  /** Last time the lesson was opened (ms since epoch). */
  t: number;
}
export interface Progress { v: 1; l: Record<string, LessonRecord> }
export type LessonState = 'none' | 'started' | 'done';
export type RunPref = 'colab' | 'local';

export const empty = (): Progress => ({ v: 1, l: {} });

/** Read stored JSON; anything unexpected becomes empty progress instead of an error. */
export function parse(raw: string | null | undefined): Progress {
  if (!raw) return empty();
  try {
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || typeof data.l !== 'object' || data.l === null) return empty();
    const l: Record<string, LessonRecord> = {};
    for (const [k, r] of Object.entries(data.l as Record<string, Partial<LessonRecord>>)) {
      if (!r || typeof r !== 'object') continue;
      const s = Number(r.s) & ALL_STEPS;
      l[k] = { s, t: Number(r.t) || 0, ...(r.q === 1 ? { q: 1 as const } : {}) };
    }
    return { v: 1, l };
  } catch {
    return empty();
  }
}

export function lessonState(p: Progress, key: string): LessonState {
  const r = p.l[key];
  if (!r) return 'none';
  return r.q === 1 || (r.s & ALL_STEPS) === ALL_STEPS ? 'done' : 'started';
}

/** The learner opened step `step` (0–3) of a lesson. Opening a lesson at all is step 0. */
export function openStep(p: Progress, key: string, step: number, now = Date.now()): Progress {
  const r = p.l[key] ?? { s: 0, t: 0 };
  const bit = step >= 0 && step < STEPS ? 1 << step : 0;
  return { v: 1, l: { ...p.l, [key]: { ...r, s: r.s | bit, t: now } } };
}

export function passQuiz(p: Progress, key: string, now = Date.now()): Progress {
  const r = p.l[key] ?? { s: 0, t: 0 };
  return { v: 1, l: { ...p.l, [key]: { ...r, q: 1, t: now } } };
}

export const countDone = (p: Progress, keys: readonly string[]) =>
  keys.filter(k => lessonState(p, k) === 'done').length;

/**
 * Where "Continue where you left off" should go: the most recently opened lesson if it isn't done,
 * otherwise the first unfinished lesson after it (or before it, if everything after is done).
 * `null` when there is no progress yet, or every lesson is done.
 */
export function resume(p: Progress, order: readonly string[]): string | null {
  let last: string | null = null, t = -1;
  for (const k of order) {
    const r = p.l[k];
    if (r && r.t > t) { t = r.t; last = k; }
  }
  if (!last) return null;
  if (lessonState(p, last) !== 'done') return last;
  const i = order.indexOf(last);
  const rest = [...order.slice(i + 1), ...order.slice(0, i)];
  return rest.find(k => lessonState(p, k) !== 'done') ?? null;
}

// ---- storage (browser) ----

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Storage | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function load(s: Storage | null = store()): Progress {
  try { return parse(s?.getItem(PROGRESS_KEY)); } catch { return empty(); }
}

export function save(p: Progress, s: Storage | null = store()): boolean {
  try { s?.setItem(PROGRESS_KEY, JSON.stringify(p)); return !!s; } catch { return false; }
}

export function reset(s: Storage | null = store()): void {
  try { s?.removeItem(PROGRESS_KEY); } catch { /* storage blocked: nothing to clear */ }
}

export function getRun(s: Storage | null = store()): RunPref {
  try { return s?.getItem(RUN_KEY) === 'local' ? 'local' : 'colab'; } catch { return 'colab'; }
}

export function setRun(v: RunPref, s: Storage | null = store()): void {
  try { s?.setItem(RUN_KEY, v); } catch { /* storage blocked: the choice just isn't remembered */ }
}
