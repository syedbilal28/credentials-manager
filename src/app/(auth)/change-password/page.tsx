import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password" };

export default function ChangePasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          You signed in with a temporary password. Set your own password to
          continue. It must be at least {MIN_PASSWORD_LENGTH} characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-56 w-full" />}>
          <Gate />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function Gate() {
  const user = await requireUser({ allowPendingPasswordChange: true });
  // Only reachable while a password change is pending.
  if (!user.mustChangePassword) redirect("/");
  return <ChangePasswordForm email={user.email} />;
}
