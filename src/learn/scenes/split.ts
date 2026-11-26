import { shuffleSplit } from '../../prep/logic';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const N = 12;
const DECK_Y = 86;
const CARD_W = 24;
const CARD_H = 32;

const deckX = (pos: number) => 28 + pos * 29;
const testSlot = (k: number): [number, number] => [40 + k * 34, 198];
const trainSlot = (k: number): [number, number] => {
  const row = k < 5 ? 0 : 1;
  const col = row === 0 ? k : k - 5;
  const rowOffset = row === 0 ? 176 : 194;
  return [rowOffset + col * 36, 178 + row * 40];
};

const delay = (el: SVGElement, ms: number) => el.style.setProperty('--delay', `${ms}ms`);

interface CardNodes {
  group: SVGGElement;
  ring: SVGRectElement;
}

export default function splitScene() {
  const { test, train } = shuffleSplit(N, 0.25, 42);
  const shuffledOrder = [...test, ...train];
  const shuffledPos = new Array<number>(N);
  shuffledOrder.forEach((cardId, pos) => {
    shuffledPos[cardId] = pos;
  });
  const testIndexOf = new Map<number, number>(test.map((id, k) => [id, k]));
  const trainIndexOf = new Map<number, number>(train.map((id, k) => [id, k]));

  const cards: CardNodes[] = [];
  let seedBadge: SVGGElement;
  let cutLine: SVGLineElement;
  let testTray: SVGGElement;
  let trainTray: SVGGElement;
  let modelBox: SVGGElement;
  let trainArrow: SVGLineElement;
  let testArrow: SVGLineElement;
  let scoreBadge: SVGGElement;

  function applyFrame(i: number, _api: SceneApi, isBeforeZero = false) {
    // Seed badge at top in steps 0-2, dimmed/hidden when Model & Score take top stage in step 3
    delay(seedBadge, 0);
    seedBadge.setAttribute('opacity', i === 3 ? '0' : isBeforeZero ? '0.45' : '1');

    // Cut line between first 3 shuffled cards (test) and last 9 (train)
    const showCut = (i === 0 && !isBeforeZero) || i === 1;
    delay(cutLine, i === 0 ? 1050 : 0);
    cutLine.setAttribute('stroke-dashoffset', showCut ? '0' : '1');
    cutLine.setAttribute('opacity', showCut ? '1' : '0');

    // Trays
    delay(testTray, i === 1 ? 300 : 0);
    testTray.setAttribute('opacity', i === 0 ? '0.28' : i === 3 ? '0.42' : '1');
    if (i === 3) {
      delay(testTray, 700);
      testTray.setAttribute('opacity', '1');
    }

    delay(trainTray, i === 2 ? 300 : 0);
    trainTray.setAttribute('opacity', i < 2 ? '0.28' : '1');

    // Cards positions and test rings
    for (let id = 0; id < N; id++) {
      const card = cards[id];
      const inTest = testIndexOf.has(id);
      let x = deckX(id);
      let y = DECK_Y;
      let moveDelay = 0;

      if (isBeforeZero) {
        x = deckX(id);
        y = DECK_Y;
      } else if (i === 0) {
        x = deckX(shuffledPos[id]);
        y = DECK_Y;
        moveDelay = 350;
      } else if (i === 1) {
        if (inTest) {
          [x, y] = testSlot(testIndexOf.get(id)!);
          moveDelay = 380;
        } else {
          x = deckX(shuffledPos[id]);
          y = DECK_Y;
        }
      } else {
        if (inTest) {
          [x, y] = testSlot(testIndexOf.get(id)!);
        } else {
          [x, y] = trainSlot(trainIndexOf.get(id)!);
          moveDelay = i === 2 ? 380 : 0;
        }
      }

      delay(card.group, moveDelay);
      card.group.style.transform = `translate(${x}px, ${y}px)`;

      const showRing = i >= 1 && inTest;
      delay(card.ring, i === 1 ? 120 : 0);
      card.ring.setAttribute('opacity', showRing ? '1' : '0');
    }

    // Step 3: Model box, train -> model arrow, test -> model arrow, test score
    const isEval = i === 3;
    delay(modelBox, 0);
    modelBox.setAttribute('opacity', isEval ? '1' : '0');

    delay(trainArrow, isEval ? 220 : 0);
    trainArrow.setAttribute('stroke-dashoffset', isEval ? '0' : '1');
    trainArrow.setAttribute('opacity', isEval ? '1' : '0');

    delay(testArrow, isEval ? 780 : 0);
    testArrow.setAttribute('stroke-dashoffset', isEval ? '0' : '1');
    testArrow.setAttribute('opacity', isEval ? '1' : '0');

    delay(scoreBadge, isEval ? 1180 : 0);
    scoreBadge.setAttribute('opacity', isEval ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      // Seed pill
      seedBadge = el('g', { class: 'scene-tween' });
      el('rect', {
        x: 118, y: 24, width: 164, height: 32, rx: 10,
        fill: 'var(--sheet)', stroke: 'var(--hl)', 'stroke-width': 2,
      }, seedBadge);
      label(api, seedBadge, 200, 45, 'random_state = 42', {
        'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, class: 'scene-value',
      });

      // Model & Score (frame 3)
      modelBox = el('g', { opacity: 0, class: 'scene-tween' });
      el('rect', {
        x: 138, y: 30, width: 108, height: 42, rx: 11,
        fill: 'var(--sheet)', stroke: 'var(--a)', 'stroke-width': 2.2,
      }, modelBox);
      label(api, modelBox, 192, 56, t('model'), {
        'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700,
      });

      scoreBadge = el('g', { opacity: 0, class: 'scene-tween' });
      el('rect', {
        x: 266, y: 30, width: 104, height: 42, rx: 11,
        fill: 'var(--sheet)', stroke: 'var(--ok)', 'stroke-width': 2.2,
      }, scoreBadge);
      label(api, scoreBadge, 318, 47, t('score'), {
        'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13,
      });
      label(api, scoreBadge, 318, 65, '89%', {
        'text-anchor': 'middle', fill: 'var(--ok)', 'font-size': 15, 'font-weight': 700,
        class: 'scene-value',
      });

      // Arrows (Train -> Model, Test -> Model)
      trainArrow = line(api, svg, 266, 160, 212, 76, {
        stroke: 'var(--a)', 'stroke-width': 2.2, pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });
      testArrow = line(api, svg, 88, 160, 172, 76, {
        stroke: 'var(--ok)', 'stroke-width': 2.2, pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      // Cut line between shuffled slots 2 and 3
      cutLine = line(api, svg, 113, 74, 113, 130, {
        stroke: 'var(--ink)', 'stroke-width': 2, pathLength: 1,
        'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
      });

      // Bottom trays
      testTray = el('g', { class: 'scene-tween' });
      el('rect', {
        x: 28, y: 162, width: 120, height: 108, rx: 12,
        fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': 1.75, 'stroke-dasharray': '5 4',
      }, testTray);
      label(api, testTray, 40, 184, t('test'), { 'font-size': 14, 'font-weight': 700 });
      label(api, testTray, 136, 184, '25%', {
        'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value',
      });

      trainTray = el('g', { class: 'scene-tween' });
      el('rect', {
        x: 162, y: 162, width: 210, height: 108, rx: 12,
        fill: 'var(--sheet)', stroke: 'var(--a)', 'stroke-width': 1.75,
      }, trainTray);
      label(api, trainTray, 174, 256, t('train'), { 'font-size': 14, 'font-weight': 700 });
      label(api, trainTray, 360, 256, '75%', {
        'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13, class: 'scene-value',
      });

      // 12 row cards
      const cardsLayer = el('g');
      for (let id = 0; id < N; id++) {
        const g = el('g', { class: 'scene-tween scene-slow' }, cardsLayer);
        el('rect', {
          x: 0, y: 0, width: CARD_W, height: CARD_H, rx: 5,
          fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
        }, g);
        const ring = el('rect', {
          x: -2, y: -2, width: CARD_W + 4, height: CARD_H + 4, rx: 7,
          fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, opacity: 0, class: 'scene-tween',
        }, g);
        el('circle', {
          cx: CARD_W / 2, cy: 10, r: 3.5, fill: id % 2 === 0 ? 'var(--a)' : 'var(--b)',
        }, g);
        label(api, g, CARD_W / 2, 26, String(id + 1), {
          'text-anchor': 'middle', 'font-size': 13, class: 'scene-value',
        });
        cards.push({ group: g, ring });
      }

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) applyFrame(0, api, true);
      else applyFrame(i - 1, api);
    },
  });
}
