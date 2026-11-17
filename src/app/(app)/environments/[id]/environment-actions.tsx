"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteEnvironment, updateEnvironment } from "@/actions/environments";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Env = { id: string; name: string; description: string | null };

export function EnvironmentActions({ environment }: { environment: Env }) {
  return (
    <div className="flex gap-2">
      <EditEnvironmentDialog environment={environment} />
      <DeleteEnvironmentDialog environment={environment} />
    </div>
  );
}

function EditEnvironmentDialog({ environment }: { environment: Env }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateEnvironment({
        id: environment.id,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Environment updated");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil aria-hidden />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-env-name">Name</Label>
            <Input
              id="edit-env-name"
              name="name"
              defaultValue={environment.name}
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-env-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="edit-env-description"
              name="description"
              defaultValue={environment.description ?? ""}
              maxLength={1000}
              rows={3}
            />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEnvironmentDialog({ environment }: { environment: Env }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await deleteEnvironment({ id: environment.id, confirmName });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Deleted ${environment.name}`);
      setOpen(false);
      router.replace("/");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setConfirmName("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Delete environment?</DialogTitle>
            <DialogDescription>
              This permanently deletes the environment, all of its credentials,
              and every user&apos;s access to it. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-env-name">
              Type <span className="font-mono font-semibold">{environment.name}</span> to
              confirm
            </Label>
            <Input
              id="confirm-env-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || confirmName.trim() !== environment.name}
            >
              {pending ? "Deleting…" : "Delete environment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
