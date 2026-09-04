"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Gift,
  GraduationCap,
  Loader2,
  MessageCircle,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JENJANG_OPTIONS, getMapelOptions } from "@/lib/curriculum";
import { readResponseJson } from "@/lib/http-json";
import { cn } from "@/lib/utils";
import { useAppDisplay } from "@/hooks/use-app-display";

type Province = {
  id: string;
  code: string;
  name: string;
};

type Regency = {
  id: string;
  code: string;
  name: string;
  provinceId: string;
};

type SchoolOption = {
  id: string;
  npsn?: string | null;
  name: string;
  level?: string | null;
  regencyId?: string | null;
  regencyName?: string | null;
};

type DirectoryResponse = {
  provinces: Province[];
  regencies: Regency[];
  schools: SchoolOption[];
};

type Step = 0 | 1 | 2;

const steps = [
  {
    title: "Akun",
    description: "Identitas login",
    icon: UserPlus,
  },
  {
    title: "Sekolah",
    description: "Profil mengajar",
    icon: School,
  },
  {
    title: "Verifikasi",
    description: "WhatsApp OTP",
    icon: ShieldCheck,
  },
];

function guessJenjang(level?: string | null) {
  const value = (level || "").toLowerCase();
  if (value.includes("smk")) return "smk";
  if (value.includes("sma") || value.includes("ma")) return "sma";
  if (value.includes("smp") || value.includes("mts")) return "smp";
  if (value.includes("sd") || value.includes("mi")) return "sd";
  return "";
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: appDisplay } = useAppDisplay();
  const authLogoUrl = appDisplay.branding.authLogoUrl || "";
  const appName = appDisplay.branding.appName;
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [regencyId, setRegencyId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");
  const [jenjang, setJenjang] = useState("");
  const [mapel, setMapel] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpWarning, setOtpWarning] = useState("");
  const [directory, setDirectory] = useState<DirectoryResponse>({
    provinces: [],
    regencies: [],
    schools: [],
  });
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref.toUpperCase());
      return;
    }
    const match = document.cookie.match(/(?:^|;\s*)gs_ref=([^;]+)/);
    if (match?.[1]) {
      setReferralCode(decodeURIComponent(match[1]).toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const loadDirectory = async () => {
      setDirectoryLoading(true);
      const params = new URLSearchParams();
      if (provinceId) params.set("provinceId", provinceId);
      if (regencyId) params.set("regencyId", regencyId);
      if (schoolQuery.trim()) params.set("q", schoolQuery.trim());
      try {
        const res = await fetch(`/api/school-directory?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          setDirectory(await readResponseJson(res));
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Gagal memuat data wilayah dan sekolah");
        }
      } finally {
        setDirectoryLoading(false);
      }
    };
    loadDirectory();
    return () => controller.abort();
  }, [provinceId, regencyId, schoolQuery]);

  const selectedSchool = useMemo(
    () => directory.schools.find((school) => school.id === schoolId),
    [directory.schools, schoolId]
  );

  const mapelOptions = useMemo(() => getMapelOptions(jenjang), [jenjang]);

  const accountComplete =
    name.trim().length >= 2 &&
    email.includes("@") &&
    password.length >= 8 &&
    phone.trim().length >= 8;
  const schoolComplete = Boolean(provinceId && regencyId && schoolId && jenjang && mapel);
  const canSubmit = accountComplete && schoolComplete && otpVerified && !loading;

  const goNext = () => {
    setError("");
    if (step === 0 && !accountComplete) {
      setError("Lengkapi nama, email, password minimal 8 karakter, dan nomor WhatsApp.");
      return;
    }
    if (step === 1 && !schoolComplete) {
      setError("Lengkapi provinsi, kabupaten/kota, sekolah, jenjang, dan mata pelajaran.");
      return;
    }
    setStep((current) => Math.min(current + 1, 2) as Step);
  };

  const requestOtp = async () => {
    setOtpLoading(true);
    setOtpWarning("");
    setError("");
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name,
          purpose: "REGISTER",
        }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) {
        setOtpWarning(
          json.error ||
            "WhatsApp Gateway belum aktif. OTP wajib untuk mendaftar — aktifkan gateway atau coba lagi nanti."
        );
        return;
      }
      setOtpSent(true);
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    setOtpLoading(true);
    setOtpWarning("");
    setError("");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          purpose: "REGISTER",
          code: otp,
        }),
      });
      const json = await readResponseJson<{
        ok?: boolean;
        error?: string;
        reason?: string;
      }>(res);
      if (!res.ok || !json.ok) {
        setOtpWarning(json.error || json.reason || "Kode OTP tidak sesuai.");
        return;
      }
      setOtpVerified(true);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setError(
        otpVerified
          ? "Lengkapi semua data wajib sebelum membuat akun."
          : "Verifikasi OTP WhatsApp wajib sebelum membuat akun."
      );
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        phone,
        schoolId,
        jenjang,
        mapel,
        referralCode: referralCode || undefined,
        otpCode: otp,
      }),
    });

    const json = await readResponseJson<{ error?: string }>(res);
    if (!res.ok) {
      setError(json.error || "Gagal mendaftar");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email, password, redirect: false });
    router.push("/dashboard");
    router.refresh();
  };

  const selectSchool = (id: string) => {
    setSchoolId(id);
    const school = directory.schools.find((item) => item.id === id);
    const guessed = guessJenjang(school?.level);
    if (guessed) {
      setJenjang(guessed);
      setMapel("");
    }
  };

  return (
    <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden min-h-[720px] overflow-hidden bg-[#064e3b] p-10 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(16,185,129,0.72),transparent_34%),radial-gradient(circle_at_84%_18%,rgba(45,212,191,0.40),transparent_30%),linear-gradient(145deg,#042f2e_0%,#065f46_48%,#10b981_100%)]" />
        <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div>
            <div className="mb-12 flex items-center gap-3">
              <AppLogo
                appName={appName}
                logoUrl={authLogoUrl}
                showName={!authLogoUrl}
                className="inline-flex"
                imageClassName="h-12 w-auto max-w-[180px] object-contain"
                fallbackClassName="sr-only"
                nameClassName="text-2xl font-black tracking-tight text-white"
              />
            </div>
            <h1 className="max-w-sm text-4xl font-semibold leading-tight tracking-normal">
              Siapkan akun guru dengan data sekolah yang rapi sejak awal.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-emerald-100">
              Profil yang lengkap membuat generator dokumen, kredit, referral,
              dan notifikasi WhatsApp bekerja lebih akurat.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/15 bg-white/12 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-100">Bonus pendaftaran</p>
                  <p className="mt-1 text-3xl font-bold">10 kredit</p>
                </div>
                <WalletCards className="h-10 w-10 text-cyan-200" />
              </div>
              <div className="mt-5 h-2 rounded-full bg-white/15">
                <div className="h-full w-2/3 rounded-full bg-cyan-300" />
              </div>
            </div>
            {referralCode && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm backdrop-blur">
                <Gift className="h-5 w-5 text-amber-200" />
                <span>
                  Kode referral <strong>{referralCode}</strong> akan terhubung
                  otomatis.
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-5 sm:p-8 lg:p-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/login"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Masuk ke akun
            </Link>
            <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
              Buat Akun Guru
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Lengkapi data utama agar dashboard, profil sekolah, kredit, dan
              notifikasi siap digunakan setelah login.
            </p>
          </div>
          <Badge className="hidden rounded-full bg-emerald-600 px-3 py-1 text-white sm:inline-flex">
            Gratis
          </Badge>
        </div>

        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const active = index === step;
            const complete = index < step;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => setStep(index as Step)}
                className={cn(
                  "flex min-h-[72px] items-center gap-3 rounded-2xl border p-3 text-left transition",
                  active
                    ? "border-emerald-500 bg-white shadow-[0_14px_34px_rgba(5,150,105,0.14)]"
                    : "border-slate-200 bg-white/70 hover:bg-white"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    active || complete
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {complete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">
                    {item.title}
                  </span>
                  <span className="block text-xs text-slate-500">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <Card className="border-slate-200 bg-white/90 shadow-[0_16px_44px_rgba(15,23,42,0.07)]">
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Nama Lengkap</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Bu Sinta Rahayu"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Nomor WhatsApp</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setOtpVerified(false);
                      }}
                      placeholder="08xxxxxxxxxx"
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      placeholder="Minimal 8 karakter"
                      required
                    />
                  </div>
                  {referralCode && (
                    <div className="sm:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <div className="flex items-center gap-2 font-semibold">
                        <Gift className="h-4 w-4" />
                        Referral aktif: {referralCode}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Provinsi</Label>
                      <Select
                        value={provinceId}
                        onValueChange={(value) => {
                          setProvinceId(value);
                          setRegencyId("");
                          setSchoolId("");
                          setSchoolQuery("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih provinsi" />
                        </SelectTrigger>
                        <SelectContent>
                          {directory.provinces.map((province) => (
                            <SelectItem key={province.id} value={province.id}>
                              {province.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Kabupaten/Kota</Label>
                      <Select
                        value={regencyId}
                        onValueChange={(value) => {
                          setRegencyId(value);
                          setSchoolId("");
                          setSchoolQuery("");
                        }}
                        disabled={!provinceId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kabupaten/kota" />
                        </SelectTrigger>
                        <SelectContent>
                          {directory.regencies.map((regency) => (
                            <SelectItem key={regency.id} value={regency.id}>
                              {regency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="school-search">Sekolah</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="school-search"
                        value={schoolQuery}
                        onChange={(e) => setSchoolQuery(e.target.value)}
                        disabled={!regencyId}
                        placeholder="Cari nama sekolah atau NPSN"
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-2">
                      {directoryLoading && (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Memuat sekolah...
                        </div>
                      )}
                      {!directoryLoading && !regencyId && (
                        <div className="py-8 text-center text-sm text-slate-500">
                          Pilih provinsi dan kabupaten/kota terlebih dahulu.
                        </div>
                      )}
                      {!directoryLoading && regencyId && directory.schools.length === 0 && (
                        <div className="py-8 text-center text-sm text-slate-500">
                          Sekolah tidak ditemukan. Coba kata kunci lain.
                        </div>
                      )}
                      {!directoryLoading &&
                        directory.schools.slice(0, 80).map((school) => (
                          <button
                            key={school.id}
                            type="button"
                            onClick={() => selectSchool(school.id)}
                            className={cn(
                              "mb-2 flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition last:mb-0",
                              schoolId === school.id
                                ? "border-blue-500 bg-white shadow-sm"
                                : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-white"
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-slate-950">
                                {school.name}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {school.npsn || "NPSN belum tersedia"} ·{" "}
                                {school.level || "Jenjang belum tersedia"}
                              </span>
                            </span>
                            {schoolId === school.id && (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                            )}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Jenjang</Label>
                      <Select
                        value={jenjang}
                        onValueChange={(value) => {
                          setJenjang(value);
                          setMapel("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih jenjang" />
                        </SelectTrigger>
                        <SelectContent>
                          {JENJANG_OPTIONS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mata Pelajaran Utama</Label>
                      <Select value={mapel} onValueChange={setMapel} disabled={!jenjang}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih mapel" />
                        </SelectTrigger>
                        <SelectContent>
                          {mapelOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedSchool && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <div className="flex items-center gap-2 font-semibold">
                        <GraduationCap className="h-4 w-4" />
                        Profil sekolah terpilih
                      </div>
                      <p className="mt-1 text-emerald-800">
                        {selectedSchool.name}, {selectedSchool.regencyName || "wilayah terpilih"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                          <MessageCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-950">
                            Verifikasi nomor WhatsApp
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            OTP membuat reset password, penarikan komisi, dan notifikasi
                            pembayaran lebih aman.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={otpVerified ? "secondary" : "default"}
                        onClick={requestOtp}
                        disabled={!phone || otpLoading || otpVerified}
                      >
                        {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {otpVerified ? "Terverifikasi" : otpSent ? "Kirim Ulang" : "Kirim OTP"}
                      </Button>
                    </div>
                  </div>

                  {otpSent && !otpVerified && (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Masukkan kode OTP"
                        inputMode="numeric"
                      />
                      <Button type="button" variant="outline" onClick={verifyOtp} disabled={otpLoading}>
                        Verifikasi
                      </Button>
                    </div>
                  )}

                  {otpVerified && (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Nomor WhatsApp sudah terverifikasi.
                    </div>
                  )}

                  {otpWarning && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                      {otpWarning} Anda tetap bisa membuat akun, lalu admin dapat
                      mengaktifkan OTP dari menu WhatsApp Gateway.
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      "10 kredit awal",
                      "Profil sekolah tersimpan",
                      "Siap pakai generator AI",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700"
                      >
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep((current) => Math.max(current - 1, 0) as Step)}
                  disabled={step === 0 || loading}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </Button>

                {step < 2 ? (
                  <Button type="button" onClick={goNext}>
                    Lanjut
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button className="min-w-44" variant="brand" type="submit" disabled={!canSubmit}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Membuat akun...
                      </>
                    ) : (
                      "Buat Akun"
                    )}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:flex lg:items-center lg:justify-center lg:p-8">
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Memuat...
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </div>
  );
}
