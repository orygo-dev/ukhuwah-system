"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  School,
  UserRound,
  Users,
  BrainCircuit,
  RadioTower,
  BookOpen,
  BellRing,
  ShieldCheck,
  FileStack,
  BadgeDollarSign,
  ShoppingBag,
  ShoppingCart,
  ClipboardList,
} from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { useAppDisplay } from "@/hooks/use-app-display";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

type SchoolAdminShellProps = {
  children: React.ReactNode;
  activePath?: string;
  accountName?: string | null;
  accountEmail?: string | null;
  schoolName?: string | null;
};

const COMMERCIAL_NAV_ITEMS = process.env.NEXT_PUBLIC_SCHOOL_COMMERCIALIZATION_ENABLED === "true"
  ? [
      { href: "/school/administration", label: "Administrasi", description: "Dokumen & jadwal", icon: FileStack },
      { href: "/school/subscription", label: "Paket Sekolah", description: "Seat & pemakaian", icon: BadgeDollarSign },
    ]
  : [];

// Items that must match exactly (siblings share the same prefix)
const EXACT_MATCH_HREFS = new Set(["/school/market", "/school/market/cart", "/school/market/orders"]);

function isSchoolNavActive(href: string, activePath: string) {
  if (href === "/school") return activePath === href;
  if (EXACT_MATCH_HREFS.has(href)) return activePath === href;
  return activePath === href || activePath.startsWith(href);
}

const NAV_ITEMS = [
  {
    href: "/school",
    label: "Ringkasan",
    description: "Kondisi sekolah",
    icon: LayoutDashboard,
  },
  {
    href: "/school/classes",
    label: "Kelas",
    description: "Roster & kelas",
    icon: School,
  },
  {
    href: "/school/teachers",
    label: "Guru",
    description: "Guru terhubung",
    icon: GraduationCap,
  },
  {
    href: "/school/pjj",
    label: "PJJ",
    description: "Kelas jarak jauh",
    icon: RadioTower,
  },
  {
    href: "/school/tka",
    label: "TKA",
    description: "Review bank sekolah",
    icon: BrainCircuit,
  },
  {
    href: "/school/zona-baca",
    label: "Zona Baca",
    description: "Koleksi & literasi",
    icon: BookOpen,
  },
  {
    href: "/school/market",
    label: "Toko Buku & ATK",
    description: "Marketplace",
    icon: ShoppingBag,
  },
  {
    href: "/school/market/cart",
    label: "Keranjang",
    description: "Item siap dibeli",
    icon: ShoppingCart,
  },
  {
    href: "/school/market/orders",
    label: "Riwayat Pesanan",
    description: "Status & unduh",
    icon: ClipboardList,
  },
  {
    href: "/school/content-review",
    label: "Mading & Zona Kreasi",
    description: "Review konten siswa",
    icon: ShieldCheck,
  },
  {
    href: "/school/students",
    label: "Siswa",
    description: "Akun & data siswa",
    icon: Users,
  },
  {
    href: "/school/siswa-online",
    label: "Siswa Online",
    description: "Status aktivitas siswa",
    icon: RadioTower,
  },
  {
    href: "/school/notifications",
    label: "Pemberitahuan",
    description: "Informasi sekolah",
    icon: BellRing,
  },
  ...COMMERCIAL_NAV_ITEMS,
];

export function SchoolAdminShell({
  children,
  activePath = "/school",
  accountName,
  accountEmail,
  schoolName,
}: SchoolAdminShellProps) {
  const { data: appDisplay } = useAppDisplay();
  const branding = appDisplay.branding;
  const activeItem =
    NAV_ITEMS.find((item) => isSchoolNavActive(item.href, activePath)) ?? NAV_ITEMS[0];

  const handleLogout = async () => {
    await signOut({ redirect: false, callbackUrl: "/" });
    window.location.assign("/");
  };

  return (
    <div className="min-h-screen bg-[#f4f8ff] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-emerald-100 bg-white/95 shadow-[14px_0_40px_rgba(15,76,129,0.06)] backdrop-blur-xl lg:flex">
        <div className="flex h-20 items-center border-b border-blue-50 px-5">
          <AppLogo
            href="/school"
            appName={branding.appName}
            logoUrl={branding.logoUrl}
            showName={false}
            imageClassName="h-11 w-auto max-w-[190px] object-contain"
            fallbackClassName="text-2xl font-black text-primary"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Admin Sekolah
          </p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isSchoolNavActive(item.href, activePath);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-colors",
                    active
                      ? "bg-primary text-white shadow-sm shadow-primary/20"
                      : "text-slate-600 hover:bg-emerald-50 hover:text-primary"
                  )}
                  >
                  <Icon className="h-4 w-4" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[11px] font-semibold",
                        active ? "text-white/70" : "text-slate-400"
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-60" />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-blue-50 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-600 transition-colors hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/[0.94] px-4 shadow-[0_10px_30px_rgba(15,76,129,0.06)] backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 lg:h-20">
            <div className="lg:hidden">
              <AppLogo
                href="/school"
                appName={branding.appName}
                logoUrl={branding.logoUrl}
                showName={false}
                imageClassName="h-9 w-auto max-w-[160px] object-contain"
                fallbackClassName="text-xl font-black text-primary"
              />
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600">
                Portal Sekolah
              </p>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-950">
                {activeItem.label} · {activeItem.description}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <div className="hidden min-w-0 items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-3 py-2 shadow-sm md:flex">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="max-w-[180px] truncate text-sm font-extrabold text-slate-950">
                    {accountName || "Admin Sekolah"}
                  </p>
                  <p className="max-w-[220px] truncate text-[11px] font-semibold text-slate-500">
                    {schoolName || accountEmail || "Sekolah belum terhubung"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                asChild
                className="hidden rounded-xl border-emerald-100 bg-white sm:inline-flex"
              >
                <Link href="/school/students">
                  <GraduationCap className="h-4 w-4" />
                  Siswa
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-red-600 hover:bg-red-50 lg:hidden"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-3 lg:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isSchoolNavActive(item.href, activePath);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-extrabold transition-colors",
                    active
                      ? "border-blue-600 bg-emerald-600 text-white"
                      : "border-emerald-100 bg-white text-slate-700"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
