"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CURRENT_ITERATION,
  ENGAGEMENT_NAV,
  type NavItem,
} from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface AppSidebarProps {
  engagementId?: string;
}

export function AppSidebar({ engagementId }: AppSidebarProps): React.ReactNode {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = engagementId
    ? ENGAGEMENT_NAV
    : ENGAGEMENT_NAV.filter((item) => item.id === "overview").map((item) => ({
        ...item,
        href: () => "/engagements",
        label: "Engagements",
      }));

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-3">
        {!collapsed ? (
          <Link href="/engagements" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Layers3 className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold leading-tight">
                Ontology-Teleology Studio
              </p>
              <p className="text-[10px] text-muted-foreground">OTS</p>
            </div>
          </Link>
        ) : (
          <Link
            href="/engagements"
            className="mx-auto flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <Layers3 className="size-4" />
          </Link>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.id}
            item={item}
            engagementId={engagementId}
            pathname={pathname}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          className={cn("w-full", !collapsed && "justify-start gap-2")}
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

function SidebarNavItem({
  item,
  engagementId,
  pathname,
  collapsed,
}: {
  item: NavItem | { id: string; label: string; href: () => string; icon: NavItem["icon"]; iteration?: number };
  engagementId?: string;
  pathname: string;
  collapsed: boolean;
}): React.ReactNode {
  const href = engagementId ? item.href(engagementId) : item.href("");
  const enabled =
    !("iteration" in item) ||
    !item.iteration ||
    item.iteration <= CURRENT_ITERATION;
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = item.icon;

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active &&
          "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
        !active && enabled && "hover:bg-sidebar-accent/60",
        !enabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </div>
  );

  if (!enabled) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <div>{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right">
          Available in iteration {item.iteration}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}
