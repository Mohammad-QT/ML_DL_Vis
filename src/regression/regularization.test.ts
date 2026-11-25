// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, inject, it, vi } from 'vitest';
import { empty } from '../progress';
import { paint } from '../progressui';
import { mountRegularization } from './regularization';

const out = inject('siteDir');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it.each(['en', 'ar'])('draws and updates the regularization demo on the %s lesson page', lang => {
  const arc = vi.fn();
  const context = {
    fillStyle: '#000000', arc, stroke: vi.fn(), setLineDash: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(),
    setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(256);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(180);
  const resize: Array<() => void> = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(fn: () => void) { resize.push(fn); }
    observe() {}
  });
  const path = join(out, lang === 'ar' ? 'ar' : '', 'learn/2-regression/regularization/index.html');
  const page = new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');
  document.body.replaceChildren(...page.body.childNodes);
  paint(empty());
  const figure = document.querySelector<HTMLElement>('[data-regz-demo][data-regz-figure]')!;
  const play = document.querySelector<HTMLElement>('[data-regz-demo]:not([data-regz-figure])')!;
  const get = <T extends Element = HTMLElement>(name: string) => play.querySelector<T>(`[data-regz-${name}]`)!;
  mountRegularization(figure);
  mountRegularization(play);
  resize.forEach(fn => fn());
  expect(arc).toHaveBeenCalled();
  expect(figure.querySelector('canvas')?.hasAttribute('tabindex')).toBe(false);
  expect(get('bars').childElementCount).toBe(9);
  const initialError = get('test').textContent!;
  const alpha = get<HTMLInputElement>('alpha');
  alpha.value = '-2';
  alpha.dispatchEvent(new Event('input', { bubbles: true }));
  expect(get('test').textContent).not.toBe(initialError);
  if (lang === 'en') expect(Number(get('test').textContent)).toBeLessThan(Number(initialError) / 2);
  const penalty = get<HTMLSelectElement>('penalty');
  penalty.value = 'lasso';
  penalty.dispatchEvent(new Event('change', { bubbles: true }));
  const zeros = play.querySelectorAll('[data-regz-zero]').length;
  expect(zeros).toBeGreaterThan(0);
  expect(zeros).toBeLessThan(9);
  const degree = get<HTMLInputElement>('degree');
  degree.value = '5';
  degree.dispatchEvent(new Event('input', { bubbles: true }));
  expect(get('bars').childElementCount).toBe(5);
});
