"use client";

import { RoleProvider } from "@/lib/context/role-context";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <RoleProvider>{children}</RoleProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
