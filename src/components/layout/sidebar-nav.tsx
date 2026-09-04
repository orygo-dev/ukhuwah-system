"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarNavGroup, SidebarNavItem } from "@/lib/constants";

type SidebarNavProps = {
  items?: SidebarNavItem[];
  groups?: SidebarNavGroup[];
  activePath?: string;
  variant?: "default" | "admin";
};

function isNavActive(item: SidebarNavItem, activePath: string) {
  const exactOnly =
    item.href === "/dashboard/tools" ||
    item.href === "/dashboard" ||
    item.href === "/admin" ||
    // Marketplace catalog must be exact — /dashboard/market/cart etc. are siblings, not children
    item.href === "/dashboard/market" ||
    item.href === "/school/market";
  if (exactOnly) return activePath === item.href;
  return activePath === item.href || activePath.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  activePath,
  variant,
  onWarmRoute,
}: {
  item: SidebarNavItem;
  activePath: string;
  variant: "default" | "admin";
  onWarmRoute: (href: string) => void;
}) {
  const hasChildren = !!item.children?.length;
  const childActive = item.children?.some((child) => isNavActive(child, activePath)) ?? false;
  const isActive = hasChildren ? childActive : isNavActive(item, activePath);
  const Icon = item.icon;

  if (hasChildren) {
    return (
      <NestedNavLink
        item={item}
        activePath={activePath}
        variant={variant}
        onWarmRoute={onWarmRoute}
        childActive={childActive}
      />
    );
  }

  return (
    <Link
      href={item.href}
      prefetch
      onMouseEnter={() => onWarmRoute(item.href)}
      onFocus={() => onWarmRoute(item.href)}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
        isActive
          ? variant === "admin"
            ? "bg-primary text-white shadow-sm shadow-primary/20"
            : "bg-primary text-primary-foreground shadow-sm"
          : variant === "admin"
            ? "text-slate-600 hover:bg-emerald-50 hover:text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function NestedNavLink({
  item,
  activePath,
  variant,
  onWarmRoute,
  childActive,
}: {
  item: SidebarNavItem;
  activePath: string;
  variant: "default" | "admin";
  onWarmRoute: (href: string) => void;
  childActive: boolean;
}) {
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => {
          onWarmRoute(item.href);
          item.children?.forEach((child) => onWarmRoute(child.href));
        }}
        onFocus={() => onWarmRoute(item.href)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all",
          childActive
            ? variant === "admin"
              ? "bg-primary text-white shadow-sm shadow-primary/20"
              : "bg-primary text-primary-foreground shadow-sm"
            : variant === "admin"
              ? "text-slate-600 hover:bg-emerald-50 hover:text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        aria-expanded={open}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="mt-1 space-y-0.5 border-l border-emerald-100 pl-3 ml-5">
          {item.children?.map((child) => {
            const ChildIcon = child.icon;
            const active = isNavActive(child, activePath);
            return (
              <Link
                key={child.href}
                href={child.href}
                prefetch
                onMouseEnter={() => onWarmRoute(child.href)}
                onFocus={() => onWarmRoute(child.href)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors",
                  active
                    ? "bg-emerald-50 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarNav({
  items,
  groups,
  activePath = "",
  variant = "default",
}: SidebarNavProps) {
  const router = useRouter();
  const warmedRoutes = useMemo(() => new Set<string>(), []);
  const warmRoute = (href: string) => {
    if (warmedRoutes.has(href)) return;
    warmedRoutes.add(href);
    router.prefetch(href);
  };

  if (groups?.length) {
    return (
      <nav className="flex flex-col gap-5 p-3">
        {groups.map((group) => (
          <div key={group.id}>
            <p
              className={cn(
                "mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider",
                variant === "admin"
                  ? "text-slate-400"
                  : "text-muted-foreground/70"
              )}
            >
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  activePath={activePath}
                  variant={variant}
                  onWarmRoute={warmRoute}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {(items ?? []).map((item) => (
        <NavLink
          key={item.href}
          item={item}
          activePath={activePath}
          variant={variant}
          onWarmRoute={warmRoute}
        />
      ))}
    </nav>
  );
}
