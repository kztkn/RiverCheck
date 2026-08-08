UPDATE games
SET status = 'open',
    updated_at = NOW()
WHERE status = 'draft';

ALTER TABLE games
ALTER COLUMN status SET DEFAULT 'open';
