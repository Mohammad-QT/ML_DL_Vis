/** Class label: 0 = class A (cobalt), 1 = class B (raspberry). */
export type Label = 0 | 1;

/** A point on the board. Coordinates are in [0, 1]; y grows downwards like the canvas. */
export interface Sample {
  x: number;
  y: number;
  c: Label;
}

export interface Point extends Sample {
  /** Held out for the test score; the model never trains on it. */
  test: boolean;
}

/** A fitted model. `predict` returns P(class B) in [0, 1]. */
export interface Model {
  predict(x: number, y: number): number;
  /** K-NN only: the training points that vote for (x, y). */
  neighbours?(x: number, y: number): Sample[];
  /** True when the training data had fewer than two classes. */
  constant?: boolean;
}

export interface Trainable extends Model {
  fit(train: Sample[]): void;
}

export type Params = Record<string, number>;
