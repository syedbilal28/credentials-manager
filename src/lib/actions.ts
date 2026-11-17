import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { getCurrentUser, type SessionUser } from "./auth/session";

/*
 * Helpers for Server Actions. Every action is a public POST endpoint, so each
 * one validates its input and calls one of the guards below itself.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** An expected failure whose message is safe to show to the user. */
export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function actionUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ActionError("Your session has expired. Please sign in again.");
  }
  if (user.mustChangePassword) {
    throw new ActionError("You must change your password first.");
  }
  return user;
}

export async function actionSuperuser(): Promise<SessionUser> {
  const user = await actionUser();
  if (user.role !== "superuser") {
    throw new ActionError("You are not allowed to do that.");
  }
  return user;
}

export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "_";
      fieldErrors[field] ??= issue.message;
    }
    const first = result.error.issues[0]?.message ?? "Invalid input.";
    throw new ActionError(first, fieldErrors);
  }
  return result.data;
}

/**
 * Runs an action body. ActionErrors become `{ ok: false }`. Next.js control
 * flow (redirect/notFound) is rethrown. Unexpected errors are logged and
 * replaced with a generic message so internals aren't leaked to the browser.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    if (isUniqueViolation(error)) {
      return { ok: false, error: "That name is already in use." };
    }
    console.error("[action] unexpected error", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function isUniqueViolation(error: unknown): boolean {
  // Postgres unique_violation. Drizzle may wrap the driver error in `cause`.
  for (let e: unknown = error, depth = 0; e && depth < 3; depth++) {
    if (typeof e === "object" && "code" in e && e.code === "23505") return true;
    e = typeof e === "object" && "cause" in e ? e.cause : undefined;
  }
  return false;
}
