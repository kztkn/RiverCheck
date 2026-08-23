import {
  queryDatabase,
  withTransaction,
  type DatabaseTransaction,
} from "@server/db/client.server";
import type { GamePhotoContentType } from "@domain/highlight/validate-game-highlight";
import type {
  OwnGameStoryPost,
  PublishedGameStoryPost,
} from "@shared-types/game-story";

export type GameStoryParticipantTarget =
  | { kind: "group-player-id"; value: string }
  | { kind: "participant-token"; value: string };

interface StoryPostRow {
  id: string | null;
  game_participant_id: string;
  group_player_id: string;
  display_name: string;
  avatar_uploaded_at: Date | null;
  body: string | null;
  photo_object_key: string | null;
  photo_content_type: GamePhotoContentType | null;
  photo_byte_size: number | null;
  photo_uploaded_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface EditableGameStoryPostRecord {
  id: string | null;
  participantId: string;
  body: string | null;
  photoObjectKey: string | null;
  photoContentType: GamePhotoContentType | null;
  photoByteSize: number | null;
  photoUploadedAt: string | null;
  updatedAt: string | null;
}

export interface SaveFinalizedGameStoryRecordInput {
  body: string | null;
  expectedPhotoObjectKey: string | null;
  photoObjectKey: string | null;
  photoContentType: GamePhotoContentType | null;
  photoByteSize: number | null;
  photoUploadedAt: string | null;
  target: GameStoryParticipantTarget;
}

export async function findEditableGameStoryPost(
  groupId: string,
  gameId: string,
  target: GameStoryParticipantTarget,
): Promise<EditableGameStoryPostRecord | null> {
  const targetColumn =
    target.kind === "group-player-id"
      ? "participant.group_player_id"
      : "participant.participant_token_hash";
  const result = await queryDatabase<StoryPostRow>(
    `
      SELECT
        post.id,
        participant.id AS game_participant_id,
        participant.group_player_id,
        player.display_name,
        player.avatar_uploaded_at,
        post.body,
        post.photo_object_key,
        post.photo_content_type,
        post.photo_byte_size,
        post.photo_uploaded_at,
        post.created_at,
        post.updated_at
      FROM game_participants AS participant
      INNER JOIN games AS game ON game.id = participant.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      LEFT JOIN game_story_posts AS post
        ON post.game_participant_id = participant.id
       AND post.deleted_at IS NULL
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'finalized'
        AND ${targetColumn} = $3
    `,
    [gameId, groupId, target.value],
  );
  const row = result.rows[0];
  return row ? mapEditable(row) : null;
}

export async function findOwnGameStoryPost(
  groupId: string,
  gameId: string,
  participantId: string,
): Promise<OwnGameStoryPost | null> {
  const result = await queryDatabase<StoryPostRow>(
    `
      SELECT
        post.id,
        participant.id AS game_participant_id,
        participant.group_player_id,
        player.display_name,
        player.avatar_uploaded_at,
        post.body,
        post.photo_object_key,
        post.photo_content_type,
        post.photo_byte_size,
        post.photo_uploaded_at,
        post.created_at,
        post.updated_at
      FROM game_story_posts AS post
      INNER JOIN game_participants AS participant
        ON participant.id = post.game_participant_id
      INNER JOIN games AS game ON game.id = participant.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE post.game_participant_id = $1
        AND game.id = $2
        AND game.group_id = $3
        AND post.deleted_at IS NULL
    `,
    [participantId, gameId, groupId],
  );
  const row = result.rows[0];
  return row?.id ? toOwnPost(row) : null;
}

export async function listPublishedGameStoryPosts(
  groupId: string,
  gameId: string,
): Promise<PublishedGameStoryPost[]> {
  const result = await queryDatabase<StoryPostRow>(
    `
      SELECT
        post.id,
        participant.id AS game_participant_id,
        participant.group_player_id,
        player.display_name,
        player.avatar_uploaded_at,
        post.body,
        post.photo_object_key,
        post.photo_content_type,
        post.photo_byte_size,
        post.photo_uploaded_at,
        post.created_at,
        post.updated_at
      FROM game_story_posts AS post
      INNER JOIN game_participants AS participant
        ON participant.id = post.game_participant_id
      INNER JOIN games AS game ON game.id = participant.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'finalized'
        AND post.deleted_at IS NULL
      ORDER BY post.created_at ASC, post.id ASC
    `,
    [gameId, groupId],
  );
  return result.rows.flatMap((row) =>
    row.id
      ? [{
          ...toOwnPost(row),
          groupPlayerId: row.group_player_id,
          displayName: row.display_name,
          avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
        }]
      : [],
  );
}

export async function saveFinalizedGameStoryRecord(
  groupId: string,
  gameId: string,
  input: SaveFinalizedGameStoryRecordInput,
): Promise<boolean> {
  try {
    return await withTransaction(async (transaction) => {
      const participantId = await lockEditableParticipant(
        transaction,
        groupId,
        gameId,
        input.target,
        "finalized",
      );
      if (!participantId) return false;
      await writeGameStoryPost(transaction, participantId, input);
      return true;
    });
  } catch (error) {
    if (error instanceof StoryConflictError) return false;
    throw error;
  }
}

export async function softDeleteGameStoryPost(
  groupId: string,
  gameId: string,
  postId: string,
): Promise<{ deleted: boolean; photoObjectKey: string | null }> {
  const result = await queryDatabase<{ photo_object_key: string | null }>(
    `
      WITH target AS (
        SELECT post.id, post.photo_object_key
        FROM game_story_posts AS post
        INNER JOIN game_participants AS participant
          ON participant.id = post.game_participant_id
        INNER JOIN games AS game ON game.id = participant.game_id
        WHERE post.id = $1
          AND game.id = $2
          AND game.group_id = $3
          AND post.deleted_at IS NULL
      )
      UPDATE game_story_posts AS post
      SET body = NULL,
          photo_object_key = NULL,
          photo_content_type = NULL,
          photo_byte_size = NULL,
          photo_uploaded_at = NULL,
          deleted_at = NOW(),
          deleted_by_type = 'organizer',
          updated_at = NOW()
      FROM target
      WHERE post.id = target.id
      RETURNING target.photo_object_key
    `,
    [postId, gameId, groupId],
  );
  const row = result.rows[0];
  return { deleted: Boolean(row), photoObjectKey: row?.photo_object_key ?? null };
}

export async function findAccessibleGameStoryPhotoObjectKey(
  groupId: string,
  gameId: string,
  postId: string,
  access: {
    groupPlayerId: string | null;
    organizer: boolean;
    participantTokenHash: string | null;
  },
): Promise<{ contentType: string; objectKey: string } | null> {
  const result = await queryDatabase<{
    photo_content_type: string;
    photo_object_key: string;
  }>(
    `
      SELECT post.photo_object_key, post.photo_content_type
      FROM game_story_posts AS post
      INNER JOIN game_participants AS participant
        ON participant.id = post.game_participant_id
      INNER JOIN games AS game ON game.id = participant.game_id
      WHERE post.id = $1
        AND game.id = $2
        AND game.group_id = $3
        AND post.deleted_at IS NULL
        AND post.photo_object_key IS NOT NULL
        AND post.photo_content_type IS NOT NULL
        AND (
          game.status = 'finalized'
          OR $4 = TRUE
          OR participant.group_player_id = $5
          OR participant.participant_token_hash = $6
        )
    `,
    [
      postId,
      gameId,
      groupId,
      access.organizer,
      access.groupPlayerId,
      access.participantTokenHash,
    ],
  );
  const row = result.rows[0];
  return row
    ? { contentType: row.photo_content_type, objectKey: row.photo_object_key }
    : null;
}

async function lockEditableParticipant(
  transaction: DatabaseTransaction,
  groupId: string,
  gameId: string,
  target: GameStoryParticipantTarget,
  gameStatus: "open" | "finalized",
): Promise<string | null> {
  const targetColumn =
    target.kind === "group-player-id"
      ? "participant.group_player_id"
      : "participant.participant_token_hash";
  const result = await transaction.query<{ id: string }>(
    `
      SELECT participant.id
      FROM game_participants AS participant
      INNER JOIN games AS game ON game.id = participant.game_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = $4
        AND ${targetColumn} = $3
      FOR UPDATE OF participant
    `,
    [gameId, groupId, target.value, gameStatus],
  );
  return result.rows[0]?.id ?? null;
}

function mapEditable(row: StoryPostRow): EditableGameStoryPostRecord {
  return {
    id: row.id,
    participantId: row.game_participant_id,
    body: row.body,
    photoObjectKey: row.photo_object_key,
    photoContentType: row.photo_content_type,
    photoByteSize: row.photo_byte_size,
    photoUploadedAt: row.photo_uploaded_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}

function toOwnPost(row: StoryPostRow): OwnGameStoryPost {
  if (!row.id || !row.created_at || !row.updated_at) {
    throw new Error("Game story post identity is missing");
  }
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    photo:
      row.photo_content_type &&
      row.photo_byte_size !== null &&
      row.photo_uploaded_at
        ? {
            byteSize: row.photo_byte_size,
            contentType: row.photo_content_type,
            uploadedAt: row.photo_uploaded_at.toISOString(),
          }
        : null,
    updatedAt: row.updated_at.toISOString(),
  };
}

async function writeGameStoryPost(
  transaction: DatabaseTransaction,
  participantId: string,
  input: SaveFinalizedGameStoryRecordInput,
): Promise<void> {
  if (!input.body && !input.photoObjectKey) {
    const deleted = await transaction.query(
      `
        DELETE FROM game_story_posts
        WHERE game_participant_id = $1
          AND deleted_at IS NULL
          AND photo_object_key IS NOT DISTINCT FROM $2
      `,
      [participantId, input.expectedPhotoObjectKey],
    );
    if (deleted.rowCount !== 1 && input.expectedPhotoObjectKey !== null) {
      throw new StoryConflictError();
    }
    return;
  }

  const saved = await transaction.query(
    `
      INSERT INTO game_story_posts (
        game_participant_id,
        body,
        photo_object_key,
        photo_content_type,
        photo_byte_size,
        photo_uploaded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (game_participant_id) DO UPDATE
      SET body = EXCLUDED.body,
          photo_object_key = EXCLUDED.photo_object_key,
          photo_content_type = EXCLUDED.photo_content_type,
          photo_byte_size = EXCLUDED.photo_byte_size,
          photo_uploaded_at = EXCLUDED.photo_uploaded_at,
          updated_at = NOW()
      WHERE game_story_posts.deleted_at IS NULL
        AND game_story_posts.photo_object_key IS NOT DISTINCT FROM $7
    `,
    [
      participantId,
      input.body,
      input.photoObjectKey,
      input.photoContentType,
      input.photoByteSize,
      input.photoUploadedAt,
      input.expectedPhotoObjectKey,
    ],
  );
  if (saved.rowCount !== 1) throw new StoryConflictError();
}

class StoryConflictError extends Error {}
