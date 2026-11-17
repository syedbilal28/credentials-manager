"use client";

import { Check, Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { revealCredential } from "@/actions/credentials";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import { copyAsync } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { CredentialFormDialog } from "./credential-form-dialog";
import { DeleteCredentialButton } from "./delete-credential-button";

type CredentialSummary = {
  id: string;
  key: string;
  description: string | null;
  updatedAt: Date;
};

/** Revealed values are hidden again automatically after this long. */
const REVEAL_MS = 30_000;
const MASK = "••••••••••••";

export function CredentialsTable({
  credentials,
  canEdit,
}: {
  credentials: CredentialSummary[];
  canEdit: boolean;
}) {
  if (credentials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <KeyRound className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-medium">No credentials yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit
            ? "Add one, or import several at once from a .env file."
            : "Nothing has been added to this environment yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border" role="table" aria-label="Credentials">
      <div
        role="row"
        className={cn(
          "hidden gap-x-4 border-b px-4 py-2 text-sm font-medium text-muted-foreground sm:grid",
          gridCols(canEdit),
        )}
      >
        <span role="columnheader">Key</span>
        <span role="columnheader">Value</span>
        <span role="columnheader" className="hidden md:block">
          Updated
        </span>
        <span role="columnheader" className="sr-only">
          Actions
        </span>
      </div>
      <div role="rowgroup" className="divide-y">
        {credentials.map((credential) => (
          <CredentialRow
            key={credential.id}
            credential={credential}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A grid rather than a <table> so each row can reflow on phones (value moves
 * under the key) while the value is still rendered only once.
 */
function gridCols(canEdit: boolean) {
  return canEdit
    ? "grid-cols-[minmax(0,1fr)_7.75rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_7.75rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_9rem_7.75rem]"
    : "grid-cols-[minmax(0,1fr)_3.75rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_3.75rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_9rem_3.75rem]";
}

function CredentialRow({
  credential,
  canEdit,
}: {
  credential: CredentialSummary;
  canEdit: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState<"reveal" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Re-mask as soon as the user navigates away, not only after REVEAL_MS.
  useResetOnHide(hide);

  function hide() {
    clearTimeout(hideTimer.current);
    setValue(null);
  }

  async function fetchValue(mode: "reveal" | "copy"): Promise<string> {
    const result = await revealCredential({ id: credential.id, mode });
    if (!result.ok) throw new Error(result.error);
    return result.data.value;
  }

  async function onToggle() {
    if (value !== null) return hide();
    setLoading("reveal");
    try {
      setValue(await fetchValue("reveal"));
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setValue(null), REVEAL_MS);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reveal value");
    } finally {
      setLoading(null);
    }
  }

  async function onCopy() {
    setLoading("copy");
    try {
      await copyAsync(() => fetchValue("copy"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(`Copied ${credential.key}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't copy value");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      role="row"
      className={cn(
        "grid items-start gap-x-4 gap-y-1.5 px-4 py-3 text-sm",
        gridCols(canEdit),
        value !== null && "bg-muted/40",
      )}
    >
      <div role="cell" className="min-w-0 self-center sm:self-start">
        <div className="font-mono font-medium break-all">{credential.key}</div>
        {credential.description && (
          <div className="mt-0.5 text-xs whitespace-pre-line text-muted-foreground">
            {credential.description}
          </div>
        )}
      </div>
      <div
        role="cell"
        className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto"
      >
        {value === null ? (
          <span
            className="font-mono text-muted-foreground select-none"
            aria-label="Hidden value"
          >
            {MASK}
          </span>
        ) : value === "" ? (
          <span className="text-xs text-muted-foreground italic">(empty)</span>
        ) : (
          <pre className="max-h-48 overflow-auto font-mono text-sm break-all whitespace-pre-wrap">
            {value}
          </pre>
        )}
      </div>
      <div role="cell" className="hidden text-xs text-muted-foreground md:block">
        <LocalTime value={credential.updatedAt} />
      </div>
      <div role="cell" className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            disabled={loading !== null}
            aria-label={value === null ? `Reveal ${credential.key}` : `Hide ${credential.key}`}
            title={value === null ? "Reveal" : "Hide"}
          >
            {loading === "reveal" ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : value === null ? (
              <Eye aria-hidden />
            ) : (
              <EyeOff aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCopy}
            disabled={loading !== null}
            aria-label={`Copy ${credential.key}`}
            title="Copy"
          >
            {loading === "copy" ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : copied ? (
              <Check aria-hidden />
            ) : (
              <Copy aria-hidden />
            )}
          </Button>
          {canEdit && (
            <>
              <CredentialFormDialog
                mode="edit"
                credential={credential}
                onSaved={hide}
              />
              <DeleteCredentialButton id={credential.id} credentialKey={credential.key} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
