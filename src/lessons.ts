import type { ModelName } from './engine';

/** The 7 classification lessons in course order. Lesson pages live at `learn/3-classification/<id>/`. */
export const CLASSIFICATION: ModelName[] = ['logistic', 'knn', 'svm', 'ksvm', 'nb', 'tree', 'forest'];

export const lessonPath = (id: ModelName) => `learn/3-classification/${id}/`;
export const notebookUrl = (id: ModelName) =>
  `https://colab.research.google.com/github/Mohammad-QT/ML_DL_Vis/blob/main/notebooks/3-classification/${id}.ipynb`;

/** Part 0 and Part 1 lessons in course order. `start` is Part 0; the rest live under `learn/1-data/`. */
export const PREP = ['start', 'missing', 'categories', 'split', 'scaling'] as const;
export type PrepId = (typeof PREP)[number];

export const prepPath = (id: PrepId) => (id === 'start' ? 'learn/0-start/' : `learn/1-data/${id}/`);
export const prepNotebookUrl = (id: PrepId) =>
  `https://colab.research.google.com/github/Mohammad-QT/ML_DL_Vis/blob/main/notebooks/${id === 'start' ? '0-start/hello' : `1-data/${id}`}.ipynb`;
