import type { Model, Params, Sample, Trainable } from '../types';
import { knn } from './knn';
import { logistic } from './logistic';
import { naiveBayes } from './naiveBayes';
import { svm } from './svm';
import { forest, tree } from './tree';

export interface ParamSpec { min: number; max: number; step: number; def: number; log?: boolean }
interface ModelDef { make: (p: Params) => Trainable; params: Record<string, ParamSpec> }

export const MODELS = {
  knn:      { make: p => knn({ k: p.k }), params: { k: { min: 1, max: 25, step: 1, def: 5 } } },
  logistic: { make: () => logistic(), params: {} },
  svm:      { make: p => svm('linear', p), params: { C: { min: -1, max: 3, step: 0.1, def: 1, log: true } } },
  ksvm:     { make: p => svm('rbf', p), params: { gamma: { min: 0, max: 2.3, step: 0.05, def: 1.2, log: true } } },
  nb:       { make: () => naiveBayes(), params: {} },
  tree:     { make: p => tree({ depth: p.depth }), params: { depth: { min: 1, max: 12, step: 1, def: 4 } } },
  forest:   { make: p => forest({ trees: p.trees }), params: { trees: { min: 1, max: 40, step: 1, def: 10 } } },
} satisfies Record<string, ModelDef>;

export type ModelName = keyof typeof MODELS;
export const MODEL_NAMES = Object.keys(MODELS) as ModelName[];
export const isModel = (name: string): name is ModelName => name in MODELS;

export function defaults(name: ModelName): Params {
  const specs: Record<string, ParamSpec> = MODELS[name].params;
  return Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, v.def]));
}

/** Fit a model on training points. Fewer than two classes gives a constant guess. */
export function fitModel(name: ModelName, params: Params, train: Sample[]): Model {
  const has = new Set(train.map(p => p.c));
  if (has.size < 2) {
    const c = has.size ? [...has][0] : 0.5;
    return { predict: () => c, constant: true };
  }
  const def: ModelDef = MODELS[name];
  const m = def.make({ ...defaults(name), ...params });
  m.fit(train);
  return m;
}
