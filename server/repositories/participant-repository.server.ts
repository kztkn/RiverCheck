import { queryDatabase } from "@server/db/client.server";
import type {
  GameParticipantSummary,
  RegisteredPlayerOption,
} from "@shared-types/player";

interface ParticipantRow {
  id: string;
  group_player_id: string;
  display_name: string;
  status: "joined" | "submitted" | "locked";
  remaining_chips: string | null;
  rebuy_count: number;
  device_locked: boolean;
  avatar_uploaded_at: Date | null;
}

interface PlayerOptionRow {
  id: string;
  display_name: string;
  device_locked: boolean;
  avatar_uploaded_at: Date | null;
}

export async function listRegisteredPlayersForGame(
  groupId: string,
  gameId: string,
): Promise<RegisteredPlayerOption[]> {
  const result = await queryDatabase<PlayerOptionRow>(
    `
      SELECT
        group_player.id,
        player.display_name,
        participant.participant_token_hash IS NOT NULL AS device_locked,
        player.avatar_uploaded_at
      FROM group_players AS group_player
      INNER JOIN players AS player ON player.id = group_player.player_id
      LEFT JOIN game_participants AS participant
        ON participant.group_player_id = group_player.id
       AND participant.game_id = $2
      LEFT JOIN (
        SELECT
          history.group_player_id,
          COUNT(*) AS attendance_count,
          MAX(history_game.played_at) AS last_played_at
        FROM game_participants AS history
        INNER JOIN games AS history_game ON history_game.id = history.game_id
        WHERE history_game.group_id = $1
          AND history_game.status = 'finalized'
        GROUP BY history.group_player_id
      ) AS attendance ON attendance.group_player_id = group_player.id
      WHERE group_player.group_id = $1
        AND group_player.is_active = TRUE
      ORDER BY
        COALESCE(attendance.attendance_count, 0) DESC,
        attendance.last_played_at DESC NULLS LAST,
        display_name ASC,
        group_player.created_at ASC
    `,
    [groupId, gameId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    deviceLocked: row.device_locked,
    avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
  }));
}

export async function listGameParticipants(
  groupId: string,
  gameId: string,
): Promise<GameParticipantSummary[]> {
  const result = await queryDatabase<ParticipantRow>(
    `
      SELECT
        participant.id,
        participant.group_player_id,
        player.display_name,
        participant.status,
        participant.remaining_chips,
        participant.rebuy_count,
        participant.participant_token_hash IS NOT NULL AS device_locked,
        player.avatar_uploaded_at
      FROM game_participants AS participant
      INNER JOIN games AS game ON game.id = participant.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE game.id = $1 AND game.group_id = $2
      ORDER BY participant.joined_at ASC
    `,
    [gameId, groupId],
  );

  return result.rows.map(mapParticipant);
}

export async function findParticipantByTokenHash(
  groupId: string,
  gameId: string,
  tokenHash: string,
): Promise<GameParticipantSummary | null> {
  const result = await queryDatabase<ParticipantRow>(
    `
      SELECT
        participant.id,
        participant.group_player_id,
        player.display_name,
        participant.status,
        participant.remaining_chips,
        participant.rebuy_count,
        TRUE AS device_locked,
        player.avatar_uploaded_at
      FROM game_participants AS participant
      INNER JOIN games AS game ON game.id = participant.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND participant.participant_token_hash = $3
    `,
    [gameId, groupId, tokenHash],
  );

  const row = result.rows[0];
  return row ? mapParticipant(row) : null;
}

export async function findParticipantByGroupPlayerId(
  groupId: string,
  gameId: string,
  groupPlayerId: string,
): Promise<GameParticipantSummary | null> {
  const result = await queryDatabase<ParticipantRow>(
    `
      SELECT
        participant.id,
        participant.group_player_id,
        player.display_name,
        participant.status,
        participant.remaining_chips,
        participant.rebuy_count,
        participant.participant_token_hash IS NOT NULL AS device_locked,
        player.avatar_uploaded_at
      FROM game_participants AS participant
      INNER JOIN games AS game ON game.id = participant.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND participant.group_player_id = $3
    `,
    [gameId, groupId, groupPlayerId],
  );

  const row = result.rows[0];
  return row ? mapParticipant(row) : null;
}

export async function claimRegisteredParticipant(
  groupId: string,
  gameId: string,
  groupPlayerId: string,
  tokenHash: string,
): Promise<boolean> {
  const result = await queryDatabase<{ id: string }>(
    `
      INSERT INTO game_participants (
        game_id,
        group_player_id,
        participant_token_hash
      )
      SELECT game.id, group_player.id, $4
      FROM games AS game
      INNER JOIN group_players AS group_player
        ON group_player.group_id = game.group_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND group_player.id = $3
        AND group_player.is_active = TRUE
      ON CONFLICT (game_id, group_player_id) DO UPDATE
      SET participant_token_hash = EXCLUDED.participant_token_hash,
          updated_at = NOW()
      WHERE game_participants.participant_token_hash IS NULL
      RETURNING id
    `,
    [gameId, groupId, groupPlayerId, tokenHash],
  );

  return result.rowCount === 1;
}

export async function joinAuthenticatedParticipant(
  groupId: string,
  gameId: string,
  groupPlayerId: string,
  tokenHash: string,
): Promise<boolean> {
  const result = await queryDatabase<{ id: string }>(
    `
      INSERT INTO game_participants (
        game_id,
        group_player_id,
        participant_token_hash
      )
      SELECT game.id, group_player.id, $4
      FROM games AS game
      INNER JOIN group_players AS group_player
        ON group_player.group_id = game.group_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND group_player.id = $3
        AND group_player.is_active = TRUE
      ON CONFLICT (game_id, group_player_id) DO NOTHING
      RETURNING id
    `,
    [gameId, groupId, groupPlayerId, tokenHash],
  );

  return result.rowCount === 1;
}

export async function joinNewParticipant(
  groupId: string,
  gameId: string,
  displayName: string,
  tokenHash: string,
  profileSessionTokenHash: string,
  profileSessionExpiresAt: string,
): Promise<{ playerId: string; groupPlayerId: string } | null> {
  const result = await queryDatabase<{ player_id: string; group_player_id: string }>(
    `
      WITH target_game AS (
        SELECT id, group_id
        FROM games
        WHERE id = $1 AND group_id = $2 AND status = 'open'
      ),
      new_player AS (
        INSERT INTO players (display_name)
        SELECT $3 FROM target_game
        RETURNING id
      ),
      new_group_player AS (
        INSERT INTO group_players (group_id, player_id)
        SELECT target_game.group_id, new_player.id
        FROM target_game CROSS JOIN new_player
        RETURNING id
      ),
      new_profile_session AS (
        INSERT INTO player_profile_sessions (player_id, token_hash, expires_at)
        SELECT new_player.id, $5, $6
        FROM new_player
        RETURNING player_id
      ),
      new_participant AS (
        INSERT INTO game_participants (
          game_id,
          group_player_id,
          participant_token_hash
        )
        SELECT target_game.id, new_group_player.id, $4
        FROM target_game CROSS JOIN new_group_player
        RETURNING group_player_id
      )
      SELECT new_player.id AS player_id, new_group_player.id AS group_player_id
      FROM new_player
      CROSS JOIN new_group_player
      CROSS JOIN new_profile_session
      CROSS JOIN new_participant
    `,
    [
      gameId,
      groupId,
      displayName,
      tokenHash,
      profileSessionTokenHash,
      profileSessionExpiresAt,
    ],
  );

  const row = result.rows[0];
  return row
    ? { playerId: row.player_id, groupPlayerId: row.group_player_id }
    : null;
}

export async function updateParticipantInput(
  groupId: string,
  gameId: string,
  tokenHash: string,
  remainingChips: number,
  rebuyCount: number,
): Promise<boolean> {
  const result = await queryDatabase<{ id: string }>(
    `
      UPDATE game_participants AS participant
      SET
        remaining_chips = $4,
        rebuy_count = $5,
        status = 'submitted',
        submitted_at = NOW(),
        updated_at = NOW()
      FROM games AS game
      WHERE participant.game_id = game.id
        AND game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND participant.participant_token_hash = $3
      RETURNING participant.id
    `,
    [gameId, groupId, tokenHash, remainingChips, rebuyCount],
  );

  return result.rowCount === 1;
}

export async function updateParticipantInputByGroupPlayerId(
  groupId: string,
  gameId: string,
  groupPlayerId: string,
  remainingChips: number,
  rebuyCount: number,
): Promise<boolean> {
  const result = await queryDatabase<{ id: string }>(
    `
      UPDATE game_participants AS participant
      SET
        remaining_chips = $4,
        rebuy_count = $5,
        status = 'submitted',
        submitted_at = NOW(),
        updated_at = NOW()
      FROM games AS game
      WHERE participant.game_id = game.id
        AND game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND participant.group_player_id = $3
      RETURNING participant.id
    `,
    [gameId, groupId, groupPlayerId, remainingChips, rebuyCount],
  );

  return result.rowCount === 1;
}

export async function leaveGame(
  groupId: string,
  gameId: string,
  tokenHash: string,
): Promise<boolean> {
  const result = await queryDatabase<{ id: string }>(
    `
      DELETE FROM game_participants AS participant
      USING games AS game
      WHERE participant.game_id = game.id
        AND game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND participant.participant_token_hash = $3
      RETURNING participant.id
    `,
    [gameId, groupId, tokenHash],
  );

  return result.rowCount === 1;
}

export async function leaveGameByGroupPlayerId(
  groupId: string,
  gameId: string,
  groupPlayerId: string,
): Promise<boolean> {
  const result = await queryDatabase<{ id: string }>(
    `
      DELETE FROM game_participants AS participant
      USING games AS game
      WHERE participant.game_id = game.id
        AND game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND participant.group_player_id = $3
      RETURNING participant.id
    `,
    [gameId, groupId, groupPlayerId],
  );

  return result.rowCount === 1;
}

export async function removeParticipant(
  groupId: string,
  gameId: string,
  participantId: string,
): Promise<boolean> {
  const result = await queryDatabase<{ id: string }>(
    `
      DELETE FROM game_participants AS participant
      USING games AS game
      WHERE participant.game_id = game.id
        AND participant.id = $3
        AND game.id = $1
        AND game.group_id = $2
        AND game.status <> 'finalized'
      RETURNING participant.id
    `,
    [gameId, groupId, participantId],
  );

  return result.rowCount === 1;
}

function mapParticipant(row: ParticipantRow): GameParticipantSummary {
  return {
    id: row.id,
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    status: row.status,
    remainingChips:
      row.remaining_chips === null ? null : Number(row.remaining_chips),
    rebuyCount: row.rebuy_count,
    deviceLocked: row.device_locked,
    avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
  };
}
