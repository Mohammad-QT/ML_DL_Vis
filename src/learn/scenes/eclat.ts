import { eclat, intersect, tidLists, type Itemset } from '../../engine/rules';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const BASKETS: readonly string[][] = [
  ['pasta', 'sauce'],
  ['pasta', 'cheese'],
  ['pasta', 'sauce', 'cheese'],
  ['sauce', 'cheese'],
  ['pasta', 'sauce', 'cheese'],
];

const ITEMS = ['pasta', 'sauce', 'cheese'] as const;
const ITEM_COLOR: Record<string, string> = {
  pasta: 'var(--a)',
  sauce: 'var(--b)',
  cheese: 'var(--ok)',
};

interface IdBadge {
  id: number;
  group: SVGGElement;
  ring: SVGRectElement;
}

function delay(el: SVGElement, ms: number) {
  el.style.setProperty('--delay', `${ms}ms`);
}

function makeBadge(
  api: SceneApi,
  parent: Element,
  x: number,
  y: number,
  id: number,
  accent: string,
): IdBadge {
  const group = api.el('g', { class: 'scene-tween' }, parent);
  api.el('rect', {
    x, y, width: 24, height: 22, rx: 6,
    fill: 'var(--paper)', stroke: accent, 'stroke-width': 1.4,
  }, group);
  const ring = api.el('rect', {
    x: x - 2, y: y - 2, width: 28, height: 26, rx: 7,
    fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.2, opacity: 0, class: 'scene-tween',
  }, group);
  label(api, group, x + 12, y + 15.5, String(id), {
    'text-anchor': 'middle', class: 'scene-value', 'font-size': 13, 'font-weight': 600,
  });
  return { id, group, ring };
}

export default function eclatScene() {
  const tids = tidLists(BASKETS);
  const pastaIds = tids.get('pasta')!;
  const sauceIds = tids.get('sauce')!;
  const cheeseIds = tids.get('cheese')!;
  const pairIds = intersect(pastaIds, sauceIds);
  const tripleIds = intersect(pairIds, cheeseIds);
  const frequent = eclat(BASKETS, 0.4);
  const pairSup = frequent.find((s: Itemset) => s.items.length === 2 && s.items.includes('pasta') && s.items.includes('sauce'))!.count;
  const tripleSup = frequent.find((s: Itemset) => s.items.length === 3)!.count;

  let basketRows: SVGGElement[] = [];
  let scanArrow: SVGPathElement;
  let itemRows: Array<{ group: SVGGElement; badges: IdBadge[] }> = [];
  let pairRow: SVGGElement;
  let pairBadges: IdBadge[] = [];
  let tripleRow: SVGGElement;

  function setBadges(badges: IdBadge[], shared: ReadonlySet<number>, highlight: boolean, ms: number) {
    badges.forEach(b => {
      const keep = shared.has(b.id - 1);
      delay(b.group, ms);
      delay(b.ring, ms);
      b.group.setAttribute('opacity', !highlight || keep ? '1' : '0.22');
      b.ring.setAttribute('opacity', highlight && keep ? '1' : '0');
    });
  }

  function applyFrame(i: number) {
    // Left baskets active only in frame 0
    basketRows.forEach((row, idx) => {
      delay(row, i === 0 ? idx * 70 : 0);
      row.setAttribute('opacity', i === 0 ? '1' : '0.26');
    });

    delay(scanArrow, i === 0 ? 180 : 0);
    scanArrow.setAttribute('stroke-dashoffset', i === 0 ? '0' : '1');
    scanArrow.setAttribute('opacity', i === 0 ? '0.85' : '0.2');

    // Top 3 item TID rows
    itemRows.forEach((row, idx) => {
      const active =
        i === 0 ? true
        : i === 1 ? idx < 2
        : idx === 2;
      delay(row.group, i === 0 ? 280 + idx * 140 : 0);
      row.group.setAttribute('opacity', active ? '1' : '0.24');

      if (i === 0) {
        setBadges(row.badges, pastaIds, false, 480 + idx * 140);
        row.badges.forEach(b => {
          delay(b.group, 480 + idx * 140);
          b.group.setAttribute('opacity', '1');
        });
      } else if (i === 1 && idx < 2) {
        setBadges(row.badges, pairIds, true, 360);
      } else if (i === 2 && idx === 2) {
        setBadges(row.badges, tripleIds, true, 360);
      } else {
        setBadges(row.badges, pastaIds, false, 0);
      }
    });

    // Pair result row (frames 1 & 2)
    delay(pairRow, i === 1 ? 760 : 0);
    pairRow.setAttribute('opacity', i >= 1 ? '1' : '0');
    if (i === 2) {
      setBadges(pairBadges, tripleIds, true, 360);
    } else {
      setBadges(pairBadges, pairIds, false, 0);
    }

    // Triple result row (frame 2)
    delay(tripleRow, i === 2 ? 760 : 0);
    tripleRow.setAttribute('opacity', i === 2 ? '1' : '0');
  }

  return defineScene({
    frames: 3,
    setup(api) {
      const { el, svg, t } = api;

      label(api, svg, 70, 30, t('baskets'), {
        'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700,
      });
      label(api, svg, 142, 30, t('tidLists'), {
        'font-size': 15, 'font-weight': 700,
      });

      // Left baskets (#1..#5)
      basketRows = BASKETS.map((basket, bIdx) => {
        const y = 46 + bIdx * 47;
        const g = el('g', { class: 'scene-tween' });
        el('rect', {
          x: 20, y, width: 100, height: 38, rx: 8,
          fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
        }, g);
        label(api, g, 28, y + 24, `#${bIdx + 1}`, {
          class: 'scene-value', 'font-size': 13, fill: 'var(--muted)',
        });
        basket.forEach((item, pIdx) => {
          el('circle', {
            cx: 59 + pIdx * 19, cy: y + 19, r: 5.5,
            fill: ITEM_COLOR[item],
          }, g);
        });
        return g;
      });

      scanArrow = el('path', {
        d: 'M 124 148 L 138 148',
        fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-linecap': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, class: 'scene-tween',
      });

      // Top 3 TID rows
      itemRows = ITEMS.map((item, idx) => {
        const y = 46 + idx * 45;
        const group = el('g', { class: 'scene-tween' });
        el('rect', {
          x: 142, y, width: 238, height: 36, rx: 8,
          fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
        }, group);
        el('circle', { cx: 156, cy: y + 18, r: 5, fill: ITEM_COLOR[item] }, group);
        label(api, group, 168, y + 23, t(item), { 'font-size': 13.5, 'font-weight': 600 });

        const ids = [...tids.get(item)!].sort((a, b) => a - b);
        const badges = ids.map((id, k) => makeBadge(api, group, 254 + k * 30, y + 7, id + 1, ITEM_COLOR[item]));
        return { group, badges };
      });

      // Pair intersection row (Pasta + Sauce)
      pairRow = el('g', { opacity: 0, class: 'scene-tween' });
      el('rect', {
        x: 142, y: 192, width: 238, height: 40, rx: 9,
        fill: 'var(--sheet)', stroke: 'var(--hl)', 'stroke-width': 2,
      }, pairRow);
      el('circle', { cx: 156, cy: 212, r: 5, fill: ITEM_COLOR.pasta }, pairRow);
      label(api, pairRow, 168, 216, '+', { 'font-size': 13, fill: 'var(--muted)', 'text-anchor': 'middle' });
      el('circle', { cx: 180, cy: 212, r: 5, fill: ITEM_COLOR.sauce }, pairRow);

      const pList = [...pairIds].sort((a, b) => a - b);
      pairBadges = pList.map((id, k) => makeBadge(api, pairRow, 194 + k * 28, 201, id + 1, 'var(--ink)'));
      label(api, pairRow, 372, 217, t('support').replace('{n}', `${pairSup}/${BASKETS.length}`), {
        'text-anchor': 'end', class: 'scene-value', 'font-size': 13, 'font-weight': 600,
      });

      // Triple intersection row (Pasta + Sauce + Cheese)
      tripleRow = el('g', { opacity: 0, class: 'scene-tween' });
      el('rect', {
        x: 142, y: 242, width: 238, height: 40, rx: 9,
        fill: 'var(--sheet)', stroke: 'var(--hl)', 'stroke-width': 2,
      }, tripleRow);
      el('circle', { cx: 155, cy: 262, r: 5, fill: ITEM_COLOR.pasta }, tripleRow);
      label(api, tripleRow, 166, 266, '+', { 'font-size': 13, fill: 'var(--muted)', 'text-anchor': 'middle' });
      el('circle', { cx: 177, cy: 262, r: 5, fill: ITEM_COLOR.sauce }, tripleRow);
      label(api, tripleRow, 188, 266, '+', { 'font-size': 13, fill: 'var(--muted)', 'text-anchor': 'middle' });
      el('circle', { cx: 199, cy: 262, r: 5, fill: ITEM_COLOR.cheese }, tripleRow);

      const tList = [...tripleIds].sort((a, b) => a - b);
      tList.forEach((id, k) => makeBadge(api, tripleRow, 218 + k * 29, 251, id + 1, 'var(--ok)'));
      label(api, tripleRow, 372, 267, t('support').replace('{n}', `${tripleSup}/${BASKETS.length}`), {
        'text-anchor': 'end', class: 'scene-value', 'font-size': 13, 'font-weight': 600,
      });

      // Subtle divider between raw TID lists and intersection results
      line(api, svg, 142, 182, 380, 182, { stroke: 'var(--rule)', 'stroke-dasharray': '4 4' });

      applyFrame(0);
    },
    frame(i) {
      applyFrame(i);
    },
    before(i) {
      if (i === 0) {
        applyFrame(0);
        delay(scanArrow, 0);
        scanArrow.setAttribute('stroke-dashoffset', '1');
        scanArrow.setAttribute('opacity', '0');
        itemRows.forEach(row => {
          delay(row.group, 0);
          row.group.setAttribute('opacity', '0');
          row.badges.forEach(b => {
            delay(b.group, 0);
            b.group.setAttribute('opacity', '0');
          });
        });
      } else {
        applyFrame(i - 1);
      }
    },
  });
}
