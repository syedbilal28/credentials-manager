"use client";

import {
  KeyRound,
  MoreHorizontal,
  Server,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserEnvironments } from "@/actions/access";
import {
  deactivateUser,
  reactivateUser,
  resetPassword,
  setRole,
} from "@/actions/users";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import { TempPassword } from "./temp-password";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "superuser" | "user";
  isActive: boolean;
};

type Pending =
  | "access"
  | "reset"
  | "promote"
  | "demote"
  | "deactivate"
  | "reactivate"
  | null;

export function UserActions({
  user,
  isSelf,
  environments,
  grantedEnvironmentIds,
}: {
  user: UserRow;
  isSelf: boolean;
  environments: { id: string; name: string }[];
  grantedEnvironmentIds: string[];
}) {
  const [dialog, setDialog] = useState<Pending>(null);
  // Closing unmounts the dialog body, discarding any one-time password shown.
  useResetOnHide(() => setDialog(null));

  if (isSelf) return null;

  return (
    <>
      {/* Non-modal so opening a dialog from a menu item doesn't fight over focus. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.email}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {user.role === "user" && (
            <DropdownMenuItem onSelect={() => setDialog("access")}>
              <Server aria-hidden />
              Environment access
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setDialog("reset")}>
            <KeyRound aria-hidden />
            Reset password
          </DropdownMenuItem>
          {user.role === "user" ? (
            <DropdownMenuItem onSelect={() => setDialog("promote")}>
              <ShieldCheck aria-hidden />
              Make superuser
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDialog("demote")}>
              <ShieldOff aria-hidden />
              Make regular user
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {user.isActive ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("deactivate")}>
              <UserX aria-hidden />
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDialog("reactivate")}>
              <UserCheck aria-hidden />
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          {dialog === "access" && (
            <AccessDialog
              user={user}
              environments={environments}
              grantedEnvironmentIds={grantedEnvironmentIds}
              onDone={() => setDialog(null)}
            />
          )}
          {dialog === "reset" && <ResetPasswordDialog user={user} />}
          {(dialog === "promote" ||
            dialog === "demote" ||
            dialog === "deactivate" ||
            dialog === "reactivate") && (
            <ConfirmDialog kind={dialog} user={user} onDone={() => setDialog(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const CONFIRM_COPY = {
  promote: {
    title: "Make superuser?",
    body: "They'll be able to see and change every environment and credential, manage users and read the audit log. They will be signed out and need to sign in again.",
    button: "Make superuser",
    success: "User is now a superuser",
    destructive: false,
  },
  demote: {
    title: "Make regular user?",
    body: "They'll only see environments they've been given access to, with read-only rights. They will be signed out and need to sign in again.",
    button: "Make regular user",
    success: "User is now a regular user",
    destructive: false,
  },
  deactivate: {
    title: "Deactivate user?",
    body: "They'll be signed out immediately and won't be able to sign in. Their environment access and audit history are kept, so you can reactivate them later.",
    button: "Deactivate",
    success: "User deactivated",
    destructive: true,
  },
  reactivate: {
    title: "Reactivate user?",
    body: "They'll be able to sign in again with their existing password, and their previous environment access is restored.",
    button: "Reactivate",
    success: "User reactivated",
    destructive: false,
  },
} as const;

function ConfirmDialog({
  kind,
  user,
  onDone,
}: {
  kind: keyof typeof CONFIRM_COPY;
  user: UserRow;
  onDone: () => void;
}) {
  const copy = CONFIRM_COPY[kind];
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result =
        kind === "promote"
          ? await setRole({ id: user.id, role: "superuser" })
          : kind === "demote"
            ? await setRole({ id: user.id, role: "user" })
            : kind === "deactivate"
              ? await deactivateUser({ id: user.id })
              : await reactivateUser({ id: user.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(copy.success);
      onDone();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground">{user.email}</span>. {copy.body}
        </DialogDescription>
      </DialogHeader>
      <FormError message={error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          variant={copy.destructive ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Working…" : copy.button}
        </Button>
      </DialogFooter>
    </>
  );
}

function ResetPasswordDialog({ user }: { user: UserRow }) {
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onReset() {
    startTransition(async () => {
      const result = await resetPassword({ id: user.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPassword(result.data.tempPassword);
    });
  }

  if (password) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Password reset</DialogTitle>
        </DialogHeader>
        <TempPassword email={user.email} password={password} />
        <DialogFooter>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset password?</DialogTitle>
        <DialogDescription>
          A new temporary password will be generated for{" "}
          <span className="font-medium text-foreground">{user.email}</span>. Their
          current password stops working, they&apos;re signed out everywhere, and
          they must choose a new password at their next sign-in.
        </DialogDescription>
      </DialogHeader>
      <FormError message={error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button onClick={onReset} disabled={pending}>
          {pending ? "Resetting…" : "Reset password"}
        </Button>
      </DialogFooter>
    </>
  );
}

function AccessDialog({
  user,
  environments,
  grantedEnvironmentIds,
  onDone,
}: {
  user: UserRow;
  environments: { id: string; name: string }[];
  grantedEnvironmentIds: string[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(() => new Set(grantedEnvironmentIds));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const result = await setUserEnvironments({
        userId: user.id,
        environmentIds: [...selected],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Access updated");
      onDone();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Environment access</DialogTitle>
        <DialogDescription>
          Environments <span className="font-medium text-foreground">{user.email}</span>{" "}
          can view (read-only).
        </DialogDescription>
      </DialogHeader>
      {environments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No environments exist yet.</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-auto">
          {environments.map((env) => (
            <li key={env.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
              <Checkbox
                id={`ua-${user.id}-${env.id}`}
                checked={selected.has(env.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (checked === true) next.add(env.id);
                    else next.delete(env.id);
                    return next;
                  })
                }
              />
              <label htmlFor={`ua-${user.id}-${env.id}`} className="flex-1 cursor-pointer truncate text-sm">
                {env.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <FormError message={error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button onClick={onSave} disabled={pending || environments.length === 0}>
          {pending ? "Saving…" : "Save access"}
        </Button>
      </DialogFooter>
    </>
  );
}
