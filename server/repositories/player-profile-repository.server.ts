import {
  queryDatabase,
  withTransaction,
} from "@server/db/client.server";
import type { GamePhotoContentType } from "@domain/highlight/validate-game-highlight";

interface ProfileRow {
  player_id: string;
  group_player_id: string;
  display_name: string;
  profile_message: string | null;
  avatar_object_key: string | null;
  avatar_content_type: GamePhotoContentType | null;
  avatar_byte_size: number | null;
  avatar_uploaded_at: Date | null;
  updated_at: Date;
}

interface ClaimRow {
  id: string;
  player_id: string;
  group_player_id: string;
  display_name: string;
  expires_at: Date;
}

export interface PlayerProfileRecord {
  playerId: string;
  groupPlayerId: string;
  displayName: string;
  profileMessage: string | null;
  avatarObjectKey: string | null;
  avatarContentType: GamePhotoContentType | null;
  avatarByteSize: number | null;
  avatarUploadedAt: string | null;
  updatedAt: string;
}

export interface PlayerProfileClaimRecord {
  id: string;
  playerId: string;
  groupPlayerId: string;
  displayName: string;
  expiresAt: string;
}

export async function findPlayerProfileBySession(
  groupId: string,
  tokenHash: string,
): Promise<PlayerProfileRecord | null> {
  const result = await queryDatabase<ProfileRow>(
    `
      SELECT
        player.id AS player_id,
        group_player.id AS group_player_id,
        player.display_name,
        player.profile_message,
        player.avatar_object_key,
        player.avatar_content_type,
        player.avatar_byte_size,
        player.avatar_uploaded_at,
        player.updated_at
      FROM player_profile_sessions AS profile_session
      INNER JOIN players AS player ON player.id = profile_session.player_id
      INNER JOIN group_players AS group_player
        ON group_player.player_id = player.id
      WHERE profile_session.token_hash = $1
        AND profile_session.revoked_at IS NULL
        AND profile_session.expires_at > NOW()
        AND group_player.group_id = $2
      LIMIT 1
    `,
    [tokenHash, groupId],
  );
  return result.rows[0] ? mapProfile(result.rows[0]) : null;
}

export async function issuePlayerProfileClaim(
  groupId: string,
  groupPlayerId: string,
  tokenHash: string,
  expiresAt: string,
): Promise<PlayerProfileClaimRecord | null> {
  return withTransaction(async (transaction) => {
    const identity = await transaction.query<{
      player_id: string;
      display_name: string;
    }>(
      `
        SELECT player.id AS player_id, player.display_name
        FROM group_players AS group_player
        INNER JOIN players AS player ON player.id = group_player.player_id
        WHERE group_player.group_id = $1 AND group_player.id = $2
        FOR UPDATE OF player
      `,
      [groupId, groupPlayerId],
    );
    const player = identity.rows[0];
    if (!player) return null;

    await transaction.query(
      `
        UPDATE player_profile_claims
        SET revoked_at = NOW()
        WHERE player_id = $1
          AND consumed_at IS NULL
          AND revoked_at IS NULL
      `,
      [player.player_id],
    );
    const inserted = await transaction.query<{ id: string; expires_at: Date }>(
      `
        INSERT INTO player_profile_claims (player_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, expires_at
      `,
      [player.player_id, tokenHash, expiresAt],
    );
    const claim = inserted.rows[0];
    if (!claim) throw new Error("Profile claim creation did not return a row");
    return {
      id: claim.id,
      playerId: player.player_id,
      groupPlayerId,
      displayName: player.display_name,
      expiresAt: claim.expires_at.toISOString(),
    };
  });
}

export async function findValidPlayerProfileClaim(
  groupId: string,
  tokenHash: string,
): Promise<PlayerProfileClaimRecord | null> {
  const result = await queryDatabase<ClaimRow>(
    `
      SELECT
        claim.id,
        claim.player_id,
        group_player.id AS group_player_id,
        player.display_name,
        claim.expires_at
      FROM player_profile_claims AS claim
      INNER JOIN players AS player ON player.id = claim.player_id
      INNER JOIN group_players AS group_player
        ON group_player.player_id = player.id
      WHERE claim.token_hash = $1
        AND group_player.group_id = $2
        AND claim.consumed_at IS NULL
        AND claim.revoked_at IS NULL
        AND claim.expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash, groupId],
  );
  return result.rows[0] ? mapClaim(result.rows[0]) : null;
}

export async function consumePlayerProfileClaim(
  groupId: string,
  claimTokenHash: string,
  sessionTokenHash: string,
  sessionExpiresAt: string,
): Promise<PlayerProfileRecord | null> {
  return withTransaction(async (transaction) => {
    const claimResult = await transaction.query<ClaimRow>(
      `
        SELECT
          claim.id,
          claim.player_id,
          group_player.id AS group_player_id,
          player.display_name,
          claim.expires_at
        FROM player_profile_claims AS claim
        INNER JOIN players AS player ON player.id = claim.player_id
        INNER JOIN group_players AS group_player
          ON group_player.player_id = player.id
        WHERE claim.token_hash = $1
          AND group_player.group_id = $2
          AND claim.consumed_at IS NULL
          AND claim.revoked_at IS NULL
          AND claim.expires_at > NOW()
        FOR UPDATE OF claim
      `,
      [claimTokenHash, groupId],
    );
    const claim = claimResult.rows[0];
    if (!claim) return null;

    await transaction.query(
      "UPDATE player_profile_claims SET consumed_at = NOW() WHERE id = $1",
      [claim.id],
    );
    await transaction.query(
      `
        INSERT INTO player_profile_sessions (player_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [claim.player_id, sessionTokenHash, sessionExpiresAt],
    );
    const profileResult = await transaction.query<ProfileRow>(
      `
        SELECT
          player.id AS player_id,
          group_player.id AS group_player_id,
          player.display_name,
          player.profile_message,
          player.avatar_object_key,
          player.avatar_content_type,
          player.avatar_byte_size,
          player.avatar_uploaded_at,
          player.updated_at
        FROM players AS player
        INNER JOIN group_players AS group_player
          ON group_player.player_id = player.id
        WHERE player.id = $1 AND group_player.id = $2
      `,
      [claim.player_id, claim.group_player_id],
    );
    const row = profileResult.rows[0];
    if (!row) throw new Error("Claimed profile could not be loaded");
    return mapProfile(row);
  });
}

export async function savePlayerProfileRecord(
  playerId: string,
  input: {
    displayName: string;
    profileMessage: string | null;
    avatarObjectKey: string | null;
    avatarContentType: GamePhotoContentType | null;
    avatarByteSize: number | null;
    avatarUploadedAt: string | null;
    expectedAvatarObjectKey: string | null;
  },
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE players
      SET display_name = $2,
          profile_message = $3,
          avatar_object_key = $4,
          avatar_content_type = $5,
          avatar_byte_size = $6,
          avatar_uploaded_at = $7,
          updated_at = NOW()
      WHERE id = $1
        AND avatar_object_key IS NOT DISTINCT FROM $8
    `,
    [
      playerId,
      input.displayName,
      input.profileMessage,
      input.avatarObjectKey,
      input.avatarContentType,
      input.avatarByteSize,
      input.avatarUploadedAt,
      input.expectedAvatarObjectKey,
    ],
  );
  return result.rowCount === 1;
}

export async function findPlayerAvatarRecord(
  groupId: string,
  groupPlayerId: string,
): Promise<{
  objectKey: string;
  contentType: GamePhotoContentType;
} | null> {
  const result = await queryDatabase<{
    avatar_object_key: string | null;
    avatar_content_type: GamePhotoContentType | null;
  }>(
    `
      SELECT player.avatar_object_key, player.avatar_content_type
      FROM group_players AS group_player
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE group_player.group_id = $1 AND group_player.id = $2
    `,
    [groupId, groupPlayerId],
  );
  const row = result.rows[0];
  return row?.avatar_object_key && row.avatar_content_type
    ? {
        objectKey: row.avatar_object_key,
        contentType: row.avatar_content_type,
      }
    : null;
}

function mapProfile(row: ProfileRow): PlayerProfileRecord {
  return {
    playerId: row.player_id,
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    profileMessage: row.profile_message,
    avatarObjectKey: row.avatar_object_key,
    avatarContentType: row.avatar_content_type,
    avatarByteSize: row.avatar_byte_size,
    avatarUploadedAt: row.avatar_uploaded_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapClaim(row: ClaimRow): PlayerProfileClaimRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    expiresAt: row.expires_at.toISOString(),
  };
}
