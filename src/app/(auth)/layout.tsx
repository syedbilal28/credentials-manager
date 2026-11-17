import { KeyRound } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
          <KeyRound className="size-5" aria-hidden />
          Credentials Manager
        </div>
        {children}
      </div>
    </main>
  );
}
