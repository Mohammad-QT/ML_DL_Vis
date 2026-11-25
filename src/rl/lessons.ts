export const RL = ['ucb', 'thompson'] as const;
export type BanditLesson = typeof RL[number];
export const rlPath = (id: BanditLesson) => `learn/6-rl/${id}/`;
