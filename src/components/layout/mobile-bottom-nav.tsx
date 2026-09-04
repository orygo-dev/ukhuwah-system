"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_BOTTOM_NAV } from "@/lib/constants";
import { isMobileNavActive } from "@/lib/mobile-nav";
import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  chatUnread?: number;
  onMenuOpen: () => void;
};

export function MobileBottomNav({ chatUnread = 0, onMenuOpen }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-emerald-100 bg-white/[0.97] shadow-[0_-10px_28px_rgba(15,76,129,0.1)] backdrop-blur-md lg:hidden"
      aria-label="Navigasi utama"
    >
      <div className="mx-auto flex h-[4.55rem] max-w-lg items-end justify-around px-1.5 pb-[env(safe-area-inset-bottom,0px)]">
        {MOBILE_BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = isMobileNavActive(pathname, item);
          const badge =
            item.badgeKey === "chat" && chatUnread > 0 ? chatUnread : 0;

          if (item.action === "menu") {
            return (
              <button
                key={item.id}
                type="button"
                onClick={onMenuOpen}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition-colors active:bg-emerald-50",
                  isActive ? "text-primary" : "text-slate-500"
                )}
              >
                <span
                  className={cn(
                    "relative grid h-8 w-8 place-items-center rounded-2xl transition-colors",
                    isActive && "bg-emerald-50"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold leading-none",
                    isActive && "font-semibold"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          if (item.isPrimary && item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-1"
              >
                <span
                  className={cn(
                    "relative flex h-[3.65rem] w-[3.65rem] -translate-y-3 items-center justify-center overflow-hidden rounded-[1.35rem] shadow-[0_16px_34px_rgba(37,99,235,0.32)] transition-transform active:scale-95",
                    isActive
                      ? "gradient-brand text-white ring-4 ring-primary/20"
                      : "gradient-brand text-white"
                  )}
                >
                  <span className="absolute inset-x-2 top-1 h-4 rounded-full bg-white/24 blur-sm" />
                  <span className="absolute -bottom-4 -right-3 h-9 w-9 rounded-full bg-cyan-300/35 blur-md" />
                  <Icon className="relative h-6 w-6 drop-shadow-sm" strokeWidth={2.45} />
                </span>
                <span
                  className={cn(
                    "-mt-1.5 text-[10px] font-extrabold leading-none",
                    isActive ? "text-primary" : "text-slate-500"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          if (!item.href) return null;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition-colors active:bg-emerald-50",
                isActive ? "text-primary" : "text-slate-500"
              )}
            >
              <span
                className={cn(
                  "relative grid h-8 w-8 place-items-center rounded-2xl transition-colors",
                  isActive && "bg-emerald-50"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold leading-none",
                  isActive && "font-semibold"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
