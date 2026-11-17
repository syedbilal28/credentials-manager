import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { listEnvironmentsForUser } from "@/lib/queries";
import { CreateEnvironmentDialog } from "./create-environment-dialog";
import { EnvironmentList } from "./environment-list";

export const metadata: Metadata = { title: "Environments" };

export default async function EnvironmentsPage() {
  const user = await requireUser();
  const environments = await listEnvironmentsForUser(user);
  const isSuperuser = user.role === "superuser";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Environments</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperuser
              ? "All environments. You can see and manage every one."
              : "Environments you've been given access to."}
          </p>
        </div>
        {isSuperuser && <CreateEnvironmentDialog />}
      </div>
      <EnvironmentList environments={environments} isSuperuser={isSuperuser} />
    </div>
  );
}
