// Hand-made example digits for the "Example" button and the hero figure, as pen strokes on the 0–1 pad (y down).
import type { Stroke } from './cnn';

const pts = (...xy: number[]): Stroke => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));
const oval = (cx: number, cy: number, rx: number, ry: number, tilt = 0): Stroke =>
  Array.from({ length: 33 }, (_, i) => {
    const t = (i / 32) * 2 * Math.PI;
    const x = rx * Math.sin(t), y = -ry * Math.cos(t);
    return { x: cx + x * Math.cos(tilt) - y * Math.sin(tilt), y: cy + x * Math.sin(tilt) + y * Math.cos(tilt) };
  });

/** EXAMPLES[d] draws the digit d. */
export const EXAMPLES: Stroke[][] = [
  [oval(0.5, 0.5, 0.17, 0.27, 0.08)],
  [pts(0.43, 0.3, 0.54, 0.21, 0.54, 0.79)],
  [pts(0.33, 0.34, 0.38, 0.26, 0.5, 0.21, 0.62, 0.25, 0.66, 0.35, 0.62, 0.47, 0.5, 0.58, 0.33, 0.77, 0.69, 0.77)],
  [pts(0.33, 0.27, 0.45, 0.21, 0.6, 0.23, 0.66, 0.32, 0.61, 0.43, 0.47, 0.48, 0.6, 0.52, 0.67, 0.62, 0.62, 0.73, 0.48, 0.79, 0.33, 0.74)],
  [pts(0.52, 0.21, 0.3, 0.6, 0.72, 0.6), pts(0.6, 0.38, 0.6, 0.81)],
  [pts(0.66, 0.22, 0.38, 0.22, 0.35, 0.47, 0.5, 0.42, 0.63, 0.47, 0.68, 0.6, 0.62, 0.73, 0.48, 0.79, 0.33, 0.73)],
  [pts(0.62, 0.21, 0.48, 0.3, 0.38, 0.45, 0.35, 0.6, 0.39, 0.73, 0.5, 0.79, 0.62, 0.74, 0.66, 0.62, 0.6, 0.52, 0.48, 0.5, 0.38, 0.57)],
  [pts(0.32, 0.23, 0.68, 0.23, 0.52, 0.5, 0.43, 0.79)],
  [pts(0.5, 0.5, 0.39, 0.43, 0.37, 0.31, 0.5, 0.21, 0.63, 0.3, 0.62, 0.42, 0.5, 0.5, 0.36, 0.6, 0.36, 0.72, 0.5, 0.8, 0.64, 0.72, 0.64, 0.6, 0.5, 0.5)],
  [pts(0.64, 0.33, 0.6, 0.24, 0.5, 0.21, 0.38, 0.26, 0.36, 0.37, 0.45, 0.45, 0.58, 0.43, 0.64, 0.33, 0.62, 0.55, 0.57, 0.8)],
];
