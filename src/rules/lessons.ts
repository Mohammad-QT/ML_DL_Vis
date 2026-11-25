export const RULES = ['apriori', 'eclat'] as const;
export type RulesId = (typeof RULES)[number];
export const rulesPath = (id: RulesId) => `learn/5-rules/${id}/`;
