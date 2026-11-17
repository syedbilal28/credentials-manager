"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createEnvironment } from "@/actions/environments";
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

export function CreateEnvironmentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createEnvironment({
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Environment created");
      setOpen(false);
      router.push(`/environments/${result.data.id}`);
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
        <Button>
          <Plus aria-hidden />
          New environment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New environment</DialogTitle>
            <DialogDescription>
              For example <span className="font-mono">toronto-dev</span>. You
              can add credentials and give users access afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="env-name">Name</Label>
            <Input id="env-name" name="name" maxLength={100} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="env-description" name="description" maxLength={1000} rows={3} />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create environment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
