ALTER TABLE groups
  ADD COLUMN paypay_recipient_link TEXT,
  ADD COLUMN paypay_link_registered_at TIMESTAMPTZ,
  ADD CONSTRAINT groups_paypay_link_metadata_complete CHECK (
    NUM_NONNULLS(paypay_recipient_link, paypay_link_registered_at) IN (0, 2)
  ),
  ADD CONSTRAINT groups_paypay_recipient_link_valid CHECK (
    paypay_recipient_link IS NULL OR (
      CHAR_LENGTH(paypay_recipient_link) <= 2048
      AND paypay_recipient_link ~ '^https://[^[:space:]]+$'
    )
  );
