import { fullScreen, mountSheets, relocate, showDockWhileVisible } from './dock';

/**
 * Phone wiring for a lesson Play board (Board.astro / RegBoard.astro): the setting slider and the data chips
 * move into the dock and its sheet, the dock shows while the board is on screen, and Undo / full screen work.
 */
export function mountPlayDock(root: HTMLElement, undo: () => void): void {
  relocate(root);
  mountSheets(root);
  const dock = root.querySelector<HTMLElement>('.dock');
  const frame = root.querySelector<HTMLElement>('.frame');
  if (dock && frame) showDockWhileVisible(dock, frame);
  const full = root.querySelector<HTMLElement>('[data-role="full"]');
  if (full) fullScreen(root, full, { on: full.title, off: full.dataset.off ?? full.title });
  root.querySelectorAll<HTMLButtonElement>('[data-role="undo"]').forEach(b => b.addEventListener('click', undo));
  // Ctrl+Z / Cmd+Z while the board or one of its controls has focus
  root.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });
}
