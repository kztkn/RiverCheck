ALTER TABLE players
  ADD COLUMN favorite_hand_card_1 VARCHAR(2),
  ADD COLUMN favorite_hand_card_2 VARCHAR(2),
  ADD CONSTRAINT players_favorite_hand_complete CHECK (
    (favorite_hand_card_1 IS NULL AND favorite_hand_card_2 IS NULL)
    OR
    (favorite_hand_card_1 IS NOT NULL AND favorite_hand_card_2 IS NOT NULL)
  ),
  ADD CONSTRAINT players_favorite_hand_card_1_valid CHECK (
    favorite_hand_card_1 IS NULL
    OR favorite_hand_card_1 ~ '^[AKQJT2-9][SHDC]$'
  ),
  ADD CONSTRAINT players_favorite_hand_card_2_valid CHECK (
    favorite_hand_card_2 IS NULL
    OR favorite_hand_card_2 ~ '^[AKQJT2-9][SHDC]$'
  ),
  ADD CONSTRAINT players_favorite_hand_distinct CHECK (
    favorite_hand_card_1 IS NULL
    OR favorite_hand_card_1 <> favorite_hand_card_2
  );
