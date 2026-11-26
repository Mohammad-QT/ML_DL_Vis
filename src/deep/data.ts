// Point sets for the neural-network board. Blobs, XOR and circles reuse the classification presets; the spiral is new.
import { gauss, rng, type Rng } from '../engine/random';
import { PRESETS } from '../engine/store';
import type { Label, Sample } from '../engine/types';

export const ANN_PRESETS = ['blobs', 'xor', 'circles', 'spiral'] as const;
export type AnnPreset = (typeof ANN_PRESETS)[number];

/** Two arms that wind around each other: a single straight line gets about half of them right. */
function spiral(r: Rng): Sample[] {
  const points: Sample[] = [];
  const n = 70;
  for (let i = 0; i < n; i++) {
    const t = 0.3 + (i / n) * 2.1 * Math.PI;
    const radius = 0.04 + 0.36 * (i / n);
    for (const c of [0, 1] as Label[]) {
      const angle = t + c * Math.PI;
      points.push({
        x: 0.5 + radius * Math.cos(angle) + gauss(r) * 0.012,
        y: 0.5 + radius * Math.sin(angle) + gauss(r) * 0.012,
        c,
      });
    }
  }
  return points;
}

export function annPoints(preset: AnnPreset, seed: number): Sample[] {
  const r = rng(seed);
  const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v));
  return (preset === 'spiral' ? spiral(r) : PRESETS[preset](r)).map(p => ({ ...p, x: clamp(p.x), y: clamp(p.y) }));
}

/** Board coordinates (0–1, y down) to network inputs centred on 0. */
export const toInputs = (x: number, y: number): [number, number] => [2 * x - 1, 1 - 2 * y];
