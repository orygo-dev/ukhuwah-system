"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Coins,
  Crown,
  LogOut,
  Shield,
  X,
} from "lucide-react";
import { DASHBOARD_NAV_GROUPS, MOBILE_BOTTOM_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { clearDashboardPopupSession } from "@/components/dashboard/dashboard-popup-ad";

type MobileMenuSheetProps = {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string; credits: number };
  chatUnread?: number;
  isSuperAdmin?: boolean;
  branding?: { appName: string; logoUrl: string };
};

const BOTTOM_HREFS = new Set(
  MOBILE_BOTTOM_NAV.filter((i) => i.href).map((i) => i.href!)
);

export function MobileMenuSheet({
  open,
  onClose,
  user,
  chatUnread = 0,
  isSuperAdmin = false,
  branding,
}: MobileMenuSheetProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" &&
      href !== "/dashboard/tools" &&
      pathname.startsWith(`${href}/`));
  const handleLogout = async () => {
    clearDashboardPopupSession();
    await signOut({ redirect: false, callbackUrl: "/" });
    window.location.assign("/");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] max-h-[88vh] overflow-hidden rounded-t-[1.75rem] border-t border-emerald-100 bg-white shadow-[0_-24px_60px_rgba(15,23,42,0.18)] lg:hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Menu aplikasi"
      >
        <div className="flex justify-center pt-2">
          <span className="h-1.5 w-11 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-slate-950">Menu</p>
            <p className="text-xs font-semibold text-slate-500">
              Semua fitur {branding?.appName || "Navalogi"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-slate-900"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-4 rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,#eff6ff,#ffffff)] p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600 text-sm font-extrabold text-white">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-slate-950">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 ring-1 ring-blue-100">
              Guru
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href="/dashboard/topup"
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-blue-100"
            >
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-700">{user.credits} kredit</span>
            </Link>
            <Link
              href="/dashboard/billing"
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-blue-100"
            >
              <Crown className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700">Paket member</span>
            </Link>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>

        <div className="max-h-[calc(88vh-10.75rem)] overflow-y-auto overscroll-contain px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {DASHBOARD_NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !BOTTOM_HREFS.has(item.href));
            if (!items.length) return null;

            return (
              <div key={group.id} className="mb-5">
                <p className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const badge =
                      item.href === "/dashboard/pesan" && chatUnread > 0
                        ? chatUnread
                        : 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "relative flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-transparent px-1 py-2.5 text-center transition-colors active:bg-emerald-50",
                          active && "border-emerald-100 bg-emerald-50 text-primary"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-2xl ring-1",
                            active
                              ? "bg-primary text-primary-foreground ring-primary/20"
                              : "bg-slate-50 text-slate-700 ring-slate-100"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="line-clamp-2 text-[10px] font-extrabold leading-tight text-slate-700">
                          {item.label}
                        </span>
                        {badge > 0 && (
                          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
                {group.id === "ai-generator" && (
                  <div className="mt-3 space-y-3">
                    {items
                      .filter((item) => item.children?.length)
                      .map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={`${item.href}-children`}
                            className="rounded-2xl border border-emerald-100 bg-emerald-50/55 p-3"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-blue-100">
                                <Icon className="h-4 w-4" />
                              </span>
                              <p className="text-xs font-extrabold text-slate-800">
                                {item.label}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {item.children?.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={onClose}
                                  className="rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 ring-1 ring-blue-100 active:bg-emerald-100"
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}

          {isSuperAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className="mx-2 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
            >
              <Shield className="h-4 w-4" />
              Panel Super Admin
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
