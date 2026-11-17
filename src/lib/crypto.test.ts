import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, parseEncryptionKey } from "./crypto";

const key = randomBytes(32);
const aad = "6f1c2a40-7c55-4c1f-9d61-1a2b3c4d5e6f";

describe("encrypt/decrypt", () => {
  it("round-trips text, including unicode and multi-line values", () => {
    for (const value of [
      "",
      "postgres://user:p@ss@host:5432/db",
      "héllo 🌍",
      "-----BEGIN KEY-----\nabc\n-----END KEY-----",
    ]) {
      expect(decrypt(encrypt(value, aad, key), aad, key)).toBe(value);
    }
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same", aad, key)).not.toBe(encrypt("same", aad, key));
  });

  it("produces the versioned v1 format without the plaintext", () => {
    const blob = encrypt("supersecret", aad, key);
    expect(blob).toMatch(/^v1:[^:]+:[^:]+:[^:]*$/);
    expect(blob).not.toContain("supersecret");
  });

  it("rejects a tampered ciphertext", () => {
    const [v, iv, tag, data] = encrypt("secret value", aad, key).split(":");
    const bytes = Buffer.from(data, "base64");
    bytes[0] ^= 0xff;
    const tampered = [v, iv, tag, bytes.toString("base64")].join(":");
    expect(() => decrypt(tampered, aad, key)).toThrow();
  });

  it("rejects a tampered auth tag", () => {
    const [v, iv, tag, data] = encrypt("secret value", aad, key).split(":");
    const t = Buffer.from(tag, "base64");
    t[0] ^= 0xff;
    expect(() => decrypt([v, iv, t.toString("base64"), data].join(":"), aad, key)).toThrow();
  });

  it("rejects the wrong key", () => {
    const blob = encrypt("secret", aad, key);
    expect(() => decrypt(blob, aad, randomBytes(32))).toThrow();
  });

  it("rejects a ciphertext moved to another credential id", () => {
    const blob = encrypt("secret", aad, key);
    expect(() =>
      decrypt(blob, "00000000-0000-4000-8000-000000000000", key),
    ).toThrow();
  });

  it("rejects unknown formats", () => {
    expect(() => decrypt("v2:a:b:c", aad, key)).toThrow(/Unsupported/);
    expect(() => decrypt("not encrypted", aad, key)).toThrow(/Unsupported/);
  });
});

describe("parseEncryptionKey", () => {
  it("accepts a base64 32-byte key", () => {
    expect(parseEncryptionKey(randomBytes(32).toString("base64"))).toHaveLength(32);
  });

  it("rejects missing or wrong-length keys", () => {
    expect(() => parseEncryptionKey(undefined)).toThrow(/not set/);
    expect(() => parseEncryptionKey("")).toThrow(/not set/);
    expect(() => parseEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
