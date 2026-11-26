import { rng } from '../engine/random';
import { fill, learn, type Lang } from '../i18n/ui';
import type { Scene, SceneApi } from './scene';
import { loadScene } from './scenes';

const frameTime = 4000;
/** While a step is held (via arrows, dots, swipe or keyboard), it replays this often. */
const replayTime = 3500;
/** Hold the `before` state for this long before animating `frame(i)` on replay. */
const replayWait = 600;
const swipeThreshold = 40;
const modeKey = 'mlv-learn-mode';
type Mode = 'simple' | 'detailed';

export async function mountLearn(root: HTMLElement) {
  const moduleId = root.dataset.learn;
  if (!moduleId) return;

  const document = root.ownerDocument;
  const window = document.defaultView!;
  const lang: Lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const ui = learn[lang];
  // Shared scene words, plus the lesson's own `quick.words` from its frontmatter.
  let own: Record<string, string> = {};
  try { own = JSON.parse(root.dataset.learnWords ?? '{}'); } catch { /* bad words: fall back to the shared ones */ }
  const words: Record<string, string> = { ...ui, ...own };
  const heading = root.querySelector<HTMLElement>('[data-learn-heading]')!;
  const simple = root.querySelector<HTMLElement>('[data-learn-simple]')!;
  const detailed = root.querySelector<HTMLElement>('[data-learn-detailed]')!;
  const previous = root.querySelector<HTMLElement>('[data-learn-previous]');
  const visual = root.querySelector<HTMLElement>('[data-learn-visual]')!;
  const svg = visual.querySelector('svg')!;
  const modes = [...heading.querySelectorAll<HTMLButtonElement>('[data-learn-mode]')];
  const caption = root.querySelector<HTMLElement>('[data-learn-caption]')!;
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-learn-prev]')!;
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-learn-next]')!;
  const steps = [...root.querySelectorAll<HTMLElement>('[data-learn-step]')];
  const dots = [...root.querySelectorAll<HTMLButtonElement>('[data-learn-dot]')];
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
  let held = false;
  let swipe: { id: number; x: number; y: number } | null = null;
  let advance: number | undefined;
  let replaying: number | undefined;
  let replayFrame: number | undefined;
  let stopLoop: (() => void) | undefined;
  let replayToken = 0;
  let disposed = false;

  function stop() {
    replayToken++;
    window.clearTimeout(advance);
    advance = undefined;
    window.clearInterval(replaying);
    replaying = undefined;
    window.clearTimeout(replayFrame);
    replayFrame = undefined;
    root.removeAttribute('data-playing');
    stopLoop?.();
    stopLoop = undefined;
  }

  function sync() {
    const autoplayOff = paused || held || api.reduced;
    pause.textContent = autoplayOff ? ui.play : ui.pause;
    pause.setAttribute('aria-pressed', String(autoplayOff));
    pause.disabled = api.reduced;
    if (!scene || mode !== 'simple' || !open || !visible || document.hidden || paused || api.reduced) {
      stop();
    } else if (held) {
      // Keep the held step replaying on a ~3.5 s cycle while holding autoplay.
      if (advance !== undefined) stop();
      if (replaying === undefined) {
        replaying = window.setInterval(replay, replayTime);
        root.setAttribute('data-playing', '');
        stopLoop = scene.loop?.(current, api);
      }
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
      step.hidden = i !== current;
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('current', i === current);
      if (i === current) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
    status.textContent = `${current + 1} / ${steps.length}`;
    status.setAttribute('aria-label', fill(ui.step, { n: current + 1, total: steps.length }));
    svg.setAttribute('aria-label', steps[current].querySelector('mark')?.textContent?.trim() || ui.animation);
    sync();
  }

  function holdStep(index: number) {
    held = true;
    paused = false;
    select((index + steps.length) % steps.length);
  }

  /** Jump, without animating, to the state before the current step, wait ~600 ms, then animate into the step again. */
  function replay() {
    if (!scene) return;
    stopLoop?.();
    stopLoop = undefined;
    window.clearTimeout(replayFrame);
    replayFrame = undefined;
    svg.classList.add('learn-instant');
    if (scene.before) scene.before(current, api);
    else scene.frame((current + steps.length - 1) % steps.length, api);
    svg.getBoundingClientRect();
    svg.classList.remove('learn-instant');
    const token = ++replayToken;
    replayFrame = window.setTimeout(() => {
      replayFrame = undefined;
      if (disposed || token !== replayToken) return;
      scene?.frame(current, api);
      if (!api.reduced) {
        stopLoop = scene?.loop?.(current, api);
      }
    }, replayWait);
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
    held = false;
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

  prevBtn.addEventListener('click', () => holdStep(current - 1), options);
  nextBtn.addEventListener('click', () => holdStep(current + 1), options);
  for (const [i, dot] of dots.entries()) {
    dot.addEventListener('click', () => holdStep(i), options);
  }

  caption.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    const next = arrow(event, current, steps.length, true);
    if (next === undefined) return;
    event.preventDefault();
    holdStep(next);
  }, options);

  svg.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, options);
  document.addEventListener('pointerup', event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < swipeThreshold || Math.abs(dx) <= Math.abs(dy)) return;
    const dir = dx < 0 ? 1 : -1;
    const delta = lang === 'ar' ? -dir : dir;
    holdStep(current + delta);
  }, options);
  document.addEventListener('pointercancel', event => {
    if (swipe && event.pointerId === swipe.id) swipe = null;
  }, options);

  pause.addEventListener('click', () => {
    if (paused || held) {
      paused = false;
      held = false;
    } else {
      paused = true;
    }
    sync();
  }, options);

  motion?.addEventListener('change', () => {
    api.reduced = motion.matches;
    if (api.reduced) {
      held = false;
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
    held = false;
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
    listeners.abort();
    intersection?.disconnect();
    panel.disconnect();
  };
}
