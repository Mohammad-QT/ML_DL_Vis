import type { Scene } from '../scene';

type SceneModule = { default: () => Scene };

// Every file in this folder except the helpers is a scene, named by its file name (e.g. `kmeans.ts` → `kmeans`).
// Each one is its own lazy chunk, so a lesson page loads only its own scene.
const modules = import.meta.glob<SceneModule>(['./*.ts', '!./index.ts', '!./svg.ts', '!./*.test.ts']);
const scenes = new Map(Object.entries(modules).map(([path, load]) => [path.slice(2, -3), load]));

export function loadScene(id: string): Promise<SceneModule> | undefined {
  return scenes.get(id)?.();
}
