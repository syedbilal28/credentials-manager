"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/sign-out";

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: "superuser" | "user";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1" aria-label={`Account: ${name}`}>
          <UserRound className="sm:hidden" aria-hidden />
          <span className="hidden max-w-40 truncate sm:inline">{name}</span>
          <ChevronDown className="hidden sm:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <div className="truncate font-medium text-foreground">{name}</div>
          <div className="truncate text-xs font-normal">{email}</div>
          {role === "superuser" && <Badge variant="secondary">Superuser</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
