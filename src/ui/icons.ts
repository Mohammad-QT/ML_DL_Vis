/** Small stroke icons for the dock and sheets (24×24, currentColor). Decorative: buttons carry their own labels. */
const svg = (d: string, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}><path d="${d}"/></svg>`;

export const ICON = {
  undo: svg('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11'),
  full: svg('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  caret: svg('m6 15 6-6 6 6', ' class="caret"'),
  down: svg('m6 9 6 6 6-6', ' class="caret"'),
  swap: svg('M7 7h13l-4-4M17 17H4l4 4'),
} as const;
