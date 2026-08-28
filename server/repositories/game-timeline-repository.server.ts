import { queryDatabase } from "@server/db/client.server";

export type GameTimelineEventType = "rebuy" | "repayment";

interface GameTimelineEventRow {
  id: string;
  event_type: GameTimelineEventType;
  recorded_at: Date;
  group_player_id: string;
  display_name: string;
  avatar_uploaded_at: Date | null;
}

export interface GameTimelineEvent {
  id: string;
  type: GameTimelineEventType;
  recordedAt: string;
  groupPlayerId: string;
  displayName: string;
  avatarUpdatedAt: string | null;
}

export async function listFinalizedGameTimeline(
  groupId: string,
  gameId: string,
): Promise<GameTimelineEvent[]> {
  const result = await queryDatabase<GameTimelineEventRow>(
    `
      SELECT event.id,
             event.event_type,
             event.recorded_at,
             participant.group_player_id,
             player.display_name,
             player.avatar_uploaded_at
      FROM game_rebuy_events AS event
      INNER JOIN game_participants AS participant
        ON participant.id = event.game_participant_id
      INNER JOIN games AS game ON game.id = participant.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'finalized'
        AND event.event_type IN ('rebuy', 'repayment')
        AND NOT EXISTS (
          SELECT 1
          FROM game_rebuy_events AS undo
          WHERE undo.reverts_event_id = event.id
        )
      ORDER BY event.recorded_at ASC, event.id ASC
    `,
    [gameId, groupId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    type: row.event_type,
    recordedAt: row.recorded_at.toISOString(),
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
  }));
}
