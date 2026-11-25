// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, inject, it } from 'vitest';
import { NLP, nlpPath } from '../lessons';
import { empty } from '../progress';
import { paint } from '../progressui';
import { mountNlp } from './demos';

const out = inject('siteDir');

it.each(NLP)('mounts %s on both real lesson pages and responds to controls', id => {
  for (const lang of ['en', 'ar']) {
    const file = join(out, lang === 'ar' ? 'ar' : '', nlpPath(id), 'index.html');
    const page = new DOMParser().parseFromString(readFileSync(file, 'utf8'), 'text/html');
    expect(page.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
    expect(page.querySelectorAll('.qz')).toHaveLength(2);
    expect(page.querySelectorAll('.nlp-figure textarea')).toHaveLength(0);
    const demo = page.querySelector<HTMLElement>('[data-nlp]')!;
    expect(() => mountNlp(demo)).not.toThrow();
    paint(empty(), page);
    const board = demo.querySelector<HTMLTableElement>('[data-nlp-board]')!;
    expect(board.tHead?.rows.length).toBe(1);
    const input = demo.querySelector<HTMLTextAreaElement>('[data-nlp-input]')!;
    const slider = demo.querySelector<HTMLInputElement>('[data-nlp-vocab]')!;
    if (id === 'bag-of-words') {
      expect(board.tBodies[0].rows.length).toBe(6);
      expect(demo.querySelector('[data-nlp-stage="stems"]')?.textContent).toBe('likcakecoffee');
      input.value = 'CAKES, cakes! 2';
      input.dispatchEvent(new Event('input'));
      expect(demo.querySelector('[data-nlp-stage="cleaned"]')?.textContent).toBe('cakes cakes');
      slider.value = '1';
      slider.dispatchEvent(new Event('input'));
      expect(board.tHead?.rows[0].cells).toHaveLength(2);
      expect(board.rows[board.rows.length - 1].cells[1].textContent).toBe(new Intl.NumberFormat(lang).format(2));
    } else {
      expect(board.tBodies[0].rows.length).toBe(2);
      const examples = demo.querySelectorAll<HTMLButtonElement>('[data-nlp-example]');
      const prediction = demo.querySelector('[data-nlp-prediction]')!;
      const score = demo.querySelector('[data-nlp-score]')!;
      expect(prediction.textContent).toMatch(/[%٪]/);
      expect(score.textContent).toMatch(/[%٪]/);
      examples[2].click();
      const first = prediction.textContent;
      examples[3].click();
      expect(prediction.textContent).toBe(first);
      expect(demo.querySelectorAll('[data-nlp-evidence] .nlp-token')).toHaveLength(5);
      slider.value = '10';
      slider.dispatchEvent(new Event('input'));
      expect(demo.querySelector<HTMLOutputElement>('[data-nlp-size]')?.value).toBe(new Intl.NumberFormat(lang).format(10));
      demo.querySelector<HTMLInputElement>('[data-nlp-stem]')!.click();
      demo.querySelector<HTMLInputElement>('[data-nlp-stop]')!.click();
      expect(board.tBodies[0].rows.length).toBe(2);
    }
  }
});
