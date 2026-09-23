ALTER TABLE games
ADD COLUMN initial_stack_bb SMALLINT NOT NULL DEFAULT 100;

ALTER TABLE games
ADD CONSTRAINT games_initial_stack_bb_supported CHECK (
  initial_stack_bb IN (50, 100)
);
