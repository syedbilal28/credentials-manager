"use client";

import { ChevronRight, Search, Server } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LocalTime } from "@/components/local-time";
import { Input } from "@/components/ui/input";

type EnvironmentSummary = {
  id: string;
  name: string;
  description: string | null;
  credentialCount: number;
  updatedAt: Date;
};

export function EnvironmentList({
  environments,
  isSuperuser,
}: {
  environments: EnvironmentSummary[];
  isSuperuser: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? environments.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q),
      )
    : environments;

  if (environments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Server className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-medium">No environments yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuperuser
            ? "Create your first environment to start adding credentials."
            : "You haven't been given access to any environments. Ask a superuser."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search environments"
          aria-label="Search environments"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No environments match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {filtered.map((env) => (
            <li key={env.id}>
              <Link
                href={`/environments/${env.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{env.name}</div>
                  {env.description && (
                    <div className="truncate text-sm text-muted-foreground">
                      {env.description}
                    </div>
                  )}
                </div>
                <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                  <div>
                    {env.credentialCount}{" "}
                    {env.credentialCount === 1 ? "credential" : "credentials"}
                  </div>
                  <div>
                    Updated <LocalTime value={env.updatedAt} withTime={false} />
                  </div>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
