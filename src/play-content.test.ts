import { globSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const files = globSync('src/content/*/{en,ar}/*.mdx').map(file => file.replaceAll('\\', '/'));
const lessons = [...new Set(files.map(file => file.replace(/\/(en|ar)\//, '/{lang}/')))].sort();

describe('Play introductions', () => {
  it.each(lessons)('has valid bilingual copy for %s', lesson => {
    const hasTouchVersion = ['en', 'ar'].map(lang => {
      const file = lesson.replace('{lang}', lang);
      const { play } = parse(readFileSync(file, 'utf8').split('---')[1]);

      for (const field of ['short', 'short_touch'] as const) {
        const line = play[field];
        if (field === 'short_touch' && line === undefined) continue;

        const label = `${file} play.${field}`;
        expect(typeof line, label).toBe('string');
        expect(line.trim(), label).not.toBe('');
        expect(line, label).not.toMatch(/[<>\r\n\u2028\u2029]/u);
        expect(line.trim().split(/\s+/u).length, label).toBeLessThanOrEqual(14);
      }

      return play.short_touch !== undefined;
    });

    expect(hasTouchVersion[0]).toBe(hasTouchVersion[1]);
  });
});
