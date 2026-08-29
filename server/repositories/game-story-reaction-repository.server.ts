import {
  queryDatabase,
  withTransaction,
} from "@server/db/client.server";
import type {
  GameStoryReactionSummary,
  GameStoryReactionType,
} from "@shared-types/game-story-reaction";

interface ReactionSummaryRow {
  post_id: string;
  reaction_type: GameStoryReactionType;
  reaction_count: number;
  reacted_by_current_player: boolean;
}

export async function listGameStoryReactionSummaries(
  groupId: string,
  gameId: string,
  currentGroupPlayerId: string | null,
): Promise<GameStoryReactionSummary[]> {
  const result = await queryDatabase<ReactionSummaryRow>(
    `
      SELECT
        post.id AS post_id,
        reaction.reaction_type,
        COUNT(*)::INTEGER AS reaction_count,
        COALESCE(
          BOOL_OR(reaction.group_player_id = $3::UUID),
          FALSE
        ) AS reacted_by_current_player
      FROM game_story_reactions AS reaction
      INNER JOIN game_story_posts AS post
        ON post.id = reaction.game_story_post_id
      INNER JOIN game_participants AS participant
        ON participant.id = post.game_participant_id
      INNER JOIN games AS game ON game.id = participant.game_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'finalized'
        AND post.deleted_at IS NULL
      GROUP BY post.id, reaction.reaction_type
      ORDER BY post.created_at ASC, post.id ASC, reaction.reaction_type ASC
    `,
    [gameId, groupId, currentGroupPlayerId],
  );
  return result.rows.map((row) => ({
    postId: row.post_id,
    type: row.reaction_type,
    count: row.reaction_count,
    reactedByCurrentPlayer: row.reacted_by_current_player,
  }));
}

export async function setGameStoryReactionState(
  groupId: string,
  gameId: string,
  postId: string,
  groupPlayerId: string,
  reactionType: GameStoryReactionType,
  active: boolean,
): Promise<{ active: boolean; count: number } | null> {
  return withTransaction(async (transaction) => {
    const target = await transaction.query<{ id: string }>(
      `
        SELECT post.id
        FROM game_story_posts AS post
        INNER JOIN game_participants AS participant
          ON participant.id = post.game_participant_id
        INNER JOIN games AS game ON game.id = participant.game_id
        INNER JOIN group_players AS actor
          ON actor.id = $4
         AND actor.group_id = game.group_id
         AND actor.is_active = TRUE
        WHERE game.id = $1
          AND game.group_id = $2
          AND game.status = 'finalized'
          AND post.id = $3
          AND post.deleted_at IS NULL
        LIMIT 1
      `,
      [gameId, groupId, postId, groupPlayerId],
    );
    if (!target.rows[0]) return null;

    if (active) {
      await transaction.query(
        `
          INSERT INTO game_story_reactions (
            game_story_post_id,
            group_player_id,
            reaction_type
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (game_story_post_id, group_player_id, reaction_type)
          DO NOTHING
        `,
        [postId, groupPlayerId, reactionType],
      );
    } else {
      await transaction.query(
        `
          DELETE FROM game_story_reactions
          WHERE game_story_post_id = $1
            AND group_player_id = $2
            AND reaction_type = $3
        `,
        [postId, groupPlayerId, reactionType],
      );
    }

    const count = await transaction.query<{ reaction_count: number }>(
      `
        SELECT COUNT(*)::INTEGER AS reaction_count
        FROM game_story_reactions
        WHERE game_story_post_id = $1
          AND reaction_type = $2
      `,
      [postId, reactionType],
    );
    return {
      active,
      count: count.rows[0]?.reaction_count ?? 0,
    };
  });
}
