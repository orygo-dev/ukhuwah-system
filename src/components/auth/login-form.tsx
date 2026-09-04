"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { GraduationCap, School, UsersRound } from "lucide-react";
import { APP_NAME, DEFAULT_BRAND_LOGO_URL } from "@/lib/constants";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSpotlightSharePath } from "@/lib/spotlight-links";

export type LoginBranding = {
  appName: string;
  logoUrl: string;
  authLogoUrl: string;
  loginTagline: string;
  loginSubtitle: string;
};

type LoginFormProps = {
  branding?: LoginBranding;
};

function safeInternalPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function resolveDestination(role: string | undefined, callback: string) {
  if (isSpotlightSharePath(callback)) return callback;
  if (role === "SUPER_ADMIN") {
    return callback.startsWith("/admin") ? callback : "/admin";
  }
  if (role === "PROVINCE_ADMIN") {
    return callback.startsWith("/province") ? callback : "/province";
  }
  if (role === "SCHOOL_ADMIN") {
    return callback.startsWith("/school") ? callback : "/school";
  }
  if (role === "STUDENT") {
    return callback.startsWith("/student") ? callback : "/student";
  }
  if (role === "MERCHANT") {
    return callback.startsWith("/merchant") ? callback : "/merchant";
  }
  if (
    callback.startsWith("/admin") ||
    callback.startsWith("/province") ||
    callback.startsWith("/school") ||
    callback.startsWith("/student") ||
    callback.startsWith("/merchant") ||
    callback === "/register"
  ) {
    return "/dashboard";
  }
  return callback;
}

export function LoginForm({ branding }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const appName = branding?.appName || APP_NAME;
  const logoUrl = branding?.authLogoUrl || DEFAULT_BRAND_LOGO_URL;
  const tagline =
    branding?.loginTagline ||
    "Platform manajemen sekolah\nYayasan Ukhuwah Kalimantan Selatan.";
  const subtitle =
    branding?.loginSubtitle ||
    "Guru, admin sekolah, siswa, dan orang tua Yayasan Ukhuwah memakai pintu masuk yang sama.";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<"staff" | "student">("staff");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const callback = safeInternalPath(searchParams.get("callbackUrl"), "/dashboard");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: callback,
      });

      if (!res || res.error) {
        setError("Email atau password salah");
        return;
      }

      const session = await getSession();
      if (!session?.user) {
        setError("Sesi login belum terbentuk. Silakan coba kembali.");
        return;
      }

      const destination = resolveDestination(session.user.role, callback);

      router.push(destination);
      router.refresh();
    } catch {
      setError("Layanan login sedang bermasalah. Muat ulang halaman lalu coba kembali.");
    } finally {
      setLoading(false);
    }
  };

  const authErrorCode = searchParams.get("error");
  const passwordChanged = searchParams.get("passwordChanged") === "1";
  const authRedirectError =
    authErrorCode === "ProvinceNotBound"
      ? "Akun dinas belum ditautkan ke provinsi. Hubungi Super Admin untuk menetapkan wilayah."
      : authErrorCode
        ? "Proses login sebelumnya tidak berhasil. Silakan masuk kembali."
        : "";

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 gradient-brand lg:flex lg:flex-col lg:justify-between lg:p-12">
        <AppLogo
          appName={appName}
          logoUrl={logoUrl}
          showName={!logoUrl}
          className="inline-flex self-start"
          imageClassName="h-12 w-auto max-w-[220px] object-contain"
          fallbackClassName="sr-only"
          nameClassName="text-2xl font-black tracking-tight text-white"
        />
        <div className="text-white">
          <h2 className="whitespace-pre-line text-3xl font-bold leading-tight">
            {tagline}
          </h2>
          <p className="mt-4 max-w-md whitespace-pre-line text-sm opacity-90">
            {subtitle}
          </p>
        </div>
        <p className="text-sm text-white/70">
          © {new Date().getFullYear()} {appName}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="mb-6 lg:hidden">
          <AppLogo
            appName={appName}
            logoUrl={logoUrl}
            showName={false}
            className="inline-flex"
            imageClassName="h-12 w-auto max-w-[180px] object-contain"
            fallbackClassName="text-2xl font-black text-primary"
          />
        </div>
        <Card className="w-full max-w-xl border-0 shadow-none sm:border sm:shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Masuk ke Akun</CardTitle>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
              Pilih jenis akses. Guru, admin sekolah, dan siswa memakai email dan
              password. Orang tua masuk memakai kode akses dari sekolah.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setSelectedAccess("staff")}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedAccess === "staff"
                    ? "border-emerald-300 bg-emerald-50 shadow-[0_12px_30px_rgba(5,150,105,0.12)]"
                    : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
                }`}
              >
                <School className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="text-sm font-extrabold text-slate-950">Guru/Admin</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Untuk guru, admin sekolah, dan super admin.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAccess("student")}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedAccess === "student"
                    ? "border-cyan-300 bg-cyan-50 shadow-[0_12px_30px_rgba(6,182,212,0.12)]"
                    : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/50"
                }`}
              >
                <GraduationCap className="mb-3 h-5 w-5 text-cyan-700" />
                <p className="text-sm font-extrabold text-slate-950">Siswa</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Kelas otomatis mengikuti roster sekolah.
                </p>
              </button>
              <Link
                href="/orangtua"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-100/70"
              >
                <UsersRound className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="text-sm font-extrabold text-slate-950">Orang Tua</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Masuk dengan kode akses siswa.
                </p>
              </Link>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-600">
              {selectedAccess === "student" ? (
                <p>
                  Akun siswa dibuat oleh guru atau admin sekolah dari data roster.
                  Setelah login, dashboard siswa menampilkan kelas, tugas, ujian,
                  absensi, dan aktivitas sesuai kelas aktif.
                </p>
              ) : (
                <p>
                  Admin sekolah memakai akun yang dibuat Super Admin. Guru dapat
                  mendaftar dari halaman registrasi, lalu melengkapi data sekolah.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {passwordChanged ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  Password berhasil diperbarui. Silakan masuk dengan password baru.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    selectedAccess === "student"
                      ? "siswa@sekolah.sch.id"
                      : "nama@sekolah.sch.id"
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {(error || authRedirectError) && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-destructive">
                  {error || authRedirectError}
                </p>
              )}
              <Button variant="brand" className="w-full" type="submit" disabled={loading}>
                {loading ? "Memproses..." : "Masuk"}
              </Button>
            </form>
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-center sm:gap-4">
              <span>
                Belum punya akun guru?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Daftar
                </Link>
              </span>
              <span className="hidden text-slate-300 sm:inline">|</span>
              <Link href="/partner/login" className="font-semibold text-primary hover:underline">
                Portal Mitra
              </Link>
              <span className="hidden text-slate-300 sm:inline">|</span>
              <Link href="/register/merchant" className="font-semibold text-primary hover:underline">
                Daftar Merchant
              </Link>
              <span className="hidden text-slate-300 sm:inline">|</span>
              <Link href="/orangtua" className="font-semibold text-emerald-700 hover:underline">
                Portal Orang Tua
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
