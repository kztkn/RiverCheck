import { queryDatabase } from "@server/db/client.server";
import type { GameStatus } from "@shared-types/game";
import type { GamePhotoContentType } from "@domain/highlight/validate-game-highlight";

interface GameHighlightRow {
  game_status: GameStatus;
  highlight_text: string | null;
  highlight_photo_object_key: string | null;
  highlight_photo_content_type: GamePhotoContentType | null;
  highlight_photo_byte_size: number | null;
  highlight_photo_uploaded_at: Date | null;
  highlight_updated_at: Date | null;
}

export interface GameHighlightRecord {
  gameStatus: GameStatus;
  text: string | null;
  photoObjectKey: string | null;
  photoContentType: GamePhotoContentType | null;
  photoByteSize: number | null;
  photoUploadedAt: string | null;
  updatedAt: string | null;
}

export interface SaveGameHighlightRecordInput {
  text: string | null;
  photoObjectKey: string | null;
  photoContentType: GamePhotoContentType | null;
  photoByteSize: number | null;
  photoUploadedAt: string | null;
  expectedPhotoObjectKey: string | null;
}

export async function findGameHighlightRecord(
  groupId: string,
  gameId: string,
): Promise<GameHighlightRecord | null> {
  const result = await queryDatabase<GameHighlightRow>(
    `
      SELECT
        game.status AS game_status,
        game.highlight_text,
        game.highlight_photo_object_key,
        game.highlight_photo_content_type,
        game.highlight_photo_byte_size,
        game.highlight_photo_uploaded_at,
        game.highlight_updated_at
      FROM games AS game
      WHERE game.group_id = $1 AND game.id = $2
    `,
    [groupId, gameId],
  );
  const row = result.rows[0];
  return row ? mapHighlightRow(row) : null;
}

export async function saveGameHighlightRecord(
  groupId: string,
  gameId: string,
  input: SaveGameHighlightRecordInput,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE games
      SET highlight_text = $3,
          highlight_photo_object_key = $4,
          highlight_photo_content_type = $5,
          highlight_photo_byte_size = $6,
          highlight_photo_uploaded_at = $7,
          highlight_updated_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND group_id = $2
        AND status = 'finalized'
        AND highlight_photo_object_key IS NOT DISTINCT FROM $8
    `,
    [
      gameId,
      groupId,
      input.text,
      input.photoObjectKey,
      input.photoContentType,
      input.photoByteSize,
      input.photoUploadedAt,
      input.expectedPhotoObjectKey,
    ],
  );
  return result.rowCount === 1;
}

function mapHighlightRow(row: GameHighlightRow): GameHighlightRecord {
  return {
    gameStatus: row.game_status,
    text: row.highlight_text,
    photoObjectKey: row.highlight_photo_object_key,
    photoContentType: row.highlight_photo_content_type,
    photoByteSize: row.highlight_photo_byte_size,
    photoUploadedAt: row.highlight_photo_uploaded_at?.toISOString() ?? null,
    updatedAt: row.highlight_updated_at?.toISOString() ?? null,
  };
}
