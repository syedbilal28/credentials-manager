import type { Role } from "@/db/schema";

/**
 * Pure rules for user management, kept separate so they can be unit tested.
 * Each returns an error message, or null when the change is allowed.
 */

type Target = { id: string; role: Role; isActive: boolean };

export function checkRoleChange(args: {
  actorId: string;
  target: Target;
  newRole: Role;
  activeSuperuserCount: number;
}): string | null {
  const { actorId, target, newRole, activeSuperuserCount } = args;
  if (target.role === newRole) return null;
  if (target.id === actorId) return "You can't change your own role.";
  if (
    target.role === "superuser" &&
    target.isActive &&
    activeSuperuserCount <= 1
  ) {
    return "This is the last active superuser and can't be demoted.";
  }
  return null;
}

export function checkDeactivate(args: {
  actorId: string;
  target: Target;
  activeSuperuserCount: number;
}): string | null {
  const { actorId, target, activeSuperuserCount } = args;
  if (target.id === actorId) return "You can't deactivate your own account.";
  if (!target.isActive) return "This user is already deactivated.";
  if (target.role === "superuser" && activeSuperuserCount <= 1) {
    return "This is the last active superuser and can't be deactivated.";
  }
  return null;
}
