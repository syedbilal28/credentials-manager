"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, type Tx } from "@/db";
import { environmentAccess, environments, users } from "@/db/schema";
import {
  ActionError,
  actionSuperuser,
  parseInput,
  runAction,
} from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { id } from "@/lib/validation";

type Grant = {
  userId: string;
  userEmail: string;
  environmentId: string;
  environmentName: string;
};

async function applyChanges(
  tx: Tx,
  actor: SessionUser,
  toGrant: Grant[],
  toRevoke: Grant[],
) {
  if (toGrant.length > 0) {
    await tx
      .insert(environmentAccess)
      .values(
        toGrant.map((g) => ({
          userId: g.userId,
          environmentId: g.environmentId,
          grantedBy: actor.id,
        })),
      )
      .onConflictDoNothing();
  }
  for (const g of toRevoke) {
    await tx
      .delete(environmentAccess)
      .where(
        and(
          eq(environmentAccess.userId, g.userId),
          eq(environmentAccess.environmentId, g.environmentId),
        ),
      );
  }
  for (const [action, list] of [
    ["access.granted", toGrant],
    ["access.revoked", toRevoke],
  ] as const) {
    for (const g of list) {
      await logAudit(
        {
          actor,
          action,
          targetType: "user",
          targetId: g.userId,
          targetLabel: `${g.userEmail} → ${g.environmentName}`,
          environmentId: g.environmentId,
        },
        tx,
      );
    }
  }
}

const setEnvironmentUsersInput = z.object({
  environmentId: id,
  userIds: z.array(id).max(1000),
});

/** Sets which regular users can view one environment. */
export async function setEnvironmentUsers(
  input: z.input<typeof setEnvironmentUsersInput>,
) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const data = parseInput(setEnvironmentUsersInput, input);
    const wanted = new Set(data.userIds);

    const result = await db.transaction(async (tx) => {
      const [env] = await tx
        .select({ id: environments.id, name: environments.name })
        .from(environments)
        .where(eq(environments.id, data.environmentId));
      if (!env) throw new ActionError("Environment not found.");

      // Only active regular users are managed here. Grants held by deactivated
      // users are left alone so they come back on reactivation.
      const candidates = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.role, "user"), eq(users.isActive, true)));
      const candidateIds = new Set(candidates.map((u) => u.id));
      const invalid = data.userIds.find((u) => !candidateIds.has(u));
      if (invalid) {
        throw new ActionError("Access can only be given to active regular users.");
      }

      const current = await tx
        .select({ userId: environmentAccess.userId })
        .from(environmentAccess)
        .where(eq(environmentAccess.environmentId, env.id));
      const currentIds = new Set(current.map((c) => c.userId));

      const toGrant: Grant[] = [];
      const toRevoke: Grant[] = [];
      for (const u of candidates) {
        const grant = {
          userId: u.id,
          userEmail: u.email,
          environmentId: env.id,
          environmentName: env.name,
        };
        if (wanted.has(u.id) && !currentIds.has(u.id)) toGrant.push(grant);
        if (!wanted.has(u.id) && currentIds.has(u.id)) toRevoke.push(grant);
      }
      await applyChanges(tx, actor, toGrant, toRevoke);
      return { granted: toGrant.length, revoked: toRevoke.length };
    });

    refresh();
    return result;
  });
}

const setUserEnvironmentsInput = z.object({
  userId: id,
  environmentIds: z.array(id).max(10_000),
});

/** Sets which environments one regular user can view. */
export async function setUserEnvironments(
  input: z.input<typeof setUserEnvironmentsInput>,
) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const data = parseInput(setUserEnvironmentsInput, input);
    const wanted = new Set(data.environmentIds);

    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, data.userId));
      if (!target) throw new ActionError("User not found.");
      if (target.role === "superuser") {
        throw new ActionError("Superusers can already see every environment.");
      }

      const allEnvs = await tx
        .select({ id: environments.id, name: environments.name })
        .from(environments);
      const envIds = new Set(allEnvs.map((e) => e.id));
      if (data.environmentIds.some((e) => !envIds.has(e))) {
        throw new ActionError("One of the environments no longer exists.");
      }

      const current = await tx
        .select({ environmentId: environmentAccess.environmentId })
        .from(environmentAccess)
        .where(
          and(
            eq(environmentAccess.userId, target.id),
            inArray(
              environmentAccess.environmentId,
              allEnvs.map((e) => e.id),
            ),
          ),
        );
      const currentIds = new Set(current.map((c) => c.environmentId));

      const toGrant: Grant[] = [];
      const toRevoke: Grant[] = [];
      for (const env of allEnvs) {
        const grant = {
          userId: target.id,
          userEmail: target.email,
          environmentId: env.id,
          environmentName: env.name,
        };
        if (wanted.has(env.id) && !currentIds.has(env.id)) toGrant.push(grant);
        if (!wanted.has(env.id) && currentIds.has(env.id)) toRevoke.push(grant);
      }
      await applyChanges(tx, actor, toGrant, toRevoke);
      return { granted: toGrant.length, revoked: toRevoke.length };
    });

    refresh();
    return result;
  });
}
