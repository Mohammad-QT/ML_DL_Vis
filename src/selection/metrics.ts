import { classificationMetrics, confusionAt, thresholdCurves } from '../engine/metrics';
import { logistic } from '../engine/models/logistic';
import { gauss, rng } from '../engine/random';
import type { Label, Sample } from '../engine/types';

export const METRIC_PRESETS = ['balanced', 'rare', 'overlap'] as const;
type MetricPreset = typeof METRIC_PRESETS[number];
const boardSize = 240;

export function fitMetricPreset(preset: MetricPreset) {
  const random = rng(941);
  const sample = (): Sample[] => {
    const positives = preset === 'rare' ? 8 : 60;
    const spread = preset === 'overlap' ? 0.19 : preset === 'rare' ? 0.15 : 0.14;
    const offset = preset === 'overlap' ? 0.085 : preset === 'rare' ? 0.15 : 0.14;
    const bound = (value: number) => Math.max(0.025, Math.min(0.975, value));
    return Array.from({ length: 120 }, (_, index) => {
      const c: Label = index < positives ? 1 : 0;
      const direction = c ? 1 : -1;
      return { c, x: bound(0.5 + direction * offset + spread * gauss(random)), y: bound(0.5 - direction * offset * 0.58 + spread * gauss(random)) };
    });
  };
  const model = logistic();
  model.fit(sample());
  const points = sample().map(({ x, y, c }) => ({ x, y, label: c, score: model.predict(x, y) }));
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => {
    const probability = model.predict(x, y);
    return { x, y, logit: Math.log(probability / (1 - probability)) };
  });
  return { points, corners, ...thresholdCurves(points) };
}

function boardRegion({ corners }: ReturnType<typeof fitMetricPreset>, threshold: number) {
  const cutoff = Math.log(threshold / (1 - threshold));
  const polygon: string[] = [];
  const crossings: string[] = [];
  const coords = (x: number, y: number) => `${x * boardSize},${y * boardSize}`;
  corners.forEach((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    if (corner.logit >= cutoff) polygon.push(coords(corner.x, corner.y));
    if ((corner.logit >= cutoff) !== (next.logit >= cutoff)) {
      const portion = (cutoff - corner.logit) / (next.logit - corner.logit);
      const point = coords(corner.x + portion * (next.x - corner.x), corner.y + portion * (next.y - corner.y));
      polygon.push(point);
      crossings.push(point);
    }
  });
  return { polygon: polygon.join(' '), boundary: crossings.join(' ') };
}

export function mountMetrics(root: HTMLElement) {
  const get = <ElementType extends Element>(name: string) => root.querySelector<ElementType>(`[data-metrics-${name}]`)!;
  const slider = get<HTMLInputElement>('threshold');
  const preset = get<HTMLSelectElement>('preset');
  const percent = new Intl.NumberFormat(root.lang, { style: 'percent', maximumFractionDigits: 1 });
  const decimal = new Intl.NumberFormat(root.lang, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const integer = new Intl.NumberFormat(root.lang);
  const rocX = (fpr: number) => 28 + fpr * 176;
  const rocY = (tpr: number) => 188 - tpr * 176;
  let data: ReturnType<typeof fitMetricPreset>;

  function paint() {
    const threshold = Number(slider.value) / 100;
    const counts = confusionAt(data.points, threshold);
    const scores = classificationMetrics(counts);
    const { polygon, boundary } = boardRegion(data, threshold);
    get('region').setAttribute('points', polygon);
    get('boundary').setAttribute('points', boundary);
    const thresholdText = percent.format(threshold);
    get('threshold-value').textContent = thresholdText;
    slider.setAttribute('aria-valuetext', thresholdText);
    for (const key of ['tp', 'fp', 'tn', 'fn'] as const) get(key).textContent = integer.format(counts[key]);
    for (const key of ['precision', 'recall', 'f1', 'accuracy'] as const) get(key).textContent = percent.format(scores[key]);
    get('auc').textContent = data.auc == null ? '—' : decimal.format(data.auc);
    get('roc-point').setAttribute('cx', String(rocX(scores.falsePositiveRate)));
    get('roc-point').setAttribute('cy', String(rocY(scores.recall)));
  }

  function load() {
    data = fitMetricPreset(preset.value as MetricPreset);
    get('points').innerHTML = data.points.map(({ x, y, label }) => label
      ? `<circle cx="${x * boardSize}" cy="${y * boardSize}" r="3.3" fill="var(--b)"/>`
      : `<circle cx="${x * boardSize}" cy="${y * boardSize}" r="2.7" fill="var(--sheet)" stroke="var(--a)"/>`).join('');
    get('roc-line').setAttribute('points', data.roc.map(({ fpr, tpr }) => `${rocX(fpr)},${rocY(tpr)}`).join(' '));
    paint();
  }

  slider.addEventListener('input', paint);
  preset.addEventListener('change', load);
  load();
}
