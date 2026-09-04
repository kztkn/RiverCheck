import pg from "pg";

const { Client } = pg;
const client = new Client({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/rivercheck",
});

await client.connect();
try {
  const group = await client.query(
    `INSERT INTO groups (name, public_code)
     VALUES ('Cancel Test', 'cancel-test')
     RETURNING id`,
  );
  const player = await client.query(
    `INSERT INTO players (display_name) VALUES ('Alice') RETURNING id`,
  );
  const groupPlayer = await client.query(
    `INSERT INTO group_players (group_id, player_id)
     VALUES ($1, $2)
     RETURNING id`,
    [group.rows[0].id, player.rows[0].id],
  );
  const game = await client.query(
    `INSERT INTO games (
      group_id, title, played_at, status, initial_chips, rebuy_chips,
      venue_cost, rounding_unit, first_place_cost, second_place_cost,
      third_place_cost, preview_participant_count,
      seven_deuce_rule_enabled, bomb_pot_rule_enabled
    ) VALUES (
      $1, 'Cancel Test', NOW(), 'open', 20000, 20000,
      0, 100, 0, 0, 0, 4, TRUE, TRUE
    )
    RETURNING id`,
    [group.rows[0].id],
  );
  await client.query(
    `INSERT INTO game_participants (game_id, group_player_id)
     VALUES ($1, $2)`,
    [game.rows[0].id, groupPlayer.rows[0].id],
  );

  for (const eventType of ["bomb_pot", "seven_deuce"]) {
    const event = await client.query(
      `INSERT INTO game_table_events (
        command_id, game_id, event_type, subject_group_player_id,
        recorded_by_group_player_id, recorded_by_type
      ) VALUES (
        gen_random_uuid(), $1, $2,
        CASE WHEN $2 = 'seven_deuce' THEN $3::uuid ELSE NULL END,
        $3, 'participant'
      )
      RETURNING id`,
      [game.rows[0].id, eventType, groupPlayer.rows[0].id],
    );

    const result = await client.query(
      `UPDATE game_table_events AS event
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
       RETURNING event.id`,
      [
        game.rows[0].id,
        group.rows[0].id,
        event.rows[0].id,
        groupPlayer.rows[0].id,
        "participant",
      ],
    );

    if (result.rowCount !== 1) {
      throw new Error(`${eventType} cancellation updated ${result.rowCount} rows`);
    }
  }

  const organizerEvent = await client.query(
    `INSERT INTO game_table_events (
      command_id, game_id, event_type,
      recorded_by_group_player_id, recorded_by_type
    ) VALUES (gen_random_uuid(), $1, 'bomb_pot', NULL, 'organizer')
    RETURNING id`,
    [game.rows[0].id],
  );

  const organizerResult = await client.query(
    `UPDATE game_table_events AS event
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
     RETURNING event.id`,
    [game.rows[0].id, group.rows[0].id, organizerEvent.rows[0].id, null, "organizer"],
  );

  if (organizerResult.rowCount !== 1) {
    throw new Error(`organizer cancellation updated ${organizerResult.rowCount} rows`);
  }

  console.log("table-event cancellation SQL passed against PostgreSQL");
} finally {
  await client.end();
}
