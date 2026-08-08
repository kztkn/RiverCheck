UPDATE games
SET rounding_unit = 100,
    updated_at = NOW()
WHERE rounding_unit <> 100;

ALTER TABLE games
  ADD CONSTRAINT games_rounding_unit_fixed CHECK (rounding_unit = 100);
