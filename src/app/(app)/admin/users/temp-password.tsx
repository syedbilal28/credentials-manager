"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";

/** Shows a one-time temporary password with a copy button. */
export function TempPassword({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Share this temporary password with <span className="font-medium text-foreground">{email}</span>{" "}
        through a secure channel. It is shown only once. They&apos;ll have to choose
        a new password when they sign in.
      </p>
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
        <code className="flex-1 px-1 font-mono text-base break-all select-all">{password}</code>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await copyText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
