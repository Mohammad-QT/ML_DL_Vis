// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { Mlp } from '../engine/mlp';
import { DEEP, deepPath } from '../lessons';
import { buildNet } from './ann';
import { ANN_PRESETS, annPoints, toInputs } from './data';

const fit = (preset: (typeof ANN_PRESETS)[number], net: Mlp, epochs: number, rate = 0.1) => {
  const pts = annPoints(preset, 42);
  const X = pts.map(p => toInputs(p.x, p.y)), y = pts.map(p => p.c);
  for (let e = 0; e < epochs; e++) net.epoch(X, y, rate, 16);
  return net.accuracy(X, y)!;
};

describe('neural-network presets', () => {
  it('one unit draws a straight line: fine on blobs, near chance on XOR, circles and spiral', () => {
    const one = () => buildNet({ layers: 1, units: 1, activation: 'tanh', rate: 0.1 });
    expect(fit('blobs', one(), 300)).toBeGreaterThanOrEqual(0.95);
    for (const preset of ['xor', 'circles', 'spiral'] as const) expect(fit(preset, one(), 400), preset).toBeLessThan(0.75);
  });

  it('hidden layers learn every preset with the default settings', () => {
    for (const preset of ANN_PRESETS) {
      const net = buildNet({ layers: 2, units: 6, activation: 'relu', rate: 0.1 });
      expect(fit(preset, net, 1500), preset).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('keeps every preset point on the board', () => {
    for (const preset of ANN_PRESETS) for (const p of annPoints(preset, 42)) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(1);
    }
  });
});

describe('Part 8 lesson files', () => {
  const read = (lang: string, id: string) => parse(readFileSync(`src/content/deep/${lang}/${id}.mdx`, 'utf8').split('---')[1]);
  it.each(DEEP)('%s matches across languages', id => {
    const en = read('en', id), ar = read('ar', id);
    expect(en.id).toBe(id);
    expect(ar.id).toBe(id);
    expect(Object.keys(ar.ui).sort()).toEqual(Object.keys(en.ui).sort());
    expect(ar.quiz.map((q: { correct: number }) => q.correct)).toEqual(en.quiz.map((q: { correct: number }) => q.correct));
    expect(ar.code).toBe(en.code);
    expect(ar.steps.length).toBe(en.steps.length);
  });
});

const out = inject('siteDir');

/** A 2-D context stand-in: remembers assigned properties and answers every method call. */
function mockContext(arc: ReturnType<typeof vi.fn>) {
  const props: Record<string | symbol, unknown> = { arc };
  return new Proxy(props, {
    get: (t, key) => (key in t ? t[key] : (t[key] = vi.fn())),
    set: (t, key, value) => { t[key] = value; return true; },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it('mounts the neural-network hero and Play demo on the English and Arabic pages, and trains', async () => {
  const { mountAnn } = await import('./ann');
  const draw = vi.fn();
  const context = mockContext(draw);
  const resize: Array<() => void> = [];
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(240);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
  vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { resize.push(cb); } observe() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => { frames.length = 0; });

  for (const lang of ['en', 'ar']) {
    const html = readFileSync(join(out, lang === 'ar' ? 'ar' : '', deepPath('ann'), 'index.html'), 'utf8');
    document.body.replaceChildren(...new DOMParser().parseFromString(html, 'text/html').body.childNodes);
    const figure = document.querySelector<HTMLElement>('[data-ann][data-ann-figure]')!;
    const play = document.querySelector<HTMLElement>('[data-ann]:not([data-ann-figure])')!;
    expect(figure && play).toBeTruthy();
    draw.mockClear();
    mountAnn(figure);
    mountAnn(play);
    resize.splice(0).forEach(cb => cb());
    expect(draw).toHaveBeenCalled();
    expect(figure.querySelector('canvas')!.getAttribute('tabindex')).toBeNull();

    // The diagram has one line per weight: 2·6 + 6·6 + 6·1 with the default two layers of six units.
    expect(play.querySelectorAll('[data-ann-net] line')).toHaveLength(54);
    const epoch = play.querySelector('[data-ann-epoch]')!;
    expect(epoch.textContent).toMatch(/[0٠]/);

    play.querySelector<HTMLButtonElement>('[data-ann-step]')!.click();
    expect(epoch.textContent).toMatch(/[1١]/);

    const train = play.querySelector<HTMLButtonElement>('[data-ann-train]')!;
    train.click();
    expect(train.getAttribute('aria-pressed')).toBe('true');
    for (let i = 0; i < 5 && frames.length; i++) frames.shift()!(performance.now());
    train.click();
    expect(train.getAttribute('aria-pressed')).toBe('false');
    expect(play.querySelector('[data-ann-loss-trace]')!.getAttribute('points')!.split(' ').length).toBeGreaterThan(2);
    expect(play.querySelector('[data-ann-test-acc]')!.textContent).toMatch(/[\d٠-٩]/);

    // One unit per layer shows the straight-line hint and rebuilds the diagram.
    const units = play.querySelector<HTMLInputElement>('[data-ann-units]')!;
    units.value = '1';
    units.dispatchEvent(new Event('input'));
    expect(play.querySelector<HTMLElement>('[data-ann-hint]')!.hidden).toBe(false);
    expect(play.querySelectorAll('[data-ann-net] line')).toHaveLength(2 + 1 + 1);

    // A tap on the board adds a point.
    const board = play.querySelector<HTMLCanvasElement>('[data-ann-board]')!;
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 240, 240));
    draw.mockClear();
    for (const type of ['pointerdown', 'pointerup']) board.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 }));
    expect(draw).toHaveBeenCalled();
  }
});
