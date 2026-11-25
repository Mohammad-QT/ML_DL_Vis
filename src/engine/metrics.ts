export type ScoredLabel = { score: number; label: 0 | 1 };
export type Confusion = { tp: number; fp: number; tn: number; fn: number };

export function confusionAt(rows: readonly ScoredLabel[], threshold: number): Confusion {
  const counts: Confusion = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const { score, label } of rows) counts[score >= threshold ? (label ? 'tp' : 'fp') : (label ? 'fn' : 'tn')]++;
  return counts;
}

const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : 0;

export function classificationMetrics({ tp, fp, tn, fn }: Confusion) {
  return {
    precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn),
    f1: ratio(2 * tp, 2 * tp + fp + fn),
    accuracy: ratio(tp + tn, tp + fp + tn + fn),
    falsePositiveRate: ratio(fp, fp + tn),
  };
}

export function thresholdCurves(rows: readonly ScoredLabel[]) {
  const sorted = [...rows].sort((left, right) => right.score - left.score);
  const positives = rows.filter(row => row.label === 1).length;
  const negatives = rows.length - positives;
  const roc = [{ fpr: 0, tpr: 0, threshold: Infinity }];
  const pr = [{ precision: 1, recall: 0, threshold: Infinity }];
  let tp = 0;
  let fp = 0;
  let auc = 0;
  for (let index = 0; index < sorted.length;) {
    const { score } = sorted[index];
    do {
      if (sorted[index++].label === 1) tp++;
      else fp++;
    } while (index < sorted.length && sorted[index].score === score);
    const fpr = ratio(fp, negatives);
    const tpr = ratio(tp, positives);
    const last = roc[roc.length - 1];
    auc += (fpr - last.fpr) * (tpr + last.tpr) / 2;
    roc.push({ fpr, tpr, threshold: score });
    pr.push({ precision: ratio(tp, tp + fp), recall: tpr, threshold: score });
  }
  return { roc, pr, auc: positives && negatives ? auc : null };
}
