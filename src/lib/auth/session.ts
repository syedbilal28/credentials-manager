import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, type Tx } from "@/db";
import { sessions, users } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_SECURE,
  SESSION_TTL_MS,
} from "./constants";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "superuser" | "user";
  mustChangePassword: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a session row and sets the cookie. Only callable from Server Actions. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  // Opportunistic cleanup so the table doesn't grow forever.
  await db.delete(sessions).where(lt(sessions.expiresAt, sql`now()`));

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Deletes the current session and its cookie. Only callable from Server Actions. */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere (deactivation, password reset, role change). */
export async function destroyAllSessionsForUser(
  userId: string,
  tx: Tx | typeof db = db,
): Promise<void> {
  await tx.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * The signed-in user for this request, or null. Only active users with an
 * unexpired session count. Memoised per request with React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, hashToken(token)),
        gt(sessions.expiresAt, sql`now()`),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  return row ?? null;
});
