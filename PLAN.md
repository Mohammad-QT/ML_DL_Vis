# ML Visual — build plan

An interactive, bilingual (English default, Arabic RTL) site that teaches the Machine Learning A-Z
syllabus (Python only) by letting beginners watch models draw their decision lines live in the browser.
Code practice happens in Google Colab, never on the site.

© 2026 Mohammad Ismael Al-Qatameen. All rights reserved.

## Settled decisions

| Topic | Decision |
|---|---|
| Audience | Beginners, intuition first, light math |
| Language | English default at `/`, Arabic at `/ar/` (RTL). Claude drafts English for the owner's review and writes the Arabic |
| Theme | Dark by default, light toggle, choice remembered in the browser |
| Hosting | GitHub Pages from `Mohammad-QT/ML_DL_Vis` → `https://mohammad-qt.github.io/ML_DL_Vis/` |
| Models | Re-implemented in TypeScript, train in the browser, re-fit instantly |
| Code | Our own notebooks in `notebooks/`, opened via "Open in Colab" links. No code runs on the site |
| Data | Draw points, preset shapes, built-in public datasets, CSV upload (later milestone) |
| Tests for viewers | Multiple choice, predict-the-line, beat-the-score challenges |
| Progress | Saved in the viewer's browser only (localStorage, wrapped in try/catch) |
| Copyright | Footer on every page: "© 2026 Mohammad Ismael Al-Qatameen. All rights reserved." / Arabic equivalent |
| Course files | `course_material/` is reference only, git-ignored, never copied into the site. Write original notebooks and text; use public datasets |

## Design (approved)

The approved mockups live in `sketches/` (run `python -m http.server 8765 --directory sketches`):
`sketches/home/`, `sketches/006-lesson/`, `sketches/compare/`. They are the visual spec. Port their look exactly.

- Identity: graph paper + plotting ink. Tokens in `sketches/shared/theme.css` (light + dark).
- Fonts: Bricolage Grotesque (display), Atkinson Hyperlegible (body), IBM Plex Mono (data), Readex Pro (Arabic).
- Signature: every algorithm is shown by the boundary line it draws (smooth marching-squares contour).
- Lesson structure: Learn → Play → Check → Code tabs, one card at a time; train/test scores with ringed test points.
- Highlighter `<mark>` swipe on key words; no confetti, no emoji badges.

## Stack

- **Astro** (static output) with TypeScript. Content in MDX content collections, one file per lesson per language.
- **Engine** in `src/engine/` (plain TS, no framework): data store, models, board renderer. Port from
  `sketches/shared/engine.js`, split into modules, typed.
- **Vitest** for engine tests (each model: fits a separable set to ≥95% train accuracy, handles one class, deterministic).
- **GitHub Actions** workflow deploying `dist/` to Pages on push to `main`. `base: '/ML_DL_Vis/'` in Astro config.
- Notebooks: `notebooks/<part>/<lesson>.ipynb`, data in `datasets/` (public, license noted in `datasets/README.md`),
  loaded in notebooks by raw GitHub URL so Colab works with no upload.
  Colab link pattern: `https://colab.research.google.com/github/Mohammad-QT/ML_DL_Vis/blob/main/notebooks/...`

## Site map (v1)

```
/                     Home: live hero, the route, algorithm picker
/compare/             Two algorithms side by side (classification; regression added in M5)
/learn/0-start/       Part 0  Start here (how the site works, what Colab is, reading a board)
/learn/1-data/        Part 1  Preprocessing: missing values, encoding categories, train/test split, feature scaling
/learn/2-regression/  Part 2  Simple linear, Multiple linear, Polynomial, SVR, Decision tree, Random forest
/learn/3-classification/ Part 3  Logistic, K-NN, SVM, Kernel SVM, Naive Bayes, Decision tree, Random forest
/learn/10-selection/  Part 10 k-fold cross-validation, Grid search, XGBoost (gradient boosting)
/ar/...               Same pages in Arabic
```
Parts 4–9 appear on the route as "come later".

## Milestones

Each milestone ends with: tests green, `npm run build` clean, pages checked in a browser in light/dark and EN/AR.

1. **Foundation** — Astro scaffold, theme tokens + fonts, base layout (top bar, theme + language toggles,
   copyright footer), i18n routing, engine ported to TS with Vitest tests, `<Board>` component,
   Pages deploy workflow. Done when an empty lesson page deploys and renders a working K-NN board.
2. **Home + Compare** — port `sketches/home` and `sketches/compare` onto the real engine; picker links into Compare
   with `?a=&b=` params.
3. **Classification lessons (7)** — lesson template from `sketches/006-lesson` driven by MDX frontmatter
   (model id, params, quiz). One original notebook per lesson. Add "predict-the-line" and "beat-the-score" exercises.
4. **Part 0 + Part 1** — welcome lesson and four preprocessing lessons, each with its own small interactive
   (impute missing values, one-hot encoding table, split slider, scaling before/after with K-NN distances).
5. **Regression (6)** — 1-D regression board (points x→y, fitted curve, residuals), regression models in the engine
   (linear, polynomial, SVR, tree, forest), R² train/test; Compare supports regression.
6. **Model selection (3)** — k-fold animation over the board, grid-search heatmap (e.g. Kernel SVM C × gamma),
   gradient boosting step-through.
7. **Polish** — CSV upload (pick 2 columns or PCA to 2-D), accessibility pass (keyboard, contrast, reduced motion),
   performance (boards render in a Web Worker if needed), full Arabic review list for the owner.

## Open items for the owner

- Review English copy as each milestone lands (lesson text lives in `src/content/`).
- Confirm the Arabic spelling of the name: محمد إسماعيل القطامين.
- Figma design may refine visuals later; the sketches stay the spec until then.
