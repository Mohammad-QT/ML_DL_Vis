// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, inject, it } from 'vitest';
import { empty } from '../progress';
import { paint } from '../progressui';
import { mountDbscan } from './dbscan';

const out = inject('siteDir');

afterEach(() => document.body.replaceChildren());

it.each(['en', 'ar'])('mounts the DBSCAN Play board on the built %s page', lang => {
  const path = join(out, lang === 'ar' ? 'ar' : '', 'learn', '4-clustering', 'dbscan', 'index.html');
  const page = new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');
  document.body.replaceChildren(...page.body.childNodes);
  const hero = document.querySelector('[data-dbscan-figure]')!;
  const play = document.querySelector<HTMLElement>('[data-dbscan]')!;
  expect(hero.querySelectorAll('[data-dbscan-type="core"]').length).toBeGreaterThan(0);
  expect(hero.querySelector('[data-dbscan-eps]')).toBeNull();

  expect(() => { paint(empty()); mountDbscan(play); }).not.toThrow();
  const format = new Intl.NumberFormat(lang);
  expect(play.querySelector('[data-dbscan-clusters]')?.textContent).toBe(format.format(3));
  expect(play.querySelectorAll('[data-dbscan-type="noise"]').length).toBeGreaterThan(4);
  expect(play.querySelectorAll('[data-dbscan-type="border"]').length).toBeGreaterThan(0);

  const preset = play.querySelector<HTMLSelectElement>('[data-dbscan-preset]')!;
  preset.value = 'moons';
  preset.dispatchEvent(new Event('change'));
  expect(play.querySelector('[data-dbscan-clusters]')?.textContent).toBe(format.format(2));
  expect(play.querySelector('[data-dbscan-noise]')?.textContent).toBe(format.format(2));

  const board = play.querySelector<SVGSVGElement>('[data-dbscan-board]')!;
  board.getBoundingClientRect = () => new DOMRect(0, 0, 300, 300);
  board.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 30, clientY: 90 }));
  const radius = board.querySelector('[data-dbscan-radius]')!;
  expect(radius.hasAttribute('data-dbscan-hidden')).toBe(false);
  expect(radius.getAttribute('r')).toBe('36');

  const eps = play.querySelector<HTMLInputElement>('[data-dbscan-eps]')!;
  eps.value = '.2';
  eps.dispatchEvent(new Event('input'));
  expect(radius.getAttribute('r')).toBe('60');
  expect(play.querySelector('[data-dbscan-clusters]')?.textContent).toBe(format.format(1));

  const minPts = play.querySelector<HTMLInputElement>('[data-dbscan-minpts]')!;
  minPts.value = '12';
  minPts.dispatchEvent(new Event('input'));
  expect(play.querySelector('[data-dbscan-clusters]')?.textContent).toBe(format.format(2));
  expect(play.querySelectorAll('[data-dbscan-type="border"]').length).toBeGreaterThan(0);
});
