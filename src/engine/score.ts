import type { Model, Sample } from './types';

/** Accuracy in [0, 1], or null when there are no points to score. */
export function score(model: Model, pts: Sample[]): number | null {
  if (!pts.length) return null;
  let ok = 0;
  for (const p of pts) if ((model.predict(p.x, p.y) > 0.5 ? 1 : 0) === p.c) ok++;
  return ok / pts.length;
}

export const pct = (v: number | null): string => (v == null ? '–' : `${Math.round(v * 100)}%`);
