import { describe, expect, it } from 'vitest';
import { buildVocabulary, cleanText, countVector, scoreSentiment, splitReviews, splitWords, stemWord, tokenize, trainMultinomialNB } from './text';

describe('bag of words', () => {
  it('cleans, splits, drops stop words and strips one suffix', () => {
    const cleaned = cleanText('The CAFÉ? 2 cups, and I liked cakes.');
    expect(cleaned).toBe('the caf cups and i liked cakes');
    expect(splitWords(cleaned)).toEqual(['the', 'caf', 'cups', 'and', 'i', 'liked', 'cakes']);
    expect(tokenize('The cups and cakes were not good.', true, true)).toEqual(['cup', 'cake', 'not', 'good']);
    expect(stemWord('liked')).toBe('lik');
    expect(stemWord('stirring')).toBe('stirr');
    expect(tokenize('The cakes', false, false)).toEqual(['the', 'cakes']);
  });

  it('keeps the most frequent terms and breaks ties alphabetically', () => {
    const rows = [['tea', 'pie', 'tea'], ['bun', 'tea']];
    expect(buildVocabulary(rows, 2)).toEqual(['tea', 'bun']);
    expect(buildVocabulary([...rows].reverse(), 3)).toEqual(['tea', 'bun', 'pie']);
    expect(countVector(['pie', 'tea', 'tea', 'unknown'], ['tea', 'bun', 'pie'])).toEqual([2, 0, 1]);
  });

  it('handles empty text', () => {
    expect(tokenize('123!!!', true, true)).toEqual([]);
    expect(buildVocabulary([[]], 5)).toEqual([]);
    expect(countVector([], ['tea'])).toEqual([0]);
  });
});

describe('sentiment', () => {
  const model = trainMultinomialNB([[4, 0], [2, 0], [0, 4], [0, 2]], [0, 0, 1, 1]);

  it('learns the classes and explains both directions', () => {
    expect(model.predict([2, 0]).label).toBe(0);
    expect(model.predict([0, 2]).label).toBe(1);
    expect(model.logRatios[0]).toBeCloseTo(-Math.log(7));
    expect(model.logRatios[1]).toBeCloseTo(Math.log(7));
    expect(model.predict([0, 0]).probabilities).toEqual([0.5, 0.5]);
  });

  it('smooths unseen words in either class', () => {
    expect(model.predict([0, 1]).probabilities).toEqual([expect.closeTo(1 / 8), expect.closeTo(7 / 8)]);
  });

  it('splits reproducibly without dropping or duplicating items', () => {
    const items = Array.from({ length: 12 }, (_, index) => index);
    const split = splitReviews(items, 42);
    expect(split).toEqual(splitReviews(items, 42));
    expect(split).not.toEqual(splitReviews(items, 51));
    expect(split.test).toHaveLength(3);
    expect([...split.train, ...split.test].sort((left, right) => left - right)).toEqual(items);
  });

  it('counts actual classes by row and predicted classes by column', () => {
    expect(scoreSentiment([0, 0, 1, 1, 1], [0, 1, 0, 0, 1])).toEqual({ matrix: [[1, 1], [2, 1]], accuracy: 0.4 });
  });
});
