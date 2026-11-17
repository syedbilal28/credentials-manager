import "server-only";
import { headers } from "next/headers";
import { db, type Tx } from "@/db";
import { auditLogs } from "@/db/schema";

export const AUDIT_ACTIONS = [
  "login.success",
  "login.failed",
  "login.throttled",
  "logout",
  "password.changed",
  "user.created",
  "user.password_reset",
  "user.role_changed",
  "user.deactivated",
  "user.reactivated",
  "environment.created",
  "environment.updated",
  "environment.deleted",
  "credential.created",
  "credential.updated",
  "credential.deleted",
  "credential.imported",
  "credential.revealed",
  "credential.copied",
  "access.granted",
  "access.revoked",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  actor: { id: string; email: string } | null;
  /** For failed logins: the email that was tried. Defaults to actor.email. */
  actorEmail?: string;
  action: AuditAction;
  targetType?: "user" | "environment" | "credential";
  targetId?: string;
  targetLabel?: string;
  environmentId?: string;
  metadata?: Record<string, unknown>;
};

async function requestInfo() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent")?.slice(0, 512) ?? null;
  return { ip, userAgent };
}

/**
 * Writes an audit entry. Pass `tx` to make the entry part of the same
 * transaction as the change it records.
 */
export async function logAudit(
  entry: AuditEntry,
  tx: Tx | typeof db = db,
): Promise<void> {
  const { ip, userAgent } = await requestInfo();
  await tx.insert(auditLogs).values({
    actorId: entry.actor?.id ?? null,
    actorEmail: entry.actorEmail ?? entry.actor?.email ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    targetLabel: entry.targetLabel ?? null,
    environmentId: entry.environmentId ?? null,
    metadata: entry.metadata ?? null,
    ip,
    userAgent,
  });
}
