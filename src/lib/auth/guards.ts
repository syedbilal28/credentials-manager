import "server-only";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { environmentAccess, environments } from "@/db/schema";
import { getCurrentUser, type SessionUser } from "./session";

/*
 * Guards for Server Components (pages and layouts). They redirect or 404.
 * Server Actions use the guards in src/lib/actions.ts, which return errors instead.
 */

export async function requireUser(
  options: { allowPendingPasswordChange?: boolean } = {},
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    redirect("/change-password");
  }
  return user;
}

export async function requireSuperuser(): Promise<SessionUser> {
  const user = await requireUser();
  // 404 rather than 403 so admin pages don't advertise themselves.
  if (user.role !== "superuser") notFound();
  return user;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Returns the environment if the user may view it. Superusers see everything;
 * users need a grant. Anything else is a 404, so names of environments a user
 * can't access never leak.
 */
export async function getAccessibleEnvironment(
  user: SessionUser,
  environmentId: string,
) {
  if (!isUuid(environmentId)) return null;

  if (user.role === "superuser") {
    const [env] = await db
      .select()
      .from(environments)
      .where(eq(environments.id, environmentId))
      .limit(1);
    return env ?? null;
  }

  const [row] = await db
    .select({ env: environments })
    .from(environments)
    .innerJoin(
      environmentAccess,
      and(
        eq(environmentAccess.environmentId, environments.id),
        eq(environmentAccess.userId, user.id),
      ),
    )
    .where(eq(environments.id, environmentId))
    .limit(1);
  return row?.env ?? null;
}

export async function requireEnvironmentAccess(environmentId: string) {
  const user = await requireUser();
  const environment = await getAccessibleEnvironment(user, environmentId);
  if (!environment) notFound();
  return { user, environment };
}
