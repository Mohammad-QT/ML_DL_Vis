import { apriori, associationRules } from '../../engine/rules';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const baskets: readonly string[][] = [
  ['bread', 'milk'],
  ['bread', 'milk'],
  ['bread', 'eggs'],
  ['eggs', 'tea'],
];

const items = ['bread', 'milk', 'eggs', 'tea'] as const;
const pairList: [string, string][] = [
  ['bread', 'milk'],
  ['bread', 'eggs'],
  ['milk', 'eggs'],
];

const minSupport = 0.5;
const minConfidence = 0.6;

interface BasketRow {
  card: SVGRectElement;
  pills: { item: string; rect: SVGRectElement; text: SVGTextElement }[];
}

interface BarRow {
  group: SVGGElement;
  bar: SVGRectElement;
  countText: SVGTextElement;
  strike: SVGLineElement;
}

export default function aprioriScene() {
  const { itemsets } = apriori(baskets, minSupport);
  const frequentMap = new Map(itemsets.map(s => [s.items.join('+'), s]));
  const rules = associationRules(itemsets, minConfidence);
  const mainRule = rules.find(r => r.antecedent[0] === 'bread' && r.consequent[0] === 'milk') ?? rules[0];

  const singleCounts = items.map(item => baskets.filter(b => b.includes(item)).length);
  const pairCounts = pairList.map(([a, b]) => baskets.filter(basket => basket.includes(a) && basket.includes(b)).length);

  let basketRows: BasketRow[] = [];
  let scanFrame: SVGRectElement;
  let minHeader: SVGTextElement;
  let step0Group: SVGGElement;
  let step1Group: SVGGElement;
  let step2Group: SVGGElement;
  let step3Group: SVGGElement;

  let singleRows: BarRow[] = [];
  let chipHighlights = new Map<string, SVGRectElement>();
  let candidateCards: SVGGElement[] = [];
  let cardHighlights: SVGRectElement[] = [];
  let pairRows: BarRow[] = [];
  let metricBars: SVGRectElement[] = [];

  function highlightPair(pairIdx: number | null) {
    chipHighlights.forEach(ring => ring.setAttribute('opacity', '0'));
    cardHighlights.forEach(ring => ring.setAttribute('opacity', '0'));

    if (pairIdx === null) {
      candidateCards.forEach(card => {
        card.setAttribute('opacity', '1');
        card.setAttribute('transform', 'translate(0, 0)');
      });
      return;
    }

    const [a, b] = pairList[pairIdx];
    chipHighlights.get(a)?.setAttribute('opacity', '1');
    chipHighlights.get(b)?.setAttribute('opacity', '1');
    cardHighlights[pairIdx]?.setAttribute('opacity', '1');
    candidateCards.forEach((card, idx) => {
      const shown = idx <= pairIdx;
      card.setAttribute('opacity', shown ? '1' : '0.2');
      card.setAttribute('transform', shown ? 'translate(0, 0)' : 'translate(0, -6)');
    });
  }

  function setBasketState(highlightMask: boolean[], dimMask: boolean[], accentColor = 'var(--a)') {
    basketRows.forEach((row, idx) => {
      const hl = highlightMask[idx];
      const dim = dimMask[idx];
      row.card.setAttribute('stroke', hl ? accentColor : 'var(--rule)');
      row.card.setAttribute('stroke-width', hl ? '2.25' : '1.5');
      row.card.setAttribute('opacity', dim ? '0.32' : '1');
      row.pills.forEach(p => {
        p.rect.setAttribute('opacity', dim ? '0.4' : '1');
        p.text.setAttribute('opacity', dim ? '0.4' : '1');
      });
    });
  }

  function showSingles(throughBasket: number, struck: boolean) {
    const partialCounts = items.map(item =>
      baskets.slice(0, throughBasket + 1).filter(b => b.includes(item)).length,
    );
    singleRows.forEach((row, idx) => {
      const count = partialCounts[idx];
      const pass = count / baskets.length >= minSupport;
      row.bar.setAttribute('transform', `scale(${count / baskets.length} 1)`);
      row.bar.setAttribute('fill', struck && !pass ? 'var(--bad)' : idx === 0 ? 'var(--a)' : 'var(--ok)');
      row.countText.textContent = `${count}/${baskets.length}`;
      row.strike.setAttribute('stroke-dashoffset', struck && !pass ? '0' : '1');
      row.strike.setAttribute('opacity', struck && !pass ? '1' : '0');
    });
  }

  function showPairs(throughBasket: number, struck: boolean) {
    const partial = pairList.map(([a, b]) =>
      baskets.slice(0, throughBasket + 1).filter(basket => basket.includes(a) && basket.includes(b)).length,
    );
    pairRows.forEach((row, idx) => {
      const count = partial[idx];
      const pass = count / baskets.length >= minSupport;
      row.bar.setAttribute('transform', `scale(${count / baskets.length} 1)`);
      row.bar.setAttribute('fill', struck && !pass ? 'var(--bad)' : 'var(--ok)');
      row.countText.textContent = `${count}/${baskets.length}`;
      row.strike.setAttribute('stroke-dashoffset', struck && !pass ? '0' : '1');
      row.strike.setAttribute('opacity', struck && !pass ? '1' : '0');
    });
  }

  function applyFrame(i: number, _api: SceneApi) {
    step0Group.setAttribute('opacity', i === 0 ? '1' : '0');
    step1Group.setAttribute('opacity', i === 1 ? '1' : '0');
    step2Group.setAttribute('opacity', i === 2 ? '1' : '0');
    step3Group.setAttribute('opacity', i === 3 ? '1' : '0');
    minHeader.setAttribute('opacity', i < 3 ? '1' : '0');
    scanFrame.setAttribute('opacity', '0');

    if (i === 0) {
      setBasketState([false, false, false, false], [false, false, false, false]);
      showSingles(baskets.length - 1, true);
      highlightPair(null);
      candidateCards.forEach(card => {
        card.setAttribute('opacity', '0');
        card.setAttribute('transform', 'translate(0, -8)');
      });
    } else if (i === 1) {
      setBasketState([false, false, false, false], [false, false, false, false]);
      highlightPair(null);
    } else if (i === 2) {
      setBasketState([true, true, false, false], [false, false, false, true], 'var(--ok)');
      showPairs(baskets.length - 1, true);
    } else {
      setBasketState([true, true, false, false], [false, false, false, true], 'var(--a)');
      metricBars.forEach(bar => bar.setAttribute('transform', 'scale(1 1)'));
    }
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      label(api, svg, 87, 31, t('baskets'), { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });
      minHeader = label(api, svg, 376, 31, `${t('minSup')} 2/${baskets.length}`, {
        'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 14, 'font-weight': 600, class: 'scene-tween',
      });

      const basketsLayer = el('g');
      basketRows = baskets.map((basket, bIdx) => {
        const y = 48 + bIdx * 54;
        const card = el('rect', {
          x: 20, y, width: 134, height: 44, rx: 9, fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
          class: 'scene-tween',
        }, basketsLayer);
        label(api, basketsLayer, 28, y + 27, `#${bIdx + 1}`, {
          class: 'scene-value', 'font-size': 13, fill: 'var(--muted)',
        });
        const pills = basket.map((item, pIdx) => {
          const px = 52 + pIdx * 49;
          const isRare = item === 'tea';
          const rect = el('rect', {
            x: px, y: y + 9, width: 45, height: 26, rx: 6, fill: 'var(--paper)',
            stroke: isRare ? 'var(--rule)' : item === 'bread' ? 'var(--a)' : item === 'milk' ? 'var(--b)' : 'var(--rule)',
            'stroke-width': 1.3, class: 'scene-tween',
          }, basketsLayer);
          const text = label(api, basketsLayer, px + 22.5, y + 26, t(item), {
            'text-anchor': 'middle', 'font-size': 13, fill: 'var(--ink)', class: 'scene-tween',
          });
          return { item, rect, text };
        });
        return { card, pills };
      });

      scanFrame = el('rect', {
        x: 18, y: 46, width: 138, height: 48, rx: 10, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 3,
        opacity: 0, class: 'scene-tween',
      }, basketsLayer);

      // Step 0: Single-item counts + prune
      step0Group = el('g', { class: 'scene-tween' });
      line(api, step0Group, 284, 48, 284, 246, { stroke: 'var(--ink)', 'stroke-dasharray': '3 3', opacity: 0.5 });
      singleRows = items.map((item, idx) => {
        const y = 56 + idx * 50;
        const group = el('g', {}, step0Group);
        label(api, group, 174, y + 18, t(item), { 'font-size': 14, 'font-weight': 600 });
        el('rect', { x: 236, y: y + 5, width: 96, height: 15, rx: 4, fill: 'var(--rule)' }, group);
        const bar = el('rect', {
          x: 236, y: y + 5, width: 96, height: 15, rx: 4,
          fill: singleCounts[idx] / baskets.length >= minSupport ? 'var(--ok)' : 'var(--bad)',
          class: 'scene-tween',
        }, group);
        bar.style.transformOrigin = '236px 0';
        const countText = label(api, group, 376, y + 18, `${singleCounts[idx]}/${baskets.length}`, {
          'text-anchor': 'end', class: 'scene-value', 'font-size': 13,
        });
        const strike = line(api, group, 172, y + 14, 228, y + 14, {
          stroke: 'var(--bad)', 'stroke-width': 2.2, pathLength: 1, 'stroke-dasharray': '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        });
        return { group, bar, countText, strike };
      });

      // Step 1: Join surviving items into candidate pairs (skipping rare Tea)
      step1Group = el('g', { class: 'scene-tween', opacity: 0 });
      const topSlots = [
        { item: 'bread', x: 174, w: 46, alive: true },
        { item: 'milk', x: 226, w: 46, alive: true },
        { item: 'eggs', x: 278, w: 46, alive: true },
        { item: 'tea', x: 332, w: 44, alive: false },
      ];
      chipHighlights = new Map();
      topSlots.forEach(s => {
        el('rect', {
          x: s.x, y: 52, width: s.w, height: 28, rx: 7, fill: 'var(--sheet)',
          stroke: s.alive ? 'var(--ok)' : 'var(--bad)', 'stroke-width': 1.5, opacity: s.alive ? 1 : 0.55,
        }, step1Group);
        label(api, step1Group, s.x + s.w / 2, 70, t(s.item), {
          'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600,
          fill: s.alive ? 'var(--ink)' : 'var(--muted)', opacity: s.alive ? 1 : 0.55,
        });
        if (s.alive) {
          const hl = el('rect', {
            x: s.x - 2, y: 50, width: s.w + 4, height: 32, rx: 8, fill: 'none',
            stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
          }, step1Group);
          chipHighlights.set(s.item, hl);
        } else {
          line(api, step1Group, s.x + 5, 66, s.x + s.w - 5, 66, { stroke: 'var(--bad)', 'stroke-width': 2.4 });
        }
      });

      const pairYs = [122, 170, 218];
      cardHighlights = [];
      candidateCards = pairList.map(([a, b], idx) => {
        const y = pairYs[idx];
        const card = el('g', { class: 'scene-tween', opacity: 0 }, step1Group);
        el('rect', {
          x: 186, y, width: 178, height: 32, rx: 8, fill: 'var(--sheet)',
          stroke: 'var(--rule)', 'stroke-width': 1.5,
        }, card);
        const hl = el('rect', {
          x: 186, y, width: 178, height: 32, rx: 8, fill: 'none',
          stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
        }, card);
        cardHighlights.push(hl);
        label(api, card, 275, y + 21, `${t(a)} + ${t(b)}`, {
          'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 600,
        });
        return card;
      });
      label(api, step1Group, 376, 102, t('skipped'), {
        'text-anchor': 'end', 'font-size': 13, fill: 'var(--muted)',
      });

      // Step 2: Scan baskets for candidate pairs, count & prune
      step2Group = el('g', { class: 'scene-tween', opacity: 0 });
      line(api, step2Group, 253, 56, 253, 240, { stroke: 'var(--ink)', 'stroke-dasharray': '3 3', opacity: 0.5 });
      pairRows = pairList.map(([a, b], idx) => {
        const y = 70 + idx * 60;
        const group = el('g', {}, step2Group);
        const pass = frequentMap.has(`${a}+${b}`);
        label(api, group, 174, y + 16, `${t(a)} + ${t(b)}`, {
          'font-size': 14, 'font-weight': 600, fill: pass ? 'var(--ink)' : 'var(--muted)',
        });
        el('rect', { x: 174, y: y + 25, width: 158, height: 14, rx: 4, fill: 'var(--rule)' }, group);
        const bar = el('rect', {
          x: 174, y: y + 25, width: 158, height: 14, rx: 4,
          fill: pass ? 'var(--ok)' : 'var(--bad)', class: 'scene-tween',
        }, group);
        bar.style.transformOrigin = '174px 0';
        const countText = label(api, group, 376, y + 36, `${pairCounts[idx]}/${baskets.length}`, {
          'text-anchor': 'end', class: 'scene-value', 'font-size': 13,
        });
        const strike = line(api, group, 172, y + 12, 276, y + 12, {
          stroke: 'var(--bad)', 'stroke-width': 2.2, pathLength: 1, 'stroke-dasharray': '1 1',
          'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        });
        return { group, bar, countText, strike };
      });

      // Step 3: Rule card with Support, Confidence, Lift
      step3Group = el('g', { class: 'scene-tween', opacity: 0 });
      el('rect', {
        x: 176, y: 52, width: 198, height: 46, rx: 10, fill: 'var(--sheet)', stroke: 'var(--hl)', 'stroke-width': 2.5,
      }, step3Group);
      label(api, step3Group, 240, 80, t('bread'), { 'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, fill: 'var(--a)' });
      line(api, step3Group, 252, 75, 294, 75, { stroke: 'var(--ink)', 'stroke-width': 2 });
      line(api, step3Group, 287, 70, 294, 75, { stroke: 'var(--ink)', 'stroke-width': 2 });
      line(api, step3Group, 287, 80, 294, 75, { stroke: 'var(--ink)', 'stroke-width': 2 });
      label(api, step3Group, 306, 80, t('milk'), { 'text-anchor': 'start', 'font-size': 15, 'font-weight': 700, fill: 'var(--b)' });

      const metrics = [
        { key: 'support', ratio: mainRule.support, val: `${Math.round(mainRule.support * 100)}%`, color: 'var(--a)' },
        { key: 'confidence', ratio: mainRule.confidence, val: `${Math.round(mainRule.confidence * 100)}%`, color: 'var(--b)' },
        { key: 'lift', ratio: Math.min(mainRule.lift / 2, 1), val: mainRule.lift.toFixed(2), color: 'var(--ok)' },
      ];
      metricBars = metrics.map((m, idx) => {
        const y = 122 + idx * 46;
        label(api, step3Group, 178, y + 14, t(m.key), { 'font-size': 14, 'font-weight': 600 });
        label(api, step3Group, 374, y + 14, m.val, {
          'text-anchor': 'end', class: 'scene-value', 'font-size': 14, 'font-weight': 700,
        });
        el('rect', { x: 178, y: y + 22, width: 196, height: 12, rx: 4, fill: 'var(--rule)' }, step3Group);
        if (m.key === 'lift') {
          line(api, step3Group, 178 + 98, y + 20, 178 + 98, y + 36, {
            stroke: 'var(--ink)', 'stroke-dasharray': '2 2', opacity: 0.7,
          });
        }
        const bar = el('rect', {
          x: 178, y: y + 22, width: 196 * m.ratio, height: 12, rx: 4, fill: m.color, class: 'scene-tween',
        }, step3Group);
        bar.style.transformOrigin = '178px 0';
        return bar;
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        step0Group.setAttribute('opacity', '1');
        step1Group.setAttribute('opacity', '0');
        step2Group.setAttribute('opacity', '0');
        step3Group.setAttribute('opacity', '0');
        minHeader.setAttribute('opacity', '1');
        scanFrame.setAttribute('opacity', '0');
        setBasketState([false, false, false, false], [false, false, false, false]);
        singleRows.forEach(row => {
          row.bar.setAttribute('transform', 'scale(0 1)');
          row.countText.textContent = `0/${baskets.length}`;
          row.strike.setAttribute('stroke-dashoffset', '1');
          row.strike.setAttribute('opacity', '0');
        });
      } else if (i === 1) {
        applyFrame(0, api);
      } else if (i === 2) {
        step0Group.setAttribute('opacity', '0');
        step1Group.setAttribute('opacity', '0');
        step2Group.setAttribute('opacity', '1');
        step3Group.setAttribute('opacity', '0');
        minHeader.setAttribute('opacity', '1');
        scanFrame.setAttribute('opacity', '0');
        setBasketState([false, false, false, false], [false, false, false, false]);
        pairRows.forEach(row => {
          row.bar.setAttribute('transform', 'scale(0 1)');
          row.countText.textContent = `0/${baskets.length}`;
          row.strike.setAttribute('stroke-dashoffset', '1');
          row.strike.setAttribute('opacity', '0');
        });
      } else {
        step0Group.setAttribute('opacity', '0');
        step1Group.setAttribute('opacity', '0');
        step2Group.setAttribute('opacity', '0');
        step3Group.setAttribute('opacity', '1');
        minHeader.setAttribute('opacity', '0');
        scanFrame.setAttribute('opacity', '0');
        setBasketState([false, false, false, false], [false, false, false, false]);
        metricBars.forEach(bar => bar.setAttribute('transform', 'scale(0 1)'));
      }
    },
    loop(i, api) {
      const browser = api.svg.ownerDocument.defaultView;
      if (api.reduced || !browser) return () => {};

      if (i === 0 || i === 2) {
        const timers: number[] = [];
        const stepMs = 480;
        for (let b = 0; b < baskets.length; b++) {
          const run = () => {
            scanFrame.setAttribute('y', String(46 + b * 54));
            scanFrame.setAttribute('opacity', '1');
            if (i === 0) showSingles(b, b === baskets.length - 1);
            else showPairs(b, b === baskets.length - 1);
          };
          if (b === 0) run();
          else timers.push(browser.setTimeout(run, b * stepMs));
        }
        timers.push(browser.setTimeout(() => applyFrame(i, api), baskets.length * stepMs + 150));
        return () => timers.forEach(id => browser.clearTimeout(id));
      }

      if (i === 1) {
        const timers: number[] = [];
        const pairMs = 620;
        for (let p = 0; p < pairList.length; p++) {
          const run = () => highlightPair(p);
          if (p === 0) run();
          else timers.push(browser.setTimeout(run, p * pairMs));
        }
        timers.push(browser.setTimeout(() => applyFrame(1, api), pairList.length * pairMs + 150));
        return () => timers.forEach(id => browser.clearTimeout(id));
      }

      return () => {};
    },
  });
}
