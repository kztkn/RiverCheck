import { queryDatabase, withTransaction } from "@server/db/client.server";
import type { TableEventType } from "@domain/table-events/validate-table-event";

export type TableEventActorType = "participant" | "organizer";

export interface TableEventPlayer {
  groupPlayerId: string;
  displayName: string;
  isWinner: boolean;
}

export interface TableEventRecord {
  id: string;
  type: TableEventType;
  recordedAt: string;
  recordedByGroupPlayerId: string | null;
  recordedByType: TableEventActorType;
  subject: {
    groupPlayerId: string;
    displayName: string;
    avatarUpdatedAt: string | null;
  } | null;
  players: TableEventPlayer[];
}

interface TableEventRow {
  id: string;
  event_type: TableEventType;
  recorded_at: Date;
  recorded_by_group_player_id: string | null;
  recorded_by_type: TableEventActorType;
  subject_group_player_id: string | null;
  subject_display_name: string | null;
  subject_avatar_uploaded_at: Date | null;
}

interface TableEventPlayerRow {
  event_id: string;
  group_player_id: string;
  display_name: string;
  is_winner: boolean;
}

interface ActorInput {
  groupPlayerId: string | null;
  type: TableEventActorType;
}

export async function createSevenDeuceTableEvent(input: {
  actor: ActorInput;
  commandId: string;
  gameId: string;
  groupId: string;
  subjectGroupPlayerId: string;
}): Promise<string | null> {
  const result = await queryDatabase<{ id: string }>(
    `
      INSERT INTO game_table_events (
        command_id,
        game_id,
        event_type,
        subject_group_player_id,
        recorded_by_group_player_id,
        recorded_by_type
      )
      SELECT $3, game.id, 'seven_deuce', participant.group_player_id, $5, $6
      FROM games AS game
      INNER JOIN game_participants AS participant
        ON participant.game_id = game.id
       AND participant.group_player_id = $4
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND game.seven_deuce_rule_enabled = TRUE
      ON CONFLICT (command_id) DO NOTHING
      RETURNING id
    `,
    [
      input.gameId,
      input.groupId,
      input.commandId,
      input.subjectGroupPlayerId,
      input.actor.groupPlayerId,
      input.actor.type,
    ],
  );
  return result.rows[0]?.id ?? null;
}

export async function createBombPotTableEvent(input: {
  actor: ActorInput;
  commandId: string;
  gameId: string;
  groupId: string;
}): Promise<string | null> {
  const result = await queryDatabase<{ id: string }>(
    `
      INSERT INTO game_table_events (
        command_id,
        game_id,
        event_type,
        recorded_by_group_player_id,
        recorded_by_type
      )
      SELECT $3, game.id, 'bomb_pot', $4, $5
      FROM games AS game
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND game.bomb_pot_rule_enabled = TRUE
      ON CONFLICT (command_id) DO NOTHING
      RETURNING id
    `,
    [
      input.gameId,
      input.groupId,
      input.commandId,
      input.actor.groupPlayerId,
      input.actor.type,
    ],
  );
  return result.rows[0]?.id ?? null;
}

export async function createAllInTableEvent(input: {
  actor: ActorInput;
  commandId: string;
  gameId: string;
  groupId: string;
  participantIds: string[];
  winnerIds: string[];
}): Promise<string | null> {
  return withTransaction(async (transaction) => {
    const game = await transaction.query<{ id: string }>(
      `
        SELECT id
        FROM games
        WHERE id = $1
          AND group_id = $2
          AND status = 'open'
        FOR UPDATE
      `,
      [input.gameId, input.groupId],
    );
    if (!game.rows[0]) return null;

    const participants = await transaction.query<{ group_player_id: string }>(
      `
        SELECT group_player_id
        FROM game_participants
        WHERE game_id = $1
          AND group_player_id = ANY($2::uuid[])
      `,
      [input.gameId, input.participantIds],
    );
    if (participants.rows.length !== input.participantIds.length) return null;

    const event = await transaction.query<{ id: string }>(
      `
        INSERT INTO game_table_events (
          command_id,
          game_id,
          event_type,
          recorded_by_group_player_id,
          recorded_by_type
        )
        VALUES ($1, $2, 'all_in', $3, $4)
        ON CONFLICT (command_id) DO NOTHING
        RETURNING id
      `,
      [
        input.commandId,
        input.gameId,
        input.actor.groupPlayerId,
        input.actor.type,
      ],
    );
    const eventId = event.rows[0]?.id;
    if (!eventId) return null;

    await transaction.query(
      `
        INSERT INTO game_table_event_players (
          event_id,
          group_player_id,
          is_winner
        )
        SELECT $1, selected.group_player_id,
               selected.group_player_id = ANY($3::uuid[])
        FROM UNNEST($2::uuid[]) AS selected(group_player_id)
      `,
      [eventId, input.participantIds, input.winnerIds],
    );
    return eventId;
  });
}

export async function cancelTableEvent(input: {
  actor: ActorInput;
  eventId: string;
  gameId: string;
  groupId: string;
}): Promise<boolean> {
  const result = await queryDatabase<{ id: string }>(
    `
      UPDATE game_table_events AS event
      SET canceled_at = NOW(),
          canceled_by_group_player_id = $4,
          canceled_by_type = $5
      FROM games AS game
      WHERE event.game_id = game.id
        AND event.id = $3
        AND game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND event.canceled_at IS NULL
        AND (
          $5 = 'organizer'
          OR ($4 IS NOT NULL AND event.recorded_by_group_player_id = $4)
        )
      RETURNING event.id
    `,
    [
      input.gameId,
      input.groupId,
      input.eventId,
      input.actor.groupPlayerId,
      input.actor.type,
    ],
  );
  return result.rowCount === 1;
}

export async function listOpenGameTableEvents(
  groupId: string,
  gameId: string,
  limit = 5,
): Promise<TableEventRecord[]> {
  return listTableEvents(groupId, gameId, "open", limit, "DESC");
}

export async function listFinalizedGameTableEvents(
  groupId: string,
  gameId: string,
): Promise<TableEventRecord[]> {
  return listTableEvents(groupId, gameId, "finalized", null, "ASC");
}

async function listTableEvents(
  groupId: string,
  gameId: string,
  gameStatus: "open" | "finalized",
  limit: number | null,
  direction: "ASC" | "DESC",
): Promise<TableEventRecord[]> {
  const params: unknown[] = [gameId, groupId, gameStatus];
  const limitSql = limit === null ? "" : `LIMIT $${params.push(limit)}`;
  const eventResult = await queryDatabase<TableEventRow>(
    `
      SELECT event.id,
             event.event_type,
             event.recorded_at,
             event.recorded_by_group_player_id,
             event.recorded_by_type,
             event.subject_group_player_id,
             subject_player.display_name AS subject_display_name,
             subject_player.avatar_uploaded_at AS subject_avatar_uploaded_at
      FROM game_table_events AS event
      INNER JOIN games AS game ON game.id = event.game_id
      LEFT JOIN group_players AS subject_group_player
        ON subject_group_player.id = event.subject_group_player_id
      LEFT JOIN players AS subject_player
        ON subject_player.id = subject_group_player.player_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = $3
        AND event.canceled_at IS NULL
      ORDER BY event.recorded_at ${direction}, event.id ${direction}
      ${limitSql}
    `,
    params,
  );

  if (eventResult.rows.length === 0) return [];
  const eventIds = eventResult.rows.map((row) => row.id);
  const playerResult = await queryDatabase<TableEventPlayerRow>(
    `
      SELECT event_player.event_id,
             event_player.group_player_id,
             player.display_name,
             event_player.is_winner
      FROM game_table_event_players AS event_player
      INNER JOIN group_players AS group_player
        ON group_player.id = event_player.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE event_player.event_id = ANY($1::uuid[])
      ORDER BY player.display_name ASC, event_player.group_player_id ASC
    `,
    [eventIds],
  );

  const playersByEvent = new Map<string, TableEventPlayer[]>();
  for (const row of playerResult.rows) {
    const players = playersByEvent.get(row.event_id) ?? [];
    players.push({
      groupPlayerId: row.group_player_id,
      displayName: row.display_name,
      isWinner: row.is_winner,
    });
    playersByEvent.set(row.event_id, players);
  }

  return eventResult.rows.map((row) => ({
    id: row.id,
    type: row.event_type,
    recordedAt: row.recorded_at.toISOString(),
    recordedByGroupPlayerId: row.recorded_by_group_player_id,
    recordedByType: row.recorded_by_type,
    subject:
      row.subject_group_player_id && row.subject_display_name
        ? {
            groupPlayerId: row.subject_group_player_id,
            displayName: row.subject_display_name,
            avatarUpdatedAt:
              row.subject_avatar_uploaded_at?.toISOString() ?? null,
          }
        : null,
    players: playersByEvent.get(row.id) ?? [],
  }));
}
