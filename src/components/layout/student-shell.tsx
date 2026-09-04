"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BookOpenCheck,
  BookOpen,
  CalendarCheck2,
  Clapperboard,
  ClipboardList,
  FileQuestion,
  Home,
  LogOut,
  Newspaper,
  ShieldCheck,
  BrainCircuit,
  RadioTower,
  UserRoundCheck,
  BellRing,
} from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppDisplay } from "@/hooks/use-app-display";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

type StudentShellProps = {
  children: React.ReactNode;
};

export function StudentShell({ children }: StudentShellProps) {
  const { data: appDisplay } = useAppDisplay();
  const branding = appDisplay.branding;
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ redirect: false, callbackUrl: "/" });
    window.location.assign("/");
  };

  const navItems = [
    { href: "/student", label: "Beranda", icon: Home, exact: true },
    { href: "/student/pjj", label: "PJJ", icon: RadioTower },
    { href: "/student/tugas", label: "Tugas", icon: ClipboardList },
    { href: "/student/quiz", label: "Quiz Harian", icon: FileQuestion },
    { href: "/student/exam", label: "Ujian", icon: ShieldCheck },
    { href: "/student/tka", label: "TKA", icon: BrainCircuit },
    { href: "/student/zona-baca", label: "Zona Baca", icon: BookOpen },
    { href: "/student/mading", label: "Mading", icon: Newspaper },
    { href: "/student/spotlight", label: "Zona Kreasi", icon: Clapperboard },
    { href: "/student/nilai", label: "Nilai", icon: BookOpenCheck },
    { href: "/student/absensi", label: "Absensi", icon: CalendarCheck2 },
    { href: "/student/notifications", label: "Pemberitahuan", icon: BellRing },
  ];
  const bottomItems = [
    navItems.find((item) => item.href === "/student")!,
    navItems.find((item) => item.href === "/student/pjj")!,
    navItems.find((item) => item.href === "/student/tugas")!,
    navItems.find((item) => item.href === "/student/absensi")!,
    navItems.find((item) => item.href === "/student/nilai")!,
  ];
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-[#f3f8ff] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/[0.96] shadow-[0_10px_30px_rgba(15,76,129,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 lg:h-20 lg:px-6">
          <AppLogo
            href="/student"
            appName={branding.appName}
            logoUrl={branding.logoUrl}
            showName={false}
            imageClassName="h-10 w-auto max-w-[170px] object-contain"
            fallbackClassName="text-2xl font-black text-primary"
          />
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.slice(0, 7).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold transition",
                    active
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                      : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-red-100 bg-white text-red-600 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 lg:px-6 lg:pb-8 lg:pt-8">
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-[0_12px_32px_rgba(15,76,129,0.05)]">
          <ShieldCheck className="h-4 w-4" />
          Portal siswa menampilkan aktivitas kelas, tugas, quiz, ujian, simulasi TKA,
          mading, Zona Kreasi, absensi, dan nilai dari guru/sekolah.
        </div>
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-100 bg-white/[0.96] px-3 pb-3 pt-2 shadow-[0_-14px_34px_rgba(15,76,129,0.08)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, "exact" in item ? item.exact : false);
            const primary = item.label === "Zona Kreasi";
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-extrabold transition",
                  active
                    ? "text-emerald-700"
                    : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700",
                  primary && "relative -mt-6"
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-2xl",
                    active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25" : "bg-slate-100",
                    primary && "h-12 w-12 rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-600/25"
                  )}
                >
                  <Icon className={cn("h-4 w-4", primary && "h-5 w-5")} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function StudentUnlinkedState() {
  return (
    <StudentShell>
      <Card className="rounded-[28px] border-amber-200 bg-amber-50 shadow-[0_18px_48px_rgba(146,64,14,0.08)]">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 ring-1 ring-amber-100">
            <UserRoundCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-amber-950">
              Akun siswa belum terhubung ke roster sekolah
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900">
              Portal siswa hanya menampilkan tugas, quiz, ujian, absensi,
              nilai, mading, dan Zona Kreasi setelah akun login ditautkan ke data
              siswa pada kelas sekolah. Minta guru pengelola atau admin sekolah
              mengaktifkan akun dari menu data siswa.
            </p>
          </div>
        </CardContent>
      </Card>
    </StudentShell>
  );
}
