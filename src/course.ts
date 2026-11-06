// The whole course as one ordered list: the single source of truth for the sidebar, the progress counts,
// "next lesson" and "continue where you left off". Built from the per-part lists in `lessons.ts`.
import { CLASSIFICATION, PREP, REGRESSION, SELECTION, lessonPath, prepPath, regPath, selPath } from './lessons';
import { common, prep, sel, type Lang } from './i18n/ui';
import { home } from './i18n/pages';

export type PartId = '0' | '1' | '2' | '3' | '10';

export interface CourseLesson {
  /** Progress key, unique across parts: `<part>/<id>`, e.g. `3/tree` vs `2/tree`. */
  key: string;
  part: PartId;
  id: string;
  /** Site path without base or language prefix. */
  path: string;
  /** Notebook path inside the repo, e.g. `notebooks/3-classification/knn.ipynb`. */
  notebook: string;
}

export interface CoursePart { id: PartId; lessons: CourseLesson[] }

const mk = (part: PartId, id: string, path: string, nb: string): CourseLesson =>
  ({ key: `${part}/${id}`, part, id, path, notebook: `notebooks/${nb}.ipynb` });

export const PARTS: CoursePart[] = [
  { id: '0', lessons: [mk('0', 'start', prepPath('start'), '0-start/hello')] },
  { id: '1', lessons: PREP.filter(id => id !== 'start').map(id => mk('1', id, prepPath(id), `1-data/${id}`)) },
  { id: '2', lessons: REGRESSION.map(id => mk('2', id, regPath(id), `2-regression/${id}`)) },
  { id: '3', lessons: CLASSIFICATION.map(id => mk('3', id, lessonPath(id), `3-classification/${id}`)) },
  { id: '10', lessons: SELECTION.map(id => mk('10', id, selPath(id), `10-selection/${id}`)) },
];

/** Every lesson in course order. */
export const LESSONS: CourseLesson[] = PARTS.flatMap(p => p.lessons);
export const KEYS = LESSONS.map(l => l.key);

export const findLesson = (key: string) => LESSONS.find(l => l.key === key);
export const nextLesson = (key: string): CourseLesson | undefined => LESSONS[KEYS.indexOf(key) + 1];

const REPO = 'Mohammad-QT/ML_DL_Vis';
export const colabUrl = (l: CourseLesson) => `https://colab.research.google.com/github/${REPO}/blob/main/${l.notebook}`;
export const githubUrl = (path: string) => `https://github.com/${REPO}/tree/main/${path}`;

/** Lesson name in the given language (the same names the home route and the lesson buttons use). */
export function lessonName(lang: Lang, l: CourseLesson): string {
  if (l.part === '0' || l.part === '1') return prep[lang][`n_${l.id}` as keyof (typeof prep)['en']];
  if (l.part === '10') return sel[lang][`n_${l.id}` as keyof (typeof sel)['en']];
  return common[lang][`m_${l.id}` as keyof (typeof common)['en']];
}

/** Part name as shown on the home route. */
export const partName = (lang: Lang, part: PartId): string => home[lang][`p${part}` as keyof (typeof home)['en']];
