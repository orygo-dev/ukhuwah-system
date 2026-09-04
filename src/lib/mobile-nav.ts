import { APP_NAME, type MobileBottomNavItem } from "@/lib/constants";

export function isMobileNavActive(
  pathname: string,
  item: MobileBottomNavItem
): boolean {
  if (item.action === "menu") {
    return (
      item.activePrefixes?.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
      ) ?? false
    );
  }
  if (!item.href) return false;
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (item.activePrefixes?.length) {
    return item.activePrefixes.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getMobilePageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Beranda";
  if (pathname.startsWith("/dashboard/kelas")) return "Kelas & Siswa";
  if (pathname.startsWith("/dashboard/akun-siswa")) return "Akun Siswa";
  if (pathname.startsWith("/dashboard/jurnal")) return "Jurnal Harian";
  if (pathname.startsWith("/dashboard/penilaian")) return "Penilaian";
  if (pathname.startsWith("/dashboard/tools")) return "Generator";
  if (pathname.startsWith("/dashboard/documents")) return "Dokumen Saya";
  if (pathname.startsWith("/dashboard/absensi")) return "Absensi";
  if (pathname.startsWith("/dashboard/pesan")) return "Pesan";
  if (pathname.startsWith("/dashboard/profil")) return "Profil Guru";
  if (pathname.startsWith("/dashboard/spotlight-siswa")) return "Zona Kreasi Siswa";
  if (pathname.startsWith("/dashboard/spotlight")) return "Zona Kreasi";
  if (pathname.startsWith("/dashboard/member")) return "Member";
  if (pathname.startsWith("/dashboard/reward")) return "Dapatkan Kredit";
  if (pathname.startsWith("/dashboard/topup")) return "Top Up Kredit";
  if (pathname.startsWith("/dashboard/billing")) return "Paket Langganan";
  if (pathname.startsWith("/dashboard/afiliasi")) return "Afiliasi";
  if (pathname.startsWith("/dashboard/settings")) return "Pengaturan";
  return APP_NAME;
}
