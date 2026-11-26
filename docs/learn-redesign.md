# Learn step v2: less reading, more watching

Owner request (26 Nov 2026): the Learn step is mostly text. Make it simpler and more visual:

1. A **short step list next to an animation** that shows each step. Pointing at a step moves the animation to it; when
   nobody is pointing, the animation keeps cycling through the steps.
2. **Simple by default, Detailed on request.** The current full text stays one click away for readers who want it.
3. **Collapse the hero** (kicker, title, lede, figure) to the title only once the learner leaves Learn. It takes too much
   room, especially on phones.
4. **Make the important buttons easier to notice** across the site.

The approved visual spec (`sketches/`, `src/styles/theme.css`) still rules: reuse its tokens, fonts, radii and shadows;
add no new colours. The owner asked for these changes, so they may adjust components, but not restyle the site.

## 1. The Simple Learn view

### Layout

```
┌ Learn card ──────────────────────────────────────────────────────────────┐
│ The idea                                         [ Simple | Detailed ]   │
│                                                                          │
│  ① Pick K, the number of neighbours   ◀──┐   ┌───────────────────────┐   │
│  ② Measure the distance to each point     │   │                       │   │
│  ③ Keep the K closest                     ├── │   animated scene       │   │
│  ④ The majority class wins                │   │   (frame = step)       │   │
│                                           │   └───────────────────────┘   │
│  ⚠ Scale features first: distance mixes units.   ● ● ○ ○  ❚❚            │
│                                                   [Play →]               │
└──────────────────────────────────────────────────────────────────────────┘
```

- Wide screens: two columns, steps at the inline start (right side in Arabic), scene at the inline end.
- Below 860px: the scene on top, the steps under it. The scene stays visible while you tap steps.
- Steps are `<button>`s in an ordered list. The current one is highlighted with the existing `--hl` swipe (same as
  `<mark>`), plus a progress bar under it that fills while autoplay waits on that step.
- Under the scene: step dots and a pause/play button (`aria-pressed`). The caution shrinks to one line (`caution.short`).

### Behaviour

| Input | What happens |
|---|---|
| Nothing (autoplay) | Frames advance every ~3s and loop. The matching step is highlighted. |
| Mouse over a step / keyboard focus on a step | Jump to that frame and pause. Moving the pointer down the list scrubs through frames. |
| Pointer leaves the list / focus leaves | Resume autoplay after 1.5s from the current frame. |
| Tap a step (touch) | Jump to that frame and pause. The pause button shows it is paused; tap it (or the same step) to resume. |
| Pause button | Toggles autoplay. |
| Arrow keys in the list | Move between steps (roving tabindex). |
| `prefers-reduced-motion` | No autoplay and no tweening. Frame 1 is shown, and steps still switch frames instantly. |
| Scene scrolled out of view or tab hidden | Autoplay stops (IntersectionObserver, `visibilitychange`), so the CPU stays idle. |

### Simple / Detailed toggle

- A segmented control at the top of the Learn card (`role="radiogroup"`, two buttons).
- **Simple** (default): the view above.
- **Detailed**: exactly today's Learn card (idea text, step cards, caution, nav).
- The choice is remembered in `localStorage` key `mlv-learn-mode` (inside try/catch; the site works without it) and
  applies to every lesson.
- A lesson without `quick` data shows Detailed only and hides the toggle. This lets lessons convert one at a time.

### Content (frontmatter, every lesson collection)

Add an optional block to every lesson schema in `src/content.config.ts`:

```yaml
quick:
  steps:            # same count as `steps` (3–4); ≤ 12 words each, plain, active, no HTML except <b>/<bdi>
    - "Pick K, the number of neighbours to ask"
    - "Measure the distance to every training point"
    - "Keep the K closest points"
    - "The class most of them share wins"
  caution: "Scale the features first: distance mixes units"   # one line
  scene: knn        # id of the scene module in src/learn/scenes/
```

- English and Arabic files carry the same `scene` id and step count; a Vitest check enforces this.
- Arabic: natural MSA, Latin terms in `<bdi>`.

## 2. Scene engine (`src/learn/`)

Small, dependency-free, SVG only, themed through CSS variables so light/dark/RTL just work.

```ts
// src/learn/scene.ts
export interface SceneApi {
  svg: SVGSVGElement;                    // viewBox 0 0 400 300; direction: ltr (scenes are diagrams)
  el<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K];
  /** Seeded random numbers, so a scene is the same on every visit. */
  random: () => number;
  /** Text label in the page language: scenes get short words from `ui`. */
  t(key: string): string;
  reduced: boolean;                      // prefers-reduced-motion
}
export interface Scene {
  frames: number;                        // must equal the lesson's step count
  /** Build the static parts once. */
  setup(api: SceneApi): void;
  /** Show frame `i`. Called on every change. Set attributes; CSS transitions (300–600 ms) do the tweening. */
  frame(i: number, api: SceneApi): void;
  /** Optional loop while frame `i` is shown (e.g. a filter sliding across an image). Return a stop function. */
  loop?(i: number, api: SceneApi): () => void;
}
export const defineScene = (s: Scene) => s;
```

- `src/learn/scenes/index.ts` maps scene ids to lazy imports (`() => import('./knn')`), so a lesson page loads only its
  own scene.
- `src/learn/player.ts` contains `mountLearn(root)`. It wires the list, the toggle, autoplay, hover scrubbing, touch,
  keyboard, reduced motion, visibility and the pause button, then calls `setup`, `frame` and `loop`.
- `src/components/LearnStep.astro` is the shared Learn card (Simple + Detailed). **All four lesson templates**
  (`Lesson`, `PrepLesson`, `RegLesson`, `SelLesson`) use it instead of their duplicated markup.
- Scene style rules: use only `var(--a)`, `var(--b)`, `var(--ink)`, `var(--muted)`, `var(--rule)`, `var(--sheet)`,
  `var(--paper)`, `var(--hl)`, `var(--ok)`, `var(--bad)`, the site fonts, round line caps, and 1.5–2px strokes, like the
  boards. Words inside a scene come from `ui` keys and stay short.
- Where cheap, scenes reuse the real engine (`src/engine/`) on a seeded preset, so the picture matches the Play board.

### Tests

- `player.test.ts` (jsdom): autoplay advances, hover pauses and jumps, leaving resumes, the toggle persists (and works when
  `localStorage` throws), reduced motion disables autoplay, and keyboard arrows move.
- Content test: for each lesson with `quick`, the EN/AR step counts equal `steps.length`, the scene ids match, and the
  scene's `frames` equals the step count.
- Each converted lesson's built page mounts without errors (extend the existing jsdom page tests that read
  `inject('siteDir')`; never build inside a test).

## 3. Collapsing hero

- `go(i)` toggles `.compact` on `.hero` when `i > 0`. Compact shows the kicker and the title only. The title shrinks to
  about 30px (24px on phones), and the lede and figure are hidden. Height changes are animated, or instant under reduced
  motion.
- Going back to Learn restores the full hero. The tab row stays right under the title, so Play opens near the top of
  the screen.
- Implement it once (shared script/CSS used by the four templates), not four times.

## 4. Prominent buttons (GPT/Codex only)

Problem: key actions look like secondary chips. Examples: CNN **Example**/**Clear**, ANN **Step**, the **Play →** /
**Check →** next buttons at the bottom of each card, the quiz answers, and **Open in Colab**.

- One clear primary action per panel, using the existing primary styles: `.btn` (ink) and `.btn.hl` (yellow highlight)
  for "go forward" actions. Secondary actions stay `.chip` or `.btn.ghost`.
- Next-step buttons (`.navrow .btn:not(.ghost)`) use the highlight style and a larger hit area (≥ 44px on touch).
- Action chips that run something (Example, Step, Reset, Clear, Shuffle…) get a distinct "action" look via a new
  `.chip.act` rule in `theme.css`: an icon and a stronger border, built only from existing tokens. Toggle chips keep
  their look.
- A demo's main action (Train in ANN, Example in CNN when the pad is empty, Run in gradient descent…) gets a short,
  subtle attention pulse on first view only. It is skipped under reduced motion.
- Check contrast in both themes (WCAG AA for text, 3:1 for control borders).

## Phases and agents

| Phase | Work | Who | Branch / worktree |
|---|---|---|---|
| 1a | Scene engine, `LearnStep`, player, toggle, collapsing hero, schema + tests, and **pilot scenes**: K-NN (Part 3), ANN and CNN (Part 8) with `quick` EN+AR | Sol (Codex `gpt-6.2-sol`, high) | `learn-v2` · `C:\Projects\mlv-wt\learn-v2` |
| 1b | Prominent buttons, site-wide (`theme.css`, demo components, `CodeOptions`, `NextLesson`). Does not edit the four lesson templates; next-step buttons are styled from `theme.css` | Sol (Codex, high), GPT only | `buttons-v2` · `C:\Projects\mlv-wt\buttons-v2` |
| — | Merge 1a + 1b, review, `npm test`, `npm run build`, browser check (EN/AR, light/dark, 375px, reduced motion) → **one PR for the owner to try** | Claude | `learn-v2` |
| 2 | After the owner approves the pilot: `quick` + a scene for every other lesson, split by part into 4–5 parallel Sol agents (each only touches its own content files and `src/learn/scenes/<id>.ts`) | Sol (Codex, high) × 4–5 | one worktree per agent, merged by Claude |

Rules for every agent: read `CLAUDE.md` and this file first; never open `course_material/`; only edit the files of your
own task; run `npm test` and `npm run build` before finishing; do not commit (Claude reviews and commits).

## Phase 2: which lessons get a scene (owner approved, 26 Nov 2026)

Owner feedback on the pilot: "super good". Two changes:

1. **Pointing at a step plays that step instead of freezing it** (done in `player.ts`: `before(i)` then `frame(i)` every
   2.6s, plus `loop`).
2. **Animate where it teaches, not everywhere.** The rule: animate when the algorithm is a *process over time* that the
   Play board only shows as an end result. Tier 3 lessons get no scene for now.

How-to for authors: `docs/scenes-guide.md`.

### Tier 1 — animate (process lessons)

| Lesson (file) | Scene id | What the steps show |
|---|---|---|
| K-Means (`clustering/kmeans`) | `kmeans` | Centres dropped → points take the nearest centre's colour (lines to centres) → centres slide to their points' mean (trail) → repeat until still ("Round n" ticks; loop runs rounds) |
| Hierarchical (`clustering/hierarchical`) | `hierarchical` | Every point its own cluster → closest pair merges (link drawn, dendrogram bar grows beside) → merging continues up the tree → cut line across the dendrogram picks the clusters |
| DBSCAN (`clustering/dbscan`) | `dbscan` | ε-circle around a point counts neighbours → core points light up → clusters grow by chaining core points (spread animation) → leftover points marked as noise (×) |
| Decision tree, classification (`lessons/tree`) | `3-tree` | Board with two classes → first split line with the question → second split inside one half → regions shaded = leaves; a point drops down the tiny tree to its leaf |
| Random forest, classification (`lessons/forest`) | `3-forest` | Bootstrap: points sampled with repeats into 3 mini boards → each grows a different tree boundary → boundaries overlaid → majority vote gives a smooth boundary |
| SVM (`lessons/svm`) | `svm` | Many possible separating lines → the widest street (margin) → support vectors ringed on the edges → a new point classified by side |
| Kernel SVM (`lessons/ksvm`) | `ksvm` | Rings that no line separates → points lifted by a bump (height = distance from centre, isometric) → a flat plane cuts them → back on the board the cut is a circle |
| Gradient descent (`regression/gradient-descent`) | `gradient-descent` | Loss curve (bowl) with a ball → slope arrow at the ball → step downhill by rate × slope → repeated steps shrink near the bottom (loop), line on a mini board fits better each step |
| XGBoost / boosting (`selection/boost`) | `boost` | First weak model (flat step) and its residual bars → next tree fits the residuals → added together the fit improves → repeat, residual bars shrink |
| k-fold CV (`selection/cv`) | `cv` | Data split into 5 folds (bar) → fold 1 is test, rest train, score shown → the test fold rotates through all 5 (loop) → scores averaged, mean ± spread |
| Grid search (`selection/grid`) | `grid` | C × gamma grid → each cell runs CV and fills with its score colour (loop fills cells) → best cell ringed → final model retrained with it |
| PCA (`dimred/pca`) | `pca` | Cloud of points → a candidate axis rotates, projected ticks spread changes (loop) → stops at max spread = PC1 → PC2 at right angles, points re-drawn in PC coordinates |
| Q-learning (`bandit/q-learning`) | `q-learning` | Grid world, agent at start → agent explores (random steps) → reaching the goal updates the last cell's value → values spread backwards over episodes (cells brighten), then the greedy arrow path |
| Apriori (`rules/apriori`) | `apriori` | Baskets → count single items, prune the rare ones (struck out) → build pairs only from survivors, count, prune → rule with support/confidence/lift shown |
| UCB (`bandit/ucb`) | `ucb` | 3 ads with bars (average) and confidence whiskers → pick the highest top-of-whisker → its whisker shrinks after a click/no-click → over rounds the best ad gets most picks (loop) |
| Thompson sampling (`bandit/thompson`) | `thompson` | 3 bell-shaped beliefs → draw one sample from each (dots) → play the highest sample; that belief narrows after the result → over rounds beliefs separate (loop) |

### Tier 2 — short and simple (one clear movement each)

`logistic` (straight score → squashed by the S-curve → threshold 0.5 colours the side), `nb` (bell curve per class per
feature → multiply → larger product wins), `2-polynomial` (degree 1 → 2 → 3 bends the line), `svr` (tube around the line;
points outside pull it), `regularization` (weight bars shrink as λ grows; Lasso hits zero), `metrics` (threshold slides,
confusion counts change, a dot walks the ROC curve), `lda`, `kernel-pca`, `eclat` (ID lists intersect),
`bag-of-words` (sentence → words → count row), `scaling` (axis squash changes which neighbour is nearest), `split`
(cards shuffle into train / test piles), `categories` (a text column becomes one-hot columns), `missing` (blank cells
fill with the mean/median), `2-tree` and `2-forest` (regression versions: steps, averaging).

### Tier 3 — no scene for now

`linear`, `multiple`, `start`, `sentiment`: their Play board already says it all. They keep today's Learn view.

### Agents

Trial first: **Gemini 4 Hydrogen (high)** writes the K-Means scene. If its quality matches the pilot scenes, Hydrogen
does the rest; otherwise Gemini 4 Neon does. Tier 1 is split across parallel agents by part, each in its own worktree,
merged and browser-checked by Claude; tier 2 follows after the owner sees tier 1.
