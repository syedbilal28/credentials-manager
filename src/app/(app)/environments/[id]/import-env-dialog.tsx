"use client";

import { FileUp } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { importEnv } from "@/actions/credentials";
import { FormError } from "@/components/form-error";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import { parseEnv } from "@/lib/env-parser";

const EXAMPLE = `# Paste KEY=value lines, e.g.
DATABASE_NAME=toronto-dev
DATABASE_URL="postgres://user:pass@host:5432/db"
export API_KEY=abc123`;

export function ImportEnvDialog({
  environmentId,
  existingKeys,
}: {
  environmentId: string;
  existingKeys: string[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseEnv(text), [text]);
  const existing = useMemo(() => new Set(existingKeys), [existingKeys]);
  const conflicts = parsed.entries.filter((e) => existing.has(e.key)).length;
  const newCount = parsed.entries.length - conflicts;
  const willWrite = newCount + (overwrite ? conflicts : 0);

  function reset() {
    setStep("paste");
    setText("");
    setOverwrite(false);
    setError(null);
  }

  // The pasted text contains secrets; drop it when the page is left.
  useResetOnHide(() => {
    setOpen(false);
    reset();
  });

  function onImport() {
    startTransition(async () => {
      const result = await importEnv({ environmentId, text, overwrite });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { created, updated, skipped } = result.data;
      toast.success(
        [
          `${created} added`,
          updated ? `${updated} overwritten` : null,
          skipped ? `${skipped} skipped` : null,
        ]
          .filter(Boolean)
          .join(", "),
      );
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp aria-hidden />
          Import .env
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from .env</DialogTitle>
          <DialogDescription>
            {step === "paste"
              ? "Paste the contents of a .env file. You'll see a preview before anything is saved."
              : "Check what will be imported."}
          </DialogDescription>
        </DialogHeader>

        {step === "paste" ? (
          <div className="space-y-3">
            <Label htmlFor="env-text" className="sr-only">
              .env contents
            </Label>
            <Textarea
              id="env-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              rows={12}
              className="font-mono text-sm"
              spellCheck={false}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              autoFocus
            />
            {parsed.errors.length > 0 && (
              <ul className="space-y-1 text-sm text-destructive" role="alert">
                {parsed.errors.slice(0, 5).map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
                {parsed.errors.length > 5 && (
                  <li>…and {parsed.errors.length - 5} more</li>
                )}
              </ul>
            )}
            <DialogFooter>
              <Button
                onClick={() => setStep("preview")}
                disabled={parsed.entries.length === 0 || parsed.errors.length > 0}
              >
                Preview {parsed.entries.length > 0 && `(${parsed.entries.length})`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-72 overflow-auto rounded-md border">
              <ul className="divide-y text-sm">
                {parsed.entries.map((entry) => {
                  const exists = existing.has(entry.key);
                  return (
                    <li
                      key={entry.key}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <span className="truncate font-mono">{entry.key}</span>
                      {exists ? (
                        <Badge variant={overwrite ? "destructive" : "outline"}>
                          {overwrite ? "Will overwrite" : "Exists, skip"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">New</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {parsed.warnings.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {parsed.warnings.map((w) => (
                  <li key={w.line}>
                    Line {w.line}: {w.message}
                  </li>
                ))}
              </ul>
            )}

            {conflicts > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="import-overwrite"
                  checked={overwrite}
                  onCheckedChange={(checked) => setOverwrite(checked === true)}
                />
                <Label htmlFor="import-overwrite" className="font-normal">
                  Overwrite {conflicts} existing{" "}
                  {conflicts === 1 ? "credential" : "credentials"}
                </Label>
              </div>
            )}

            <FormError message={error} />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("paste")}
                disabled={pending}
              >
                Back
              </Button>
              <Button onClick={onImport} disabled={pending || willWrite === 0}>
                {pending
                  ? "Importing…"
                  : `Import ${willWrite} ${willWrite === 1 ? "credential" : "credentials"}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
