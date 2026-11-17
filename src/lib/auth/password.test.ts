import { describe, expect, it } from "vitest";
import {
  generateTempPassword,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  passwordPolicyError,
  verifyAgainstDummy,
  verifyPassword,
} from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong password!!")).toBe(false);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "whatever")).toBe(false);
  });

  it("dummy verification always fails", async () => {
    expect(await verifyAgainstDummy("dummy-password-for-timing")).toBe(false);
  });
});

describe("generateTempPassword", () => {
  it("meets the password policy and avoids look-alike characters", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(passwordPolicyError(pw)).toBeNull();
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });

  it("is random", () => {
    expect(new Set(Array.from({ length: 20 }, () => generateTempPassword())).size).toBe(20);
  });
});

describe("passwordPolicyError", () => {
  it("enforces the minimum length", () => {
    expect(passwordPolicyError("x".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/);
    expect(passwordPolicyError("x".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });
});
