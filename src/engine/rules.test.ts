import { describe, expect, it } from 'vitest';
import { apriori, associationRules, eclat, intersect, tidLists } from './rules';
import { rng } from './random';

const baskets = [['bread', 'milk'], ['bread', 'milk'], ['bread'], ['tea']];

describe('Apriori', () => {
  it('counts itemsets and computes both directions of a rule', () => {
    const { itemsets } = apriori(baskets, 0.5);
    expect(itemsets).toEqual([
      { items: ['bread'], count: 3, support: 0.75 },
      { items: ['milk'], count: 2, support: 0.5 },
      { items: ['bread', 'milk'], count: 2, support: 0.5 },
    ]);
    expect(associationRules(itemsets, 0.6)).toEqual([
      { antecedent: ['bread'], consequent: ['milk'], items: ['bread', 'milk'], support: 0.5, confidence: 2 / 3, lift: 4 / 3 },
      { antecedent: ['milk'], consequent: ['bread'], items: ['bread', 'milk'], support: 0.5, confidence: 1, lift: 4 / 3 },
    ]);
    expect(associationRules(itemsets, 0.8).map(rule => rule.antecedent)).toEqual([['milk']]);
  });

  it('prunes below-support candidates and skips a triple with a missing pair', () => {
    const result = apriori([['bread', 'milk'], ['bread', 'tea'], ['bread', 'tea'], ['bread', 'milk']], 0.5);
    expect(result.levels).toEqual([
      { size: 1, frequent: 3, subsetPruned: 0, supportPruned: 0 },
      { size: 2, frequent: 2, subsetPruned: 0, supportPruned: 1 },
      { size: 3, frequent: 0, subsetPruned: 1, supportPruned: 0 },
    ]);
    expect(apriori(baskets, 0.51).itemsets.map(set => set.items)).toEqual([['bread']]);
  });

  it('handles empty data and counts a repeated item only once per basket', () => {
    expect(apriori([], 0.5)).toEqual({ itemsets: [], levels: [] });
    expect(apriori([[], []], 0.5).itemsets).toEqual([]);
    expect(associationRules([], 0)).toEqual([]);
    expect(apriori([['milk', 'milk'], []], 0.5).itemsets).toEqual([{ items: ['milk'], count: 1, support: 0.5 }]);
  });

  it('orders itemsets and tied rules independently of input order', () => {
    const shuffled = baskets.toReversed().map(basket => basket.toReversed());
    expect(apriori(shuffled, 0.25)).toEqual(apriori(baskets, 0.25));
    expect(associationRules(apriori(shuffled, 0.25).itemsets, 0)).toEqual(associationRules(apriori(baskets, 0.25).itemsets, 0));
  });
});

describe('Eclat', () => {
  it('builds and intersects transaction ID lists', () => {
    const lists = tidLists(baskets);
    expect([...lists.get('bread')!]).toEqual([0, 1, 2]);
    expect([...intersect(lists.get('bread')!, lists.get('milk')!)]).toEqual([0, 1]);
  });

  it('matches Apriori on empty, hand-checked and seeded baskets', () => {
    const random = rng(2026);
    for (const data of [[], [[], ['tea', 'tea']], baskets, ...Array.from({ length: 5 }, () =>
      Array.from({ length: 20 }, () => ['bread', 'milk', 'tea', 'cheese', 'pasta'].filter(() => random() < 0.5)))]) {
      for (const support of [0, 0.15, 0.5, 1]) expect(eclat(data, support)).toEqual(apriori(data, support).itemsets);
    }
  });
});
