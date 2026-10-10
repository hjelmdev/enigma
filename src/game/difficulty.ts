export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty)
  );
}
