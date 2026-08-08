import { config } from "dotenv";

config({ path: [".env", ".dev.vars"], quiet: true });

export function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env and update it.",
    );
  }
  return databaseUrl;
}
