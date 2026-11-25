import { describe, expect, it } from 'vitest';
import { classificationMetrics, confusionAt, thresholdCurves, type ScoredLabel } from './metrics';

const rows: ScoredLabel[] = [
  { score: 0.9, label: 1 }, { score: 0.7, label: 0 }, { score: 0.6, label: 1 }, { score: 0.2, label: 0 },
];

describe('threshold metrics', () => {
  it('counts the threshold itself as positive and computes hand-checked scores', () => {
    const matrix = confusionAt(rows, 0.7);
    expect(matrix).toEqual({ tp: 1, fp: 1, tn: 1, fn: 1 });
    expect(classificationMetrics(matrix)).toEqual({ precision: 0.5, recall: 0.5, f1: 0.5, accuracy: 0.5, falsePositiveRate: 0.5 });
    const curves = thresholdCurves(rows);
    expect(curves.auc).toBe(0.75);
    expect(curves.pr[3]).toEqual({ precision: 2 / 3, recall: 1, threshold: 0.6 });
  });

  it('treats tied scores as one threshold, independent of input order', () => {
    const ties: ScoredLabel[] = [{ score: 0.5, label: 0 }, { score: 0.5, label: 1 }];
    const curves = thresholdCurves(ties);
    expect(curves.roc).toEqual([{ fpr: 0, tpr: 0, threshold: Infinity }, { fpr: 1, tpr: 1, threshold: 0.5 }]);
    expect(curves.auc).toBe(0.5);
    expect(thresholdCurves(ties.reverse())).toEqual(curves);
  });

  it('keeps undefined ratios finite without inventing an AUC for one class', () => {
    for (const label of [0, 1] as const) {
      const single = [{ score: 0.4, label }];
      expect(thresholdCurves(single).auc).toBeNull();
      expect(classificationMetrics(confusionAt(single, 1)).precision).toBe(0);
      expect(classificationMetrics(confusionAt(single, 1)).recall).toBe(0);
    }
    expect(thresholdCurves([]).auc).toBeNull();
  });
});
