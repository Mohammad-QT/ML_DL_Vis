import { buildVocabulary, cleanText, countVector, scoreSentiment, splitReviews, splitWords, stemWord, tokenize, trainMultinomialNB, withoutStopWords, type Sentiment } from '../engine/text';
import { fill } from '../i18n/ui';

export const BAG_REVIEWS = [
  'The coffee was good.', 'The coffee was cold.', 'I liked the cakes.',
  'Good coffee and good cakes.', 'The cakes were cold.',
];
export const BAG_EXAMPLES = ['I liked the cakes and the coffee!', '2 cold cakes, please.', 'The coffee was good, good, good!'];
export const SENTIMENT_EXAMPLES = ['The coffee was smooth and fresh.', 'Not good.', 'Good coffee, not bad service.', 'Bad coffee, not good service.'];
export interface Review { text: string; liked: Sentiment }

function chips(words: readonly string[], empty: string): HTMLElement[] {
  return (words.length ? words : [empty]).map(word => {
    const chip = document.createElement('span');
    chip.className = 'nlp-token';
    chip.textContent = word;
    return chip;
  });
}

function cells(rows: readonly (readonly (string | number)[])[], table: HTMLTableElement, highlightLast = false) {
  const head = table.tHead!;
  const body = table.tBodies[0];
  head.replaceChildren();
  body.replaceChildren();
  rows.forEach((values, index) => {
    const row = (index === 0 ? head : body).insertRow();
    if (highlightLast && index === rows.length - 1) row.className = 'nlp-own';
    values.forEach((value, col) => {
      const heading = index === 0 || col === 0;
      const cell = document.createElement(heading ? 'th' : 'td');
      if (heading) cell.scope = index === 0 ? 'col' : 'row';
      cell.textContent = String(value);
      row.append(cell);
    });
  });
}

export function mountNlp(root: HTMLElement) {
  if (root.hasAttribute('data-nlp-mounted')) return;
  const input = root.querySelector<HTMLTextAreaElement>('[data-nlp-input]')!;
  const limit = root.querySelector<HTMLInputElement>('[data-nlp-vocab]')!;
  const limitValue = root.querySelector<HTMLOutputElement>('[data-nlp-size]')!;
  const board = root.querySelector<HTMLTableElement>('[data-nlp-board]')!;
  const ui: Record<string, string> = JSON.parse(root.querySelector('[data-nlp-ui]')!.textContent!);
  const locale = root.dataset.nlpLang;
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const labels = [ui.disliked, ui.liked];
  let update: () => void;
  let configure: () => void;

  if (root.dataset.nlp === 'bag-of-words') {
    const examples = BAG_REVIEWS.map(text => tokenize(text, true, true));
    const stages = [...root.querySelectorAll<HTMLElement>('[data-nlp-stage]')];
    let vocabulary: string[];
    update = () => {
      const clean = cleanText(input.value);
      const words = splitWords(clean);
      const filtered = withoutStopWords(words);
      const stems = filtered.map(stemWord);
      const pipeline = [input.value.trim() ? [input.value] : [], clean ? [clean] : [], words, filtered, stems];
      stages.forEach((stage, index) => stage.replaceChildren(...chips(pipeline[index], ui.empty)));
      const counts = [...examples, stems].map(row => countVector(row, vocabulary).map(count => number.format(count)));
      cells([[ui.review, ...vocabulary], ...counts.map((row, index) => [
        BAG_REVIEWS[index] ?? ui.yours, ...row,
      ])], board, true);
      limitValue.value = number.format(vocabulary.length);
    };
    configure = () => {
      vocabulary = buildVocabulary(examples, Number(limit.value));
      update();
    };
  } else {
    const reviews: Review[] = JSON.parse(root.querySelector('[data-nlp-reviews]')!.textContent!);
    const { train, test } = splitReviews(reviews, 42);
    const stop = root.querySelector<HTMLInputElement>('[data-nlp-stop]')!;
    const stem = root.querySelector<HTMLInputElement>('[data-nlp-stem]')!;
    const prediction = root.querySelector<HTMLElement>('[data-nlp-prediction]')!;
    const evidence = root.querySelector<HTMLElement>('[data-nlp-evidence]')!;
    const score = root.querySelector<HTMLElement>('[data-nlp-score]')!;
    const weight = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 2 });
    const classifyWord = (word: string) => stem.checked ? stemWord(word) : word;
    const preprocess = (text: string) => tokenize(text, stop.checked, stem.checked);
    let vocabulary: string[];
    let columns: Map<string, number>;
    let model: ReturnType<typeof trainMultinomialNB>;
    update = () => {
      const vector = countVector(preprocess(input.value), vocabulary);
      const { label, probabilities } = model.predict(vector);
      prediction.textContent = fill(vector.some(Boolean) ? ui.prediction : ui.prior, { label: labels[label], probability: percent.format(probabilities[label]) });
      const words = input.value.match(/[a-z]+/gi) ?? [];
      const tokens = words.map(original => {
        const word = original.toLowerCase();
        const kept = !stop.checked || withoutStopWords([word]).length > 0;
        const column = kept ? columns.get(classifyWord(word)) : undefined;
        const ratio = column === undefined ? 0 : model.logRatios[column];
        const token = chips([original], ui.empty)[0];
        token.dataset.nlpDirection = ratio > 0 ? 'liked' : ratio < 0 ? 'disliked' : 'neutral';
        token.style.setProperty('--nlp-strength', Math.min(Math.abs(ratio) * 14, 55) + '%');
        const value = document.createElement('small');
        value.textContent = ' ' + weight.format(ratio);
        token.append(value);
        return token;
      });
      evidence.replaceChildren(...(tokens.length ? tokens : chips([], ui.empty)));
    };
    configure = () => {
      const trainWords = train.map(row => preprocess(row.text));
      vocabulary = buildVocabulary(trainWords, Number(limit.value));
      columns = new Map(vocabulary.map((word, index) => [word, index]));
      model = trainMultinomialNB(trainWords.map(words => countVector(words, vocabulary)), train.map(row => row.liked));
      const predictions = test.map(row => model.predict(countVector(preprocess(row.text), vocabulary)).label);
      const { accuracy, matrix } = scoreSentiment(test.map(row => row.liked), predictions);
      score.textContent = fill(ui.accuracy, { score: percent.format(accuracy), total: number.format(test.length) });
      cells([[ui.actual, ...labels], ...matrix.map((row, index) => [labels[index], ...row.map(count => number.format(count))])], board);
      limitValue.value = number.format(vocabulary.length);
      update();
    };
    stop.addEventListener('change', configure);
    stem.addEventListener('change', configure);
  }

  input.addEventListener('input', update);
  limit.addEventListener('input', configure);
  root.querySelectorAll<HTMLButtonElement>('[data-nlp-example]').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.nlpExample!;
    update();
  }));
  configure();
  root.setAttribute('data-nlp-mounted', '');
}
