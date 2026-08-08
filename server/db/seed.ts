import pg from "pg";
import { requireDatabaseUrl } from "./load-env.node.js";

const { Client } = pg;
const groupName = process.env.MVP_GROUP_NAME?.trim() || "RiverCheck Poker Club";
const groupCode = process.env.MVP_GROUP_CODE?.trim() || "river-check";
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(groupCode)) {
  throw new Error(
    "MVP_GROUP_CODE must use lowercase letters, numbers, and hyphens",
  );
}

const client = new Client({ connectionString: requireDatabaseUrl() });

await client.connect();
try {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO groups (name, public_code)
      VALUES ($1, $2)
      ON CONFLICT (public_code) DO UPDATE
      SET name = EXCLUDED.name,
          updated_at = NOW()
      RETURNING id
    `,
    [groupName, groupCode],
  );
  console.log(`Seeded group ${groupCode} (${result.rows[0]?.id})`);
} finally {
  await client.end();
}
