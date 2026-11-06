# ML Visual — working notes for Claude

Read `PLAN.md` first: it holds every settled decision, the stack, the site map and the milestones.

## Rules

- The approved visual spec is `sketches/home/`, `sketches/006-lesson/`, `sketches/compare/` with `sketches/shared/`.
  Match their tokens, fonts, spacing and behaviour. Don't restyle without the owner asking.
- Defaults: dark theme, English. Arabic lives under `/ar/` and must render right-to-left; wrap Latin terms in
  Arabic headings with `<bdi>` so they don't break.
- Every page shows the footer "© 2026 Mohammad Ismael Al-Qatameen. All rights reserved." (Arabic: "© 2026 محمد إسماعيل القطامين. جميع الحقوق محفوظة.").
- Never copy files or text from `course_material/` (the paid course's own material, git-ignored). Use it only to
  know which topics, hyperparameters and steps a lesson covers. Notebooks, prose and datasets must be original or public.
- No Python or code execution on the site. Code goes to Colab via notebooks in `notebooks/`.
- Copy: plain, specific, active voice, sentence case, written for beginners. English is a draft for the owner's review.
- localStorage access always in try/catch; the site must work without it.
- Engine models need Vitest tests. Run `npm test` and `npm run build` before calling a milestone done, and check
  pages in the browser in light/dark and EN/AR.
- Commit per milestone on a branch and open a PR; don't push to `main` directly.
