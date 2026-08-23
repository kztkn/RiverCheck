ALTER TABLE games
ADD COLUMN seven_deuce_rule_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE games
ALTER COLUMN seven_deuce_rule_enabled SET DEFAULT TRUE;
