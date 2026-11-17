import { hash, verify } from "@node-rs/argon2";
import { randomInt } from "node:crypto";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password-policy";

// Shared by the app and the CLI, so no "server-only" import here.

export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH };

// Argon2id (the library default) with OWASP-recommended parameters.
const HASH_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real verification. Used when the email doesn't
 * exist, so response timing doesn't reveal which accounts exist.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummyHash, password);
  return false;
}

// No look-alike characters (0/O, 1/l/I) so temp passwords are easy to read out.
const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTempPassword(length = 16): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
