"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCredential, updateCredential } from "@/actions/credentials";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useResetOnHide } from "@/hooks/use-reset-on-hide";

type Props =
  | { mode: "create"; environmentId: string }
  | {
      mode: "edit";
      credential: { id: string; key: string; description: string | null };
      onSaved?: () => void;
    };

export function CredentialFormDialog(props: Props) {
  const isEdit = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [replaceValue, setReplaceValue] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Closing unmounts the form, discarding any typed value.
  useResetOnHide(() => setOpen(false));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const key = String(form.get("key") ?? "");
    const description = String(form.get("description") ?? "");
    const value = String(form.get("value") ?? "");

    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createCredential({
              environmentId: props.environmentId,
              key,
              value,
              description,
            })
          : await updateCredential({
              id: props.credential.id,
              key,
              description,
              value: replaceValue ? value : undefined,
            });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Credential updated" : "Credential added");
      setOpen(false);
      if (props.mode === "edit") props.onSaved?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setReplaceValue(!isEdit);
        }
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${props.credential.key}`}
            title="Edit"
          >
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden />
            Add credential
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit credential" : "Add credential"}</DialogTitle>
            <DialogDescription>
              Keys are free-form, e.g. <span className="font-mono">database url</span>{" "}
              or <span className="font-mono">DATABASE_URL</span>. Values are
              encrypted before they are stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cred-key">Key</Label>
            <Input
              id="cred-key"
              name="key"
              defaultValue={isEdit ? props.credential.key : ""}
              maxLength={200}
              required
              autoFocus
              className="font-mono"
              spellCheck={false}
            />
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="cred-replace"
                checked={replaceValue}
                onCheckedChange={(checked) => setReplaceValue(checked === true)}
              />
              <Label htmlFor="cred-replace" className="font-normal">
                Replace the value
              </Label>
            </div>
          )}
          {replaceValue && (
            <div className="space-y-2">
              <Label htmlFor="cred-value">{isEdit ? "New value" : "Value"}</Label>
              <Textarea
                id="cred-value"
                name="value"
                rows={4}
                maxLength={20000}
                className="font-mono text-sm"
                spellCheck={false}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cred-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="cred-description"
              name="description"
              rows={2}
              maxLength={1000}
              defaultValue={isEdit ? (props.credential.description ?? "") : ""}
            />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add credential"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
