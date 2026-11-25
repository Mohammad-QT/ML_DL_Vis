import { rng } from './random';

const STOP_WORDS = new Set('a an and are as at be but by for from i in is it my of on or our so the their this to was we were with you'.split(' '));

export const cleanText = (text: string): string => text.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
export const splitWords = (cleaned: string): string[] => cleaned.split(/\s+/).filter(Boolean);
export const withoutStopWords = (words: readonly string[]): string[] => words.filter(word => !STOP_WORDS.has(word));

/** A single suffix-strip for illustration, not the Porter stemmer. */
export function stemWord(word: string): string {
  const suffix = ['ing', 'ed', 's'].find(end => word.endsWith(end) && word.length - end.length >= 3);
  return suffix ? word.slice(0, -suffix.length) : word;
}

export function tokenize(text: string, stopWords: boolean, stemming: boolean): string[] {
  const words = splitWords(cleanText(text));
  return (stopWords ? withoutStopWords(words) : words).map(word => stemming ? stemWord(word) : word);
}

function frequencies(words: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}

export function buildVocabulary(texts: readonly (readonly string[])[], maxSize: number): string[] {
  const counts = frequencies(texts.flat());
  return [...counts.keys()].sort((left, right) =>
    counts.get(right)! - counts.get(left)! || (left < right ? -1 : 1)).slice(0, Math.max(0, maxSize));
}

export function countVector(words: readonly string[], vocabulary: readonly string[]): number[] {
  const counts = frequencies(words);
  return vocabulary.map(word => counts.get(word) ?? 0);
}

export type Sentiment = 0 | 1;
type Pair = [number, number];

export function trainMultinomialNB(vectors: readonly (readonly number[])[], labels: readonly Sentiment[]) {
  const width = vectors[0]?.length ?? 0;
  const counts: [number[], number[]] = [Array(width).fill(1), Array(width).fill(1)];
  const documents: Pair = [0, 0];
  vectors.forEach((vector, row) => {
    const label = labels[row];
    documents[label] += 1;
    vector.forEach((count, col) => { counts[label][col] += count; });
  });
  const likelihood = counts.map(row => {
    const total = row.reduce((sum, count) => sum + count, 0);
    return row.map(count => Math.log(count / total));
  });
  const prior = documents.map(count => Math.log((count + 1) / (labels.length + 2)));
  const logRatios = likelihood[1].map((value, col) => value - likelihood[0][col]);
  return {
    logRatios,
    predict(vector: readonly number[]): { label: Sentiment; probabilities: Pair } {
      const odds = vector.reduce((sum, count, col) => sum + count * logRatios[col], prior[1] - prior[0]);
      const probabilities: Pair = [1 / (1 + Math.exp(odds)), 1 / (1 + Math.exp(-odds))];
      return { label: odds > 0 ? 1 : 0, probabilities };
    },
  };
}

export function splitReviews<T>(items: readonly T[], seed: number): { train: T[]; test: T[] } {
  const shuffled = [...items];
  const random = rng(seed);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const testSize = Math.min(Math.ceil(shuffled.length / 4), Math.max(0, shuffled.length - 1));
  return { test: shuffled.slice(0, testSize), train: shuffled.slice(testSize) };
}

export function scoreSentiment(actual: readonly Sentiment[], predicted: readonly Sentiment[]) {
  const matrix: [Pair, Pair] = [[0, 0], [0, 0]];
  actual.forEach((label, index) => { matrix[label][predicted[index]] += 1; });
  return { matrix, accuracy: actual.length ? (matrix[0][0] + matrix[1][1]) / actual.length : 0 };
}
