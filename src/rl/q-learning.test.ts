// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, inject, it, vi } from 'vitest';
import { empty } from '../progress';
import { paint } from '../progressui';
import { mountQLearning } from './q-learning';

const out = inject('siteDir');

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

it.each(['en', 'ar'])('trains, animates, edits walls and resets on the built %s lesson', lang => {
  vi.useFakeTimers();
  const path = join(out, lang === 'ar' ? 'ar' : '', 'learn/6-rl/q-learning/index.html');
  const page = new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');
  expect(page.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
  document.body.replaceChildren(...page.body.childNodes);
  const play = document.querySelector<HTMLElement>('[data-q-world]')!;
  const figure = document.querySelector('figure .q-grid')!;
  const status = play.querySelector('[data-q-status]')!;
  const chart = play.querySelector('[data-q-steps]')!;
  const open = play.querySelector<HTMLButtonElement>('[data-q-cell="0"]')!;
  const start = play.querySelector('[data-q-tile="start"]')!;
  const settings = play.querySelector<HTMLInputElement>('[data-q-setting="epsilon"]')!;
  const number = new Intl.NumberFormat(lang);
  const click = (selector: string) => play.querySelector<HTMLButtonElement>(selector)!.click();

  expect(figure.querySelectorAll('button')).toHaveLength(0);
  expect(figure.textContent).toContain('→');
  paint(empty());
  mountQLearning(play);
  expect(start.hasAttribute('data-q-agent')).toBe(true);
  click('[data-q-train="1"]');
  expect(start.hasAttribute('data-q-agent')).toBe(true);
  vi.runAllTimers();
  expect(chart.getAttribute('points')?.split(' ')).toHaveLength(1);
  expect(start.hasAttribute('data-q-agent')).toBe(false);
  click('[data-q-train="100"]');
  expect(status.textContent).toContain(number.format(101));
  expect(chart.getAttribute('points')?.split(' ')).toHaveLength(101);
  expect(play.querySelector('[data-q-cell="33"] [data-q-arrow]')?.textContent).toBe('→');

  settings.value = '0.7';
  settings.dispatchEvent(new Event('input'));
  expect(play.querySelector('[data-q-output="epsilon"]')?.textContent).toBe(number.format(0.7));
  open.click();
  expect(open.dataset.qTile).toBe('wall');
  expect(chart.getAttribute('points')).toBe('');
  click('[data-q-reset]');
  expect(open.dataset.qTile).toBe('open');
  expect(settings.value).toBe('0.2');
  expect(start.hasAttribute('data-q-agent')).toBe(true);
});
