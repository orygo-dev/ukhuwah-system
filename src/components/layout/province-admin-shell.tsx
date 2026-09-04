"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BookOpenCheck,
  Library,
  BrainCircuit,
  BellRing,
  Building2,
  CalendarCheck2,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  RadioTower,
  School,
  UserCheck,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppDisplay } from "@/hooks/use-app-display";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

type ProvinceAdminShellProps = {
  children: React.ReactNode;
  activePath?: string;
  accountName?: string | null;
  accountEmail?: string | null;
};

type ProvinceNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type ProvinceNavGroup = {
  id: string;
  label: string;
  items: ProvinceNavItem[];
};

const PROVINCE_NAV_GROUPS: ProvinceNavGroup[] = [
  {
    id: "overview",
    label: "Ikhtisar",
    items: [
      { href: "/province", label: "Ringkasan", description: "Kondisi provinsi", icon: LayoutDashboard },
    ],
  },
  {
    id: "education-data",
    label: "Data Pendidikan",
    items: [
      { href: "/province/regions", label: "Wilayah", description: "Kabupaten dan kota", icon: MapPinned },
      { href: "/province/schools", label: "Sekolah", description: "SMA dan SMK", icon: School },
    ],
  },
  {
    id: "indicators",
    label: "Indikator",
    items: [
      { href: "/province/attendance", label: "Kehadiran Siswa", description: "Hadir, izin, sakit, alpha", icon: CalendarCheck2 },
      { href: "/province/literacy", label: "Literasi Siswa", description: "Capaian dan partisipasi", icon: BookOpenCheck },
      { href: "/province/daily-quiz", label: "Quiz Harian", description: "Partisipasi nasional", icon: ClipboardList },
      { href: "/province/content", label: "Zona Kreasi & Mading", description: "Konten dan review", icon: Clapperboard },
      { href: "/province/diversity", label: "Kebhinnekaan", description: "Partisipasi inklusif", icon: UsersRound },
      { href: "/province/teachers", label: "Keaktifan Guru", description: "Aktivitas pembelajaran", icon: UserCheck },
    ],
  },
  {
    id: "programs",
    label: "Program",
    items: [
      { href: "/province/pjj", label: "Pembelajaran Jarak Jauh", description: "Program dan statistik", icon: RadioTower },
      { href: "/province/tka", label: "Tes Kemampuan Akademik", description: "Paket dan capaian", icon: BrainCircuit },
      { href: "/province/zona-baca", label: "Zona Baca", description: "Perpustakaan digital", icon: Library },
    ],
  },
  {
    id: "communication",
    label: "Komunikasi",
    items: [
      { href: "/province/notifications", label: "Pemberitahuan", description: "Informasi resmi", icon: BellRing },
    ],
  },
];

const ALL_NAV_ITEMS = PROVINCE_NAV_GROUPS.flatMap((group) => group.items);

function isItemActive(href: string, pathname: string) {
  return href === "/province" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function ProvinceNavigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-3 px-3 py-3" aria-label="Navigasi Dinas Pendidikan">
      {PROVINCE_NAV_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
                  active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-emerald-600 transition-opacity",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-30"
                  )}
                />
                <Icon className={cn("size-5 shrink-0", active ? "text-emerald-600" : "text-slate-500")} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[13px] font-extrabold leading-5">{item.label}</span>
                <ChevronRight className={cn("size-4 shrink-0 transition-transform", active ? "text-emerald-500" : "text-slate-300 group-hover:translate-x-0.5")} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function ProvinceAdminShell({
  children,
  activePath = "/province",
  accountName,
  accountEmail,
}: ProvinceAdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname() || activePath;
  const { data: appDisplay } = useAppDisplay();
  const branding = appDisplay.branding;
  const activeItem = ALL_NAV_ITEMS.find((item) => isItemActive(item.href, pathname)) ?? ALL_NAV_ITEMS[0];

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut({ redirect: false, callbackUrl: "/" });
    window.location.assign("/");
  };

  const accountCard = (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-blue-100">
        <UserRound className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-slate-950">{accountName || "Dinas Provinsi"}</p>
        <p className="truncate text-[11px] font-semibold text-slate-500">{accountEmail || "Monitoring pendidikan"}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-slate-950">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Tutup navigasi"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col border-r border-slate-200 bg-white shadow-[12px_0_40px_rgba(15,23,42,0.04)] transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
          <AppLogo
            href="/province"
            appName={branding.appName}
            logoUrl={branding.logoUrl}
            showName={false}
            imageClassName="h-10 w-auto max-w-[190px] object-contain"
            fallbackClassName="text-2xl font-black text-primary"
          />
          <Button variant="ghost" size="icon" className="rounded-full lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu">
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProvinceNavigation pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
        </div>

        <div className="border-t border-slate-100 p-3">
          {accountCard}
          <Separator className="my-2" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-extrabold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="lg:pl-[286px]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 lg:h-20 lg:px-8">
            <Button variant="ghost" size="icon" className="rounded-full lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Buka menu">
              <Menu aria-hidden="true" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-600 sm:text-xs">Portal Dinas Pendidikan</p>
              <p className="mt-0.5 truncate text-sm font-black text-slate-950 sm:text-base">
                {activeItem.label} <span className="font-semibold text-slate-400">· {activeItem.description}</span>
              </p>
            </div>
            <NotificationBell />
            <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
              <div className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <Building2 className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="max-w-44 truncate text-sm font-extrabold text-slate-950">{accountName || "Dinas Provinsi"}</p>
                <p className="max-w-56 truncate text-[11px] font-semibold text-slate-500">{accountEmail || "Monitoring pendidikan"}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
