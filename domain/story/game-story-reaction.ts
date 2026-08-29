export const GAME_STORY_REACTION_TYPES = [
  "laugh",
  "fire",
  "shock",
  "nice",
  "respect",
] as const;

export type GameStoryReactionType =
  (typeof GAME_STORY_REACTION_TYPES)[number];

export function isGameStoryReactionType(
  value: string,
): value is GameStoryReactionType {
  return GAME_STORY_REACTION_TYPES.some((type) => type === value);
}
