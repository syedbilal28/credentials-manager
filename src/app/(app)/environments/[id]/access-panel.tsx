"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setEnvironmentUsers } from "@/actions/access";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type AccessUser = { id: string; name: string; email: string; hasAccess: boolean };

export function AccessPanel({
  environmentId,
  users,
}: {
  environmentId: string;
  users: AccessUser[];
}) {
  const initial = new Set(users.filter((u) => u.hasAccess).map((u) => u.id));
  const [selected, setSelected] = useState(initial);
  const [pending, startTransition] = useTransition();

  // Re-sync after a save (the server sends fresh props) without an effect.
  const serverKey = users.map((u) => `${u.id}:${u.hasAccess}`).join(",");
  const [syncedKey, setSyncedKey] = useState(serverKey);
  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setSelected(initial);
  }

  const dirty =
    selected.size !== initial.size || [...selected].some((id) => !initial.has(id));

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onSave() {
    startTransition(async () => {
      const result = await setEnvironmentUsers({
        environmentId,
        userIds: [...selected],
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Access updated");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access</CardTitle>
        <CardDescription>
          Users who can view and copy this environment&apos;s credentials.
          Superusers can always see every environment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no active regular users yet.{" "}
            <Link href="/admin/users" className="underline underline-offset-4">
              Create one
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {users.map((user) => (
              <li key={user.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Checkbox
                  id={`access-${user.id}`}
                  checked={selected.has(user.id)}
                  onCheckedChange={(checked) => toggle(user.id, checked === true)}
                />
                <label htmlFor={`access-${user.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <div className="truncate text-sm font-medium">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </label>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {users.length > 0 && (
        <CardFooter className="justify-end gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setSelected(initial)} disabled={pending}>
              Reset
            </Button>
          )}
          <Button onClick={onSave} disabled={!dirty || pending}>
            {pending ? "Saving…" : "Save access"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
