import "server-only";
import { createDb, type Db } from "./client";

const globalForDb = globalThis as unknown as { __db?: Db };

function getDb(): Db {
  if (!globalForDb.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. See .env.example.");
    }
    // Cached on globalThis so dev hot reloads don't open a new pool each time.
    globalForDb.__db = createDb(url);
  }
  return globalForDb.__db;
}

/**
 * Lazily-initialised database client: importing this module never connects or
 * requires DATABASE_URL, which keeps `next build` working without a database.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
