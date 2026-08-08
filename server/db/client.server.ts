import { env } from "cloudflare:workers";
import pg, { type QueryResult, type QueryResultRow } from "pg";

const { Client } = pg;

interface RuntimeDatabaseEnv {
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
}

export async function queryDatabase<Row extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<Row>> {
  const runtimeEnv = env as RuntimeDatabaseEnv;
  const connectionString =
    runtimeEnv.HYPERDRIVE?.connectionString ?? runtimeEnv.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or HYPERDRIVE binding is required");
  }

  // Workers cannot reuse network I/O across requests. A fresh pg Client keeps
  // the connection inside the current invocation; Hyperdrive supplies pooling.
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();

  try {
    return await client.query<Row>(text, values);
  } finally {
    await client.end();
  }
}

export interface DatabaseTransaction {
  query<Row extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
}

export async function withTransaction<Result>(
  work: (transaction: DatabaseTransaction) => Promise<Result>,
): Promise<Result> {
  const runtimeEnv = env as RuntimeDatabaseEnv;
  const connectionString =
    runtimeEnv.HYPERDRIVE?.connectionString ?? runtimeEnv.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or HYPERDRIVE binding is required");
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();

  const transaction: DatabaseTransaction = {
    query: <Row extends QueryResultRow>(text: string, values: unknown[] = []) =>
      client.query<Row>(text, values),
  };

  try {
    await client.query("BEGIN");
    const result = await work(transaction);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
