import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { requireDatabaseUrl } from "./load-env.node.js";

const { Client } = pg;
const migrationsDirectory = resolve(process.cwd(), "migrations");
const client = new Client({ connectionString: requireDatabaseUrl() });

await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await client.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = $1) AS exists",
      [file],
    );
    if (applied.rows[0]?.exists) continue;

    const sql = await readFile(resolve(migrationsDirectory, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
