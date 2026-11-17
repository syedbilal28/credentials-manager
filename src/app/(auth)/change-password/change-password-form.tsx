"use client";

import { useActionState } from "react";
import { changePassword } from "@/actions/auth";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { signOut } from "@/lib/sign-out";

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {/* Lets password managers associate the new password with the account. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          hidden
        />
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current (temporary) password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
        <FormError message={state?.error} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Set password"}
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => void signOut()}
      >
        Sign out
      </Button>
    </div>
  );
}
