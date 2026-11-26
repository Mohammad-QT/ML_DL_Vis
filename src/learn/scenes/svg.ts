import type { SceneApi } from '../scene';

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const textContentDesc = typeof Node !== 'undefined' ? Object.getOwnPropertyDescriptor(Node.prototype, 'textContent') : undefined;
const baseSetAttribute = typeof Element !== 'undefined' ? Element.prototype.setAttribute : undefined;

function flipAnchor(anchor: string): string {
  if (anchor === 'start') return 'end';
  if (anchor === 'end') return 'start';
  return anchor;
}

export function label(api: SceneApi, parent: Element, x: number, y: number, text: string, attrs: Record<string, string | number> = {}) {
  let logicalAnchor = attrs['text-anchor'] !== undefined ? String(attrs['text-anchor']) : undefined;
  const el = api.el('text', { x, y, fill: 'var(--ink)', 'font-size': 16, ...attrs }, parent);
  const setAttr = typeof Element !== 'undefined' && el instanceof Element && baseSetAttribute ? baseSetAttribute : el.setAttribute;

  const syncRtl = (value: string) => {
    if (ARABIC_RE.test(value)) {
      setAttr.call(el, 'direction', 'rtl');
      setAttr.call(el, 'unicode-bidi', 'plaintext');
      setAttr.call(el, 'text-anchor', flipAnchor(logicalAnchor ?? 'start'));
    } else {
      el.removeAttribute('direction');
      el.removeAttribute('unicode-bidi');
      if (logicalAnchor !== undefined) setAttr.call(el, 'text-anchor', logicalAnchor);
      else el.removeAttribute('text-anchor');
    }
  };

  el.setAttribute = function (name: string, value: string) {
    if (name === 'text-anchor') {
      logicalAnchor = String(value);
      const resolved = ARABIC_RE.test(this.textContent ?? '') ? flipAnchor(logicalAnchor) : logicalAnchor;
      return setAttr.call(this, name, resolved);
    }
    return setAttr.call(this, name, value);
  };

  if (typeof Node !== 'undefined' && el instanceof Node && textContentDesc?.set && textContentDesc?.get) {
    Object.defineProperty(el, 'textContent', {
      configurable: true,
      get() {
        return textContentDesc.get!.call(this);
      },
      set(value: string | null) {
        textContentDesc.set!.call(this, value);
        syncRtl(value ?? '');
      },
    });
    el.textContent = text;
  } else {
    el.textContent = text;
    syncRtl(text);
  }

  return el;
}

export function line(api: SceneApi, parent: Element, x1: number, y1: number, x2: number, y2: number, attrs: Record<string, string | number> = {}) {
  return api.el('line', { x1, y1, x2, y2, stroke: 'var(--rule)', 'stroke-width': 1.5, 'stroke-linecap': 'round', ...attrs }, parent);
}
