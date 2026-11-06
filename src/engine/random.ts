export type Rng = () => number;

/** Park–Miller generator: same seed, same sequence. Returns numbers in (0, 1). */
export function rng(seed: number): Rng {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Standard normal sample (Box–Muller). */
export function gauss(r: Rng): number {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

export const randomSeed = (): number => ((Math.random() * 1e9) | 0) + 1;

/** At most `max` items, evenly spaced through the list (same input, same output). Keeps the O(n²) kernel models fast on big uploads. */
export function thin<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]);
}
