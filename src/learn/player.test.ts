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
    simple: get('simple'), detailed: get('detailed'), list: get('list'), pause: get<HTMLButtonElement>('pause'),
    radios: [...root.querySelectorAll<HTMLButtonElement>('[role="radio"]')],
    steps: [...root.querySelectorAll<HTMLButtonElement>('[data-learn-frame]')],
    active: () => Number(root.querySelector<HTMLElement>('[aria-current="step"]')!.dataset.learnFrame),
  };
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
  it('advances, loops and follows the pause button', async () => {
    const { active, pause, root } = await mount();
    expect(active()).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(active()).toBe(1);
    expect(root.querySelector('[data-learn-status]')!.textContent).toBe('Step 2 of 4');
    pause.click();
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    expect(root.hasAttribute('data-playing')).toBe(false);
    vi.advanceTimersByTime(9000);
    expect(active()).toBe(1);
    pause.click();
    vi.advanceTimersByTime(9000);
    expect(active()).toBe(0);
  });

  it('scrubs while hovering and waits to resume after leaving the list', async () => {
    const { active, list, root, steps } = await mount();
    for (const i of [1, 3]) {
      steps[i].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      expect(active()).toBe(i);
      // The held step keeps playing (it replays) but autoplay does not move on.
      expect(root.hasAttribute('data-playing')).toBe(true);
      vi.advanceTimersByTime(6000);
      expect(active()).toBe(i);
    }
    list.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(1499);
    expect(root.hasAttribute('data-playing')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(root.hasAttribute('data-playing')).toBe(true);
    vi.advanceTimersByTime(2999);
    expect(active()).toBe(3);
    vi.advanceTimersByTime(1);
    expect(active()).toBe(0);
  });

  it('keeps a tapped step playing until the same step is tapped again', async () => {
    const { active, pause, root, steps } = await mount();
    const tap = () => steps[2].dispatchEvent(new PointerEvent('click', { pointerType: 'touch' }));
    tap();
    expect(active()).toBe(2);
    expect(pause.textContent).toBe(learn.en.pause);
    expect(root.hasAttribute('data-playing')).toBe(true);
    vi.advanceTimersByTime(9000);
    expect(active()).toBe(2);
    tap();
    vi.advanceTimersByTime(1500 + 3000);
    expect(active()).toBe(3);
  });

  it('replays the held step: rewinds to the step before, then animates into it again', async () => {
    const { steps, svg } = await mount();
    const add = vi.spyOn(svg.classList, 'add');
    const remove = vi.spyOn(svg.classList, 'remove');
    steps[1].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(2600 * 2 + 50);
    expect(add.mock.calls.filter(([name]) => name === 'learn-instant')).toHaveLength(2);
    expect(remove.mock.calls.filter(([name]) => name === 'learn-instant')).toHaveLength(2);
    expect(svg.classList.contains('learn-instant')).toBe(false);
  });

  it('restarts the scene loop on each replay of a held step, except under reduced motion', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { steps, svg } = await mount('cnn');
    steps[0].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    setIntervalSpy.mockClear();
    clearIntervalSpy.mockClear();
    vi.advanceTimersByTime(2600 * 2 + 50);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    expect(setIntervalSpy.mock.calls.filter(([, delay]) => delay === 65)).toHaveLength(2);
    expect(svg.querySelector('.scene-filter')!.getAttribute('x')).toBe('30');

    mounted.pop()!();
    setIntervalSpy.mockClear();
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {} }));
    const reduced = await mount('cnn');
    reduced.steps[0].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(2600 * 2 + 50);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
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
    const { active, pause, steps } = await mount('cnn');
    expect(active()).toBe(0);
    expect(pause.disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(9000);
    expect(active()).toBe(0);
    steps[2].click();
    expect(active()).toBe(2);
  });

  it('moves keyboard focus and pauses until focus leaves the list', async () => {
    const { active, pause, root, steps } = await mount();
    steps[0].focus();
    steps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(steps[1]);
    expect(steps.map(step => step.tabIndex)).toEqual([-1, 0, -1, -1]);
    vi.advanceTimersByTime(6000);
    expect(active()).toBe(1);
    pause.focus();
    expect(root.hasAttribute('data-playing')).toBe(false);
    vi.advanceTimersByTime(4500);
    expect(active()).toBe(2);
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
    vi.advanceTimersByTime(6000);
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
      const { active, radios, simple, svg, steps } = await mount(id, lang);
      expect(simple.hidden).toBe(false);
      expect(document.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
      expect(svg.getAttribute('direction')).toBe('ltr');
      expect(svg.getAttribute('viewBox')).toBe('0 0 400 300');
      expect(svg.querySelectorAll('text').length).toBeGreaterThan(0);
      expect(radios.map(radio => radio.textContent)).toEqual([learn[lang].simple, learn[lang].detailed]);
      expect(steps).toHaveLength(4);
      for (const [i, step] of steps.entries()) {
        step.click();
        expect(active()).toBe(i);
        expect(svg.getAttribute('aria-label')).toContain(step.querySelector('mark')!.textContent);
      }
    }
  });
});
