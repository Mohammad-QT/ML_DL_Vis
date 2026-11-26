export interface SceneApi {
  svg: SVGSVGElement;
  el<K extends keyof SVGElementTagNameMap>(
    tag: K, attrs?: Record<string, string | number>, parent?: Element,
  ): SVGElementTagNameMap[K];
  /** Seeded random numbers, so a scene is the same on every visit. */
  random: () => number;
  /** Short text label in the page language. */
  t(key: string): string;
  reduced: boolean;
}

export interface Scene {
  frames: number;
  setup(api: SceneApi): void;
  frame(i: number, api: SceneApi): void;
  loop?(i: number, api: SceneApi): () => void;
}

export const defineScene = (scene: Scene) => scene;
