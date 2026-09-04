"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Store } from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readResponseJson } from "@/lib/http-json";
import { useAppDisplay } from "@/hooks/use-app-display";

function MerchantRegisterForm() {
  const router = useRouter();
  const { data: appDisplay } = useAppDisplay();
  const appName = appDisplay.branding.appName;
  const authLogoUrl = appDisplay.branding.authLogoUrl || "";
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState("");

  const requestOtp = async () => {
    setOtpLoading(true);
    setError("");
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, purpose: "REGISTER" }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) {
        setError(json.error || "Gagal mengirim OTP. Aktifkan WhatsApp Gateway.");
        return;
      }
      setOtpSent(true);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register/merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone, storeName, otpCode: otp }),
    });
    const json = await readResponseJson<{ error?: string }>(res);
    if (!res.ok) {
      setError(json.error || "Pendaftaran gagal");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    router.push("/merchant");
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <AppLogo
        appName={appName}
        logoUrl={authLogoUrl}
        showName={!authLogoUrl}
        href="/"
        imageClassName="h-10 w-auto max-w-[160px] object-contain"
        fallbackClassName="text-2xl font-black text-primary"
      />
      <div className="mt-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-primary">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Daftar Merchant</h1>
          <p className="text-sm text-slate-500">Jual buku dan ATK ke guru serta sekolah.</p>
        </div>
      </div>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label>Nama pemilik</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Nama toko</Label>
          <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="space-y-1.5">
          <Label>WhatsApp</Label>
          <div className="flex gap-2">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="08xxxxxxxxxx" />
            <Button type="button" variant="outline" onClick={requestOtp} disabled={otpLoading || phone.length < 8}>
              {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : otpSent ? "Kirim ulang" : "Kirim OTP"}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Kode OTP</Label>
          <Input value={otp} onChange={(e) => setOtp(e.target.value)} required inputMode="numeric" />
        </div>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Buat akun merchant
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}

export default function MerchantRegisterPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <Suspense fallback={<div className="flex justify-center pt-24 text-slate-500">Memuat...</div>}>
        <MerchantRegisterForm />
      </Suspense>
    </div>
  );
}
