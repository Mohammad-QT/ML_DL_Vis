import { describe, expect, it } from 'vitest';
import { countDone, empty, getRun, lessonState, load, openStep, parse, passQuiz, PROGRESS_KEY, reset, resume, save, setRun } from './progress';
import { KEYS, LESSONS, PARTS, nextLesson } from './course';

class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const broken = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('quota'); },
  removeItem() { throw new Error('blocked'); },
};

describe('lesson state', () => {
  it('starts as not started', () => {
    expect(lessonState(empty(), '3/knn')).toBe('none');
  });
  it('is in progress once opened', () => {
    expect(lessonState(openStep(empty(), '3/knn', 0), '3/knn')).toBe('started');
  });
  it('is done after all four steps are opened, in any order', () => {
    let p = empty();
    for (const s of [3, 0, 2]) p = openStep(p, '3/knn', s);
    expect(lessonState(p, '3/knn')).toBe('started');
    p = openStep(p, '3/knn', 1);
    expect(lessonState(p, '3/knn')).toBe('done');
  });
  it('is done after the quiz is passed', () => {
    const p = passQuiz(openStep(empty(), '2/tree', 0), '2/tree');
    expect(lessonState(p, '2/tree')).toBe('done');
    expect(lessonState(p, '3/tree')).toBe('none'); // same id in another part is a different lesson
  });
  it('ignores step numbers outside 0–3 but still records the visit', () => {
    const p = openStep(empty(), '0/start', 9, 5);
    expect(p.l['0/start']).toEqual({ s: 0, t: 5 });
    expect(lessonState(p, '0/start')).toBe('started');
  });
  it('does not mutate the input', () => {
    const p = empty();
    openStep(p, '3/knn', 1);
    passQuiz(p, '3/knn');
    expect(p.l).toEqual({});
  });
});

describe('parse', () => {
  it('turns junk into empty progress', () => {
    for (const raw of [null, '', 'nope', '[]', '{"v":2,"l":{}}', '{"v":1,"l":null}', '42']) expect(parse(raw)).toEqual(empty());
  });
  it('keeps valid records and cleans bad fields', () => {
    const p = parse(JSON.stringify({ v: 1, l: { '3/knn': { s: 255, t: 7, q: 1 }, '3/svm': { s: 'x', t: 'y', q: true }, bad: null } }));
    expect(p.l['3/knn']).toEqual({ s: 15, t: 7, q: 1 });
    expect(p.l['3/svm']).toEqual({ s: 0, t: 0 });
    expect(p.l.bad).toBeUndefined();
  });
});

describe('counts and resume', () => {
  const part3 = PARTS.find(p => p.id === '3')!.lessons.map(l => l.key);
  it('counts done lessons in a part', () => {
    let p = passQuiz(empty(), '3/knn');
    p = openStep(p, '3/svm', 0);
    p = passQuiz(p, '2/linear');
    expect(countDone(p, part3)).toBe(1);
    expect(countDone(p, KEYS)).toBe(2);
  });
  it('has nothing to resume with no progress', () => {
    expect(resume(empty(), KEYS)).toBeNull();
  });
  it('resumes the last opened lesson when it is unfinished', () => {
    let p = openStep(empty(), '3/knn', 0, 100);
    p = openStep(p, '1/split', 1, 200);
    expect(resume(p, KEYS)).toBe('1/split');
  });
  it('moves on to the next unfinished lesson when the last one is done', () => {
    let p = passQuiz(empty(), '3/logistic', 100);
    p = passQuiz(p, '3/knn', 50);
    expect(resume(p, KEYS)).toBe('3/svm');
  });
  it('wraps round to earlier lessons and returns null when all are done', () => {
    let p = empty();
    for (const k of KEYS) p = passQuiz(p, k, 1);
    p = openStep(p, '0/start', 0, 2);
    expect(resume(p, KEYS)).toBeNull();
    const last = KEYS[KEYS.length - 1];
    p = { v: 1, l: { ...p.l, '0/start': { s: 1, t: 1 }, [last]: { s: 15, t: 9 } } };
    expect(resume(p, KEYS)).toBe('0/start');
  });
});

describe('storage', () => {
  it('saves, loads and resets', () => {
    const s = new MemStore();
    const p = openStep(empty(), '3/knn', 2, 3);
    expect(save(p, s)).toBe(true);
    expect(load(s)).toEqual(p);
    reset(s);
    expect(s.getItem(PROGRESS_KEY)).toBeNull();
    expect(load(s)).toEqual(empty());
  });
  it('never throws when storage is blocked or missing', () => {
    expect(load(broken)).toEqual(empty());
    expect(save(empty(), broken)).toBe(false);
    expect(() => reset(broken)).not.toThrow();
    expect(load(null)).toEqual(empty());
    expect(save(empty(), null)).toBe(false);
    expect(getRun(broken)).toBe('colab');
    expect(() => setRun('local', broken)).not.toThrow();
  });
  it('remembers the preferred way to run code, defaulting to Colab', () => {
    const s = new MemStore();
    expect(getRun(s)).toBe('colab');
    setRun('local', s);
    expect(getRun(s)).toBe('local');
  });
});

describe('course', () => {
  it('has 21 lessons with unique keys and a notebook each', () => {
    expect(LESSONS).toHaveLength(21);
    expect(new Set(KEYS).size).toBe(21);
    for (const l of LESSONS) expect(l.notebook).toMatch(/^notebooks\/.+\.ipynb$/);
  });
  it('runs part by part, with no next lesson after the last', () => {
    expect(PARTS.map(p => p.id)).toEqual(['0', '1', '2', '3', '10']);
    expect(nextLesson('0/start')?.key).toBe('1/missing');
    expect(nextLesson('2/forest')?.key).toBe('3/logistic');
    expect(nextLesson('10/boost')).toBeUndefined();
  });
});
