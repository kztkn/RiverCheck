ALTER TABLE games
DROP CONSTRAINT games_initial_stack_bb_supported;

ALTER TABLE games
ADD CONSTRAINT games_initial_stack_bb_supported CHECK (
  initial_stack_bb IN (25, 50, 100)
);
