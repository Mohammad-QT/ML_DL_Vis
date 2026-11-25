// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, inject, it, vi } from 'vitest';
import { empty } from '../progress';
import { paint } from '../progressui';
import { mountGradientDescent } from './gradient-descent';

const out = inject('siteDir');

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it.each(['en', 'ar'])('draws and safely updates the gradient descent demo on the %s lesson page', lang => {
  vi.useFakeTimers();
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
  const path = join(out, lang === 'ar' ? 'ar' : '', 'learn/2-regression/gradient-descent/index.html');
  const page = new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');
  document.body.replaceChildren(...page.body.childNodes);
  paint(empty());
  const figure = document.querySelector<HTMLElement>('[data-gd-demo][data-gd-figure]')!;
  const play = document.querySelector<HTMLElement>('[data-gd-demo]:not([data-gd-figure])')!;
  const get = <T extends Element = HTMLElement>(name: string) => play.querySelector<T>(`[data-gd-${name}]`)!;
  mountGradientDescent(figure);
  mountGradientDescent(play);
  resize.forEach(fn => fn());
  expect(arc).toHaveBeenCalled();
  expect(figure.querySelector('canvas')?.hasAttribute('tabindex')).toBe(false);
  expect(get('contours').getAttribute('d')).toMatch(/M.+L/);
  const initialLoss = get('loss-value').textContent;
  get<HTMLButtonElement>('step').click();
  expect(get('dots').childElementCount).toBe(2);
  expect(get('loss-value').textContent).not.toBe(initialLoss);
  expect(get('loss-trace').getAttribute('points')!.split(' ')).toHaveLength(2);
  get<HTMLButtonElement>('reset').click();
  expect(get('dots').childElementCount).toBe(1);
  const rate = get<HTMLInputElement>('rate');
  rate.value = rate.max;
  rate.dispatchEvent(new Event('input', { bubbles: true }));
  const run = get<HTMLButtonElement>('run');
  run.click();
  vi.advanceTimersByTime(1000);
  expect(run.disabled).toBe(true);
  expect(get('status').textContent).toBe(JSON.parse(play.dataset.gdUi!).diverged);
  expect(get('loss-trace').getAttribute('points')).not.toContain('NaN');
  expect(vi.getTimerCount()).toBe(0);
});
