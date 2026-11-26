import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { expect, it } from 'vitest';
import { loadScene } from './scenes';

interface Lesson {
  steps: string[];
  quick?: { steps: string[]; scene: string };
}

it('keeps Simple steps and scenes in sync across both languages', async () => {
  const converted = new Map<string, string>();
  for (const collection of readdirSync('src/content', { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const dir = join('src/content', collection.name);
    const filenames = new Set(['en', 'ar'].flatMap(lang => readdirSync(join(dir, lang)).filter(file => file.endsWith('.mdx'))));
    for (const file of filenames) {
      const read = (lang: string): Lesson => parse(readFileSync(join(dir, lang, file), 'utf8').split('---', 3)[1]);
      const en = read('en');
      const ar = read('ar');
      if (!en.quick && !ar.quick) continue;

      const name = `${collection.name}/${file}`;
      expect(en.quick, `${name} English quick`).toBeDefined();
      expect(ar.quick, `${name} Arabic quick`).toBeDefined();
      expect(ar.quick!.scene, name).toBe(en.quick!.scene);
      expect(ar.quick!.steps, name).toHaveLength(en.quick!.steps.length);
      const module = await loadScene(en.quick!.scene);
      expect(module, name).toBeDefined();
      expect(module!.default().frames, name).toBe(en.quick!.steps.length);
      for (const lesson of [en, ar]) {
        expect(lesson.quick!.steps, name).toHaveLength(lesson.steps.length);
        for (const step of lesson.quick!.steps) {
          const text = step.replace(/<\/?(?:b|bdi)>/g, '').trim();
          expect(text, name).not.toMatch(/[<>]/);
          expect(text.split(/\s+/).length, name).toBeLessThanOrEqual(12);
        }
      }
      converted.set(name, en.quick!.scene);
    }
  }
  expect(converted.get('lessons/knn.mdx')).toBe('knn');
  expect(converted.get('deep/ann.mdx')).toBe('ann');
  expect(converted.get('deep/cnn.mdx')).toBe('cnn');
});
