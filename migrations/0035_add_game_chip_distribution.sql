ALTER TABLE games
  ADD COLUMN chip_distribution JSONB,
  ADD CONSTRAINT games_chip_distribution_is_array CHECK (
    chip_distribution IS NULL OR jsonb_typeof(chip_distribution) = 'array'
  );
