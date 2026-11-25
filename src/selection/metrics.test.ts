// @vitest-environment jsdom
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, inject, it } from 'vitest';
import { LESSONS } from '../course';
import { empty } from '../progress';
import { paint } from '../progressui';
import { classificationMetrics, confusionAt } from '../engine/metrics';
import { fitMetricPreset, mountMetrics } from './metrics';

const siteDir = inject('siteDir');
const extras = LESSONS.filter(item => item.extra);
const readPage = (path: string) => new DOMParser().parseFromString(readFileSync(join(siteDir, path, 'index.html'), 'utf8'), 'text/html');

afterEach(() => document.body.replaceChildren());

it.each(['en', 'ar'])('moves the threshold and ROC marker on the built %s metrics page', lang => {
  const page = readPage(`${lang === 'ar' ? 'ar/' : ''}learn/10-selection/metrics/`);
  expect(page.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
  document.body.replaceChildren(...page.body.childNodes);
  const demo = document.querySelector<HTMLElement>('[data-metrics-demo]')!;
  expect(document.querySelector('.hero input')).toBeNull();
  expect(() => { paint(empty()); mountMetrics(demo); }).not.toThrow();
  const slider = demo.querySelector<HTMLInputElement>('[data-metrics-threshold]')!;
  const marker = demo.querySelector('[data-metrics-roc-point]')!;
  const boundary = demo.querySelector('[data-metrics-boundary]')!;
  const original = boundary.getAttribute('points');
  const auc = demo.querySelector('[data-metrics-auc]')!.textContent;
  expect(original).not.toBe('');
  slider.value = '80';
  slider.dispatchEvent(new Event('input'));
  expect(boundary.getAttribute('points')).not.toBe(original);
  slider.value = '0';
  slider.dispatchEvent(new Event('input'));
  expect(marker.getAttribute('cx')).toBe('204');
  expect(marker.getAttribute('cy')).toBe('12');
  expect(demo.querySelector('[data-metrics-auc]')!.textContent).toBe(auc);
  const preset = demo.querySelector<HTMLSelectElement>('[data-metrics-preset]')!;
  preset.value = 'rare';
  preset.dispatchEvent(new Event('change'));
  expect(demo.querySelector('[data-metrics-tp]')!.textContent).toBe(new Intl.NumberFormat(lang).format(8));
  expect(demo.querySelector('[data-metrics-points]')!.children).toHaveLength(120);
});

it('uses learnable data and shows why high accuracy is not enough', () => {
  const balanced = fitMetricPreset('balanced');
  const rare = fitMetricPreset('rare');
  const overlap = fitMetricPreset('overlap');
  // Learnable, but with some overlap so moving the threshold trades precision for recall.
  expect(balanced.auc).toBeGreaterThan(0.9);
  expect(balanced.auc).toBeLessThan(0.99);
  expect(overlap.auc).toBeLessThan(balanced.auc!);
  expect(overlap.auc).toBeGreaterThan(0.65);
  const { accuracy, recall } = classificationMetrics(confusionAt(rare.points, 0.5));
  expect(accuracy).toBeGreaterThan(0.9);
  expect(recall).toBeLessThan(0.75);
});

it.each(['en', 'ar'])('ships home thumbnails, quizzes and notebook links for all five new %s lessons', lang => {
  const prefix = lang === 'ar' ? 'ar/' : '';
  const home = readPage(prefix);
  const sitemap = readFileSync(join(siteDir, 'sitemap.xml'), 'utf8');
  expect(extras).toHaveLength(5);
  for (const item of extras) {
    const path = `${prefix}${item.path}`;
    const page = readPage(path);
    expect(sitemap).toContain(`/ML_DL_Vis/${path}</loc>`);
    expect(home.querySelector(`.mini[data-lesson="${item.key}"]`)).toBeTruthy();
    expect(page.querySelector(`.rail [data-lesson="${item.key}"]`)).toBeTruthy();
    expect(page.querySelector('.extra-tag')).toBeNull();
    expect(page.querySelectorAll('.qz')).toHaveLength(2);
    expect(page.querySelector('[data-run="colab"]')?.getAttribute('href')).toContain(item.notebook);
    expect(page.querySelector('[download]')?.getAttribute('href')).toBe(`/ML_DL_Vis/${item.notebook}`);
    expect(existsSync(join(siteDir, item.notebook))).toBe(true);
  }
});
