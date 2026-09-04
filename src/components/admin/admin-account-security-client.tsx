"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readResponseJson } from "@/lib/http-json";

export function AdminAccountSecurityClient({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmation }),
      });
      const data = await readResponseJson<{ ok?: boolean; message?: string }>(response);
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Password belum dapat diperbarui.");
      }

      setMessage(data.message || "Password berhasil diperbarui.");
      await signOut({ redirect: false });
      window.location.assign("/login?passwordChanged=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password belum dapat diperbarui.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">
          Keamanan Akun
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
          Akun &amp; Password Super Admin
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Kelola password akun Anda sendiri. Setelah password berubah, seluruh sesi lama
          akun ini dicabut dan Anda harus masuk kembali.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Identitas akun
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nama</p>
              <p className="mt-1 font-semibold text-slate-950">{name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-1 break-all font-semibold text-slate-950">{email}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Jika akun masih memakai password awal/demo, ganti sekarang sebelum aplikasi
              digunakan secara nyata.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_45px_rgba(15,76,129,0.07)]">
          <CardHeader className="border-b border-blue-50 bg-emerald-50/45">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              Ganti password
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Password saat ini</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password baru</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={12}
                  required
                />
                <p className="text-xs leading-5 text-slate-500">
                  Minimal 12 karakter, memiliki huruf besar, huruf kecil, dan angka.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-confirmation">Ulangi password baru</Label>
                <Input
                  id="password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  minLength={12}
                  required
                />
              </div>

              {error ? (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {message}
                </p>
              ) : null}

              <Button type="submit" disabled={saving} className="w-full rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Simpan password baru
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
