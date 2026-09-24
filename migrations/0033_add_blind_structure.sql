ALTER TABLE games
ADD COLUMN small_blind_chips BIGINT,
ADD COLUMN big_blind_chips BIGINT,
ADD COLUMN big_blind_ante_chips BIGINT;

-- Only rows whose legacy cache can be converted to integer chip values are
-- backfilled. Rows outside this condition remain readable through the legacy
-- fallback until they are removed or explicitly edited.
UPDATE games
SET
  big_blind_chips = initial_chips / initial_stack_bb,
  small_blind_chips = (initial_chips / initial_stack_bb) / 2,
  big_blind_ante_chips = initial_chips / initial_stack_bb
WHERE initial_chips > 0
  AND initial_stack_bb > 0
  AND initial_chips % initial_stack_bb = 0
  AND (initial_chips / initial_stack_bb) % 2 = 0;

ALTER TABLE games
DROP CONSTRAINT games_initial_stack_bb_supported;

ALTER TABLE games
ADD CONSTRAINT games_initial_stack_bb_positive CHECK (
  initial_stack_bb > 0
),
ADD CONSTRAINT games_blind_structure_valid CHECK (
  (
    small_blind_chips IS NULL AND
    big_blind_chips IS NULL AND
    big_blind_ante_chips IS NULL
  ) OR (
    small_blind_chips > 0 AND
    big_blind_chips > small_blind_chips AND
    big_blind_ante_chips >= 0 AND
    initial_chips % big_blind_chips = 0 AND
    initial_stack_bb = initial_chips / big_blind_chips
  )
);
