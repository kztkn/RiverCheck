ALTER TABLE game_participants
ADD COLUMN status_text TEXT;

ALTER TABLE game_participants
ADD CONSTRAINT game_participants_status_text_length
CHECK (status_text IS NULL OR char_length(status_text) <= 24);
