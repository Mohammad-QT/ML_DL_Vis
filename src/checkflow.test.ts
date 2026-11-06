import { describe, expect, it } from 'vitest';
import { answer, atSummary, back, canBack, canNext, dots, next, reset, score, start } from './checkflow';

// three questions, then an unscored "beat the score" card
const fresh = () => start([true, true, true, false]);

describe('check flow', () => {
  it('starts on the first card with nothing answered', () => {
    const f = fresh();
    expect(f.i).toBe(0);
    expect(canBack(f)).toBe(false);
    expect(canNext(f)).toBe(false);
    expect(score(f)).toEqual({ right: 0, total: 3 });
  });

  it('opens Next only after a scored card is answered', () => {
    let f = fresh();
    expect(next(f).i).toBe(0);
    f = answer(f, true);
    expect(canNext(f)).toBe(true);
    expect(next(f).i).toBe(1);
  });

  it('keeps the first answer', () => {
    const f = answer(answer(fresh(), false), true);
    expect(f.answers[0]).toBe(false);
  });

  it('keeps answers when going back', () => {
    let f = next(answer(fresh(), true));
    f = back(f);
    expect(f.i).toBe(0);
    expect(f.answers[0]).toBe(true);
    expect(canNext(f)).toBe(true);
  });

  it('lets an unscored card pass without an answer, then reaches the summary', () => {
    let f = fresh();
    for (const ok of [true, false, true]) f = next(answer(f, ok));
    expect(f.i).toBe(3);
    expect(canNext(f)).toBe(true);
    f = next(f);
    expect(atSummary(f)).toBe(true);
    expect(canNext(f)).toBe(false);
    expect(next(f)).toBe(f);
    expect(score(f)).toEqual({ right: 2, total: 3 });
    expect(answer(f, true)).toBe(f);
  });

  it('ignores answers on unscored cards', () => {
    let f = fresh();
    for (let k = 0; k < 3; k++) f = next(answer(f, true));
    expect(answer(f, true).answers[3]).toBeNull();
  });

  it('try again clears everything', () => {
    let f = fresh();
    for (let k = 0; k < 3; k++) f = next(answer(f, true));
    f = reset(next(f));
    expect(f.i).toBe(0);
    expect(f.answers.every(a => a == null)).toBe(true);
  });

  it('paints the dots', () => {
    let f = next(answer(fresh(), true));
    f = next(answer(f, false));
    expect(dots(f)).toEqual(['right', 'wrong', 'current', 'todo']);
    f = next(next(answer(f, true)));
    expect(dots(f)).toEqual(['right', 'wrong', 'right', 'seen']);
  });
});
