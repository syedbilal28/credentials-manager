"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Shows a timestamp in the viewer's time zone. The server render uses UTC; the
 * browser switches to local time after hydration (no hydration mismatch).
 */
export function LocalTime({
  value,
  withTime = true,
}: {
  value: Date | string | null;
  withTime?: boolean;
}) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!value) return <span className="text-muted-foreground">—</span>;

  const date = typeof value === "string" ? new Date(value) : value;
  const iso = date.toISOString();
  const text = isClient
    ? withTime
      ? date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : date.toLocaleDateString(undefined, { dateStyle: "medium" })
    : withTime
      ? `${iso.slice(0, 16).replace("T", " ")} UTC`
      : iso.slice(0, 10);

  return (
    <time dateTime={iso} title={iso}>
      {text}
    </time>
  );
}
