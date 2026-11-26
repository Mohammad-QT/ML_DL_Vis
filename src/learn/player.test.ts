// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { learn, type Lang } from '../i18n/ui';
import { mountLearn } from './player';

const siteDir = inject('siteDir');
const paths = {
  knn: 'learn/3-classification/knn',
  ann: 'learn/8-deep/ann',
  cnn: 'learn/8-deep/cnn',
};
const mounted: Array<() => void> = [];

async function mount(id: keyof typeof paths = 'knn', lang: Lang = 'en') {
  const html = readFileSync(join(siteDir, lang === 'ar' ? 'ar' : '', paths[id], 'index.html'), 'utf8');
  const page = new DOMParser().parseFromString(html, 'text/html');
  document.documentElement.lang = page.documentElement.lang;
  document.documentElement.dir = page.documentElement.dir;
  document.body.replaceChildren(...page.body.childNodes);
  const root = document.querySelector<HTMLElement>(`[data-learn="${id}"]`)!;
  mounted.push((await mountLearn(root))!);
  const get = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-learn-${name}]`)!;
  return {
    root,
    svg: root.querySelector('svg')!,
    simple: get('simple'),
    detailed: get('detailed'),
    caption: get('caption'),
    prev: get<HTMLButtonElement>('prev'),
    next: get<HTMLButtonElement>('next'),
    status: get('status'),
    pause: get<HTMLButtonElement>('pause'),
    radios: [...root.querySelectorAll<HTMLButtonElement>('[role="radio"]')],
    dots: [...root.querySelectorAll<HTMLButtonElement>('[data-learn-dot]')],
    steps: [...root.querySelectorAll<HTMLElement>('[data-learn-step]')],
    active: () => Number(root.querySelector<HTMLElement>('[data-learn-dot][aria-current="step"]')!.dataset.learnDot),
  };
}

function swipe(target: Element, dx: number, dy = 0) {
  target.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 120, pointerId: 1 }));
  document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', clientX: 200 + dx, clientY: 120 + dy, pointerId: 1 }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  window.localStorage.clear();
});

afterEach(() => {
  mounted.splice(0).forEach(dispose => dispose());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Learn playback on built lesson pages', () => {
  it('advances every 4 s, loops and follows Pause / Play', async () => {
    const { active, pause, root, status } = await mount();
    expect(active()).toBe(0);
    expect(status.textContent).toBe('1 / 4');
    vi.advanceTimersByTime(3999);
    expect(active()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(active()).toBe(1);
    expect(status.textContent).toBe('2 / 4');

    pause.click();
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    expect(pause.textContent).toBe(learn.en.play);
    expect(root.hasAttribute('data-playing')).toBe(false);
    vi.advanceTimersByTime(12000);
    expect(active()).toBe(1);

    pause.click();
    expect(pause.getAttribute('aria-pressed')).toBe('false');
    expect(pause.textContent).toBe(learn.en.pause);
    expect(root.hasAttribute('data-playing')).toBe(true);
    vi.advanceTimersByTime(8000);
    expect(active()).toBe(3);
    vi.advanceTimersByTime(4000);
    expect(active()).toBe(0);
  });

  it('holds on arrow buttons and dot clicks, and Play resumes autoplay from the current step', async () => {
    const { active, dots, next, pause, prev, root, steps } = await mount();
    next.click();
    expect(active()).toBe(1);
    expect(root.hasAttribute('data-playing')).toBe(true);
    expect(pause.textContent).toBe(learn.en.play);
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    vi.advanceTimersByTime(10000);
    expect(active()).toBe(1);

    prev.click();
    expect(active()).toBe(0);
    prev.click();
    expect(active()).toBe(3);

    dots[2].click();
    expect(active()).toBe(2);
    expect(steps.map(s => !s.hidden)).toEqual([false, false, true, false]);
    vi.advanceTimersByTime(10000);
    expect(active()).toBe(2);

    pause.click();
    expect(pause.textContent).toBe(learn.en.pause);
    expect(pause.getAttribute('aria-pressed')).toBe('false');
    vi.advanceTimersByTime(4000);
    expect(active()).toBe(3);
  });

  it('supports touch swiping with a 40 px threshold and RTL mirroring', async () => {
    const en = await mount('knn', 'en');
    swipe(en.svg, -39);
    expect(en.active()).toBe(0);
    swipe(en.svg, -45, 50);
    expect(en.active()).toBe(0);
    swipe(en.svg, -40);
    expect(en.active()).toBe(1);
    swipe(en.svg, 40);
    expect(en.active()).toBe(0);

    mounted.pop()!();
    const ar = await mount('knn', 'ar');
    expect(ar.prev.getAttribute('aria-label')).toBe(learn.ar.prevStep);
    expect(ar.next.getAttribute('aria-label')).toBe(learn.ar.nextStep);
    swipe(ar.svg, 40);
    expect(ar.active()).toBe(1);
    swipe(ar.svg, -40);
    expect(ar.active()).toBe(0);
  });

  it('moves steps with Left/Right keys on the focused caption bar (RTL-aware)', async () => {
    const en = await mount('knn', 'en');
    en.caption.focus();
    expect(document.activeElement).toBe(en.caption);
    en.caption.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(en.active()).toBe(1);
    en.caption.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(en.active()).toBe(0);
    en.caption.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(en.active()).toBe(3);
    en.caption.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(en.active()).toBe(0);

    mounted.pop()!();
    const ar = await mount('knn', 'ar');
    ar.caption.focus();
    ar.caption.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(ar.active()).toBe(1);
    ar.caption.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(ar.active()).toBe(0);
  });

  it('replays the held step: shows before(i) instantly, waits 600 ms, then animates frame(i) and restarts loop(i)', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { dots, svg } = await mount('cnn');
    const add = vi.spyOn(svg.classList, 'add');
    const remove = vi.spyOn(svg.classList, 'remove');

    dots[0].click();
    setIntervalSpy.mockClear();
    clearIntervalSpy.mockClear();

    // First replay fires at 3500 ms: rewinds instantly, stops loop, waits 600 ms before frame + loop.
    vi.advanceTimersByTime(3500);
    expect(add.mock.calls.filter(([name]) => name === 'learn-instant')).toHaveLength(1);
    expect(remove.mock.calls.filter(([name]) => name === 'learn-instant')).toHaveLength(1);
    expect(svg.classList.contains('learn-instant')).toBe(false);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(599);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setIntervalSpy.mock.calls.filter(([, delay]) => delay === 65)).toHaveLength(1);
    expect(svg.querySelector('.scene-filter')!.getAttribute('x')).toBe('30');

    // Second cycle at 7000 ms (2900 ms later) + 600 ms.
    vi.advanceTimersByTime(2900);
    expect(add.mock.calls.filter(([name]) => name === 'learn-instant')).toHaveLength(2);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(600);
    expect(setIntervalSpy.mock.calls.filter(([, delay]) => delay === 65)).toHaveLength(2);
  });

  it('persists the view across lessons and languages', async () => {
    const { radios } = await mount();
    radios[1].click();
    expect(window.localStorage.getItem('mlv-learn-mode')).toBe('detailed');
    const { detailed, simple, svg } = await mount('cnn', 'ar');
    expect(detailed.hidden).toBe(false);
    expect(simple.hidden).toBe(true);
    expect(svg.childElementCount).toBe(0);
  });

  it('switches views when storage is blocked', async () => {
    for (const method of ['getItem', 'setItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('Storage blocked'); });
    }
    const { detailed, radios, simple } = await mount();
    expect(simple.hidden).toBe(false);
    radios[1].click();
    expect(detailed.hidden).toBe(false);
    expect(simple.hidden).toBe(true);
    radios[0].click();
    expect(simple.hidden).toBe(false);
  });

  it('shows frame one without autoplay or scene loops under reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {} }));
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const { active, dots, next, pause } = await mount('cnn');
    expect(active()).toBe(0);
    expect(pause.disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(12000);
    expect(active()).toBe(0);

    dots[2].click();
    expect(active()).toBe(2);
    next.click();
    expect(active()).toBe(3);
    vi.advanceTimersByTime(7000);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops the CNN scan offscreen, in a hidden tab and outside Learn', async () => {
    let setVisible = (_visible: boolean) => {};
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        setVisible = isIntersecting => cb([{ isIntersecting }]);
      }
      observe() {}
      disconnect() {}
    });
    const { active, root } = await mount('cnn');
    expect(vi.getTimerCount()).toBe(0);
    setVisible(true);
    expect(vi.getTimerCount()).toBe(2);
    setVisible(false);
    expect(vi.getTimerCount()).toBe(0);
    setVisible(true);
    vi.mocked(Object.getOwnPropertyDescriptor(document, 'hidden')!.get!).mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(8000);
    expect(active()).toBe(0);
    vi.mocked(Object.getOwnPropertyDescriptor(document, 'hidden')!.get!).mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(2);
    root.classList.remove('on');
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(Object.keys(paths) as (keyof typeof paths)[])('mounts all four %s frames in English and Arabic', async id => {
    for (const lang of ['en', 'ar'] as const) {
      const { active, dots, radios, simple, svg, steps } = await mount(id, lang);
      expect(simple.hidden).toBe(false);
      expect(document.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
      expect(svg.getAttribute('direction')).toBe('ltr');
      expect(svg.getAttribute('viewBox')).toBe('0 0 400 300');
      expect(svg.querySelectorAll('text').length).toBeGreaterThan(0);
      expect(radios.map(radio => radio.textContent)).toEqual([learn[lang].simple, learn[lang].detailed]);
      expect(dots).toHaveLength(4);
      expect(steps).toHaveLength(4);
      for (const [i, dot] of dots.entries()) {
        dot.click();
        expect(active()).toBe(i);
        expect(dot.getAttribute('aria-label')).toBe(learn[lang].goToStep.replace('{n}', String(i + 1)));
        expect(svg.getAttribute('aria-label')).toContain(steps[i].querySelector('mark')!.textContent);
      }
    }
  });
});
