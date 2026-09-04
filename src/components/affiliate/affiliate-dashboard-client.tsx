"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Check,
  Clock3,
  Copy,
  Handshake,
  Loader2,
  Megaphone,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QaSection } from "@/components/dashboard/qa-section";
import { formatCurrency } from "@/lib/utils";
import type { AffiliateConfig } from "@/lib/affiliate";
import { commissionOnLabel } from "@/lib/affiliate";
import type { ReferralMembershipStatus } from "@/lib/affiliate-referral-status";

type AffiliateData = {
  config: AffiliateConfig;
  referralCode: string;
  referralLink: string;
  stats: {
    referrals: number;
    conversions: number;
    pending: number;
    approved: number;
    paid: number;
    availableForPayout: number;
  };
  referrals: {
    id: string;
    createdAt: string;
    membershipStatus: ReferralMembershipStatus;
    membershipLabel: string;
    planName: string | null;
    planExpiresAt: string | null;
    user: { name: string; email: string; joinedAt: string };
  }[];
  commissions: {
    id: string;
    amount: number;
    rate: number;
    orderAmount: number;
    status: string;
    availableAt: string;
    createdAt: string;
    referredName: string;
  }[];
  payouts: {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    processedAt: string | null;
  }[];
  profile: {
    bankName: string | null;
    bankAccount: string | null;
    bankHolder: string | null;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Siap cair",
  PAID: "Dibayar",
  CANCELLED: "Dibatalkan",
};

const MEMBERSHIP_BADGE: Record<
  ReferralMembershipStatus,
  { variant: "warning" | "success" | "secondary"; className?: string }
> = {
  pending: { variant: "secondary" },
  active: { variant: "success" },
  inactive: { variant: "warning" },
};

const AFFILIATE_QA = [
  {
    question: "Kapan komisi afiliasi dihitung?",
    answer:
      "Komisi dihitung saat guru rujukan melakukan pembayaran yang termasuk target komisi, misalnya paket langganan atau top up jika admin mengaktifkannya.",
  },
  {
    question: "Apa arti komisi pending dan siap cair?",
    answer:
      "Pending berarti transaksi sudah tercatat tetapi masih menunggu masa hold. Siap cair berarti komisi sudah melewati masa hold dan dapat diajukan pencairan sesuai minimum payout.",
  },
  {
    question: "Apakah saya bisa mencairkan semua saldo langsung?",
    answer:
      "Pencairan dapat diajukan jika saldo siap cair sudah mencapai minimum pencairan. Admin akan memproses transfer sesuai data rekening yang Anda isi.",
  },
  {
    question: "Bagaimana agar peluang konversi lebih tinggi?",
    answer:
      "Bagikan link ke guru yang memang membutuhkan generator administrasi. Jelaskan manfaat praktis seperti membuat dokumen lebih cepat dan kredit dapat dipakai sesuai kebutuhan.",
  },
];

function formatJoinedDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-[16px] border border-emerald-100 bg-white p-4 shadow-[0_12px_32px_rgba(15,76,129,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

export function AffiliateDashboardClient() {
  const { data: session } = useSession();
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [bank, setBank] = useState({
    bankName: "",
    bankAccount: "",
    bankHolder: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/affiliate/me");
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "Gagal memuat");
    if (!json) throw new Error("Data afiliasi tidak lengkap");
    setData(json);
    if (json?.profile) {
      setBank({
        bankName: json.profile.bankName || "",
        bankAccount: json.profile.bankAccount || "",
        bankHolder: json.profile.bankHolder || "",
      });
    }
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [load]);

  const copyLink = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutLoading) return;
    setPayoutLoading(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: bank.bankName.trim(),
          bankAccount: bank.bankAccount.trim(),
          bankHolder: bank.bankHolder.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal mengajukan pencairan");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengajukan pencairan");
    } finally {
      setPayoutLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/afiliasi">
        <div className="grid min-h-[420px] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  if (!data?.config.enabled) {
    return (
      <DashboardShell activePath="/dashboard/afiliasi">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Program afiliasi sedang tidak aktif. Hubungi admin.
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const shareText = `Yuk pakai Navalogi untuk bikin RPP & Modul Ajar otomatis! Daftar gratis: ${data.referralLink}`;
  const conversionRate =
    data.stats.referrals > 0
      ? Math.round((data.stats.conversions / data.stats.referrals) * 100)
      : 0;

  return (
    <DashboardShell
      activePath="/dashboard/afiliasi"
      user={
        session?.user
          ? {
              name: session.user.name || "",
              email: session.user.email || "",
              credits: session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[22px] border border-emerald-100 bg-white shadow-[0_18px_54px_rgba(15,76,129,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_430px]">
            <div className="relative isolate p-6 lg:p-8">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_88%_10%,rgba(37,99,235,0.14),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#eef6ff_100%)]" />
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">
                <Handshake className="h-3.5 w-3.5" />
                Program partner guru
              </div>
              <h1 className="mt-5 max-w-2xl text-3xl font-extrabold tracking-tight text-slate-950 lg:text-4xl">
                {data.config.programTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {data.config.programDescription}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4">
                  <p className="text-xs font-semibold text-slate-500">Komisi</p>
                  <p className="mt-1 text-xl font-extrabold text-primary">
                    {data.config.commissionPercent}%
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4">
                  <p className="text-xs font-semibold text-slate-500">Dihitung dari</p>
                  <p className="mt-1 text-sm font-bold text-slate-950">
                    {commissionOnLabel(data.config.commissionOn)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4">
                  <p className="text-xs font-semibold text-slate-500">Hold komisi</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-950">
                    {data.config.holdDays} hari
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[linear-gradient(135deg,#047857_0%,#059669_58%,#14b8a6_100%)] p-6 text-white lg:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white/75">Saldo siap cair</p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight">
                    {formatCurrency(data.stats.availableForPayout)}
                  </p>
                </div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/18 ring-1 ring-white/25">
                  <Wallet className="h-7 w-7" />
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white/14 p-4 ring-1 ring-white/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/75">Kode referral</span>
                  <span className="font-mono font-bold">{data.referralCode}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    readOnly
                    value={data.referralLink}
                    className="h-11 border-white/20 bg-white/15 font-mono text-xs text-white placeholder:text-white/60"
                  />
                  <Button
                    type="button"
                    className="h-11 bg-white text-primary hover:bg-white/90"
                    onClick={copyLink}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  className="mt-3 h-11 w-full bg-white text-primary hover:bg-white/90"
                  onClick={() => {
                    const wa = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                    window.open(wa, "_blank");
                  }}
                >
                  <Megaphone className="h-4 w-4" />
                  Bagikan via WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pendaftar"
            value={data.stats.referrals}
            helper="Guru yang daftar lewat link Anda."
            icon={Users}
          />
          <StatCard
            label="Konversi bayar"
            value={`${data.stats.conversions} (${conversionRate}%)`}
            helper="Rujukan yang melakukan pembayaran."
            icon={TrendingUp}
          />
          <StatCard
            label="Komisi pending"
            value={formatCurrency(data.stats.pending)}
            helper="Masih menunggu masa hold."
            icon={Clock3}
          />
          <StatCard
            label="Sudah dibayar"
            value={formatCurrency(data.stats.paid)}
            helper="Total pencairan selesai."
            icon={Banknote}
          />
        </div>

        <section className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Bagikan link",
              desc: "Kirim link referral ke guru yang membutuhkan generator administrasi.",
              icon: Megaphone,
            },
            {
              title: "Guru mendaftar",
              desc: "Sistem mencatat guru baru sebagai rujukan Anda secara otomatis.",
              icon: Users,
            },
            {
              title: "Komisi masuk",
              desc: "Saat rujukan membayar, komisi dihitung dan masuk ke saldo setelah masa hold.",
              icon: ShieldCheck,
            },
          ].map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="rounded-[16px] border border-emerald-100 bg-white p-5 shadow-[0_12px_32px_rgba(15,76,129,0.05)]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Langkah {index + 1}
                  </span>
                </div>
                <h2 className="mt-4 text-base font-extrabold text-slate-950">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{step.desc}</p>
              </div>
            );
          })}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <Card className="rounded-[18px] border-emerald-100 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Guru Rujukan
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Pantau siapa saja yang mendaftar dan status keanggotaannya.
              </p>
            </CardHeader>
            <CardContent>
              {data.referrals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 p-5 text-sm text-slate-500">
                  Belum ada guru rujukan. Bagikan link referral ke grup guru atau rekan sekolah.
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {data.referrals.map((referral) => {
                    const badge = MEMBERSHIP_BADGE[referral.membershipStatus];
                    return (
                      <li
                        key={referral.id}
                        className="flex gap-3 rounded-2xl border border-emerald-100 bg-white p-4"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-extrabold text-primary">
                          {initials(referral.user.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-bold leading-tight text-slate-950">
                              {referral.user.name}
                            </p>
                            <Badge
                              variant={badge.variant}
                              className={`shrink-0 text-[10px] ${badge.className ?? ""}`}
                            >
                              {referral.membershipLabel}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {referral.user.email}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            Bergabung {formatJoinedDate(referral.user.joinedAt)}
                            {referral.planName ? ` · ${referral.planName}` : " · Paket Gratis"}
                          </p>
                          {referral.membershipStatus === "active" && referral.planExpiresAt && (
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              Berlaku s/d {formatJoinedDate(referral.planExpiresAt)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[18px] border-emerald-100 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Ajukan Pencairan</CardTitle>
              <p className="text-sm text-muted-foreground">
                Minimum pencairan {formatCurrency(data.config.minPayout)}.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={requestPayout} className="space-y-4">
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>Bank</Label>
                    <Input
                      value={bank.bankName}
                      onChange={(e) =>
                        setBank((current) => ({ ...current, bankName: e.target.value }))
                      }
                      placeholder="BCA"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>No. Rekening</Label>
                    <Input
                      value={bank.bankAccount}
                      onChange={(e) =>
                        setBank((current) => ({
                          ...current,
                          bankAccount: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Atas Nama</Label>
                    <Input
                      value={bank.bankHolder}
                      onChange={(e) =>
                        setBank((current) => ({ ...current, bankHolder: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={
                    payoutLoading ||
                    data.stats.availableForPayout < data.config.minPayout
                  }
                >
                  {payoutLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Ajukan {formatCurrency(data.stats.availableForPayout)}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {data.payouts.length > 0 && (
                <div className="mt-6 border-t border-blue-50 pt-4">
                  <p className="mb-2 text-sm font-bold text-slate-950">
                    Riwayat pencairan
                  </p>
                  <ul className="space-y-2 text-sm">
                    {data.payouts.map((payout) => (
                      <li
                        key={payout.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <span className="font-semibold">
                          {formatCurrency(payout.amount)}
                        </span>
                        <Badge variant="secondary">
                          {STATUS_LABEL[payout.status] || payout.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[18px] border-emerald-100 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
          <CardHeader>
            <CardTitle className="text-base">Riwayat Komisi</CardTitle>
            <p className="text-sm text-muted-foreground">
              Daftar komisi dari transaksi guru rujukan.
            </p>
          </CardHeader>
          <CardContent>
            {data.commissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 p-5 text-sm text-slate-500">
                Belum ada komisi. Komisi akan muncul setelah guru rujukan melakukan pembayaran.
              </div>
            ) : (
              <ul className="divide-y divide-blue-50">
                {data.commissions.map((commission) => (
                  <li
                    key={commission.id}
                    className="grid gap-3 py-4 text-sm md:grid-cols-[minmax(0,1fr)_160px_140px]"
                  >
                    <div>
                      <p className="font-bold text-slate-950">
                        {commission.referredName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {commission.rate}% dari {formatCurrency(commission.orderAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400">Komisi</p>
                      <p className="mt-1 font-extrabold text-slate-950">
                        {formatCurrency(commission.amount)}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <Badge variant="secondary">
                        {STATUS_LABEL[commission.status] || commission.status}
                      </Badge>
                      <p className="mt-2 text-xs text-slate-500">
                        Cair {formatJoinedDate(commission.availableAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <QaSection
          title="Q&A Afiliasi Guru"
          description="Penjelasan singkat agar guru memahami cara kerja link referral, komisi, dan pencairan."
          items={AFFILIATE_QA}
        />
      </div>
    </DashboardShell>
  );
}
