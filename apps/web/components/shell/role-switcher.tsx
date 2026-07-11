"use client";

import { ChevronDown, LogIn, LogOut, ShieldCheck, UserCog, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole } from "@/lib/context/role-context";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RoleSwitcher(): React.ReactNode {
  const { role, setRole, session, signIn, signOut } = useRole();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
      >
        {session ? (
          <ShieldCheck className="size-4 text-emerald-500" />
        ) : role === "consultant" ? (
          <UserCog className="size-4" />
        ) : (
          <Users className="size-4" />
        )}
        <span className="hidden capitalize sm:inline">
          {session ? session.name : role}
        </span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {session ? (
          <>
            <DropdownMenuLabel>
              Signed in via SSO · {session.role}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuRadioGroup
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
            >
              <DropdownMenuLabel>Dev role switcher</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="consultant">
                Consultant
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="stakeholder">
                Stakeholder
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signIn()}>
              <LogIn className="size-4" />
              Sign in with SSO
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
