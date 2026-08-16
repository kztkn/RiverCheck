CREATE FUNCTION rivercheck_valid_cost_shares(
  share_values BIGINT[],
  venue_cost BIGINT,
  participant_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  WITH ranked AS (
    SELECT
      value,
      LAG(value) OVER (ORDER BY ordinal) AS previous_value
    FROM UNNEST(share_values) WITH ORDINALITY AS share(value, ordinal)
  )
  SELECT
    CARDINALITY(share_values) = participant_count
    AND CARDINALITY(share_values) >= 4
    AND COALESCE(
      BOOL_AND(
        value IS NOT NULL
        AND value >= 0
        AND value % 100 = 0
        AND (previous_value IS NULL OR value >= previous_value)
      ),
      FALSE
    )
    AND COALESCE(SUM(value), 0)::NUMERIC
      = CEIL(venue_cost::NUMERIC / 100) * 100
  FROM ranked
$$;

ALTER TABLE games
ADD COLUMN cost_shares BIGINT[];

ALTER TABLE games
ADD CONSTRAINT games_cost_shares_valid CHECK (
  cost_shares IS NULL OR rivercheck_valid_cost_shares(
    cost_shares,
    venue_cost,
    preview_participant_count
  )
);
