import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { requireEnvironmentAccess } from "@/lib/auth/guards";
import { listCredentials, listEnvironmentAccess } from "@/lib/queries";
import { AccessPanel } from "./access-panel";
import { CredentialFormDialog } from "./credential-form-dialog";
import { CredentialsTable } from "./credentials-table";
import { EnvironmentActions } from "./environment-actions";
import { ImportEnvDialog } from "./import-env-dialog";

// Generic title on purpose: names of environments shouldn't leak via metadata.
export const metadata: Metadata = { title: "Environment" };

export default async function EnvironmentPage(
  props: PageProps<"/environments/[id]">,
) {
  const { id } = await props.params;
  const { user, environment } = await requireEnvironmentAccess(id);
  const isSuperuser = user.role === "superuser";

  const [credentials, access] = await Promise.all([
    listCredentials(environment.id),
    isSuperuser ? listEnvironmentAccess(environment.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {environment.name}
            </h1>
            {!isSuperuser && <Badge variant="secondary">Read only</Badge>}
          </div>
          {environment.description && (
            <p className="max-w-2xl text-sm whitespace-pre-line text-muted-foreground">
              {environment.description}
            </p>
          )}
        </div>
        {isSuperuser && (
          <EnvironmentActions
            environment={{
              id: environment.id,
              name: environment.name,
              description: environment.description,
            }}
          />
        )}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Credentials{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({credentials.length})
            </span>
          </h2>
          {isSuperuser && (
            <div className="flex gap-2">
              <ImportEnvDialog
                environmentId={environment.id}
                existingKeys={credentials.map((c) => c.key)}
              />
              <CredentialFormDialog
                mode="create"
                environmentId={environment.id}
              />
            </div>
          )}
        </div>
        <CredentialsTable credentials={credentials} canEdit={isSuperuser} />
      </section>

      {isSuperuser && (
        <AccessPanel environmentId={environment.id} users={access} />
      )}
    </div>
  );
}
