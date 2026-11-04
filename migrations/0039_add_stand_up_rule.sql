-- Preserve the previously always-available STAND UP rule for existing games.
ALTER TABLE games
ADD COLUMN stand_up_rule_enabled BOOLEAN NOT NULL DEFAULT TRUE;
