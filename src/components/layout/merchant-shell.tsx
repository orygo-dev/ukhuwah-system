"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { useAppDisplay } from "@/hooks/use-app-display";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/merchant", label: "Beranda", icon: LayoutDashboard },
  { href: "/merchant/store", label: "Toko", icon: Store },
  { href: "/merchant/products", label: "Produk", icon: Package },
  { href: "/merchant/orders", label: "Pesanan", icon: ShoppingBag },
];

export function MerchantShell({
  children,
  activePath,
  storeName,
}: {
  children: React.ReactNode;
  activePath?: string;
  storeName?: string | null;
}) {
  const pathname = usePathname();
  const currentPath = activePath || pathname || "/merchant";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: appDisplay } = useAppDisplay();
  const branding = appDisplay.branding;

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
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white/95 shadow-[12px_0_40px_rgba(15,23,42,0.05)] backdrop-blur-xl transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
          <AppLogo
            href="/merchant"
            appName={branding.appName}
            logoUrl={branding.logoUrl}
            showName={false}
            imageClassName="h-11 w-auto max-w-[190px] object-contain"
            fallbackClassName="text-2xl font-black text-primary"
          />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/merchant"
                ? currentPath === "/merchant"
                : currentPath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold",
                  active
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-emerald-50 hover:text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
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
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/92 px-4 backdrop-blur-xl lg:px-8">
          <div className="flex h-20 items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                Portal Merchant
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {storeName || "Lengkapi data toko"}
              </p>
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
