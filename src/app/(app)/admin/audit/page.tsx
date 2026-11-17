import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { isUuid, requireSuperuser } from "@/lib/auth/guards";
import {
  AUDIT_PAGE_SIZE,
  listAuditActors,
  listAuditLogs,
  listEnvironmentNames,
  type AuditFilters,
} from "@/lib/queries";

export const metadata: Metadata = { title: "Audit log" };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireSuperuser();
  const params = await props.searchParams;

  // Ignore malformed filter values instead of erroring.
  const filters: AuditFilters = {
    actorId: isUuid(one(params.actor) ?? "") ? one(params.actor) : undefined,
    environmentId: isUuid(one(params.env) ?? "") ? one(params.env) : undefined,
    action: (AUDIT_ACTIONS as readonly string[]).includes(one(params.action) ?? "")
      ? one(params.action)
      : undefined,
    from: DATE_PATTERN.test(one(params.from) ?? "") ? one(params.from) : undefined,
    to: DATE_PATTERN.test(one(params.to) ?? "") ? one(params.to) : undefined,
  };
  const page = Math.max(1, Math.min(10_000, Number(one(params.page)) || 1));

  const [{ rows, total }, actors, environments] = await Promise.all([
    listAuditLogs(filters, page),
    listAuditActors(),
    listEnvironmentNames(),
  ]);
  const envNames = new Map(environments.map((e) => [e.id, e.name]));
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (filters.actorId) q.set("actor", filters.actorId);
    if (filters.environmentId) q.set("env", filters.environmentId);
    if (filters.action) q.set("action", filters.action);
    if (filters.from) q.set("from", filters.from);
    if (filters.to) q.set("to", filters.to);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Sign-ins, every reveal and copy of a credential, and every change.
        </p>
      </div>

      <form
        method="get"
        action="/admin/audit"
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <Field label="User" htmlFor="f-actor" className="lg:col-span-2">
          <select id="f-actor" name="actor" defaultValue={filters.actorId ?? ""} className={selectClass}>
            <option value="">All users</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Environment" htmlFor="f-env" className="lg:col-span-2">
          <select id="f-env" name="env" defaultValue={filters.environmentId ?? ""} className={selectClass}>
            <option value="">All environments</option>
            {environments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Action" htmlFor="f-action" className="lg:col-span-2">
          <select id="f-action" name="action" defaultValue={filters.action ?? ""} className={selectClass}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From (UTC)" htmlFor="f-from" className="lg:col-span-2">
          <Input id="f-from" name="from" type="date" defaultValue={filters.from} />
        </Field>
        <Field label="To (UTC)" htmlFor="f-to" className="lg:col-span-2">
          <Input id="f-to" name="to" type="date" defaultValue={filters.to} />
        </Field>
        <div className="flex items-end gap-2 lg:col-span-2">
          <Button type="submit">Apply filters</Button>
          <Button variant="ghost" asChild>
            <Link href="/admin/audit">Clear</Link>
          </Button>
        </div>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Time</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="hidden lg:table-cell">Details</TableHead>
              <TableHead className="hidden xl:table-cell">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No entries match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    <LocalTime value={row.createdAt} />
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm">
                    {row.actorEmail ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(row.action)}>{row.action}</Badge>
                  </TableCell>
                  <TableCell className="max-w-64 text-sm whitespace-normal">
                    <span className="break-all">{row.targetLabel ?? "—"}</span>
                    {row.environmentId &&
                      !envNames.has(row.environmentId) &&
                      row.action !== "environment.deleted" && (
                        <span className="ml-1 text-xs text-muted-foreground">(deleted)</span>
                      )}
                  </TableCell>
                  <TableCell className="hidden max-w-72 text-xs whitespace-normal text-muted-foreground lg:table-cell">
                    {describeMetadata(row.metadata)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground xl:table-cell">
                    {row.ip ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} {total === 1 ? "entry" : "entries"}
          {pageCount > 1 && ` · page ${page} of ${pageCount}`}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(page - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          {page < pageCount ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function actionVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action === "credential.revealed" || action === "credential.copied") return "default";
  if (action.endsWith(".deleted") || action === "user.deactivated" || action === "access.revoked") {
    return "destructive";
  }
  if (action.startsWith("login.failed") || action === "login.throttled") return "destructive";
  if (action.startsWith("login") || action === "logout") return "outline";
  return "secondary";
}

function describeMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        const shown = value.slice(0, 5).join(", ");
        parts.push(`${key}: ${shown}${value.length > 5 ? ` +${value.length - 5} more` : ""}`);
      }
    } else if (typeof value === "boolean") {
      if (value) parts.push(key);
    } else if (value !== null && value !== undefined) {
      parts.push(`${key}: ${String(value)}`);
    }
  }
  return parts.join(" · ");
}
