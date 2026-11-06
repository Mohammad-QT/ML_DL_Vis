/**
 * Phone layout helpers shared by the lesson Play boards and the Compare page:
 * a bottom dock for the controls you touch, bottom sheets for the rarer ones, full-screen boards, and swipes.
 * "Phone" means narrow (≤ 760px) or short (≤ 480px, a phone held sideways). Desktop never sees the dock.
 */
export const PHONE_QUERY = '(max-width: 760px), (max-height: 480px)';
const mq = typeof matchMedia === 'function' ? matchMedia(PHONE_QUERY) : null;
export const isPhone = () => !!mq?.matches;

/** Run `cb` now and whenever the page crosses the phone breakpoint. */
export function onPhone(cb: (phone: boolean) => void): void {
  cb(isPhone());
  mq?.addEventListener('change', e => cb(e.matches));
}

/**
 * Elements marked `data-phone="slot"` move into the matching `[data-slot="slot"]` inside `root` on phones
 * and back to where they were on wider screens. Their listeners come along, so no control is duplicated.
 */
export function relocate(root: ParentNode): void {
  const items = [...root.querySelectorAll<HTMLElement>('[data-phone]')].map(el => {
    const home = document.createComment('phone-home');
    el.before(home);
    return { el, home, slot: el.dataset.phone! };
  });
  onPhone(phone => {
    for (const it of items) {
      const slot = root.querySelector(`[data-slot="${it.slot}"]`);
      if (phone && slot) slot.append(it.el);
      else it.home.after(it.el);
    }
  });
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

/** A bottom sheet: `.bsheet` plus its `.bscrim`. Esc, the scrim and the close button shut it; focus returns to the opener. */
export class BottomSheet {
  static current: BottomSheet | null = null;
  private trigger: HTMLElement | null = null;
  private scrim: HTMLElement;
  /** Called after the sheet opens, e.g. to fill it with fresh content. */
  onOpen?: () => void;

  constructor(readonly el: HTMLElement) {
    this.scrim = el.previousElementSibling as HTMLElement;
    el.inert = true;
    this.scrim.addEventListener('click', () => this.close());
    el.querySelectorAll<HTMLElement>('[data-sheet-close]').forEach(b => b.addEventListener('click', () => this.close()));
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    mq?.addEventListener('change', e => { if (!e.matches) this.close(false); });
  }

  get isOpen() { return this.el.classList.contains('open'); }

  open(trigger?: HTMLElement | null): void {
    if (BottomSheet.current && BottomSheet.current !== this) BottomSheet.current.close(false);
    BottomSheet.current = this;
    this.trigger = trigger ?? null;
    this.trigger?.setAttribute('aria-expanded', 'true');
    this.el.inert = false;
    this.el.classList.add('open');
    this.scrim.classList.add('open');
    this.onOpen?.();
    // focus the current choice if there is one, else the first control after the close button
    const f = [...this.el.querySelectorAll<HTMLElement>(FOCUSABLE)];
    (this.el.querySelector<HTMLElement>('.bs-body [aria-pressed="true"]') ?? f.find(x => !x.hasAttribute('data-sheet-close')) ?? f[0])?.focus({ preventScroll: true });
  }

  close(restoreFocus = true): void {
    if (!this.isOpen) return;
    this.el.classList.remove('open');
    this.scrim.classList.remove('open');
    this.el.inert = true;
    this.trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) this.trigger?.focus({ preventScroll: true });
    if (BottomSheet.current === this) BottomSheet.current = null;
  }

  toggle(trigger?: HTMLElement | null): void { if (this.isOpen) this.close(); else this.open(trigger); }
}

/** Wire every `[data-sheet-open="id"]` button inside `root` to the sheet with that id. Returns the sheets by id. */
export function mountSheets(root: ParentNode): Record<string, BottomSheet> {
  const sheets: Record<string, BottomSheet> = {};
  root.querySelectorAll<HTMLElement>('.bsheet').forEach(el => (sheets[el.id] = new BottomSheet(el)));
  root.querySelectorAll<HTMLElement>('[data-sheet-open]').forEach(b => b.addEventListener('click', () => sheets[b.dataset.sheetOpen!]?.toggle(b)));
  return sheets;
}

const shown = new Set<HTMLElement>();
let sizer: ResizeObserver | null = null;
/** Keep `--dock-h` on <html> equal to the visible dock's height, and pad the page so the dock never hides its end. */
function syncDockPad() {
  const d = [...shown][0];
  document.body.classList.toggle('docked', !!d);
  if (d) document.documentElement.style.setProperty('--dock-h', `${d.offsetHeight}px`);
}

/**
 * Show `dock` on phones while `watch` (the board's card or section) is on screen.
 * Cards hidden with display:none report no intersection, so a dock from another lesson step never shows.
 */
export function showDockWhileVisible(dock: HTMLElement, watch: Element): void {
  sizer ??= new ResizeObserver(syncDockPad);
  sizer.observe(dock);
  new IntersectionObserver(es => {
    const on = es[es.length - 1].isIntersecting;
    dock.classList.toggle('show', on);
    if (on) shown.add(dock); else shown.delete(dock);
    syncDockPad();
  }).observe(watch);
}

/**
 * Full-screen board: `root` gets `.full` (fixed over the page, see dock.css) and, where the browser allows,
 * real full screen too. Esc, the button again, or leaving browser full screen turn it off.
 */
export function fullScreen(root: HTMLElement, btn: HTMLElement, labels: { on: string; off: string }): (on: boolean) => void {
  let on = false;
  const set = (next: boolean) => {
    if (next === on) return;
    on = next;
    root.classList.toggle('full', on);
    document.documentElement.classList.toggle('mlv-full', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? labels.off : labels.on);
    btn.title = on ? labels.off : labels.on;
    try {
      if (on) root.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => { /* the CSS version still works */ });
      else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch { /* no Fullscreen API (iPhone Safari): the CSS version is enough */ }
  };
  btn.addEventListener('click', () => set(!on));
  addEventListener('keydown', e => { if (e.key === 'Escape' && on && !BottomSheet.current) set(false); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && on) set(false); });
  mq?.addEventListener('change', e => { if (!e.matches) set(false); });
  return set;
}

/**
 * A quick sideways flick on `el` (not a slow drag, which is the board's long-press peek).
 * `cb(+1)` means "next" in reading order, so the direction mirrors in right-to-left pages.
 */
export function onSwipe(el: HTMLElement, cb: (dir: 1 | -1) => void): void {
  let start: { x: number; y: number; t: number; id: number } | null = null;
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
  const end = (e: PointerEvent) => {
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, dt = performance.now() - start.t;
    start = null;
    if (dt < 450 && Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) {
      const rtl = getComputedStyle(el).direction === 'rtl';
      cb(((dx < 0) !== rtl ? 1 : -1));
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => (start = null));
}
