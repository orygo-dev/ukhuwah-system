"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLogo } from "@/components/branding/app-logo";
import { useAppDisplay } from "@/hooks/use-app-display";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  LogOut,
  Megaphone,
  Search,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

type PartnerData = {
  partner: {
    name: string;
    code: string;
    type: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    commissionPercent: number;
    walletBalance: number;
    bankName: string | null;
    bankAccount: string | null;
    bankHolder: string | null;
    regency: { name: string; code: string | null; province: { name: string } } | null;
    school: { name: string; npsn: string | null } | null;
  };
  stats: {
    total: number;
    pending: number;
    approved: number;
    paid: number;
    count: number;
    teacherCount: number;
  };
  commissions: {
    id: string;
    teacherName: string;
    teacherEmail: string;
    planName: string;
    orderAmount: number;
    rate: number;
    amount: number;
    status: string;
    availableAt: string;
    createdAt: string;
  }[];
  payouts: {
    id: string;
    amount: number;
    status: string;
    bankName: string | null;
    bankAccount: string | null;
    bankHolder: string | null;
    createdAt: string;
    processedAt: string | null;
  }[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(value));
}

const statusTone: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-100",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-100",
  REJECTED: "bg-red-50 text-red-700 border-red-100",
};

export function PartnerDashboardClient() {
  const router = useRouter();
  const { data: appDisplay } = useAppDisplay();
  const [data, setData] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);
  const [profile, setProfile] = useState({
    contactName: "",
    phone: "",
    email: "",
    bankName: "",
    bankAccount: "",
    bankHolder: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/me");
      if (res.status === 401) {
        router.replace("/partner/login");
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal memuat dashboard mitra");
      if (!json?.partner) throw new Error("Data mitra tidak lengkap");
      setData(json);
      setProfile({
        contactName: json.partner.contactName || "",
        phone: json.partner.phone || "",
        email: json.partner.email || "",
        bankName: json.partner.bankName || "",
        bankAccount: json.partner.bankAccount || "",
        bankHolder: json.partner.bankHolder || "",
      });
      setMessageOk(true);
    } catch (event) {
      setMessage(event instanceof Error ? event.message : "Gagal memuat dashboard mitra");
      setMessageOk(false);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const locationLabel = useMemo(() => {
    if (!data) return "-";
    if (data.partner.school) return data.partner.school.name;
    if (data.partner.regency) {
      return `${data.partner.regency.name}, ${data.partner.regency.province.name}`;
    }
    return "Wilayah belum ditentukan";
  }, [data]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    setMessageOk(true);
    try {
      const res = await fetch("/api/partner/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan profil");
      setMessage("Profil mitra tersimpan");
      setMessageOk(true);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan profil");
      setMessageOk(false);
    } finally {
      setSaving(false);
    }
  };

  const requestPayout = async () => {
    setPayoutLoading(true);
    setMessage("");
    setMessageOk(true);
    try {
      const res = await fetch("/api/partner/payout", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal mengajukan pencairan");
      setMessage("Permintaan pencairan berhasil dikirim");
      setMessageOk(true);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal mengajukan pencairan");
      setMessageOk(false);
    } finally {
      setPayoutLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/partner/logout", { method: "POST" });
    router.replace("/partner/login");
    router.refresh();
  };

  const copyPartnerCode = async () => {
    try {
      await navigator.clipboard.writeText(data?.partner.code || "");
      setMessage("Kode mitra disalin");
    } catch {
      setMessage("Kode mitra: " + (data?.partner.code || "-"));
    }
  };

  if (loading || !data) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      </main>
    );
  }

  const premiumActive = data.stats.teacherCount || data.stats.count || 0;
  const estimatedCommission = data.stats.total || data.partner.walletBalance;
  const payoutPending = data.payouts.filter((row) => row.status === "PENDING").length;
  const chartRows = data.commissions.slice(0, 6).reverse();
  const chartMax = Math.max(...chartRows.map((row) => row.amount), 1);
  const regionRows = [
    {
      name: locationLabel,
      teachers: Math.max(data.stats.teacherCount, 0),
      premium: premiumActive,
      commission: data.stats.total,
    },
  ];

  const kpis = [
    {
      label: "Guru Binaan",
      value: `${data.stats.teacherCount}`,
      icon: Users,
      detail: "Guru terhubung ke wilayah/kode",
    },
    {
      label: "Premium Aktif",
      value: `${premiumActive}`,
      icon: CreditCard,
      detail: `${data.stats.count} transaksi premium`,
    },
    {
      label: "Estimasi Komisi",
      value: formatCurrency(estimatedCommission),
      icon: TrendingUp,
      detail: `Komisi ${data.partner.commissionPercent}%`,
    },
    {
      label: "Saldo Siap Cair",
      value: formatCurrency(data.partner.walletBalance),
      icon: Wallet,
      detail: payoutPending > 0 ? `${payoutPending} payout diproses` : "Siap diajukan",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4f8ff] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-emerald-100 bg-white/96 shadow-[16px_0_44px_rgba(15,76,129,0.06)] lg:block">
        <div className="flex h-20 items-center border-b border-blue-50 px-6">
          <AppLogo
            href="/partner"
            appName={appDisplay.branding.appName}
            logoUrl={appDisplay.branding.logoUrl}
            showName={false}
            imageClassName="h-10 w-auto max-w-[175px] object-contain"
            fallbackClassName="text-xl font-black text-emerald-700"
          />
        </div>
        <nav className="space-y-6 px-4 py-5">
          <div>
            <p className="mb-2 px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Portal Mitra
            </p>
            {[
              ["Overview", BarChart3, true],
              ["Guru Binaan", Users, false],
              ["Transaksi Premium", CreditCard, false],
              ["Komisi", Wallet, false],
              ["Pencairan", CheckCircle2, false],
              ["Materi Sosialisasi", Megaphone, false],
            ].map(([label, Icon, active]) => {
              const MenuIcon = Icon as typeof BarChart3;
              return (
                <button
                  key={label as string}
                  type="button"
                  className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition ${
                    active
                      ? "bg-emerald-600 text-white shadow-[0_14px_32px_rgba(37,99,235,0.22)]"
                      : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                >
                  <MenuIcon className="h-4 w-4" />
                  {label as string}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="absolute inset-x-4 bottom-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">
            Kode Mitra
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="truncate text-lg font-black text-slate-950">{data.partner.code}</p>
            <button
              type="button"
              onClick={copyPartnerCode}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"
              aria-label="Salin kode mitra"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Gunakan kode ini untuk menghubungkan guru binaan dengan wilayah mitra.
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/90 px-4 backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex h-20 max-w-7xl items-center gap-4">
            <div className="relative hidden min-w-0 flex-1 md:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Cari guru, transaksi, wilayah, atau pencairan..."
                className="h-11 w-full max-w-2xl rounded-2xl border border-emerald-100 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white"
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                className="relative grid h-11 w-11 place-items-center rounded-full border border-emerald-100 bg-white text-slate-700 shadow-sm"
                aria-label="Notifikasi"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600" />
              </button>
              <div className="hidden items-center gap-3 rounded-full border border-emerald-100 bg-white py-1 pl-1 pr-3 shadow-sm sm:flex">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
                  {(data.partner.contactName || data.partner.name).charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="max-w-36 truncate text-sm font-extrabold text-slate-950">
                    {data.partner.contactName || data.partner.name}
                  </p>
                  <p className="max-w-36 truncate text-xs font-bold text-emerald-600">
                    {data.partner.type === "REGENCY" ? "Mitra Wilayah" : "Mitra Sekolah"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={logout} className="rounded-xl border-emerald-100 bg-white">
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8">
          {message && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                messageOk
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}

          <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                Dashboard Mitra Wilayah
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {data.partner.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Pantau performa wilayah, transaksi premium, komisi, dan pencairan
                dari satu dashboard mitra.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                Area mitra
              </p>
              <p className="mt-1 font-bold text-slate-950">{locationLabel}</p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_16px_44px_rgba(15,76,129,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-2 truncate text-2xl font-black text-slate-950">
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{item.detail}</p>
                    </div>
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_390px]">
            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_16px_44px_rgba(15,76,129,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Tren Komisi Premium</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Komisi terbaru dari transaksi paket premium valid.
                  </p>
                </div>
                <Badge className="rounded-full bg-emerald-600">
                  {data.partner.commissionPercent}% komisi
                </Badge>
              </div>

              <div className="mt-6 flex h-56 items-end gap-3 rounded-3xl bg-[linear-gradient(180deg,#f8fbff,#eef6ff)] p-4">
                {(chartRows.length ? chartRows : Array.from({ length: 6 }, (_, index) => ({
                  id: `empty-${index}`,
                  amount: 0,
                  createdAt: new Date(Date.now() - (5 - index) * 86400000).toISOString(),
                } as PartnerData["commissions"][number]))).map((row, index) => {
                  const height = row.amount > 0 ? Math.max((row.amount / chartMax) * 100, 12) : 8;
                  return (
                    <div key={row.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <div
                        className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#059669,#2dd4bf)] shadow-[0_10px_20px_rgba(5,150,105,0.18)] transition-all"
                        style={{ height: `${height}%` }}
                        title={formatCurrency(row.amount)}
                      />
                      <p className="truncate text-[10px] font-bold text-slate-500">
                        {row.amount > 0 ? formatDate(row.createdAt).split(" ")[0] : `W${index + 1}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_16px_44px_rgba(15,76,129,0.08)]">
                <h2 className="text-lg font-black text-slate-950">Status Pencairan</h2>
                <div className="mt-4 rounded-3xl bg-emerald-50 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">
                    Saldo siap cair
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-950">
                    {formatCurrency(data.partner.walletBalance)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Komisi approved yang belum diajukan.
                  </p>
                </div>
                <Button
                  className="mt-4 w-full rounded-2xl"
                  disabled={payoutLoading || saving || data.partner.walletBalance <= 0}
                  onClick={requestPayout}
                >
                  {payoutLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Ajukan Pencairan
                </Button>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_16px_44px_rgba(15,76,129,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Kode Mitra</h2>
                    <p className="mt-1 text-sm text-slate-500">Bagikan ke guru binaan.</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyPartnerCode}
                    className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"
                    aria-label="Salin kode mitra"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xl font-black tracking-wide text-emerald-700">
                  {data.partner.code}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_16px_44px_rgba(15,76,129,0.08)]">
              <h2 className="text-lg font-black text-slate-950">Performa Wilayah</h2>
              <div className="mt-4 space-y-3">
                {regionRows.map((region) => {
                  const pct = Math.min((region.commission / Math.max(data.stats.total, 1_000_000)) * 100, 100);
                  return (
                    <div key={region.name} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-extrabold text-slate-950">{region.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {region.teachers} guru binaan · {region.premium} premium
                          </p>
                        </div>
                        <p className="text-sm font-black text-emerald-700">
                          {formatCurrency(region.commission)}
                        </p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white shadow-[0_16px_44px_rgba(15,76,129,0.08)]">
              <div className="flex items-center justify-between gap-4 border-b border-blue-50 px-5 py-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Transaksi Premium Terbaru</h2>
                  <p className="mt-1 text-sm text-slate-500">Riwayat komisi dari guru binaan.</p>
                </div>
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Guru</th>
                      <th className="px-5 py-3">Paket</th>
                      <th className="px-5 py-3">Komisi</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.commissions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                          Belum ada transaksi premium yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      data.commissions.slice(0, 8).map((commission) => (
                        <tr key={commission.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <p className="font-extrabold text-slate-950">{commission.teacherName}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{commission.teacherEmail}</p>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{commission.planName}</td>
                          <td className="px-5 py-3 font-black text-emerald-700">
                            {formatCurrency(commission.amount)}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone[commission.status] || "bg-slate-50 text-slate-600 border-slate-100"}`}>
                              {commission.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-xs font-semibold text-slate-500">
                            {formatDate(commission.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_16px_44px_rgba(15,76,129,0.08)]">
              <h2 className="text-lg font-black text-slate-950">Riwayat Pencairan</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.payouts.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                    Belum ada riwayat pencairan.
                  </p>
                ) : (
                  data.payouts.slice(0, 6).map((payout) => (
                    <div key={payout.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{formatCurrency(payout.amount)}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(payout.createdAt)}</p>
                        </div>
                        <Badge variant="secondary">{payout.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_16px_44px_rgba(15,76,129,0.08)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">Profil & Rekening</h2>
                  <p className="text-sm text-slate-500">Data untuk pencairan komisi.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Kontak</Label>
                  <Input value={profile.contactName} onChange={(e) => setProfile((p) => ({ ...p, contactName: e.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bank</Label>
                  <Input value={profile.bankName} onChange={(e) => setProfile((p) => ({ ...p, bankName: e.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>No. rekening</Label>
                    <Input value={profile.bankAccount} onChange={(e) => setProfile((p) => ({ ...p, bankAccount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nama pemilik</Label>
                    <Input value={profile.bankHolder} onChange={(e) => setProfile((p) => ({ ...p, bankHolder: e.target.value }))} />
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={saving || payoutLoading}
                  onClick={saveProfile}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Profil
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
