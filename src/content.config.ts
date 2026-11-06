import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { MODEL_NAMES } from './engine';
import { PREP } from './lessons';

const model = z.enum(MODEL_NAMES as [string, ...string[]]);
const preset = z.enum(['blobs', 'moons', 'circles', 'xor']);
const quiz = z.array(z.object({
  q: z.string(),
  a: z.array(z.string()).min(2).max(4),
  /** Index into `a`. */
  correct: z.number(),
  right: z.string(),
  wrong: z.string(),
})).min(1);
const hint = z.object({ text: z.string() });

// One MDX file per lesson per language: `lessons/<lang>/<model>.mdx`. The body is the "idea" text.
const lessons = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/lessons' }),
  schema: z.object({
    model,
    /** Short name used in links, e.g. "K-NN". */
    short: z.string(),
    /** HTML allowed (Arabic titles wrap Latin terms in <bdi>). */
    title: z.string(),
    lede: z.string(),
    figure: z.object({ preset, seed: z.number(), cell: z.number().optional(), dot: z.number().optional(), tint: z.number().optional() }),
    steps: z.array(z.string()).min(3).max(4),
    caution: z.object({ h: z.string(), p: z.string() }),
    play: z.object({
      p: z.string(),
      /** Touch-screen wording; falls back to `p`. */
      p_touch: z.string().optional(),
      preset,
      seed: z.number(),
      /** Label for the model's one setting; omit for models with none. */
      param_label: z.string().optional(),
      hints: z.object({
        low: hint.extend({ max: z.number() }).optional(),
        high: hint.extend({ min: z.number() }).optional(),
      }).default({}),
    }),
    quiz,
    /** "Predict the line": three models drawn on the same data; `answer` is the index of this lesson's model. */
    predict: z.object({ preset, seed: z.number(), options: z.array(model).length(3), answer: z.number(), why: z.string() }),
    /** "Beat the score": fixed data and split; reach `target` % test accuracy by moving the slider from `start`. */
    beat: z.object({ preset, seed: z.number(), start: z.number(), target: z.number() }).optional(),
    /** scikit-learn snippet, plain text. */
    code: z.string(),
    /** Lesson to suggest in the Compare link. */
    compare: model,
  }),
});

// Part 0 and Part 1: `prep/<lang>/<id>.mdx`. The body is the "idea" text; the Play tab is a board (Part 0) or an interactive from `ui`.
const prep = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/prep' }),
  schema: z.object({
    id: z.enum(PREP),
    short: z.string(),
    title: z.string(),
    lede: z.string(),
    figure: z.object({ preset, seed: z.number(), model: model.optional(), caption: z.string() }),
    steps_h: z.string(),
    steps: z.array(z.string()).min(3).max(4),
    caution: z.object({ h: z.string(), p: z.string() }),
    play: z.object({ p: z.string(), p_touch: z.string().optional() }),
    /** Words used by the interactive (labels, notes). Same keys in every language. */
    ui: z.record(z.string(), z.string()).default({}),
    quiz,
    code: z.string(),
  }),
});

export const collections = { lessons, prep };
