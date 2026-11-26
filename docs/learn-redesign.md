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
