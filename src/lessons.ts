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

/** The 6 regression lessons in course order. `multiple` has no board: its Play tab is a small feature-weights interactive. */
export const REGRESSION = ['linear', 'multiple', 'polynomial', 'svr', 'tree', 'forest'] as const;
export type RegId = (typeof REGRESSION)[number];

export const regPath = (id: RegId) => `learn/2-regression/${id}/`;
export const regNotebookUrl = (id: RegId) =>
  `https://colab.research.google.com/github/Mohammad-QT/ML_DL_Vis/blob/main/notebooks/2-regression/${id}.ipynb`;
