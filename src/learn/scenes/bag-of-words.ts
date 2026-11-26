import { buildVocabulary, cleanText, countVector, splitWords, stemWord, withoutStopWords } from '../../engine/text';
import { defineScene, type SceneApi } from '../scene';
import { label, line } from './svg';

const RAW = 'The 2 cakes and coffee, coffee!';
const CLEANED = cleanText(RAW);
const WORDS = splitWords(CLEANED);
const KEPT = withoutStopWords(WORDS);
const STEMS = KEPT.map(stemWord);
const VOCAB = buildVocabulary([STEMS, ['cake', 'tea']], 3);
const COUNTS = countVector(STEMS, VOCAB);

const WORD_PILLS = [
  { text: WORDS[0], x: 42, w: 44, stop: true },
  { text: WORDS[1], x: 94, w: 62, stop: false },
  { text: WORDS[2], x: 164, w: 46, stop: true },
  { text: WORDS[3], x: 218, w: 66, stop: false },
  { text: WORDS[4], x: 292, w: 66, stop: false },
];

const STEM_SLOTS = [
  { stem: STEMS[0], suffix: 's', x: 76, w: 72 },
  { stem: STEMS[1], suffix: '', x: 164, w: 72 },
  { stem: STEMS[2], suffix: '', x: 252, w: 72 },
];

const COL_X = [98, 200, 302];

function delay(el: SVGElement, ms: number) {
  el.style.setProperty('--delay', `${ms}ms`);
}

export default function bagOfWordsScene() {
  let heading: SVGTextElement;
  let cleanArrow: SVGPathElement;
  let cleanBox: SVGGElement;
  let wordGroup: SVGGElement;
  let wordItems: Array<{ rect: SVGRectElement; text: SVGTextElement; strike: SVGLineElement; stop: boolean }> = [];
  let stemGroup: SVGGElement;
  let stemSuffix: SVGTextElement;
  let stemStrike: SVGLineElement;
  let stemCards: SVGRectElement[] = [];
  let tableGroup: SVGGElement;
  let links: SVGPathElement[] = [];
  let countTexts: SVGTextElement[] = [];
  let countHighlight: SVGRectElement;

  function applyFrame(i: number, api: SceneApi) {
    const { t } = api;
    heading.textContent =
      i === 0 ? t('clean')
      : i === 1 ? t('drop')
      : i === 2 ? t('stem')
      : t('counts');

    // Frame 0: Raw -> Cleaned
    delay(cleanArrow, 0);
    cleanArrow.setAttribute('stroke-dashoffset', i === 0 ? '0' : '1');
    cleanArrow.setAttribute('opacity', i === 0 ? '0.85' : '0');

    delay(cleanBox, i === 0 ? 380 : 0);
    cleanBox.setAttribute('opacity', i === 0 ? '1' : '0');

    // Frame 1: Split + drop stop words
    delay(wordGroup, 0);
    wordGroup.setAttribute('opacity', i === 1 ? '1' : '0');
    wordItems.forEach(item => {
      delay(item.strike, i === 1 ? 350 : 0);
      item.strike.setAttribute('stroke-dashoffset', i === 1 && item.stop ? '0' : '1');
      item.strike.setAttribute('opacity', i === 1 && item.stop ? '1' : '0');

      delay(item.rect, i === 1 ? 680 : 0);
      delay(item.text, i === 1 ? 680 : 0);
      const fadeStop = i === 1 && item.stop;
      item.rect.setAttribute('opacity', fadeStop ? '0.28' : '1');
      item.text.setAttribute('opacity', fadeStop ? '0.35' : '1');
      item.rect.setAttribute('stroke', i === 1 && !item.stop ? 'var(--a)' : 'var(--rule)');
    });

    // Frames 2 & 3: Stemming row (sits middle in frame 2, higher in frame 3)
    const showStems = i >= 2;
    delay(stemGroup, 0);
    stemGroup.setAttribute('opacity', showStems ? '1' : '0');
    stemGroup.style.transform = i === 3 ? 'translateY(-16px)' : 'translateY(18px)';

    delay(stemSuffix, i === 2 ? 680 : 0);
    stemSuffix.setAttribute('opacity', i === 2 ? '0.22' : '0');
    delay(stemStrike, i === 2 ? 320 : 0);
    stemStrike.setAttribute('stroke-dashoffset', i === 2 ? '0' : '1');
    stemStrike.setAttribute('opacity', i === 2 ? '1' : '0');

    stemCards.forEach((card, idx) => {
      delay(card, i === 2 ? 750 : 0);
      card.setAttribute('stroke', i === 2 && idx === 0 ? 'var(--ok)' : i >= 2 ? 'var(--a)' : 'var(--rule)');
    });

    // Frame 3: Vocabulary table + count row
    const isCounts = i === 3;
    delay(tableGroup, 0);
    tableGroup.setAttribute('opacity', isCounts ? '1' : '0');

    links.forEach((lnk, idx) => {
      delay(lnk, isCounts ? 280 + idx * 110 : 0);
      lnk.setAttribute('stroke-dashoffset', isCounts ? '0' : '1');
      lnk.setAttribute('opacity', isCounts ? '0.8' : '0');
    });

    countTexts.forEach((txt, idx) => {
      delay(txt, isCounts ? 720 + idx * 90 : 0);
      txt.setAttribute('opacity', isCounts ? '1' : '0');
    });

    delay(countHighlight, isCounts ? 980 : 0);
    countHighlight.setAttribute('opacity', isCounts ? '1' : '0');
  }

  return defineScene({
    frames: 4,
    setup(api) {
      const { el, svg, t } = api;

      heading = label(api, svg, 200, 30, t('clean'), {
        'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700,
      });

      // Raw sentence card (always visible at top)
      el('rect', {
        x: 34, y: 44, width: 332, height: 40, rx: 9,
        fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      });
      label(api, svg, 200, 69, RAW, {
        'text-anchor': 'middle', class: 'scene-value', 'font-size': 14,
      });

      // Step 0: Clean arrow + cleaned sentence
      cleanArrow = el('path', {
        d: 'M 200 90 L 200 124',
        fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-linecap': 'round',
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, class: 'scene-tween',
      });
      cleanBox = el('g', { opacity: 0, class: 'scene-tween' });
      el('rect', {
        x: 34, y: 130, width: 332, height: 42, rx: 9,
        fill: 'var(--sheet)', stroke: 'var(--a)', 'stroke-width': 1.75,
      }, cleanBox);
      label(api, cleanBox, 200, 156, CLEANED, {
        'text-anchor': 'middle', class: 'scene-value', 'font-size': 14,
      });

      // Step 1: Split into 5 words, drop stop words
      wordGroup = el('g', { opacity: 0, class: 'scene-tween' });
      wordItems = WORD_PILLS.map(p => {
        const rect = el('rect', {
          x: p.x, y: 126, width: p.w, height: 34, rx: 8,
          fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5, class: 'scene-tween',
        }, wordGroup);
        const text = label(api, wordGroup, p.x + p.w / 2, 148, p.text, {
          'text-anchor': 'middle', class: 'scene-value scene-tween', 'font-size': 13.5,
        });
        const strike = line(api, wordGroup, p.x + 6, 143, p.x + p.w - 6, 143, {
          stroke: 'var(--bad)', 'stroke-width': 2,
          pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
        });
        return { rect, text, strike, stop: p.stop };
      });

      // Step 2 & 3: Stemmed pills
      stemGroup = el('g', { opacity: 0, class: 'scene-tween scene-slow' });
      stemGroup.style.transform = 'translateY(18px)';
      stemCards = STEM_SLOTS.map((s, idx) => {
        const card = el('rect', {
          x: s.x, y: 124, width: s.w, height: 34, rx: 8,
          fill: 'var(--sheet)', stroke: 'var(--a)', 'stroke-width': 1.5, class: 'scene-tween',
        }, stemGroup);
        if (idx === 0) {
          label(api, stemGroup, s.x + s.w / 2 - 4, 146, s.stem, {
            'text-anchor': 'middle', class: 'scene-value', 'font-size': 14, 'font-weight': 600,
          });
          stemSuffix = label(api, stemGroup, s.x + s.w / 2 + 17, 146, s.suffix, {
            'text-anchor': 'middle', class: 'scene-value scene-tween', 'font-size': 14, 'font-weight': 600,
            fill: 'var(--bad)',
          });
          stemStrike = line(api, stemGroup, s.x + s.w / 2 + 12, 141, s.x + s.w / 2 + 22, 141, {
            stroke: 'var(--bad)', 'stroke-width': 2,
            pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, class: 'scene-tween',
          });
        } else {
          label(api, stemGroup, s.x + s.w / 2, 146, s.stem, {
            'text-anchor': 'middle', class: 'scene-value', 'font-size': 14, 'font-weight': 600,
          });
        }
        return card;
      });

      // Step 3: Vocabulary table + count row
      tableGroup = el('g', { opacity: 0, class: 'scene-tween' });
      el('rect', {
        x: 50, y: 186, width: 300, height: 74, rx: 10,
        fill: 'var(--sheet)', stroke: 'var(--rule)', 'stroke-width': 1.5,
      }, tableGroup);
      line(api, tableGroup, 50, 220, 350, 220);
      line(api, tableGroup, 149, 186, 149, 260);
      line(api, tableGroup, 251, 186, 251, 260);

      VOCAB.forEach((word, idx) => {
        label(api, tableGroup, COL_X[idx], 208, word, {
          'text-anchor': 'middle', class: 'scene-value', 'font-size': 14, 'font-weight': 600,
        });
      });

      countHighlight = el('rect', {
        x: COL_X[1] - 22, y: 224, width: 44, height: 32, rx: 7,
        fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, opacity: 0, class: 'scene-tween',
      }, tableGroup);

      countTexts = COUNTS.map((val, idx) => label(api, tableGroup, COL_X[idx], 246, String(val), {
        'text-anchor': 'middle', class: 'scene-value scene-tween', 'font-size': 17, 'font-weight': 700,
        fill: val === 0 ? 'var(--muted)' : idx === 1 ? 'var(--b)' : 'var(--a)', opacity: 0,
      }));

      // Connectors from the 3 stems down to their vocabulary columns
      const targets = [COL_X[0], COL_X[1], COL_X[1]];
      links = STEM_SLOTS.map((s, idx) => {
        const sx = s.x + s.w / 2;
        const tx = targets[idx];
        return el('path', {
          d: `M ${sx} 144 C ${sx} 166, ${tx} 166, ${tx} 184`,
          fill: 'none', stroke: idx === 0 ? 'var(--a)' : 'var(--b)', 'stroke-width': 1.75,
          'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
          opacity: 0, class: 'scene-tween',
        }, tableGroup);
      });

      applyFrame(0, api);
    },
    frame(i, api) {
      applyFrame(i, api);
    },
    before(i, api) {
      if (i === 0) {
        applyFrame(0, api);
        delay(cleanArrow, 0);
        cleanArrow.setAttribute('stroke-dashoffset', '1');
        cleanArrow.setAttribute('opacity', '0');
        delay(cleanBox, 0);
        cleanBox.setAttribute('opacity', '0');
      } else if (i === 1) {
        applyFrame(1, api);
        wordItems.forEach(item => {
          delay(item.strike, 0);
          item.strike.setAttribute('stroke-dashoffset', '1');
          item.strike.setAttribute('opacity', '0');
          delay(item.rect, 0);
          delay(item.text, 0);
          item.rect.setAttribute('opacity', '1');
          item.text.setAttribute('opacity', '1');
          item.rect.setAttribute('stroke', 'var(--rule)');
        });
      } else if (i === 2) {
        applyFrame(2, api);
        delay(stemSuffix, 0);
        stemSuffix.setAttribute('opacity', '1');
        delay(stemStrike, 0);
        stemStrike.setAttribute('stroke-dashoffset', '1');
        stemStrike.setAttribute('opacity', '0');
        stemCards.forEach(card => {
          delay(card, 0);
          card.setAttribute('stroke', 'var(--rule)');
        });
      } else {
        applyFrame(3, api);
        links.forEach(lnk => {
          delay(lnk, 0);
          lnk.setAttribute('stroke-dashoffset', '1');
          lnk.setAttribute('opacity', '0');
        });
        countTexts.forEach(txt => {
          delay(txt, 0);
          txt.setAttribute('opacity', '0');
        });
        delay(countHighlight, 0);
        countHighlight.setAttribute('opacity', '0');
      }
    },
  });
}
