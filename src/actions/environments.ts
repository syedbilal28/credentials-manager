"use server";

import { count, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { credentials, environments } from "@/db/schema";
import {
  ActionError,
  actionSuperuser,
  isUniqueViolation,
  parseInput,
  runAction,
} from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { environmentInput, id } from "@/lib/validation";
import { z } from "zod";

function rethrowDuplicateName(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ActionError("An environment with this name already exists.");
  }
  throw error;
}

export async function createEnvironment(input: {
  name: string;
  description?: string;
}) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const data = parseInput(environmentInput, input);

    const [env] = await db
      .insert(environments)
      .values({ ...data, createdBy: actor.id })
      .returning({ id: environments.id, name: environments.name })
      .catch(rethrowDuplicateName);

    await logAudit({
      actor,
      action: "environment.created",
      targetType: "environment",
      targetId: env.id,
      targetLabel: env.name,
      environmentId: env.id,
    });
    return { id: env.id };
  });
}

export async function updateEnvironment(input: {
  id: string;
  name: string;
  description?: string;
}) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const envId = parseInput(id, input.id);
    const data = parseInput(environmentInput, input);

    const [before] = await db
      .select({ name: environments.name, description: environments.description })
      .from(environments)
      .where(eq(environments.id, envId));
    if (!before) throw new ActionError("Environment not found.");

    await db
      .update(environments)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(environments.id, envId))
      .catch(rethrowDuplicateName);

    await logAudit({
      actor,
      action: "environment.updated",
      targetType: "environment",
      targetId: envId,
      targetLabel: data.name,
      environmentId: envId,
      metadata:
        before.name !== data.name
          ? { renamedFrom: before.name }
          : { descriptionChanged: before.description !== data.description },
    });
    refresh();
  });
}

export async function deleteEnvironment(input: {
  id: string;
  confirmName: string;
}) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const envId = parseInput(id, input.id);
    const confirmName = parseInput(z.string(), input.confirmName);

    const [env] = await db
      .select({ name: environments.name })
      .from(environments)
      .where(eq(environments.id, envId));
    if (!env) throw new ActionError("Environment not found.");
    if (confirmName.trim() !== env.name) {
      throw new ActionError("The name you typed doesn't match.");
    }

    const [{ credentialCount }] = await db
      .select({ credentialCount: count() })
      .from(credentials)
      .where(eq(credentials.environmentId, envId));

    await db.transaction(async (tx) => {
      // Credentials and access grants are removed by ON DELETE CASCADE.
      await tx.delete(environments).where(eq(environments.id, envId));
      await logAudit(
        {
          actor,
          action: "environment.deleted",
          targetType: "environment",
          targetId: envId,
          targetLabel: env.name,
          environmentId: envId,
          metadata: { credentialCount },
        },
        tx,
      );
    });
  });
}
