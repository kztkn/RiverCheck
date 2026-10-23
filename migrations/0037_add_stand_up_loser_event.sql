-- STAND UP records one last-standing player per round. Multiple rounds
-- per game are allowed; canceled records do not count towards the title.
ALTER TABLE game_table_events
  DROP CONSTRAINT game_table_events_type_valid,
  DROP CONSTRAINT game_table_events_subject_valid;

ALTER TABLE game_table_events
  ADD CONSTRAINT game_table_events_type_valid CHECK (
    event_type IN ('seven_deuce', 'bomb_pot', 'all_in', 'stand_up_loser')
  ),
  ADD CONSTRAINT game_table_events_subject_valid CHECK (
    (event_type IN ('seven_deuce', 'stand_up_loser') AND subject_group_player_id IS NOT NULL)
    OR (event_type NOT IN ('seven_deuce', 'stand_up_loser') AND subject_group_player_id IS NULL)
  );

INSERT INTO achievements (code, name, description, icon_key, category, is_hidden, sort_order)
VALUES ('stand-up-last', '立ちっぱなし', 'STAND UPで最後まで立っていた人になる', 'arrows-up-down', 'table-event', FALSE, 300)
ON CONFLICT (code) DO NOTHING;
