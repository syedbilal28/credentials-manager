import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Credential values are encrypted with AES-256-GCM.
 *
 * Stored format: `v1:<iv b64>:<auth tag b64>:<ciphertext b64>`.
 * - A fresh random 12-byte IV is used for every encryption.
 * - The credential id is bound as additional authenticated data (AAD), so a
 *   ciphertext copied onto another row (e.g. into an environment someone can
 *   see) fails to decrypt instead of leaking.
 * - The `v1` prefix leaves room for key rotation later.
 */

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | undefined;

export function parseEncryptionKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 bytes, base64-encoded. Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

function getKey(): Buffer {
  cachedKey ??= parseEncryptionKey(process.env.ENCRYPTION_KEY);
  return cachedKey;
}

export function encrypt(
  plaintext: string,
  aad: string,
  key: Buffer = getKey(),
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decrypt(
  blob: string,
  aad: string,
  key: Buffer = getKey(),
): string {
  const parts = blob.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unsupported encrypted value format");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Malformed encrypted value");
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
