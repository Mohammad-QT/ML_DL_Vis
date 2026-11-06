import type { ModelName } from './engine';

/** The 7 classification lessons in course order. Lesson pages live at `learn/3-classification/<id>/`. */
export const CLASSIFICATION: ModelName[] = ['logistic', 'knn', 'svm', 'ksvm', 'nb', 'tree', 'forest'];

export const lessonPath = (id: ModelName) => `learn/3-classification/${id}/`;
export const notebookUrl = (id: ModelName) =>
  `https://colab.research.google.com/github/Mohammad-QT/ML_DL_Vis/blob/main/notebooks/3-classification/${id}.ipynb`;
