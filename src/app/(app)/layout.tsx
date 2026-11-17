import { KeyRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { MainNav } from "@/components/main-nav";
import { UserMenu } from "@/components/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4" aria-hidden />
            <span className="hidden sm:inline">Credentials Manager</span>
          </Link>
          <Suspense fallback={<Skeleton className="h-6 w-48" />}>
            <Header />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

async function Header() {
  const user = await requireUser();
  return (
    <>
      <MainNav isSuperuser={user.role === "superuser"} />
      <div className="ml-auto">
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </div>
    </>
  );
}
