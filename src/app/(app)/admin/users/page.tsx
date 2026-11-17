import type { Metadata } from "next";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSuperuser } from "@/lib/auth/guards";
import { listAllGrants, listEnvironmentNames, listUsers } from "@/lib/queries";
import { CreateUserDialog } from "./create-user-dialog";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const actor = await requireSuperuser();
  const [users, environments, grants] = await Promise.all([
    listUsers(),
    listEnvironmentNames(),
    listAllGrants(),
  ]);

  const grantsByUser = new Map<string, string[]>();
  for (const g of grants) {
    grantsByUser.set(g.userId, [...(grantsByUser.get(g.userId) ?? []), g.environmentId]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Create accounts, reset passwords and choose which environments each
            user can see.
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Environments</TableHead>
              <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className={user.isActive ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="font-medium">
                    {user.name}
                    {user.id === actor.id && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>
                  {user.role === "superuser" ? (
                    <Badge>Superuser</Badge>
                  ) : (
                    <Badge variant="secondary">User</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {!user.isActive ? (
                    <Badge variant="outline">Deactivated</Badge>
                  ) : user.mustChangePassword ? (
                    <Badge variant="outline">Pending password change</Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {user.role === "superuser" ? (
                    <span className="text-muted-foreground">All</span>
                  ) : (
                    user.environmentCount
                  )}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {user.lastLoginAt ? <LocalTime value={user.lastLoginAt} /> : "Never"}
                </TableCell>
                <TableCell>
                  <UserActions
                    user={{
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      role: user.role,
                      isActive: user.isActive,
                    }}
                    isSelf={user.id === actor.id}
                    environments={environments}
                    grantedEnvironmentIds={grantsByUser.get(user.id) ?? []}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
