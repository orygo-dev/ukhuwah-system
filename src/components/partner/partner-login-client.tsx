"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { LoginBranding } from "@/components/auth/login-form";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type PartnerLoginClientProps = {
  branding?: LoginBranding;
};

const partnerHighlights = [
  {
    label: "Komisi premium",
    icon: Wallet,
  },
  {
    label: "Wilayah binaan",
    icon: Building2,
  },
  {
    label: "Laporan transparan",
    icon: BarChart3,
  },
];

function safePartnerPath(value: string | null) {
  if (!value || !value.startsWith("/partner") || value.startsWith("//")) {
    return "/partner";
  }
  return value;
}

export function PartnerLoginClient({ branding }: PartnerLoginClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appName = branding?.appName || APP_NAME;
  const logoUrl = branding?.authLogoUrl || branding?.logoUrl || "";
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/partner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.replace(safePartnerPath(searchParams.get("callbackUrl")));
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-white">
      <section className="relative hidden w-1/2 overflow-hidden gradient-brand lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-24 top-14 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 left-10 h-56 w-56 rounded-full bg-cyan-200/20 blur-3xl" />

        <AppLogo
          appName={appName}
          logoUrl={logoUrl}
          showName={false}
          className="relative z-10 inline-flex self-start"
          imageClassName="h-12 w-auto max-w-[190px] object-contain"
          fallbackClassName="text-2xl font-black text-white"
        />

        <div className="relative z-10 max-w-xl text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-bold text-white shadow-[0_16px_50px_rgba(15,23,42,0.16)] backdrop-blur">
            <ShieldCheck className="h-4 w-4" />
            Portal resmi mitra wilayah
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight">
            Kelola komisi, wilayah binaan, dan pencairan dalam satu portal.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-emerald-50">
            Dibuat untuk mitra yang membantu sekolah, komunitas, dan guru di
            wilayahnya menggunakan paket premium Navalogi secara terarah.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {partnerHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/15 bg-white/12 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.14)] backdrop-blur"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-bold leading-snug text-white">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 rounded-3xl border border-white/15 bg-white/10 p-5 text-sm text-emerald-50 backdrop-blur">
          Komisi mitra dihitung dari pembelian paket premium yang terhubung ke
          wilayah atau kode mitra, sehingga performa lapangan dapat dipantau
          dengan rapi.
        </div>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_top,hsl(214_100%_97%)_0%,white_38%,hsl(210_40%_98%)_100%)] p-5 sm:p-8">
        <div className="mb-8 lg:hidden">
          <AppLogo
            appName={appName}
            logoUrl={logoUrl}
            showName={false}
            className="inline-flex"
            imageClassName="h-12 w-auto max-w-[190px] object-contain"
            fallbackClassName="text-2xl font-black text-primary"
          />
        </div>

        <Card className="w-full max-w-[440px] rounded-[28px] border border-emerald-100/80 bg-white/95 shadow-[0_24px_80px_rgba(15,76,129,0.12)] backdrop-blur">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-8 ring-blue-50/60">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-950">
                Masuk Portal Mitra
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Gunakan kode mitra dan password yang diberikan super admin untuk
                melihat komisi, guru binaan, dan status pencairan.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Kode mitra</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="MITRA-KABUPATEN"
                  autoComplete="username"
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password portal"
                  autoComplete="current-password"
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              {message && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {message}
                </p>
              )}
              <Button variant="brand" className="h-11 w-full rounded-xl" size="lg" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Masuk Portal
              </Button>
            </form>

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
              <Link
                href="/mitra-wilayah"
                className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                Pelajari program Mitra Wilayah
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-center text-slate-500">
                Login guru atau admin?{" "}
                <Link href="/login" className="font-bold text-primary hover:underline">
                  Masuk dari sini
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
