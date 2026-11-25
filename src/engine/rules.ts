export interface Itemset { items: string[]; count: number; support: number }
export interface AprioriLevel { size: number; frequent: number; subsetPruned: number; supportPruned: number }
export interface Rule { antecedent: string[]; consequent: string[]; items: string[]; support: number; confidence: number; lift: number }

type Baskets = readonly (readonly string[])[];
const key = (items: string[]) => JSON.stringify(items);
const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const compareItems = (left: string[], right: string[]) => {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const order = compareText(left[index], right[index]);
    if (order) return order;
  }
  return left.length - right.length;
};

export function tidLists(baskets: Baskets): Map<string, Set<number>> {
  const lists = new Map<string, Set<number>>();
  baskets.forEach((basket, index) => {
    for (const item of basket) {
      if (!lists.has(item)) lists.set(item, new Set());
      lists.get(item)!.add(index);
    }
  });
  return lists;
}

export function intersect(left: ReadonlySet<number>, right: ReadonlySet<number>): Set<number> {
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
  return new Set([...smaller].filter(id => larger.has(id)));
}

export function apriori(baskets: Baskets, minSupport: number): { itemsets: Itemset[]; levels: AprioriLevel[] } {
  const itemsets: Itemset[] = [];
  const levels: AprioriLevel[] = [];
  const transactions = baskets.map(basket => new Set(basket));
  let candidates = [...new Set(baskets.flat())].sort().map(item => [item]);
  let previous = new Set<string>();
  for (let size = 1; candidates.length; size++) {
    const level: AprioriLevel = { size, frequent: 0, subsetPruned: 0, supportPruned: 0 };
    const frequent: string[][] = [];
    for (const items of candidates) {
      if (size > 2 && items.some((_, omit) => !previous.has(key(items.filter((_, index) => index !== omit))))) {
        level.subsetPruned++;
        continue;
      }
      const count = transactions.filter(basket => items.every(item => basket.has(item))).length;
      const support = count / baskets.length;
      if (!count || support < minSupport) {
        level.supportPruned++;
        continue;
      }
      frequent.push(items);
      itemsets.push({ items, count, support });
      level.frequent++;
    }
    levels.push(level);
    previous = new Set(frequent.map(key));
    candidates = frequent.flatMap((left, index) => frequent.slice(index + 1)
      .filter(right => left.slice(0, -1).every((item, pos) => item === right[pos]))
      .map(right => [...left, right[size - 1]]));
  }
  return { itemsets, levels };
}

export function eclat(baskets: Baskets, minSupport: number): Itemset[] {
  const result: Itemset[] = [];
  const meetsSupport = (ids: Set<number>) => ids.size > 0 && ids.size / baskets.length >= minSupport;
  function visit(prefix: string[], extensions: [string, Set<number>][]) {
    extensions.forEach(([item, ids], index) => {
      const items = [...prefix, item];
      result.push({ items, count: ids.size, support: ids.size / baskets.length });
      const next = extensions.slice(index + 1).flatMap(([other, otherIds]): [string, Set<number>][] => {
        const shared = intersect(ids, otherIds);
        return meetsSupport(shared) ? [[other, shared]] : [];
      });
      visit(items, next);
    });
  }
  visit([], [...tidLists(baskets)].filter(([, ids]) => meetsSupport(ids)).sort(([left], [right]) => compareText(left, right)));
  return result.sort((left, right) => left.items.length - right.items.length || compareItems(left.items, right.items));
}

export function associationRules(itemsets: readonly Itemset[], minConfidence: number): Rule[] {
  const supports = new Map(itemsets.map(set => [key(set.items), set.support]));
  const rules: Rule[] = [];
  for (const { items, support } of itemsets) {
    function split(index: number, antecedent: string[], consequent: string[]) {
      if (index < items.length) {
        split(index + 1, [...antecedent, items[index]], consequent);
        split(index + 1, antecedent, [...consequent, items[index]]);
      } else if (antecedent.length && consequent.length) {
        const left = supports.get(key(antecedent));
        const right = supports.get(key(consequent));
        if (!left || !right) return;
        const confidence = support / left;
        if (confidence >= minConfidence) rules.push({ antecedent, consequent, items, support, confidence, lift: confidence / right });
      }
    }
    if (items.length > 1) split(0, [], []);
  }
  return rules.sort((left, right) => right.lift - left.lift || compareItems(left.antecedent, right.antecedent)
    || compareItems(left.consequent, right.consequent));
}
