import { apriori, associationRules, eclat, intersect, tidLists } from '../engine/rules';
import { randomSeed, rng } from '../engine/random';
import { fill, rules, type Lang } from '../i18n/ui';

const ITEMS = ['bread', 'milk', 'eggs', 'coffee', 'tea', 'cereal', 'pasta', 'sauce', 'cheese'] as const;
type Item = (typeof ITEMS)[number];
type Preset = 'breakfast' | 'pasta' | 'random';

function makeBaskets(preset: Preset, seed: number): Item[][] {
  const random = rng(seed);
  return Array.from({ length: 20 }, () => {
    const basket = new Set(ITEMS.filter(() => random() < (preset === 'random' ? 0.32 : 0.13)));
    if (preset === 'breakfast') {
      if (random() < 0.55) {
        basket.add('cereal');
        if (random() < 0.85) basket.add('milk');
      }
      if (random() < 0.45) {
        basket.add('bread');
        if (random() < 0.75) basket.add('eggs');
      }
    }
    if (preset === 'pasta' && random() < 0.65) {
      basket.add('pasta');
      if (random() < 0.88) basket.add('sauce');
      if (random() < 0.72) basket.add('cheese');
    }
    if (!basket.size) basket.add(ITEMS[Math.floor(random() * ITEMS.length)]);
    return ITEMS.filter(item => basket.has(item));
  });
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountRules(root: HTMLElement) {
  const lang = root.dataset.rulesLang as Lang;
  const ui = rules[lang];
  const isApriori = root.dataset.rules === 'apriori';
  const find = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-rules-${name}]`)!;
  const board = find('board');
  const editor = find('editor');
  const support = find<HTMLInputElement>('support');
  const confidence = find<HTMLInputElement>('confidence');
  const first = find<HTMLSelectElement>('first');
  const second = find<HTMLSelectElement>('second');
  const results = find('results');
  const number = new Intl.NumberFormat(lang);
  const percent = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 });
  const decimal = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 });
  const itemName = (item: string) => ui[item as Item];
  const itemNames = (items: string[]) => items.map(itemName).join(ui.separator);
  let baskets = makeBaskets('breakfast', 2026);
  let active = 0;
  let pinned = '';
  let hover: string[] = [];

  const button = (text: string) => {
    const control = element('button', text);
    control.type = 'button';
    return control;
  };
  const basketButtons = baskets.map((_, index) => {
    const control = button('');
    control.addEventListener('click', () => {
      active = index;
      drawBoard();
    });
    board.append(control);
    return control;
  });
  const itemButtons = ITEMS.map(item => {
    const control = button(itemName(item));
    control.className = 'chip';
    control.addEventListener('click', () => {
      const basket = baskets[active];
      baskets[active] = basket.includes(item) ? basket.filter(value => value !== item) : [...basket, item];
      presets.forEach(preset => preset.setAttribute('aria-pressed', 'false'));
      refresh();
    });
    editor.append(control);
    return control;
  });
  const presets = [...root.querySelectorAll<HTMLButtonElement>('[data-rules-preset]')];
  presets.forEach(control => control.addEventListener('click', () => {
    const preset = control.dataset.rulesPreset as Preset;
    baskets = makeBaskets(preset, preset === 'random' ? randomSeed() : 2026);
    active = 0;
    pinned = '';
    presets.forEach(option => option.setAttribute('aria-pressed', String(option === control)));
    refresh();
  }));

  function highlight(ids: ReadonlySet<number>) {
    basketButtons.forEach((control, index) => control.classList.toggle('rules-match', ids.has(index)));
  }

  function drawBoard() {
    baskets.forEach((basket, index) => {
      const control = basketButtons[index];
      const id = number.format(index + 1);
      const items = ITEMS.filter(item => basket.includes(item));
      control.setAttribute('aria-label', `${fill(ui.edit_basket, { id })}: ${itemNames(items) || ui.empty_basket}`);
      control.setAttribute('aria-pressed', String(index === active));
      control.replaceChildren(element('bdi', id), ...(items.length ? items.map(itemName) : [ui.empty_basket]).map(name => {
        const chip = element('span', name);
        chip.className = 'rules-item';
        return chip;
      }));
    });
    find('edit-label').textContent = fill(ui.edit_basket, { id: number.format(active + 1) });
    itemButtons.forEach((control, index) => control.setAttribute('aria-pressed', String(baskets[active].includes(ITEMS[index]))));
  }

  function row(control: HTMLButtonElement, values: string[]) {
    const tr = element('tr');
    const label = element('td');
    label.append(control);
    tr.append(label, ...values.map(value => {
      const cell = element('td');
      cell.append(element('bdi', value));
      return cell;
    }));
    results.append(tr);
    return tr;
  }

  function drawApriori(minimum: number) {
    const { itemsets, levels } = apriori(baskets, minimum);
    const found = associationRules(itemsets, Number(confidence.value) / 100);
    const panel = find('levels');
    panel.replaceChildren(...Array.from({ length: Math.max(3, levels.length) }, (_, index) => {
      const level = levels[index];
      const card = element('li');
      card.append(element('strong', fill(ui.level_size, { n: number.format(index + 1) })),
        element('div', fill(ui.level_frequent, { n: number.format(level?.frequent ?? 0) })),
        element('div', fill(ui.level_subset, { n: number.format(level?.subsetPruned ?? 0) })),
        element('div', fill(ui.level_support, { n: number.format(level?.supportPruned ?? 0) })));
      return card;
    }));
    const controls: HTMLButtonElement[] = [];
    const ruleKey = (rule: (typeof found)[number]) => JSON.stringify([rule.antecedent, rule.consequent]);
    const selected = () => found.find(rule => ruleKey(rule) === pinned);
    const showRule = () => {
      const items = hover.length ? hover : selected()?.items ?? [];
      highlight(new Set(baskets.flatMap((basket, index) => items.length && items.every(item => basket.includes(item as Item)) ? [index] : [])));
      controls.forEach((control, index) => control.setAttribute('aria-pressed', String(ruleKey(found[index]) === pinned)));
    };
    if (!selected()) pinned = '';
    found.forEach(rule => {
      const control = button('');
      control.append(element('bdi', itemNames(rule.antecedent)), ` ${ui.arrow} `, element('bdi', itemNames(rule.consequent)));
      const tr = row(control, [percent.format(rule.support), percent.format(rule.confidence), decimal.format(rule.lift)]);
      tr.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse') { hover = rule.items; showRule(); }
      });
      tr.addEventListener('pointerleave', () => { hover = []; showRule(); });
      control.addEventListener('click', () => {
        pinned = pinned === ruleKey(rule) ? '' : ruleKey(rule);
        hover = [];
        showRule();
      });
      controls.push(control);
    });
    showRule();
  }

  const pairControls: { control: HTMLButtonElement; items: string[] }[] = [];
  function drawPair() {
    for (const option of second.options) option.disabled = option.value === first.value;
    if (first.value === second.value) second.value = first.value === ITEMS[0] ? ITEMS[1] : ITEMS[0];
    const lists = tidLists(baskets);
    const shared = intersect(lists.get(first.value) ?? new Set(), lists.get(second.value) ?? new Set());
    const list = find('tids');
    list.replaceChildren();
    ITEMS.forEach(item => {
      const ids = lists.get(item);
      const detail = element('dd');
      if (!ids?.size) detail.textContent = ui.none;
      ids?.forEach(id => {
        const tag = element('span', number.format(id + 1));
        tag.classList.toggle('rules-common', (item === first.value || item === second.value) && shared.has(id));
        detail.append(tag);
      });
      list.append(element('dt', itemName(item)), detail);
    });
    const ids = [...shared].map(id => number.format(id + 1)).join(ui.separator);
    find('shared').textContent = fill(ui.intersection, { ids: ids || ui.none, support: percent.format(shared.size / baskets.length) });
    highlight(shared);
    pairControls.forEach(({ control, items }) => control.setAttribute('aria-pressed', String(items.includes(first.value) && items.includes(second.value))));
  }

  function drawEclat(minimum: number) {
    pairControls.length = 0;
    const pairs = eclat(baskets, minimum).filter(set => set.items.length === 2).sort((left, right) => right.count - left.count);
    for (const { items, support: value } of pairs) {
      const control = button(itemNames(items));
      control.addEventListener('click', () => {
        first.value = items[0];
        second.value = items[1];
        drawPair();
      });
      pairControls.push({ control, items });
      row(control, [percent.format(value)]);
    }
    drawPair();
  }

  function refresh() {
    drawBoard();
    results.replaceChildren();
    hover = [];
    const minimum = Number(support.value) / 100;
    find('support-value').textContent = percent.format(minimum);
    if (isApriori) {
      find('confidence-value').textContent = percent.format(Number(confidence.value) / 100);
      drawApriori(minimum);
    } else drawEclat(minimum);
    find('empty').hidden = results.childElementCount > 0;
  }

  if (!isApriori) {
    for (const select of [first, second]) {
      select.append(...ITEMS.map(item => {
        const option = element('option', itemName(item));
        option.value = item;
        return option;
      }));
      select.addEventListener('change', drawPair);
    }
    first.value = 'cereal';
    second.value = 'milk';
  }
  support.addEventListener('input', refresh);
  if (isApriori) confidence.addEventListener('input', refresh);
  refresh();
}
