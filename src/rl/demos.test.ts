// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, inject, it, vi } from 'vitest';
import { empty } from '../progress';
import { paint } from '../progressui';
import { mountBandit } from './demos';
import { RL, rlPath } from './lessons';

const out = inject('siteDir');

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it.each(RL)('mounts the %s boards and runs their controls on both lesson pages', id => {
  vi.spyOn(Math, 'random').mockReturnValueOnce(0.125).mockReturnValueOnce(0.75)
    .mockReturnValueOnce(0.125).mockReturnValueOnce(0.75);
  for (const lang of ['en', 'ar']) {
    const html = readFileSync(join(out, lang === 'ar' ? 'ar' : '', rlPath(id), 'index.html'), 'utf8');
    const page = new DOMParser().parseFromString(html, 'text/html');
    document.body.replaceChildren(...page.body.childNodes);
    const figure = document.querySelector<HTMLElement>('[data-bandit-figure]')!;
    const play = document.querySelector<HTMLElement>('[data-bandit]:not([data-bandit-figure])')!;
    const button = (selector: string) => play.querySelector<HTMLButtonElement>(selector)!;
    const plot = play.querySelector('[data-bandit-chart]')!;
    const status = play.querySelector('[data-bandit-status]')!;
    const integer = new Intl.NumberFormat(lang);
    const pick = button('[data-bandit-pick]');
    const start = button('[data-bandit-start]');
    const reveal = button('[data-bandit-reveal]');
    const rates = () => Array.from(play.querySelectorAll('[data-bandit-rate]'), node => node.textContent);

    expect(page.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
    expect(() => {
      paint(empty());
      mountBandit(figure);
      mountBandit(play);
      paint(empty());
    }).not.toThrow();
    expect(figure.querySelectorAll('svg')).toHaveLength(5);
    expect(figure.querySelectorAll('button')).toHaveLength(0);
    expect(play.querySelectorAll('[data-bandit-plot] svg')).toHaveLength(5);
    expect(plot.querySelector('svg')).toBeTruthy();
    expect(rates()).toEqual(Array(5).fill(''));
    expect(document.querySelectorAll('.qz')).toHaveLength(2);
    expect(document.querySelector(`a[download][href$="/6-rl/${id}.ipynb"]`)).toBeTruthy();

    if (id === 'ucb') {
      expect(start.hidden).toBe(true);
      expect(pick.hidden).toBe(false);
      for (let round = 0; round < 30; round++) pick.click();
      expect(pick.disabled).toBe(true);
      expect(status.textContent).toContain(integer.format(30));
      expect(start.hidden).toBe(false);
      start.click();
      expect(play.querySelector('[data-bandit-your-score]')?.textContent).not.toBe('');
    }
    expect(pick.hidden).toBe(true);
    button('[data-bandit-run="1"]').click();
    expect(play.querySelectorAll('.picked')).toHaveLength(1);
    button('[data-bandit-run="100"]').click();
    button('[data-bandit-run="1000"]').click();
    expect(status.textContent).toContain(integer.format(1101));
    expect(plot.querySelectorAll('polyline')).toHaveLength(3);
    expect(play.querySelectorAll('[data-bandit-plot] circle')).toHaveLength(5);
    reveal.click();
    expect(reveal.getAttribute('aria-pressed')).toBe('true');
    const initialRates = rates();
    expect(initialRates.every(Boolean)).toBe(true);
    button('[data-bandit-reset]').click();
    expect(rates()).toEqual(Array(5).fill(''));
    expect(play.querySelectorAll('.picked')).toHaveLength(0);
    reveal.click();
    expect(rates()).not.toEqual(initialRates);
  }
});
