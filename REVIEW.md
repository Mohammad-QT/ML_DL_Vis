# Owner review list

One sitting, top to bottom. English is a draft for you to edit; Arabic is a first pass for you to correct.
Nothing here needs a developer: edit the file named in the table and save. Arabic copy sits next to the English one
(`.../ar/<id>.mdx` next to `.../en/<id>.mdx`, or the `ar:` block in the same `.ts` file).

## Where the copy lives

| Page | URL (EN / AR) | English copy | Arabic copy |
|---|---|---|---|
| Home (hero, route, picker) | `/` · `/ar/` | `src/i18n/pages.ts` → `home.en` | `home.ar` |
| Compare (incl. CSV upload and its error messages) | `/compare/` · `/ar/compare/` | `src/i18n/pages.ts` → `compare.en` (keys `c_*` and `e_*` are the CSV text) | `compare.ar` |
| Part 0 Start here | `/learn/0-start/` | `src/content/prep/en/start.mdx` | `src/content/prep/ar/start.mdx` |
| Part 1 Missing values | `/learn/1-data/missing/` | `src/content/prep/en/missing.mdx` | `.../ar/missing.mdx` |
| Part 1 Text categories | `/learn/1-data/categories/` | `src/content/prep/en/categories.mdx` | `.../ar/categories.mdx` |
| Part 1 Train/test split | `/learn/1-data/split/` | `src/content/prep/en/split.mdx` | `.../ar/split.mdx` |
| Part 1 Feature scaling | `/learn/1-data/scaling/` | `src/content/prep/en/scaling.mdx` | `.../ar/scaling.mdx` |
| Part 2 Simple linear | `/learn/2-regression/linear/` | `src/content/regression/en/linear.mdx` | `.../ar/linear.mdx` |
| Part 2 Multiple linear | `/learn/2-regression/multiple/` | `src/content/regression/en/multiple.mdx` | `.../ar/multiple.mdx` |
| Part 2 Polynomial | `/learn/2-regression/polynomial/` | `src/content/regression/en/polynomial.mdx` | `.../ar/polynomial.mdx` |
| Part 2 SVR | `/learn/2-regression/svr/` | `src/content/regression/en/svr.mdx` | `.../ar/svr.mdx` |
| Part 2 Decision tree | `/learn/2-regression/tree/` | `src/content/regression/en/tree.mdx` | `.../ar/tree.mdx` |
| Part 2 Random forest | `/learn/2-regression/forest/` | `src/content/regression/en/forest.mdx` | `.../ar/forest.mdx` |
| Part 3 Logistic regression | `/learn/3-classification/logistic/` | `src/content/lessons/en/logistic.mdx` | `src/content/lessons/ar/logistic.mdx` |
| Part 3 K-NN | `/learn/3-classification/knn/` | `src/content/lessons/en/knn.mdx` | `.../ar/knn.mdx` |
| Part 3 SVM | `/learn/3-classification/svm/` | `src/content/lessons/en/svm.mdx` | `.../ar/svm.mdx` |
| Part 3 Kernel SVM | `/learn/3-classification/ksvm/` | `src/content/lessons/en/ksvm.mdx` | `.../ar/ksvm.mdx` |
| Part 3 Naive Bayes | `/learn/3-classification/nb/` | `src/content/lessons/en/nb.mdx` | `.../ar/nb.mdx` |
| Part 3 Decision tree | `/learn/3-classification/tree/` | `src/content/lessons/en/tree.mdx` | `.../ar/tree.mdx` |
| Part 3 Random forest | `/learn/3-classification/forest/` | `src/content/lessons/en/forest.mdx` | `.../ar/forest.mdx` |
| Part 10 k-fold cross-validation | `/learn/10-selection/cv/` | `src/content/selection/en/cv.mdx` | `.../ar/cv.mdx` |
| Part 10 Grid search | `/learn/10-selection/grid/` | `src/content/selection/en/grid.mdx` | `.../ar/grid.mdx` |
| Part 10 XGBoost | `/learn/10-selection/boost/` | `src/content/selection/en/boost.mdx` | `.../ar/boost.mdx` |
| 404 page | any missing URL | `src/i18n/ui.ts` → `common.en` keys `nf_*` | `common.ar` |

Shared text on every page (top bar, footer, model names, board hints, score labels, "Open in Colab"):
`src/i18n/ui.ts` (`common`, `lesson`, `prep`, `sel`, each with `en` and `ar`).
Page titles and descriptions come from each lesson's `short` / `lede` fields, and from `page_title` / `lede` for Home and Compare.
Site-wide fallback description: `site_desc` in `src/i18n/ui.ts`.

## Confirm first

- **Your name in Arabic**: محمد إسماعيل القطامين (footer on every page). Please confirm the spelling.
- **Brand**: the Arabic site shows "ML Visual" in Latin letters. Keep, or add an Arabic name?
- **Copyright wording** in both languages (`common.*.copyright`).

## Arabic passages I'm unsure about

Terms with more than one common Arabic rendering. Pick the one your students know, then search and replace across `src/`.

| Term | I used | Alternatives | Where |
|---|---|---|---|
| overfitting / memorising | «يحفظ النقاط عن ظهر قلب» (memorises by heart) | الإفراط في التخصيص, فرط التعلّم | Compare verdicts, lessons |
| feature | الميزة | الخاصية, المتغيّر | CSV panel, lessons |
| target (what to predict) | الهدف | المتغيّر التابع, الناتج | CSV panel, Part 1 |
| residuals | البواقي | الأخطاء, الفروق | regression lessons, `residuals` |
| naive Bayes | بايز الساذج | نايف بايز | model names |
| decision tree / random forest | شجرة القرار / الغابة العشوائية | شجرة القرارات | model names |
| cross-validation / k-fold | التحقق المتقاطع / k-fold left in Latin | التحقق التبادلي, طيّات k | Part 10 |
| grid search | البحث الشبكي | البحث في الشبكة | Part 10 |
| boosting | التعزيز | التقوية, تعزيز التدرّج | Part 10 boost |
| scaling / standardising | تحجيم / توحيد المقياس | تطبيع, تقييس | Part 1 scaling, CSV text |
| imputer | أداة التعويض | المُكمِّل | Part 1 missing |
| variance kept by PCA | «تباين» | التشتت | `c_pca_explained` |
| hyperparameter sliders ("C", "Gamma", "Epsilon") | kept in Latin letters | Arabic transliteration | all lessons |
| margin | الهامش | الحدّ الفاصل | SVM lessons |

Phrases I'd read twice (tone, not only words):

- Home hero and the "Help me pick" questions (`home.ar`): the questions are written as direct address; check the register.
- The CSV error messages (`compare.ar` keys `e_*`): they're long. Shorten where you can.
- Every `why:` text under a quiz answer (frontmatter in each `.mdx`): short explanations written quickly.
- Anywhere a Latin term sits inside Arabic text I wrapped it in `<bdi>`. If a bracket or number looks flipped, tell me the page.

## English copy to check

- Home: "The route" card descriptions, the three-question picker and its shortlist reasons (`why_*`).
- Compare: verdict sentences ("X gets N more test points right"), and the new CSV messages (`c_*`, `e_*`).
- Every lesson: `lede`, the four `steps`, the `caution` card, the quiz `why` lines and the predict-the-line exercise.
- Numbers quoted as facts: dataset sizes in `datasets/README.md`, score thresholds in each lesson's `challenge`.

## Not in v1 (so you don't look for it)

- CSV upload is on Compare only. Lessons keep their own fixed datasets.
- Kernel SVM and SVR train on at most 250 points even when more are shown (keeps the boards fast on big uploads).
- Parts 4–9 are on the route as "come later".
