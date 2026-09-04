"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Loader2 } from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDisplay } from "@/hooks/use-app-display";

function normalizeCodeInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function ParentLoginClient() {
  const router = useRouter();
  const { data: appDisplay } = useAppDisplay();
  const branding = appDisplay.branding;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parent/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kode tidak valid");
      router.push("/orangtua/portal");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-white to-cyan-50 p-4">
      <div className="mb-8 text-center">
        <AppLogo
          appName={branding.appName}
          logoUrl={branding.logoUrl}
          showName={false}
          className="mx-auto mb-4 justify-center"
          imageClassName="h-14 w-auto max-w-[180px] object-contain"
          fallbackClassName="text-2xl font-black text-primary"
        />
        <h1 className="text-2xl font-black text-slate-950">Portal Orang Tua</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Pantau ringkasan kehadiran dan nilai anak memakai kode akses dari guru
          atau admin sekolah.
        </p>
      </div>

      <Card className="w-full max-w-md rounded-[28px] border-emerald-100 bg-white shadow-[0_24px_70px_rgba(15,76,129,0.09)]">
        <CardContent className="pt-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Masuk dengan Kode Akses</p>
              <p className="text-sm text-muted-foreground">
                Kode diberikan oleh wali kelas / guru
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Kode Akses Siswa</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(normalizeCodeInput(e.target.value))}
                placeholder="Contoh: AB12CD34"
                className="text-center font-mono text-lg tracking-widest"
                required
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lihat Laporan Anak
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Guru?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Masuk ke dashboard
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
