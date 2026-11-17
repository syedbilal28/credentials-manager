import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  credentials,
  environmentAccess,
  environments,
  users,
} from "@/db/schema";
import type { SessionUser } from "./auth/session";

/*
 * Read queries for Server Components. Callers must already have run the right
 * guard (requireUser / requireSuperuser / requireEnvironmentAccess).
 * Nothing here ever selects encrypted values.
 */

export async function listEnvironmentsForUser(user: SessionUser) {
  const credentialCount = db
    .select({ environmentId: credentials.environmentId, n: count().as("n") })
    .from(credentials)
    .groupBy(credentials.environmentId)
    .as("credential_count");

  const base = db
    .select({
      id: environments.id,
      name: environments.name,
      description: environments.description,
      updatedAt: environments.updatedAt,
      credentialCount: sql<number>`coalesce(${credentialCount.n}, 0)`.mapWith(
        Number,
      ),
    })
    .from(environments)
    .leftJoin(
      credentialCount,
      eq(credentialCount.environmentId, environments.id),
    )
    .$dynamic();

  if (user.role === "superuser") {
    return base.orderBy(asc(sql`lower(${environments.name})`));
  }
  return base
    .innerJoin(
      environmentAccess,
      and(
        eq(environmentAccess.environmentId, environments.id),
        eq(environmentAccess.userId, user.id),
      ),
    )
    .orderBy(asc(sql`lower(${environments.name})`));
}

export async function listCredentials(environmentId: string) {
  return db
    .select({
      id: credentials.id,
      key: credentials.key,
      description: credentials.description,
      updatedAt: credentials.updatedAt,
    })
    .from(credentials)
    .where(eq(credentials.environmentId, environmentId))
    .orderBy(asc(sql`lower(${credentials.key})`));
}

/** Active regular users, with whether each can view the environment. */
export async function listEnvironmentAccess(environmentId: string) {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      hasAccess: sql<boolean>`${environmentAccess.userId} is not null`,
    })
    .from(users)
    .leftJoin(
      environmentAccess,
      and(
        eq(environmentAccess.userId, users.id),
        eq(environmentAccess.environmentId, environmentId),
      ),
    )
    .where(and(eq(users.role, "user"), eq(users.isActive, true)))
    .orderBy(asc(users.email));
  return rows;
}

export async function listUsers() {
  const grantCount = db
    .select({ userId: environmentAccess.userId, n: count().as("n") })
    .from(environmentAccess)
    .groupBy(environmentAccess.userId)
    .as("grant_count");

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      environmentCount: sql<number>`coalesce(${grantCount.n}, 0)`.mapWith(Number),
    })
    .from(users)
    .leftJoin(grantCount, eq(grantCount.userId, users.id))
    .orderBy(desc(users.isActive), asc(users.email));
}

export async function listEnvironmentNames() {
  return db
    .select({ id: environments.id, name: environments.name })
    .from(environments)
    .orderBy(asc(sql`lower(${environments.name})`));
}

export async function listAllGrants() {
  return db
    .select({
      userId: environmentAccess.userId,
      environmentId: environmentAccess.environmentId,
    })
    .from(environmentAccess);
}

export type AuditFilters = {
  actorId?: string;
  environmentId?: string;
  action?: string;
  /** Inclusive, YYYY-MM-DD (UTC). */
  from?: string;
  /** Inclusive, YYYY-MM-DD (UTC). */
  to?: string;
};

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditLogs(filters: AuditFilters, page: number) {
  const conditions: SQL[] = [];
  if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
  if (filters.environmentId) {
    conditions.push(eq(auditLogs.environmentId, filters.environmentId));
  }
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.from) {
    conditions.push(gte(auditLogs.createdAt, sql`${filters.from}::date`));
  }
  if (filters.to) {
    conditions.push(
      lt(auditLogs.createdAt, sql`${filters.to}::date + interval '1 day'`),
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        actorEmail: auditLogs.actorEmail,
        action: auditLogs.action,
        targetLabel: auditLogs.targetLabel,
        environmentId: auditLogs.environmentId,
        metadata: auditLogs.metadata,
        ip: auditLogs.ip,
      })
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(AUDIT_PAGE_SIZE)
      .offset((page - 1) * AUDIT_PAGE_SIZE),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);
  return { rows, total };
}

export async function listAuditActors() {
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .orderBy(asc(users.email));
}
