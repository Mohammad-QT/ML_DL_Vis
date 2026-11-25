export const BANDITS = ['ucb', 'thompson'] as const;
export const RL = [...BANDITS, 'q-learning'] as const;
export type RlLesson = typeof RL[number];
export type BanditLesson = typeof BANDITS[number];
export const rlPath = (id: RlLesson) => `learn/6-rl/${id}/`;
