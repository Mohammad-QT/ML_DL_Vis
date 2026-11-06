import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { MODELS, MODEL_NAMES, Store, fitModel, score, type ModelName } from './engine';
import { CLASSIFICATION, PREP } from './lessons';

const read = (lang: string, id: string) => {
  const raw = readFileSync(`src/content/lessons/${lang}/${id}.mdx`, 'utf8');
  return parse(raw.split('---')[1]);
};

describe('lesson files', () => {
  it('has every classification lesson in both languages and nothing else', () => {
    for (const lang of ['en', 'ar']) {
      expect(readdirSync(`src/content/lessons/${lang}`).map((f: string) => f.replace('.mdx', '')).sort()).toEqual([...CLASSIFICATION].sort());
    }
  });

  describe.each(CLASSIFICATION)('%s', id => {
    const en = read('en', id), ar = read('ar', id);

    it('matches across languages (same data, only the words differ)', () => {
      for (const key of ['model', 'figure', 'predict', 'beat'] as const) {
        const strip = (d: any) => JSON.stringify(key === 'predict' ? { ...d.predict, why: 0 } : d[key]);
        expect(strip(ar), key).toBe(strip(en));
      }
      expect(ar.quiz.map((q: any) => q.correct)).toEqual(en.quiz.map((q: any) => q.correct));
      expect(ar.code).toBe(en.code);
    });

    it('has valid quiz and predict answers', () => {
      expect(en.model).toBe(id);
      for (const q of en.quiz) expect(q.correct).toBeLessThan(q.a.length);
      expect(en.predict.options[en.predict.answer]).toBe(id);
      expect(en.predict.options.every((o: string) => MODEL_NAMES.includes(o as ModelName))).toBe(true);
    });

    it('has a beat-the-score goal that is not met at the start but can be reached', () => {
      const hasSlider = Object.keys(MODELS[id].params).length > 0;
      expect(Boolean(en.beat)).toBe(hasSlider && id !== 'logistic' && id !== 'nb');
      if (!en.beat) return;
      const name = Object.keys(MODELS[id].params)[0];
      const spec = (MODELS[id].params as Record<string, { min: number; max: number; step: number }>)[name];
      const s = new Store();
      s.preset(en.beat.preset, en.beat.seed);
      const test = (v: number) => Math.round(100 * score(fitModel(id, { [name]: v }, s.train()), s.test())!);
      expect(test(en.beat.start)).toBeLessThan(en.beat.target);
      let best = 0;
      for (let v = spec.min; v <= spec.max + 1e-9; v += spec.step) best = Math.max(best, test(Math.round(v * 100) / 100));
      expect(best).toBeGreaterThanOrEqual(en.beat.target);
    });
  });
});

describe('Part 0 and Part 1 lesson files', () => {
  const readPrep = (lang: string, id: string) => parse(readFileSync(`src/content/prep/${lang}/${id}.mdx`, 'utf8').split('---')[1]);

  it('has every lesson in both languages and nothing else', () => {
    for (const lang of ['en', 'ar']) {
      expect(readdirSync(`src/content/prep/${lang}`).map((f: string) => f.replace('.mdx', '')).sort()).toEqual([...PREP].sort());
    }
  });

  describe.each(PREP)('%s', id => {
    const en = readPrep('en', id), ar = readPrep('ar', id);
    it('matches across languages (same data, only the words differ)', () => {
      expect(en.id).toBe(id);
      expect(ar.id).toBe(id);
      expect(ar.figure.seed).toBe(en.figure.seed);
      expect(Object.keys(ar.ui ?? {}).sort().filter((k: string) => !k.startsWith('c_'))).toEqual(Object.keys(en.ui ?? {}).sort());
      expect(ar.quiz.map((q: any) => q.correct)).toEqual(en.quiz.map((q: any) => q.correct));
      expect(ar.code).toBe(en.code);
      expect(ar.steps.length).toBe(en.steps.length);
    });
    it('has valid quiz answers, two questions', () => {
      expect(en.quiz).toHaveLength(2);
      for (const q of en.quiz) expect(q.correct).toBeLessThan(q.a.length);
    });
  });
});
