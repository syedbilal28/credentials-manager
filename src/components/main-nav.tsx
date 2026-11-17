"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainNav({ isSuperuser }: { isSuperuser: boolean }) {
  const pathname = usePathname();
  const links = [
    {
      href: "/",
      label: "Environments",
      active: pathname === "/" || pathname.startsWith("/environments"),
    },
    ...(isSuperuser
      ? [
          {
            href: "/admin/users",
            label: "Users",
            active: pathname.startsWith("/admin/users"),
          },
          {
            href: "/admin/audit",
            label: "Audit log",
            active: pathname.startsWith("/admin/audit"),
          },
        ]
      : []),
  ];

  return (
    <nav className="flex min-w-0 items-center gap-0.5 text-sm sm:gap-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.active ? "page" : undefined}
          className={cn(
            "rounded-md px-2 py-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:px-3",
            link.active && "bg-muted font-medium text-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
