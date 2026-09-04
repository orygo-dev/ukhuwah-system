"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ChevronDown,
  Coins,
  Crown,
  KeyRound,
  LogOut,
  Search,
  Settings,
  Shield,
  UserRound,
} from "lucide-react";
import { DASHBOARD_NAV_GROUPS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/branding/app-logo";
import {
  clearDashboardPopupSession,
  DashboardPopupAd,
} from "@/components/dashboard/dashboard-popup-ad";
import { useAppDisplay } from "@/hooks/use-app-display";
import { SidebarNav } from "./sidebar-nav";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileDashboardHeader } from "./mobile-dashboard-header";
import { MobileMenuSheet } from "./mobile-menu-sheet";
import { Badge } from "@/components/ui/badge";
import { useChatUnread } from "@/hooks/use-chat-unread";
import { NotificationBell } from "@/components/notifications/notification-bell";

type DashboardShellProps = {
  children: React.ReactNode;
  activePath?: string;
  user?: {
    name: string;
    email: string;
    credits: number;
    avatarUrl?: string | null;
    membershipPlan?: {
      name: string;
      slug: string;
      expiresAt?: string | null;
    } | null;
  };
};

type LatestAccount = {
  name?: string | null;
  avatarUrl?: string | null;
  creditsRemaining?: number | null;
  plan?: {
    name: string;
    slug: string;
    expiresAt?: string | null;
  } | null;
};

export function DashboardShell({
  children,
  activePath = "/dashboard",
  user = {
    name: "Bu Sinta",
    email: "sinta@sekolah.sch.id",
    credits: 42,
    avatarUrl: null,
    membershipPlan: null,
  },
}: DashboardShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const [latestAccount, setLatestAccount] = useState<LatestAccount | null>(null);
  const sessionUserId = session?.user?.id;
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const chatUnread = useChatUnread();
  const { data: appDisplay } = useAppDisplay();
  const branding = appDisplay.branding;

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sessionUserId) {
      setLatestAccount(null);
      return;
    }

    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setLatestAccount(data?.account ?? null);
      })
      .catch(() => {
        if (!cancelled) setLatestAccount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, sessionUserId]);

  const displayUser = {
    name: latestAccount?.name || session?.user?.name || user.name,
    email: session?.user?.email || user.email,
    credits:
      latestAccount?.creditsRemaining ?? user.credits ?? session?.user?.creditsRemaining ?? 0,
    avatarUrl: latestAccount?.avatarUrl ?? user.avatarUrl ?? session?.user?.avatarUrl ?? null,
    membershipPlan: latestAccount?.plan ?? user.membershipPlan ?? session?.user?.membershipPlan ?? null,
  };
  const membershipName = displayUser.membershipPlan?.name ?? "Free";
  const isPaidMember =
    !!displayUser.membershipPlan?.slug && displayUser.membershipPlan.slug !== "free";

  const handleLogout = async () => {
    clearDashboardPopupSession();
    await signOut({ redirect: false, callbackUrl: "/" });
    window.location.assign("/");
  };

  const navGroups = DASHBOARD_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.href === "/dashboard/pesan" ? { ...item, badge: chatUnread } : item
    ),
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — desktop only */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center border-b px-4">
          <AppLogo
            href="/dashboard"
            appName={branding.appName}
            logoUrl={branding.logoUrl}
            showName={false}
            imageClassName="h-9 w-auto max-w-[170px] object-contain"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav groups={navGroups} activePath={activePath} />
          {isSuperAdmin && (
            <div className="border-t px-3 pt-3">
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800"
              >
                <Shield className="h-4 w-4 shrink-0" />
                Panel Super Admin
              </Link>
            </div>
          )}
        </div>

        <div className="h-4 border-t" />
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <MobileDashboardHeader
          appName={branding.appName}
          logoUrl={branding.logoUrl}
        />

        {/* Desktop header */}
        <header className="sticky top-0 z-30 hidden h-20 border-b bg-card/90 px-8 backdrop-blur-md lg:block">
          <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-[minmax(0,1fr)_390px] items-center gap-5">
            <form action="/dashboard/tools" className="relative max-w-3xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                type="search"
                placeholder="Cari menu, kelas, siswa, atau dokumen..."
                className="h-12 w-full rounded-xl border border-emerald-100 bg-background pl-12 pr-4 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </form>

            <div className="flex items-center justify-end gap-3">
              <Badge variant="default" className="h-10 gap-2 rounded-xl bg-primary px-3.5 text-white shadow-sm shadow-primary/20 hover:bg-primary">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15">
                  <Coins className="h-3.5 w-3.5" />
                </span>
                {displayUser.credits} kredit
              </Badge>

              <NotificationBell />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-secondary"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                >
                  <div className="relative grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-primary ring-2 ring-white">
                    {isSuperAdmin ? (
                      <Shield className="h-5 w-5" />
                    ) : displayUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displayUser.avatarUrl}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      displayUser.name.charAt(0)
                    )}
                    {!isSuperAdmin && displayUser.membershipPlan ? (
                      <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-emerald-600 text-white">
                        <Crown className="h-3 w-3" />
                      </span>
                    ) : null}
                  </div>
                  <div className="hidden min-w-0 text-left text-sm xl:block">
                    <p className="max-w-28 truncate font-bold leading-4 text-slate-950">
                      {displayUser.name}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 max-w-28 truncate text-xs font-bold leading-4",
                        displayUser.membershipPlan && !isSuperAdmin
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      )}
                    >
                      {isSuperAdmin ? "Admin" : membershipName}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      profileOpen && "rotate-180"
                    )}
                  />
                </button>

                {profileOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.16)]"
                  >
                    <div className="border-b border-blue-50 bg-emerald-50/60 p-4">
                      <p className="truncate text-sm font-extrabold text-slate-950">
                        {displayUser.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {displayUser.email}
                      </p>
                      <span
                        className={cn(
                          "mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                          isPaidMember
                            ? "border-emerald-200 bg-white text-emerald-700"
                            : "border-slate-200 bg-white text-slate-600"
                        )}
                      >
                        <Crown className="h-3.5 w-3.5" />
                        {membershipName}
                      </span>
                    </div>
                    <div className="p-2">
                      <Link
                        href="/dashboard/profil"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-primary"
                        role="menuitem"
                      >
                        <UserRound className="h-4 w-4" />
                        Profil Guru
                      </Link>
                      <Link
                        href="/dashboard/billing"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-primary"
                        role="menuitem"
                      >
                        <Crown className="h-4 w-4" />
                        Jenis Keanggotaan
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-primary"
                        role="menuitem"
                      >
                        <Settings className="h-4 w-4" />
                        Pengaturan
                      </Link>
                      <Link
                        href="/dashboard/settings#reset-password"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-primary"
                        role="menuitem"
                      >
                        <KeyRound className="h-4 w-4" />
                        Reset Password
                      </Link>
                      <div className="my-2 border-t border-blue-50" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50"
                        role="menuitem"
                      >
                        <LogOut className="h-4 w-4" />
                        Keluar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main
          className={cn(
            "bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_42%,#f8fbff_100%)] p-3 sm:p-4 lg:bg-background lg:p-8",
            "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8"
          )}
        >
          {children}
        </main>
      </div>

      <MobileBottomNav
        chatUnread={chatUnread}
        onMenuOpen={() => setMenuOpen(true)}
      />

      <MobileMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={displayUser}
        chatUnread={chatUnread}
        isSuperAdmin={isSuperAdmin}
        branding={branding}
      />

      <DashboardPopupAd
        enabled={appDisplay.popup.enabled}
        revision={appDisplay.popup.revision}
        slides={appDisplay.popup.slides}
      />
    </div>
  );
}
