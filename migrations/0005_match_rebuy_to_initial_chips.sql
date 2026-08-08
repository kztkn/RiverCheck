UPDATE games
SET rebuy_chips = initial_chips,
    updated_at = NOW()
WHERE status <> 'finalized'
  AND rebuy_chips <> initial_chips;

ALTER TABLE games
ADD CONSTRAINT games_open_rebuy_matches_initial CHECK (
  status = 'finalized' OR rebuy_chips = initial_chips
);
