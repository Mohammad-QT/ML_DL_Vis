/**
 * The lesson Check step as a sequence of cards: quiz questions, then "Predict the line", then "Beat the score",
 * then a summary. Pure state; the CheckFlow component renders it.
 *
 * A scored card (a question, predict-the-line) keeps its first answer until "Try again". Next opens once it is
 * answered. An unscored card (beat the score) can be passed at any time. `i === n` is the summary.
 */
export interface Flow {
  /** Per card: true if it is scored (has a right answer). */
  readonly scored: readonly boolean[];
  /** Per card: null until answered, then whether the first answer was right. */
  readonly answers: readonly (boolean | null)[];
  /** The card on screen; `scored.length` means the summary. */
  readonly i: number;
}

export const start = (scored: readonly boolean[]): Flow => ({ scored, answers: scored.map(() => null), i: 0 });

export const count = (f: Flow) => f.scored.length;
export const atSummary = (f: Flow) => f.i >= count(f);

/** Record the answer on the current card. Only the first answer counts. */
export function answer(f: Flow, right: boolean): Flow {
  if (atSummary(f) || !f.scored[f.i] || f.answers[f.i] != null) return f;
  const answers = f.answers.slice();
  answers[f.i] = right;
  return { ...f, answers };
}

export const canNext = (f: Flow) => !atSummary(f) && (!f.scored[f.i] || f.answers[f.i] != null);
export const canBack = (f: Flow) => f.i > 0;
export const next = (f: Flow): Flow => (canNext(f) ? { ...f, i: f.i + 1 } : f);
export const back = (f: Flow): Flow => (canBack(f) ? { ...f, i: f.i - 1 } : f);

/** Right answers out of the scored cards. */
export function score(f: Flow): { right: number; total: number } {
  let right = 0, total = 0;
  f.scored.forEach((s, k) => { if (s) { total++; if (f.answers[k]) right++; } });
  return { right, total };
}

/** Back to the first card with every answer cleared. */
export const reset = (f: Flow): Flow => start(f.scored);

/** What each progress dot shows. */
export type Dot = 'current' | 'right' | 'wrong' | 'seen' | 'todo';
export function dots(f: Flow): Dot[] {
  return f.scored.map((s, k) => {
    if (k === f.i) return 'current';
    const a = f.answers[k];
    if (a != null) return a ? 'right' : 'wrong';
    return !s && k < f.i ? 'seen' : 'todo';
  });
}
