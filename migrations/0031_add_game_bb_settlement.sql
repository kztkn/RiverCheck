ALTER TABLE games
ADD COLUMN bb_rate BIGINT NOT NULL DEFAULT 0;

ALTER TABLE games
ADD CONSTRAINT games_bb_rate_valid CHECK (bb_rate IN (0, 5, 10, 20));

ALTER TABLE game_results
ADD COLUMN game_settlement_amount BIGINT NOT NULL DEFAULT 0;

ALTER TABLE game_results
ADD CONSTRAINT game_results_game_settlement_amount_rounded CHECK (
  game_settlement_amount % 100 = 0
);
