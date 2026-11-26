# Writing a Learn scene

How to convert one lesson to the Simple Learn view (short steps + animated scene). Read `CLAUDE.md` and
`docs/learn-redesign.md` first. The finished examples to copy are `src/learn/scenes/knn.ts` (Part 3 K-NN),
`src/learn/scenes/ann.ts` and `src/learn/scenes/cnn.ts` (Part 8), with their lessons
`src/content/lessons/{en,ar}/knn.mdx` and `src/content/deep/{en,ar}/{ann,cnn}.mdx`.

## What you add per lesson (and nothing else)

1. **`src/learn/scenes/<scene>.ts`**: one file. It is found automatically, so there is no registry to edit. Name it after
   the lesson id, for example `kmeans.ts`. If two lessons share an id across parts, use `<part>-<id>.ts` (e.g. `3-tree.ts`
   and `2-tree.ts`).
2. **`quick:` in the lesson's English and Arabic MDX frontmatter**:

   ```yaml
   quick:
     steps:                  # exactly as many as the lesson's `steps` (3–4); ≤ 12 words each; only <b>/<bdi> tags
       - "Drop K centres at random"
       - "Give every point to its nearest centre"
       - "Move each centre to the middle of its points"
       - "Repeat until nothing changes"
     caution: "Pick K first: the algorithm will not choose it for you"   # one line
     scene: kmeans
     words:                  # labels drawn inside the scene; same keys in EN and AR; keep them 1–3 words
       centre: "Centre"
       round: "Round {n}"
   ```

   Arabic: natural Modern Standard Arabic, not word for word. Put Latin terms (K-Means, PCA, …) in `<bdi>` inside steps.
   Scene `words` are plain text (no tags).
3. Nothing else. Do **not** edit `player.ts`, `scene.ts`, `LearnStep.astro`, `index.ts`, `svg.ts`, `src/i18n/ui.ts` or
   any other shared file. If you think a shared file needs a change, write it in your final report instead.

## The scene contract (`src/learn/scene.ts`)

```ts
export default function myScene() {
  // keep references to the elements you create in setup
  return defineScene({
    frames: 4,                       // = number of steps
    setup(api) { /* build every element once with api.el(...); start in the frame-0 look */ },
    frame(i, api) { /* set attributes for step i; CSS transitions animate the change */ },
    before(i, api) { /* optional: the state just BEFORE step i (default: frame(i - 1)) */ },
    loop(i, api) { /* optional: continuous motion while step i shows; return a stop function */ },
  });
}
```

- **The player calls `frame(i)` to show a step.** Autoplay moves 0 → 1 → 2 → 3 → 0 every 3 s. When the learner points at,
  focuses or taps step `i`, the step keeps playing. The player calls `before(i)` without transitions, then `frame(i)`
  again every 2.6 s. Make each step read as a **small story** when replayed that way: something should visibly *happen*
  (a line draws, points change colour, a centre slides), not just appear. Use `before(i)` when the previous frame is not
  a good starting point.
- **`frame` must be idempotent and complete.** It sets every attribute it controls from scratch, so any frame can follow
  any other frame (learners jump around).
- **Animate with CSS transitions.** Add `class: 'scene-tween'` to an element, then change `opacity`, `fill`, `stroke`,
  `stroke-dashoffset` (with `pathLength: 1` and `'stroke-dasharray': '1 1'` to "draw" a line), `stroke-width` or
  `transform` in `frame`. For motion that has to repeat while a step shows (a scanning window, rounds ticking), use
  `loop` with `requestAnimationFrame` or `element.animate(...)`, and return a function that stops it.
- **`api.reduced` is true under reduced motion.** Then `loop` must not start, and the player shows still frames.
- **Canvas:** `viewBox="0 0 400 300"`, always left-to-right (even in Arabic). Leave ~20px margins. Keep text ≥ 13px and
  avoid more than ~4 labels on screen at once.
- **Colours only through CSS variables:** `var(--a)` (class A, blue), `var(--b)` (class B, pink), `var(--ink)`,
  `var(--muted)`, `var(--rule)` (grid), `var(--sheet)`, `var(--paper)` (scene background), `var(--hl)` (yellow
  highlight), `var(--ok)` (green), `var(--bad)` (red). Never hex or rgb. Strokes 1.5–2px with round caps, like the boards.
- **Text:** `label(api, parent, x, y, api.t('key'))` from `./svg`, with keys from the lesson's `quick.words` (or the shared
  ones already in `learn` in `src/i18n/ui.ts`: classA, classB, input, output, loss, …). Use `{n}` placeholders, filled
  with `api.t('round').replace('{n}', …)`. Numbers use the `scene-value` class (mono font).
- **Data:** seeded and deterministic. Use `api.random` (seeded) or fixed coordinates. Where it is cheap, run the real model
  from `src/engine/` on that data so the picture is truthful (K-NN does this).
- **Tone:** clear and calm, like a good textbook figure, not a screensaver. One idea per step. Highlight what changed in
  that step (yellow `--hl` ring, thicker stroke) and fade what doesn't matter.

## Check before you finish

- `npm test` passes. `src/learn/content.test.ts` checks EN/AR parity, step counts, word limits and that the scene's
  `frames` equals the step count. The existing page tests mount every built lesson.
- `npm run build` passes (0 errors).
- Node 24: put `C:\ProgramData\nvm\v24.20.0` first on PATH. `node_modules` is installed.
- Never open `course_material/`. Do not commit; Claude reviews, browser-checks and commits.
