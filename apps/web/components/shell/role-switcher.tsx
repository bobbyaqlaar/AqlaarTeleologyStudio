"use client";

import { ChevronDown, UserCog, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  const { role, setRole } = useRole();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
      >
        {role === "consultant" ? (
          <UserCog className="size-4" />
        ) : (
          <Users className="size-4" />
        )}
        <span className="hidden capitalize sm:inline">{role}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Dev role switcher</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={role}
          onValueChange={(value) => setRole(value as UserRole)}
        >
          <DropdownMenuRadioItem value="consultant">
            Consultant
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="stakeholder">
            Stakeholder
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
