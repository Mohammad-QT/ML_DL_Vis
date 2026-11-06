// Small invented tables for the Part 1 interactives.
import { gauss, rng } from '../engine';
import type { Cell } from './logic';

/** Country, age, salary. Blanks are `null`. One high salary makes the mean and the median differ. */
export const PEOPLE: Array<{ country: string; age: Cell; salary: Cell }> = [
  { country: 'France', age: 44, salary: 72000 },
  { country: 'Spain', age: 27, salary: 48000 },
  { country: 'Germany', age: 30, salary: null },
  { country: 'Spain', age: null, salary: 54000 },
  { country: 'Germany', age: 38, salary: 61000 },
  { country: 'France', age: 40, salary: null },
  { country: 'Spain', age: 35, salary: 58000 },
  { country: 'France', age: null, salary: 79000 },
  { country: 'Germany', age: 50, salary: 83000 },
  { country: 'France', age: 37, salary: 250000 },
];

/** 24 people: [age, salary]. Salary is in the tens of thousands, age under 100. */
export const AGE_SALARY: number[][] = (() => {
  const r = rng(7);
  return Array.from({ length: 24 }, () => {
    const age = Math.round(22 + r() * 38);
    const salary = Math.round((30000 + (age - 20) * 1100 + gauss(r) * 14000) / 500) * 500;
    return [age, Math.max(24000, salary)];
  });
})();

/** 40 points in two overlapping groups for the split demo: [x, y, class]. */
export const SPLIT_POINTS: number[][] = (() => {
  const r = rng(21);
  const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v));
  return Array.from({ length: 40 }, (_, i) => {
    const c = i % 2;
    return [clamp(0.5 + (c ? 0.14 : -0.14) + gauss(r) * 0.13), clamp(0.5 + (c ? -0.1 : 0.1) + gauss(r) * 0.13), c];
  });
})();
