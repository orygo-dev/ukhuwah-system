"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  ChevronRight,
  LogOut,
  Menu,
  Search,
  Shield,
  X,
} from "lucide-react";
import { ADMIN_NAV_GROUPS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppLogo } from "@/components/branding/app-logo";
import { useAppDisplay } from "@/hooks/use-app-display";
import { NotificationBell } from "@/components/notifications/notification-bell";

type AdminShellProps = {
  children: React.ReactNode;
  activePath?: string;
};

export function AdminShell({
  children,
  activePath = "/admin",
}: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: appDisplay } = useAppDisplay();
  const branding = appDisplay.branding;
  const handleLogout = async () => {
    await signOut({ redirect: false, callbackUrl: "/" });
    window.location.assign("/");
  };

  return (
    <div className="min-h-screen bg-[#edf2f8] text-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white/95 text-slate-900 shadow-[12px_0_40px_rgba(15,23,42,0.05)] backdrop-blur-xl transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
          <AppLogo
            href="/admin"
            appName={branding.appName}
            logoUrl={branding.logoUrl}
            showName={false}
            imageClassName="h-11 w-auto max-w-[190px] object-contain"
            fallbackClassName="text-2xl font-black text-primary"
          />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav
            groups={ADMIN_NAV_GROUPS}
            activePath={activePath}
            variant="admin"
          />
        </div>

        <div className="space-y-2 border-t border-slate-100 p-4">
          <Link
            href="/"
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-emerald-100 hover:bg-emerald-50 hover:text-primary"
          >
            <span className="inline-flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Lihat Landing Page
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:border-red-200 hover:bg-red-100"
          >
            <span className="inline-flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/92 px-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl lg:px-8">
          <div className="flex h-20 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Cari pengaturan, paket, pengguna, gateway..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-200 focus:bg-white"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Badge variant="secondary" className="hidden h-9 gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 font-bold text-primary lg:inline-flex">
              <Shield className="h-3.5 w-3.5" />
              Super Admin
            </Badge>
            <NotificationBell />
          </div>
          </div>
        </header>

        <main className="admin-surface p-4 lg:p-8">
          <div className="mx-auto max-w-7xl rounded-[28px] border border-white/70 bg-white/35 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] lg:p-3">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
