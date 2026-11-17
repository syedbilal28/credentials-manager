import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Creates a Drizzle client. Shared by the app (src/db/index.ts) and CLI scripts.
 * `prepare: false` keeps it compatible with Neon's pooled (PgBouncer) endpoint.
 */
export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, {
    max: options.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
