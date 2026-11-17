"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { credentials, environments } from "@/db/schema";
import {
  ActionError,
  actionSuperuser,
  actionUser,
  parseInput,
  isUniqueViolation,
  runAction,
} from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { getAccessibleEnvironment } from "@/lib/auth/guards";
import { decrypt, encrypt } from "@/lib/crypto";
import { parseEnv } from "@/lib/env-parser";
import {
  credentialDescription,
  credentialKey,
  credentialValue,
  id,
  MAX_IMPORT_LENGTH,
  MAX_VALUE_LENGTH,
} from "@/lib/validation";

const DUPLICATE_KEY = "A credential with this key already exists in this environment.";

function rethrowDuplicateKey(error: unknown): never {
  if (isUniqueViolation(error)) throw new ActionError(DUPLICATE_KEY);
  throw error;
}

async function getEnvironmentName(environmentId: string): Promise<string> {
  const [env] = await db
    .select({ name: environments.name })
    .from(environments)
    .where(eq(environments.id, environmentId));
  if (!env) throw new ActionError("Environment not found.");
  return env.name;
}

async function getCredentialWithEnv(credentialId: string) {
  const [row] = await db
    .select({
      id: credentials.id,
      key: credentials.key,
      encryptedValue: credentials.encryptedValue,
      environmentId: credentials.environmentId,
      environmentName: environments.name,
    })
    .from(credentials)
    .innerJoin(environments, eq(environments.id, credentials.environmentId))
    .where(eq(credentials.id, credentialId));
  if (!row) throw new ActionError("Credential not found.");
  return row;
}

const createInput = z.object({
  environmentId: id,
  key: credentialKey,
  value: credentialValue,
  description: credentialDescription,
});

export async function createCredential(input: z.input<typeof createInput>) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const data = parseInput(createInput, input);
    const envName = await getEnvironmentName(data.environmentId);

    const credentialId = randomUUID();
    await db
      .insert(credentials)
      .values({
        id: credentialId,
        environmentId: data.environmentId,
        key: data.key,
        encryptedValue: encrypt(data.value, credentialId),
        description: data.description,
        updatedBy: actor.id,
      })
      .catch(rethrowDuplicateKey);

    await logAudit({
      actor,
      action: "credential.created",
      targetType: "credential",
      targetId: credentialId,
      targetLabel: `${envName} / ${data.key}`,
      environmentId: data.environmentId,
    });
    refresh();
  });
}

const updateInput = z.object({
  id,
  key: credentialKey,
  description: credentialDescription,
  // Omitted when the value should stay unchanged.
  value: credentialValue.optional(),
});

export async function updateCredential(input: z.input<typeof updateInput>) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const data = parseInput(updateInput, input);
    const existing = await getCredentialWithEnv(data.id);

    await db
      .update(credentials)
      .set({
        key: data.key,
        description: data.description,
        ...(data.value !== undefined && {
          encryptedValue: encrypt(data.value, existing.id),
        }),
        updatedBy: actor.id,
        updatedAt: sql`now()`,
      })
      .where(eq(credentials.id, existing.id))
      .catch(rethrowDuplicateKey);

    await logAudit({
      actor,
      action: "credential.updated",
      targetType: "credential",
      targetId: existing.id,
      targetLabel: `${existing.environmentName} / ${data.key}`,
      environmentId: existing.environmentId,
      metadata: {
        valueChanged: data.value !== undefined,
        ...(existing.key !== data.key && { renamedFrom: existing.key }),
      },
    });
    refresh();
  });
}

export async function deleteCredential(input: { id: string }) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const credentialId = parseInput(id, input.id);
    const existing = await getCredentialWithEnv(credentialId);

    await db.transaction(async (tx) => {
      await tx.delete(credentials).where(eq(credentials.id, existing.id));
      await logAudit(
        {
          actor,
          action: "credential.deleted",
          targetType: "credential",
          targetId: existing.id,
          targetLabel: `${existing.environmentName} / ${existing.key}`,
          environmentId: existing.environmentId,
        },
        tx,
      );
    });
    refresh();
  });
}

const importInput = z.object({
  environmentId: id,
  text: z.string().max(MAX_IMPORT_LENGTH, {
    message: "That's too much text to import at once.",
  }),
  overwrite: z.boolean(),
});

export async function importEnv(input: z.input<typeof importInput>) {
  return runAction(async () => {
    const actor = await actionSuperuser();
    const data = parseInput(importInput, input);
    const envName = await getEnvironmentName(data.environmentId);

    const parsed = parseEnv(data.text);
    if (parsed.errors.length > 0) {
      const e = parsed.errors[0];
      throw new ActionError(`Line ${e.line}: ${e.message}`);
    }
    if (parsed.entries.length === 0) {
      throw new ActionError("Nothing to import.");
    }
    const tooLong = parsed.entries.find((e) => e.value.length > MAX_VALUE_LENGTH);
    if (tooLong) {
      throw new ActionError(
        `${tooLong.key}: value must be at most ${MAX_VALUE_LENGTH} characters.`,
      );
    }

    const created: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: credentials.id, key: credentials.key })
        .from(credentials)
        .where(
          and(
            eq(credentials.environmentId, data.environmentId),
            inArray(
              credentials.key,
              parsed.entries.map((e) => e.key),
            ),
          ),
        );
      const existingByKey = new Map(existing.map((c) => [c.key, c.id]));

      const toInsert: (typeof credentials.$inferInsert)[] = [];
      for (const entry of parsed.entries) {
        const existingId = existingByKey.get(entry.key);
        if (existingId) {
          if (!data.overwrite) {
            skipped.push(entry.key);
            continue;
          }
          await tx
            .update(credentials)
            .set({
              encryptedValue: encrypt(entry.value, existingId),
              updatedBy: actor.id,
              updatedAt: sql`now()`,
            })
            .where(eq(credentials.id, existingId));
          updated.push(entry.key);
        } else {
          const newId = randomUUID();
          toInsert.push({
            id: newId,
            environmentId: data.environmentId,
            key: entry.key,
            encryptedValue: encrypt(entry.value, newId),
            updatedBy: actor.id,
          });
          created.push(entry.key);
        }
      }
      if (toInsert.length > 0) await tx.insert(credentials).values(toInsert);

      await logAudit(
        {
          actor,
          action: "credential.imported",
          targetType: "environment",
          targetId: data.environmentId,
          targetLabel: envName,
          environmentId: data.environmentId,
          metadata: { created, updated, skipped },
        },
        tx,
      );
    });

    refresh();
    return {
      created: created.length,
      updated: updated.length,
      skipped: skipped.length,
    };
  });
}

const revealInput = z.object({
  id,
  mode: z.enum(["reveal", "copy"]),
});

/**
 * Returns a decrypted value to anyone who can view its environment. A value is
 * never handed out without its audit entry having been written.
 */
export async function revealCredential(input: z.input<typeof revealInput>) {
  return runAction(async () => {
    const user = await actionUser();
    const data = parseInput(revealInput, input);

    const [row] = await db
      .select({
        id: credentials.id,
        key: credentials.key,
        encryptedValue: credentials.encryptedValue,
        environmentId: credentials.environmentId,
      })
      .from(credentials)
      .where(eq(credentials.id, data.id));
    const environment = row
      ? await getAccessibleEnvironment(user, row.environmentId)
      : null;
    // Same message whether it doesn't exist or isn't accessible.
    if (!row || !environment) throw new ActionError("Credential not found.");

    // Decrypt before logging so failed decryptions aren't recorded as reveals;
    // the value is only returned after the audit entry is written.
    const value = decrypt(row.encryptedValue, row.id);
    await logAudit({
      actor: user,
      action: data.mode === "copy" ? "credential.copied" : "credential.revealed",
      targetType: "credential",
      targetId: row.id,
      targetLabel: `${environment.name} / ${row.key}`,
      environmentId: row.environmentId,
    });

    return { value };
  });
}
