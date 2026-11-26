import type { SceneApi } from '../scene';

export function label(api: SceneApi, parent: Element, x: number, y: number, text: string, attrs: Record<string, string | number> = {}) {
  const el = api.el('text', { x, y, fill: 'var(--ink)', 'font-size': 16, ...attrs }, parent);
  el.textContent = text;
  return el;
}

export function line(api: SceneApi, parent: Element, x1: number, y1: number, x2: number, y2: number, attrs: Record<string, string | number> = {}) {
  return api.el('line', { x1, y1, x2, y2, stroke: 'var(--rule)', 'stroke-width': 1.5, 'stroke-linecap': 'round', ...attrs }, parent);
}
