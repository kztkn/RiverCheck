export const MIGRATION_ADVISORY_LOCK_ID = "5931046673967386979";

type MigrationLockClient = {
  query: (queryText: string, values?: unknown[]) => Promise<unknown>;
};

export async function acquireMigrationLock(
  client: MigrationLockClient,
): Promise<void> {
  await client.query("SELECT pg_advisory_lock($1)", [
    MIGRATION_ADVISORY_LOCK_ID,
  ]);
}
