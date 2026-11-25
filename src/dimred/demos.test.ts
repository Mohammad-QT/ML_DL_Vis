// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, inject, it, vi } from 'vitest';
import { DIMRED, dimredPath } from '../lessons';
import { empty } from '../progress';
import { paint } from '../progressui';
import { mountDimred } from './demos';

const out = inject('siteDir');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it.each(DIMRED)('mounts the %s hero and Play demo on the English and Arabic lesson pages', id => {
  const draw = vi.fn();
  const context = {
    fillStyle: '#000000', arc: draw, stroke: vi.fn(), setLineDash: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(),
    setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), clearRect: vi.fn(),
    drawImage: vi.fn(),
  };
  const resize: Array<() => void> = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(256);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(256);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize.push(callback); }
    observe() {}
  });

  for (const lang of ['en', 'ar']) {
    const path = join(out, lang === 'ar' ? 'ar' : '', dimredPath(id), 'index.html');
    const page = new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');
    document.body.replaceChildren(...page.body.childNodes);
    const figure = document.querySelector<HTMLElement>('[data-dimred][data-dimred-figure]')!;
    const play = document.querySelector<HTMLElement>('[data-dimred]:not([data-dimred-figure])')!;

    draw.mockClear();
    expect(() => {
      paint(empty());
      mountDimred(figure);
      mountDimred(play);
      resize.splice(0).forEach(callback => callback());
    }).not.toThrow();
    expect(draw).toHaveBeenCalled();
    expect(figure.querySelector('canvas')?.getAttribute('tabindex')).toBeNull();
    const board = play.querySelector<HTMLCanvasElement>('canvas[data-dimred-input]')!;
    expect(board.tabIndex).toBe(0);
    const scoreSelector = {
      pca: '[data-dimred-variance]',
      lda: '[data-dimred-separation="lda"]',
      'kernel-pca': '[data-dimred-projected-score]',
    }[id];
    expect(play.querySelector(scoreSelector)?.textContent).toMatch(/[\d\u0660-\u0669]/);
    if (id === 'lda') {
      expect(play.querySelectorAll('svg circle')).toHaveLength(120);
      play.querySelector<HTMLButtonElement>('[data-dimred-class="1"]')!.click();
    }
    if (id === 'kernel-pca') {
      expect(play.querySelector('canvas[data-dimred-output]')).toBeTruthy();
      const percent = new Intl.NumberFormat(lang, { style: 'percent' });
      expect(play.querySelector('[data-dimred-original-score]')?.textContent).toContain(percent.format(0.5));
      expect(play.querySelector(scoreSelector)?.textContent).toContain(percent.format(1));
    }

    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 256, 256));
    draw.mockClear();
    for (const type of ['pointerdown', 'pointerup']) {
      board.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 1, clientX: 128, clientY: 128 }));
    }
    expect(draw).toHaveBeenCalled();
    if (id === 'lda') {
      const circles = play.querySelectorAll('svg circle');
      expect(circles).toHaveLength(122);
      expect(circles[121].getAttribute('fill')).toBe('var(--b)');
    }
  }
});
