// @vitest-environment jsdom
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { empty } from '../progress';
import { paint } from '../progressui';
import { mountRules } from './demos';
import { RULES, rulesPath } from './lessons';

let out: string;
beforeAll(() => {
  mkdirSync('.astro', { recursive: true });
  out = mkdtempSync(resolve('.astro/rules-test-'));
  execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', out], {
    timeout: 90_000,
    stdio: 'pipe',
    windowsHide: true,
  });
}, 95_000);

afterAll(() => {
  if (out?.startsWith(resolve('.astro') + sep)) rmSync(out, { recursive: true, force: true });
});

afterEach(() => { document.body.replaceChildren(); });

it.each(RULES)('mounts and updates the %s demo on both built lesson pages', id => {
  for (const lang of ['en', 'ar']) {
    const path = join(out, lang === 'ar' ? 'ar' : '', rulesPath(id), 'index.html');
    const page = new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');
    document.body.replaceChildren(...page.body.childNodes);
    expect(page.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
    expect(document.querySelector('.hero figure svg')).toBeTruthy();
    expect(document.querySelectorAll('.qz')).toHaveLength(2);
    expect(document.querySelector('[data-run="local"]')?.getAttribute('href')).toContain(`notebooks/5-rules/${id}.ipynb`);
    const demo = document.querySelector<HTMLElement>(`[data-rules="${id}"]`)!;
    expect(() => {
      mountRules(demo);
      paint(empty());
    }).not.toThrow();
    const board = demo.querySelector('[data-rules-board]')!;
    expect(board.children).toHaveLength(20);
    const chosen = board.querySelectorAll('button')[1];
    chosen.click();
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    const item = demo.querySelector<HTMLButtonElement>('[data-rules-editor] button')!;
    const before = chosen.textContent;
    item.click();
    expect(chosen.textContent).not.toBe(before);
    item.click();
    expect(chosen.textContent).toBe(before);
    demo.querySelector<HTMLButtonElement>('[data-rules-preset="pasta"]')!.click();
    const result = demo.querySelector<HTMLButtonElement>('[data-rules-results] button')!;
    expect(result).toBeTruthy();
    if (id === 'apriori') {
      expect(demo.querySelectorAll('[data-rules-levels] li').length).toBeGreaterThanOrEqual(3);
      result.closest('tr')!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      expect(board.querySelectorAll('.rules-match').length).toBeGreaterThan(0);
      result.closest('tr')!.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      expect(board.querySelectorAll('.rules-match')).toHaveLength(0);
      result.click();
      expect(result.getAttribute('aria-pressed')).toBe('true');
      expect(board.querySelectorAll('.rules-match').length).toBeGreaterThan(0);
      result.click();
      expect(board.querySelectorAll('.rules-match')).toHaveLength(0);
    } else {
      expect(demo.querySelectorAll('[data-rules-tids] dt')).toHaveLength(9);
      result.click();
      expect(result.getAttribute('aria-pressed')).toBe('true');
      expect(board.querySelectorAll('.rules-match').length).toBeGreaterThan(0);
      expect(demo.querySelectorAll('.rules-common')).toHaveLength(2 * board.querySelectorAll('.rules-match').length);
    }
    const support = demo.querySelector<HTMLInputElement>('[data-rules-support]')!;
    support.value = '100';
    support.dispatchEvent(new Event('input'));
    expect(demo.querySelector('[data-rules-results]')?.children).toHaveLength(0);
    expect(demo.querySelector<HTMLElement>('[data-rules-empty]')?.hidden).toBe(false);
  }
});
