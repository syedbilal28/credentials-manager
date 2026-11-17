"use server";

import { and, count, eq, gt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import {
  hashPassword,
  normalizeEmail,
  verifyAgainstDummy,
  verifyPassword,
} from "@/lib/auth/password";
import {
  createSession,
  destroyAllSessionsForUser,
  destroyCurrentSession,
  getCurrentUser,
} from "@/lib/auth/session";
import { newPassword } from "@/lib/validation";

export type FormState = { error?: string } | undefined;

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const INVALID_LOGIN = "Invalid email or password.";

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? "")).slice(
    0,
    320,
  );
  const password = String(formData.get("password") ?? "").slice(0, 1024);
  if (!email || !password) return { error: INVALID_LOGIN };

  // Throttle on recent failures for this email (no external store needed).
  const [{ failures }] = await db
    .select({ failures: count() })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorEmail, email),
        eq(auditLogs.action, "login.failed"),
        gt(
          auditLogs.createdAt,
          sql`now() - make_interval(mins => ${LOCKOUT_MINUTES})`,
        ),
      ),
    );
  if (failures >= MAX_FAILED_LOGINS) {
    await logAudit({ actor: null, actorEmail: email, action: "login.throttled" });
    return {
      error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
    };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyAgainstDummy(password);

  if (!user || !valid || !user.isActive) {
    await logAudit({
      actor: null,
      actorEmail: email,
      action: "login.failed",
      metadata: {
        reason: !user ? "unknown_email" : !valid ? "bad_password" : "inactive",
      },
    });
    return { error: INVALID_LOGIN };
  }

  await createSession(user.id);
  await db
    .update(users)
    .set({ lastLoginAt: sql`now()` })
    .where(eq(users.id, user.id));
  await logAudit({
    actor: { id: user.id, email: user.email },
    action: "login.success",
  });

  redirect(user.mustChangePassword ? "/change-password" : "/");
}

/**
 * Ends the session. The caller then does a full page load to /login (see
 * signOut in src/lib/sign-out.ts) so no client-side state, such as a revealed
 * value in a hidden page, survives the sign-out.
 */
export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  await destroyCurrentSession();
  if (user) {
    await logAudit({ actor: { id: user.id, email: user.email }, action: "logout" });
  }
}

const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, { message: "Enter your current password." }),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The new passwords don't match.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "The new password must be different from the current one.",
    path: ["newPassword"],
  });

export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login");

  const parsed = changePasswordInput.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return { error: "Your current password is incorrect." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false, updatedAt: sql`now()` })
    .where(eq(users.id, sessionUser.id));

  // Sign out every other session and issue a fresh one for this browser.
  await destroyAllSessionsForUser(sessionUser.id);
  await createSession(sessionUser.id);
  await logAudit({
    actor: { id: sessionUser.id, email: sessionUser.email },
    action: "password.changed",
    targetType: "user",
    targetId: sessionUser.id,
    targetLabel: sessionUser.email,
  });

  redirect("/");
}
