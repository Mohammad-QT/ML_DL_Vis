import { rng } from '../engine/random';
import { fill, learn, type Lang } from '../i18n/ui';
import type { Scene, SceneApi } from './scene';
import { loadScene } from './scenes';

const frameTime = 3000;
const resumeDelay = 1500;
const modeKey = 'mlv-learn-mode';
type Mode = 'simple' | 'detailed';

export async function mountLearn(root: HTMLElement) {
  const moduleId = root.dataset.learn;
  if (!moduleId) return;

  const document = root.ownerDocument;
  const window = document.defaultView!;
  const lang: Lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const ui = learn[lang];
  const words: Record<string, string> = ui;
  const heading = root.querySelector<HTMLElement>('[data-learn-heading]')!;
  const simple = root.querySelector<HTMLElement>('[data-learn-simple]')!;
  const detailed = root.querySelector<HTMLElement>('[data-learn-detailed]')!;
  const previous = root.querySelector<HTMLElement>('[data-learn-previous]');
  const visual = root.querySelector<HTMLElement>('[data-learn-visual]')!;
  const svg = visual.querySelector('svg')!;
  const modes = [...heading.querySelectorAll<HTMLButtonElement>('[data-learn-mode]')];
  const list = root.querySelector<HTMLOListElement>('[data-learn-list]')!;
  const steps = [...list.querySelectorAll<HTMLButtonElement>('[data-learn-frame]')];
  const dots = [...root.querySelectorAll<HTMLElement>('[data-learn-dot]')];
  const status = root.querySelector<HTMLElement>('[data-learn-status]')!;
  const pause = root.querySelector<HTMLButtonElement>('[data-learn-pause]')!;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const listeners = new window.AbortController();
  const options = { signal: listeners.signal };
  const api: SceneApi = {
    svg,
    el(tag, attrs = {}, parent = svg) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
      parent.append(el);
      return el;
    },
    random: rng(1247),
    t: key => words[key] ?? '',
    reduced: motion?.matches ?? false,
  };

  let scene: Scene | undefined;
  let loading: Promise<void> | undefined;
  let mode: Mode = 'simple';
  let current = 0;
  let visible = !window.IntersectionObserver;
  let open = root.classList.contains('on');
  let paused = false;
  let hovering = false;
  let focused = false;
  let pointerType = '';
  let advance: number | undefined;
  let resume: number | undefined;
  let stopLoop: (() => void) | undefined;
  let disposed = false;

  function stop() {
    window.clearTimeout(advance);
    advance = undefined;
    root.removeAttribute('data-playing');
    stopLoop?.();
    stopLoop = undefined;
  }

  function sync() {
    const isPaused = paused || api.reduced;
    pause.textContent = isPaused ? ui.play : ui.pause;
    pause.setAttribute('aria-pressed', String(isPaused));
    pause.disabled = api.reduced;
    if (!scene || mode !== 'simple' || !open || !visible || document.hidden ||
        isPaused || hovering || focused || resume !== undefined) {
      stop();
    } else if (advance === undefined) {
      advance = window.setTimeout(() => select((current + 1) % steps.length), frameTime);
      root.setAttribute('data-playing', '');
      stopLoop = scene.loop?.(current, api);
    }
  }

  function select(index: number) {
    if (index !== current) {
      stop();
      current = index;
      scene?.frame(current, api);
    }
    steps.forEach((step, i) => {
      step.tabIndex = i === current ? 0 : -1;
      if (i === current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
      dots[i].classList.toggle('current', i === current);
    });
    status.textContent = fill(ui.step, { n: current + 1, total: steps.length });
    svg.setAttribute('aria-label', steps[current].querySelector('mark')?.textContent?.trim() || ui.animation);
    sync();
  }

  function clearResume() {
    window.clearTimeout(resume);
    resume = undefined;
  }

  function release() {
    if (hovering || focused) return;
    clearResume();
    resume = window.setTimeout(() => {
      resume = undefined;
      sync();
    }, resumeDelay);
    sync();
  }

  async function setMode(value: Mode) {
    mode = value;
    root.dataset.mode = value;
    simple.hidden = value !== 'simple';
    detailed.hidden = value !== 'detailed';
    if (previous) previous.hidden = value === 'simple';
    for (const button of modes) {
      const active = button.dataset.learnMode === value;
      button.classList.toggle('on', active);
      button.setAttribute('aria-checked', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    hovering = focused = false;
    clearResume();
    sync();
    if (value === 'detailed' || scene) return;

    loading ??= (async () => {
      try {
        const module = await loadScene(moduleId!);
        if (disposed) return;
        const candidate = module?.default();
        if (!candidate || candidate.frames !== steps.length) throw new Error('Invalid Learn scene');
        candidate.setup(api);
        candidate.frame(current, api);
        scene = candidate;
        select(current);
      } catch {
        // If a scene chunk is unavailable, the original lesson is still readable.
        heading.hidden = true;
        await setMode('detailed');
      }
    })();
    await loading;
  }

  function chooseMode(value: Mode) {
    try { window.localStorage.setItem(modeKey, value); } catch { /* optional preference */ }
    void setMode(value);
  }

  function arrow(event: KeyboardEvent, index: number, count: number, horizontal = false) {
    const forward = horizontal && lang === 'ar' ? -1 : 1;
    switch (event.key) {
      case 'ArrowUp': return (index + count - 1) % count;
      case 'ArrowDown': return (index + 1) % count;
      case 'ArrowLeft': return (index - forward + count) % count;
      case 'ArrowRight': return (index + forward + count) % count;
      case 'Home': return 0;
      case 'End': return count - 1;
    }
  }

  for (const [i, button] of modes.entries()) {
    const modeOf = (target: HTMLButtonElement) => target.dataset.learnMode as Mode;
    button.addEventListener('click', () => chooseMode(modeOf(button)), options);
    button.addEventListener('keydown', event => {
      const next = arrow(event, i, modes.length, true);
      if (next === undefined) return;
      event.preventDefault();
      chooseMode(modeOf(modes[next]));
      modes[next].focus();
    }, options);
  }

  for (const [i, step] of steps.entries()) {
    step.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovering = true;
      clearResume();
      select(i);
    }, options);
    step.addEventListener('pointerdown', event => {
      pointerType = event.pointerType;
      // Pointer selection should not hold the keyboard-focus pause after the pointer leaves.
      event.preventDefault();
    }, options);
    step.addEventListener('pointercancel', () => { pointerType = ''; }, options);
    step.addEventListener('focus', () => {
      focused = true;
      clearResume();
      select(i);
    }, options);
    step.addEventListener('click', event => {
      if ((event as PointerEvent).pointerType === 'touch' || pointerType === 'touch') {
        paused = !(paused && current === i);
      }
      pointerType = '';
      select(i);
    }, options);
    step.addEventListener('keydown', event => {
      const next = arrow(event, i, steps.length);
      if (next === undefined) return;
      event.preventDefault();
      steps[next].focus();
    }, options);
  }
  list.addEventListener('pointerleave', event => {
    if (!hovering || event.pointerType === 'touch') return;
    hovering = false;
    release();
  }, options);
  list.addEventListener('focusout', event => {
    if (list.contains(event.relatedTarget as Node | null)) return;
    focused = false;
    release();
  }, options);
  pause.addEventListener('click', () => {
    paused = !paused;
    clearResume();
    sync();
  }, options);
  motion?.addEventListener('change', () => {
    api.reduced = motion.matches;
    if (api.reduced) {
      stop();
      scene?.frame(0, api);
      select(0);
    }
    sync();
  }, options);
  document.addEventListener('visibilitychange', sync, options);

  const intersection = window.IntersectionObserver && new window.IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  intersection?.observe(svg);
  const panel = new window.MutationObserver(() => {
    const next = root.classList.contains('on');
    if (open === next) return;
    open = next;
    hovering = focused = false;
    clearResume();
    sync();
  });
  panel.observe(root, { attributes: true, attributeFilter: ['class'] });

  root.style.setProperty('--frame-time', `${frameTime}ms`);
  heading.hidden = false;
  try { if (window.localStorage.getItem(modeKey) === 'detailed') mode = 'detailed'; } catch { /* optional preference */ }
  await setMode(mode);

  return () => {
    disposed = true;
    stop();
    clearResume();
    listeners.abort();
    intersection?.disconnect();
    panel.disconnect();
  };
}
