import { describe, expect, it } from 'vitest';
import { countDone, empty, getRun, lessonState, load, openStep, parse, passQuiz, PROGRESS_KEY, reset, resume, save, setRun } from './progress';
import { KEYS, LESSONS, PARTS, nextLesson, previousLesson } from './course';
import { paint } from './progressui';

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
  it('updates progress counters without replacing the hierarchical demos', () => {
    const counter = { dataset: { count: '', keys: '4/kmeans,4/hierarchical', tpl: '{d} of {n}' }, textContent: '' };
    const demos = [
      { dataset: { cluster: 'hierarchical', count: 'Clusters: {n}', figure: '' }, textContent: 'Static figure' },
      { dataset: { cluster: 'hierarchical', count: 'Clusters: {n}' }, textContent: 'Play controls' },
    ];
    const page = {
      querySelectorAll(selector: string) {
        const attributes = Array.from(selector.matchAll(/\[data-([\w-]+)\]/g), match => match[1]);
        return [counter, ...demos].filter(el => attributes.every(attr => Object.hasOwn(el.dataset, attr)));
      },
    } as unknown as ParentNode;

    paint(passQuiz(empty(), '4/kmeans'), page);

    expect(counter.textContent).toBe('1 of 2');
    expect(demos.map(demo => demo.textContent)).toEqual(['Static figure', 'Play controls']);
  });
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
  it('has unique lesson keys and a notebook for every lesson', () => {
    expect(new Set(KEYS).size).toBe(LESSONS.length);
    for (const l of LESSONS) expect(l.notebook).toMatch(/^notebooks\/.+\.ipynb$/);
  });
  it('runs part by part, with no next lesson after the last', () => {
    const parts = PARTS.map(part => Number(part.id));
    expect(parts).toEqual([...new Set(parts)].sort((left, right) => left - right));
    expect(parts).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5, 6, 7, 9, 10]));
    expect(nextLesson('0/start')?.key).toBe('1/missing');
    expect(nextLesson('2/forest')?.key).toBe('2/gradient-descent');
    expect(nextLesson('2/gradient-descent')?.key).toBe('2/regularization');
    expect(nextLesson('2/regularization')?.key).toBe('3/logistic');
    expect(nextLesson('3/forest')?.key).toBe('4/kmeans');
    expect(nextLesson('4/kmeans')?.key).toBe('4/hierarchical');
    expect(nextLesson('4/hierarchical')?.key).toBe('4/dbscan');
    expect(nextLesson('4/dbscan')?.key).toBe('5/apriori');
    expect(nextLesson('5/apriori')?.key).toBe('5/eclat');
    expect(nextLesson('5/eclat')?.key).toBe('6/ucb');
    expect(nextLesson('6/ucb')?.key).toBe('6/thompson');
    expect(nextLesson('6/thompson')?.key).toBe('6/q-learning');
    expect(nextLesson('6/q-learning')?.key).toBe('7/bag-of-words');
    expect(nextLesson('7/bag-of-words')?.key).toBe('7/sentiment');
    expect(nextLesson('7/sentiment')?.key).toBe('8/ann');
    expect(nextLesson('8/ann')?.key).toBe('8/cnn');
    expect(nextLesson('8/cnn')?.key).toBe('9/pca');
    expect(previousLesson('8/ann')?.key).toBe('7/sentiment');
    expect(nextLesson('9/pca')?.key).toBe('9/lda');
    expect(nextLesson('9/lda')?.key).toBe('9/kernel-pca');
    expect(nextLesson('9/kernel-pca')?.key).toBe('10/metrics');
    expect(nextLesson('10/metrics')?.key).toBe('10/cv');
    expect(previousLesson('2/gradient-descent')?.key).toBe('2/forest');
    expect(previousLesson('2/regularization')?.key).toBe('2/gradient-descent');
    expect(previousLesson('3/logistic')?.key).toBe('2/regularization');
    expect(previousLesson('4/kmeans')?.key).toBe('3/forest');
    expect(previousLesson('4/hierarchical')?.key).toBe('4/kmeans');
    expect(previousLesson('4/dbscan')?.key).toBe('4/hierarchical');
    expect(previousLesson('5/apriori')?.key).toBe('4/dbscan');
    expect(previousLesson('5/eclat')?.key).toBe('5/apriori');
    expect(previousLesson('6/ucb')?.key).toBe('5/eclat');
    expect(previousLesson('6/thompson')?.key).toBe('6/ucb');
    expect(previousLesson('6/q-learning')?.key).toBe('6/thompson');
    expect(previousLesson('7/bag-of-words')?.key).toBe('6/q-learning');
    expect(previousLesson('9/pca')?.key).toBe('8/cnn');
    expect(previousLesson('10/metrics')?.key).toBe('9/kernel-pca');
    expect(previousLesson('10/cv')?.key).toBe('10/metrics');
    expect(nextLesson('10/boost')).toBeUndefined();
  });
});
