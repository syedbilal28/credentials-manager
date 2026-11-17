"use client";

import { UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createUser } from "@/actions/users";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import { TempPassword } from "./temp-password";

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"user" | "superuser">("user");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Don't keep a one-time password around in a hidden page.
  useResetOnHide(() => {
    setOpen(false);
    setCreated(null);
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    startTransition(async () => {
      const result = await createUser({
        email,
        name: String(form.get("name") ?? ""),
        role,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("User created");
      setCreated({ email: email.trim().toLowerCase(), password: result.data.tempPassword });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setCreated(null);
          setRole("user");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden />
          New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>User created</DialogTitle>
            </DialogHeader>
            <TempPassword email={created.email} password={created.password} />
            <DialogFooter>
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            <DialogHeader>
              <DialogTitle>New user</DialogTitle>
              <DialogDescription>
                A temporary password is generated for them. You can give them
                access to environments afterwards.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input id="user-name" name="name" maxLength={100} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" name="email" type="email" maxLength={320} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User: views environments they&apos;re given</SelectItem>
                  <SelectItem value="superuser">Superuser: manages everything</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormError message={error} />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
