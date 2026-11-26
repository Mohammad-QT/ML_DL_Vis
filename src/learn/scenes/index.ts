import type { Scene } from '../scene';

const scenes = {
  knn: () => import('./knn'),
  ann: () => import('./ann'),
  cnn: () => import('./cnn'),
};

export function loadScene(id: string): Promise<{ default: () => Scene }> | undefined {
  if (Object.hasOwn(scenes, id)) return scenes[id as keyof typeof scenes]();
}
