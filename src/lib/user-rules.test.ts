import { describe, expect, it } from "vitest";
import { checkDeactivate, checkRoleChange } from "./user-rules";

const actorId = "actor";
const superuser = { id: "su", role: "superuser" as const, isActive: true };
const regular = { id: "u", role: "user" as const, isActive: true };

describe("checkRoleChange", () => {
  it("allows promoting a regular user", () => {
    expect(
      checkRoleChange({ actorId, target: regular, newRole: "superuser", activeSuperuserCount: 1 }),
    ).toBeNull();
  });

  it("allows demoting a superuser when others remain", () => {
    expect(
      checkRoleChange({ actorId, target: superuser, newRole: "user", activeSuperuserCount: 2 }),
    ).toBeNull();
  });

  it("blocks demoting the last active superuser", () => {
    expect(
      checkRoleChange({ actorId, target: superuser, newRole: "user", activeSuperuserCount: 1 }),
    ).toMatch(/last active superuser/);
  });

  it("blocks changing your own role", () => {
    expect(
      checkRoleChange({
        actorId,
        target: { ...superuser, id: actorId },
        newRole: "user",
        activeSuperuserCount: 5,
      }),
    ).toMatch(/your own role/);
  });

  it("allows demoting a deactivated superuser", () => {
    expect(
      checkRoleChange({
        actorId,
        target: { ...superuser, isActive: false },
        newRole: "user",
        activeSuperuserCount: 1,
      }),
    ).toBeNull();
  });

  it("treats setting the same role as a no-op", () => {
    expect(
      checkRoleChange({ actorId, target: superuser, newRole: "superuser", activeSuperuserCount: 1 }),
    ).toBeNull();
  });
});

describe("checkDeactivate", () => {
  it("allows deactivating a regular user", () => {
    expect(checkDeactivate({ actorId, target: regular, activeSuperuserCount: 1 })).toBeNull();
  });

  it("blocks deactivating yourself", () => {
    expect(
      checkDeactivate({ actorId, target: { ...superuser, id: actorId }, activeSuperuserCount: 3 }),
    ).toMatch(/your own account/);
  });

  it("blocks deactivating the last active superuser", () => {
    expect(checkDeactivate({ actorId, target: superuser, activeSuperuserCount: 1 })).toMatch(
      /last active superuser/,
    );
  });

  it("allows deactivating a superuser when others remain", () => {
    expect(checkDeactivate({ actorId, target: superuser, activeSuperuserCount: 2 })).toBeNull();
  });

  it("rejects an already deactivated user", () => {
    expect(
      checkDeactivate({ actorId, target: { ...regular, isActive: false }, activeSuperuserCount: 1 }),
    ).toMatch(/already deactivated/);
  });
});
