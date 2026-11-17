"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, type Tx } from "@/db";
import { users } from "@/db/schema";
import {
  ActionError,
  actionSuperuser,
  isUniqueViolation,
  parseInput,
  runAction,
} from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { checkDeactivate, checkRoleChange } from "@/lib/user-rules";
import { email, id, personName, role } from "@/lib/validation";

const createUserInput = z.object({ email, name: personName, role });

export async function createUser(input: z.input<typeof createUserInput>) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const data = parseInput(createUserInput, input);
    const tempPassword = generateTempPassword();

    const [created] = await db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        role: data.role,
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      })
      .returning({ id: users.id })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ActionError("A user with this email already exists.");
        }
        throw error;
      });

    await logAudit({
      actor,
      action: "user.created",
      targetType: "user",
      targetId: created.id,
      targetLabel: data.email,
      metadata: { role: data.role },
    });
    refresh();
    return { id: created.id, tempPassword };
  });
}

/**
 * Locks every active superuser row for the rest of the transaction, so two
 * superusers demoting/deactivating each other at the same moment can't leave
 * the system with none.
 */
async function lockActiveSuperuserCount(tx: Tx): Promise<number> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "superuser"), eq(users.isActive, true)))
    .for("update");
  return rows.length;
}

async function getTarget(tx: Tx, userId: string) {
  const [target] = await tx
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!target) throw new ActionError("User not found.");
  return target;
}

export async function resetPassword(input: { id: string }) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const userId = parseInput(id, input.id);
    if (userId === actor.id) {
      throw new ActionError(
        "You can't reset your own password here. Ask another superuser.",
      );
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await db.transaction(async (tx) => {
      const target = await getTarget(tx, userId);
      await tx
        .update(users)
        .set({ passwordHash, mustChangePassword: true, updatedAt: sql`now()` })
        .where(eq(users.id, userId));
      await destroyAllSessionsForUser(userId, tx);
      await logAudit(
        {
          actor,
          action: "user.password_reset",
          targetType: "user",
          targetId: userId,
          targetLabel: target.email,
        },
        tx,
      );
    });
    refresh();
    return { tempPassword };
  });
}

export async function setRole(input: { id: string; role: string }) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const data = parseInput(z.object({ id, role }), input);

    await db.transaction(async (tx) => {
      const activeSuperuserCount = await lockActiveSuperuserCount(tx);
      const target = await getTarget(tx, data.id);
      const error = checkRoleChange({
        actorId: actor.id,
        target,
        newRole: data.role,
        activeSuperuserCount,
      });
      if (error) throw new ActionError(error);
      if (target.role === data.role) return;

      await tx
        .update(users)
        .set({ role: data.role, updatedAt: sql`now()` })
        .where(eq(users.id, data.id));
      // Their open pages were rendered with the old role; make them sign in again.
      await destroyAllSessionsForUser(data.id, tx);
      await logAudit(
        {
          actor,
          action: "user.role_changed",
          targetType: "user",
          targetId: data.id,
          targetLabel: target.email,
          metadata: { from: target.role, to: data.role },
        },
        tx,
      );
    });
    refresh();
  });
}

export async function deactivateUser(input: { id: string }) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const userId = parseInput(id, input.id);

    await db.transaction(async (tx) => {
      const activeSuperuserCount = await lockActiveSuperuserCount(tx);
      const target = await getTarget(tx, userId);
      const error = checkDeactivate({
        actorId: actor.id,
        target,
        activeSuperuserCount,
      });
      if (error) throw new ActionError(error);

      await tx
        .update(users)
        .set({ isActive: false, updatedAt: sql`now()` })
        .where(eq(users.id, userId));
      await destroyAllSessionsForUser(userId, tx);
      await logAudit(
        {
          actor,
          action: "user.deactivated",
          targetType: "user",
          targetId: userId,
          targetLabel: target.email,
        },
        tx,
      );
    });
    refresh();
  });
}

export async function reactivateUser(input: { id: string }) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const userId = parseInput(id, input.id);

    await db.transaction(async (tx) => {
      const target = await getTarget(tx, userId);
      if (target.isActive) throw new ActionError("This user is already active.");
      await tx
        .update(users)
        .set({ isActive: true, updatedAt: sql`now()` })
        .where(eq(users.id, userId));
      await logAudit(
        {
          actor,
          action: "user.reactivated",
          targetType: "user",
          targetId: userId,
          targetLabel: target.email,
        },
        tx,
      );
    });
    refresh();
  });
}
