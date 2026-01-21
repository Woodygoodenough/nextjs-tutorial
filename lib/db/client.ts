import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("Missing POSTGRES_URL");
}

type PostgresClient = ReturnType<typeof postgres>;
type DrizzleClient = ReturnType<typeof drizzle>;

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: PostgresClient | undefined;
  // eslint-disable-next-line no-var
  var __drizzleDb: DrizzleClient | undefined;
}

export const sql: PostgresClient =
  globalThis.__pgClient ?? postgres(connectionString, { ssl: "require" });

export const db: DrizzleClient = globalThis.__drizzleDb ?? drizzle(sql);

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgClient = sql;
  globalThis.__drizzleDb = db;
}

