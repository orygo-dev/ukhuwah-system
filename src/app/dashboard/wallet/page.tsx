"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowDownToLine,
  Coins,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

type WalletData = {
  walletBalance: number;
  creditsRemaining: number;
  ledger: {
    id: string;
    amount: number;
    balanceAfter: number;
    sourceLabel: string;
    description: string;
    createdAt: string;
  }[];
  payouts: {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    processedAt: string | null;
  }[];
};

type CreditPackage = {
  id: string;
  name: string;
  slug: string;
  totalCredits: number;
  price: number;
  isPopular: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Diproses",
  PAID: "Dibayar",
  REJECTED: "Ditolak",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WalletPage() {
  const { data: session, update } = useSession();
  const [data, setData] = useState<WalletData | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bank, setBank] = useState({ bankName: "", bankAccount: "", bankHolder: "" });

  const load = useCallback(async () => {
    const [walletRes, packageRes] = await Promise.all([
      fetch("/api/wallet/me"),
      fetch("/api/credit-packages"),
    ]);
    const walletJson = await walletRes.json().catch(() => null);
    const packageJson = await packageRes.json().catch(() => null);
    if (!walletRes.ok) throw new Error(walletJson?.error || "Gagal memuat dompet");
    if (!packageRes.ok) throw new Error(packageJson?.error || "Gagal memuat paket kredit");
    if (!walletJson) throw new Error("Data dompet tidak lengkap");
    setData(walletJson);
    setPackages(packageJson?.packages || []);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [load]);

  const convert = async (slug: string) => {
    if (processing) return;
    setProcessing(`convert:${slug}`);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/wallet/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditPackageSlug: slug }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal membeli kredit");
      setMessage(json?.message || "Kredit berhasil dibeli dari saldo dompet");
      await load();
      await update();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membeli kredit");
    } finally {
      setProcessing(null);
    }
  };

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processing) return;
    setProcessing("payout");
    setMessage("");
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
      setMessage(
        `Pencairan ${formatCurrency(json?.payout?.amount ?? data?.walletBalance ?? 0)} berhasil diajukan`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengajukan pencairan");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/wallet">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activePath="/dashboard/wallet"
      user={
        session?.user
          ? {
              name: session.user.name || "",
              email: session.user.email || "",
              credits: data?.creditsRemaining ?? session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <Card className="border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo dompet</p>
                  <p className="mt-1 text-3xl font-bold">
                    {formatCurrency(data?.walletBalance ?? 0)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo kredit</p>
                  <p className="mt-1 text-3xl font-bold">{data?.creditsRemaining ?? 0}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Coins className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Sumber saldo</p>
              <p className="mt-1 font-semibold">Komisi afiliasi yang sudah melewati masa hold</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Saldo dapat ditarik atau dipakai membeli kredit.
              </p>
            </CardContent>
          </Card>
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4 text-primary" />
                Beli Kredit dari Dompet
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-xl border p-4 ${pkg.isPopular ? "border-primary bg-primary/5" : "bg-card"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{pkg.name}</p>
                    {pkg.isPopular && <Badge variant="success">Terlaris</Badge>}
                  </div>
                  <p className="mt-2 text-2xl font-bold">{pkg.totalCredits}</p>
                  <p className="text-sm text-muted-foreground">kredit · {formatCurrency(pkg.price)}</p>
                  <Button
                    className="mt-4 w-full"
                    variant={pkg.isPopular ? "brand" : "outline"}
                    disabled={
                      processing !== null ||
                      (data?.walletBalance ?? 0) < pkg.price
                    }
                    onClick={() => convert(pkg.slug)}
                  >
                    {processing === `convert:${pkg.slug}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Beli"
                    )}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownToLine className="h-4 w-4 text-primary" />
                Tarik Saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={requestPayout} className="space-y-4">
                <div className="space-y-2">
                  <Label>Bank / E-wallet</Label>
                  <Input
                    value={bank.bankName}
                    onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))}
                    placeholder="BCA / DANA"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>No. Rekening / Nomor</Label>
                  <Input
                    value={bank.bankAccount}
                    onChange={(e) => setBank((b) => ({ ...b, bankAccount: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Atas Nama</Label>
                  <Input
                    value={bank.bankHolder}
                    onChange={(e) => setBank((b) => ({ ...b, bankHolder: e.target.value }))}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={processing !== null || (data?.walletBalance ?? 0) <= 0}
                >
                  {processing === "payout" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ajukan Pencairan
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Dompet</CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.ledger.length ? (
                <p className="text-sm text-muted-foreground">Belum ada transaksi dompet.</p>
              ) : (
                <ul className="divide-y">
                  {data.ledger.map((row) => (
                    <li key={row.id} className="flex justify-between gap-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.sourceLabel} · {formatDate(row.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={row.amount >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-destructive"}>
                          {row.amount >= 0 ? "+" : ""}
                          {formatCurrency(row.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          sisa {formatCurrency(row.balanceAfter)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Pencairan</CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.payouts.length ? (
                <p className="text-sm text-muted-foreground">Belum ada pencairan.</p>
              ) : (
                <ul className="divide-y">
                  {data.payouts.map((payout) => (
                    <li key={payout.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium">{formatCurrency(payout.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payout.createdAt)}
                        </p>
                      </div>
                      <Badge variant={payout.status === "PAID" ? "success" : payout.status === "REJECTED" ? "destructive" : "secondary"}>
                        {STATUS_LABEL[payout.status] || payout.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
