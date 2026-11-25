// Vitest global setup: build the site once into a temporary folder, so every demo test can mount its
// demo on the real built lesson pages. One shared build keeps `npm test` fast and stops parallel builds
// from timing out on slower machines.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext { siteDir: string }
}

export default function setup(project: TestProject) {
  mkdirSync('.astro', { recursive: true });
  const out = mkdtempSync(resolve('.astro/test-site-'));
  execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', out], {
    timeout: 300_000,
    stdio: 'pipe',
    windowsHide: true,
  });
  project.provide('siteDir', out);
  return () => rmSync(out, { recursive: true, force: true });
}
