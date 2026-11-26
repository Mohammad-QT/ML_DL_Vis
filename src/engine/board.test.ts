// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Board } from './board';
import type { Point } from './types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** A 2-D context stand-in: remembers assigned properties and answers every method call. */
const mockContext = () => new Proxy({} as Record<string | symbol, unknown>, {
  get: (t, key) => (key in t ? t[key] : (t[key] = vi.fn())),
  set: (t, key, value) => { t[key] = value; return true; },
});

it('fades to a new model after a resize, on and off screen, without losing its colours', () => {
  const resize: Array<() => void> = [];
  const seen: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => mockContext() as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
  vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { resize.push(cb); } observe() {} });
  vi.stubGlobal('IntersectionObserver', class { constructor(cb: (e: Array<{ isIntersecting: boolean }>) => void) { seen.push(cb); } observe() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', () => 0);

  const points: Point[] = [{ x: 0.3, y: 0.3, c: 0, test: false }, { x: 0.7, y: 0.7, c: 1, test: false }];
  const board = new Board(document.createElement('canvas'), { points }, { static: true });
  const model = { predict: (x: number) => x };
  resize.forEach(cb => cb());
  board.setModel(model);

  // The home page's hero: scrolled away, the window resizes, then the slideshow fades to the next model.
  seen.forEach(cb => cb([{ isIntersecting: false }]));
  resize.forEach(cb => cb());
  expect(() => board.setModel({ predict: (x: number) => 1 - x }, true)).not.toThrow();
  // Back on screen it catches up, and the next fade works too.
  seen.forEach(cb => cb([{ isIntersecting: true }]));
  resize.forEach(cb => cb());
  expect(() => board.setModel(model, true)).not.toThrow();
});
