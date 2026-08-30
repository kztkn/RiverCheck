ALTER TABLE groups
  ADD COLUMN line_open_chat_url TEXT;

UPDATE groups
SET line_open_chat_url = 'https://line.me/ti/g2/8Bsonb9YK8YewGVvTNCp4vnCofI2PrXey7cVEg'
WHERE public_code = 'river-check';
