// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { deepPath } from '../lessons';
import { FILTERS, MAP, SIZE, featureMap, infer, parseCnn, rasterize } from './cnn';
import { EXAMPLES } from './digits';

const raw = JSON.parse(readFileSync('public/models/mnist-cnn.json', 'utf8'));
const model = parseCnn(raw);
const samples = JSON.parse(readFileSync('src/deep/fixtures/mnist-samples.json', 'utf8')) as {
  labels: number[]; images: number[][]; probs: number[][]; conv1_mean: number[][];
};
const argmax = (v: ArrayLike<number>) => Array.from(v).reduce((best, x, i, a) => (x > a[best] ? i : best), 0);

describe('CNN inference in TypeScript', () => {
  it('ships a compact weight file', () => {
    expect(readFileSync('public/models/mnist-cnn.json').length).toBeLessThan(300_000);
    expect(model.accuracy).toBeGreaterThan(0.98);
  });

  it.each(samples.labels.map((label, i) => [i, label]))('matches Keras on MNIST test sample %i (a %i)', (i, label) => {
    const image = Float32Array.from(samples.images[i], v => v / 255);
    const { probs, conv1 } = infer(model, image);
    expect(probs.reduce((a, v) => a + v, 0)).toBeCloseTo(1, 5);
    probs.forEach((p, d) => expect(p).toBeCloseTo(samples.probs[i][d], 4));
    expect(argmax(probs)).toBe(label);
    expect(conv1).toHaveLength(MAP * MAP * FILTERS);
    for (let k = 0; k < FILTERS; k++) {
      const mean = featureMap(conv1, k).reduce((a, v) => a + v, 0) / (MAP * MAP);
      expect(mean).toBeCloseTo(samples.conv1_mean[i][k], 4);
    }
  });

  it('rejects a file with the wrong shapes', () => {
    const bad = structuredClone(raw);
    bad.layers.conv1.shape = [5, 5, 1, 8];
    expect(() => parseCnn(bad)).toThrow();
    expect(() => parseCnn({ ...raw, format: 'other' })).toThrow();
  });
});

describe('drawing to a 28 × 28 image', () => {
  it('returns null for an empty pad', () => {
    expect(rasterize([])).toBeNull();
    expect(rasterize([[]])).toBeNull();
  });

  it('fits the ink in the middle 20 × 20 box and centres its mass, like MNIST', () => {
    // A small "1" drawn in the top-left corner of the pad.
    const image = rasterize([[{ x: 0.1, y: 0.05 }, { x: 0.12, y: 0.3 }]])!;
    expect(image).toHaveLength(SIZE * SIZE);
    let mass = 0, mx = 0, my = 0, top = SIZE, bottom = 0;
    image.forEach((v, i) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (v > 0.05) { top = Math.min(top, Math.floor(i / SIZE)); bottom = Math.max(bottom, Math.floor(i / SIZE)); }
      mass += v; mx += v * ((i % SIZE) + 0.5); my += v * (Math.floor(i / SIZE) + 0.5);
    });
    expect(Math.abs(mx / mass - 14)).toBeLessThan(0.6);
    expect(Math.abs(my / mass - 14)).toBeLessThan(0.6);
    expect(bottom - top).toBeGreaterThanOrEqual(17);
    expect(bottom - top).toBeLessThanOrEqual(21);
  });

  it('does not blow a single dot up to fill the box', () => {
    const image = rasterize([[{ x: 0.5, y: 0.5 }]])!;
    expect(image.filter(v => v > 0.05).length).toBeLessThan(20);
  });

  it('reads every built-in example digit correctly', () => {
    const guesses = EXAMPLES.map(strokes => argmax(infer(model, rasterize(strokes)!).probs));
    expect(guesses).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

const out = inject('siteDir');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function mockContext(fillRect: ReturnType<typeof vi.fn>) {
  const props: Record<string | symbol, unknown> = { fillRect };
  return new Proxy(props, {
    get: (t, key) => (key in t ? t[key] : (t[key] = vi.fn())),
    set: (t, key, value) => { t[key] = value; return true; },
  });
}

it('mounts the CNN hero and Play demo on the English and Arabic pages, and reads a drawn digit', async () => {
  const { mountCnn } = await import('./cnndemo');
  const fillRect = vi.fn();
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext(fillRect) as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(280);
  vi.stubGlobal('ResizeObserver', class { observe() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  const fetch = vi.fn(async () => new Response(JSON.stringify(raw)));
  vi.stubGlobal('fetch', fetch);

  for (const lang of ['en', 'ar']) {
    const html = readFileSync(join(out, lang === 'ar' ? 'ar' : '', deepPath('cnn'), 'index.html'), 'utf8');
    document.body.replaceChildren(...new DOMParser().parseFromString(html, 'text/html').body.childNodes);
    const figure = document.querySelector<HTMLElement>('[data-cnn][data-cnn-figure]')!;
    const play = document.querySelector<HTMLElement>('[data-cnn]:not([data-cnn-figure])')!;
    expect(figure.dataset.cnnModel).toMatch(/\/models\/mnist-cnn\.json$/);
    await Promise.all([mountCnn(figure), mountCnn(play)]);
    expect(fetch).toHaveBeenCalledTimes(1);

    // The hero runs the example "3" through the network.
    expect(figure.querySelector('[data-cnn-bar="3"]')!.classList.contains('best')).toBe(true);
    expect(play.querySelector('[data-cnn-status]')!.textContent).toBe('');
    expect(play.querySelectorAll('[data-cnn-map] canvas')).toHaveLength(8);

    // Draw a "7" with a pen: across the top, then down to the bottom left.
    const pad = play.querySelector<HTMLCanvasElement>('[data-cnn-pad]')!;
    vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 280));
    const pen = (type: string, x: number, y: number) => pad.dispatchEvent(new PointerEvent(type, { pointerType: 'pen', pointerId: 2, clientX: x, clientY: y }));
    pen('pointerdown', 80, 60);
    for (let t = 1; t <= 10; t++) pen('pointermove', 80 + 12 * t, 60);
    for (let t = 1; t <= 14; t++) pen('pointermove', 200 - 6 * t, 60 + 11 * t);
    pen('pointerup', 116, 214);
    frames.splice(0).forEach(cb => cb(0));
    expect(play.querySelector('[data-cnn-bar="7"]')!.classList.contains('best')).toBe(true);
    expect(play.querySelector('[data-cnn-guess]')!.textContent).toMatch(/7|٧/);

    play.querySelector<HTMLButtonElement>('[data-cnn-map="5"]')!.click();
    expect(play.querySelector('[data-cnn-map="5"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(play.querySelectorAll('[data-cnn-kernel] rect')).toHaveLength(9);

    play.querySelector<HTMLButtonElement>('[data-cnn-clear]')!.click();
    frames.splice(0).forEach(cb => cb(0));
    expect(play.querySelector('[data-cnn-confidence]')!.textContent).toBe('');

    play.querySelector<HTMLButtonElement>('[data-cnn-example]')!.click();
    frames.splice(0).forEach(cb => cb(0));
    expect(play.querySelector('[data-cnn-bar="0"]')!.classList.contains('best')).toBe(true);
  }
});
