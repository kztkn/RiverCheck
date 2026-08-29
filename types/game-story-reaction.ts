import type { GameStoryReactionType } from "@domain/story/game-story-reaction";

export type { GameStoryReactionType } from "@domain/story/game-story-reaction";

export interface GameStoryReactionSummary {
  postId: string;
  type: GameStoryReactionType;
  count: number;
  reactedByCurrentPlayer: boolean;
}
