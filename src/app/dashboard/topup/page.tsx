"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useMidtransSnap } from "@/components/payment/midtrans-snap";
import { QaSection } from "@/components/dashboard/qa-section";

type CreditPackage = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  credits: number;
  bonusCredits: number;
  totalCredits: number;
  price: number;
  isPopular: boolean;
};

type PaymentConfig = {
  midtrans?: { clientKey: string; isSandbox: boolean } | null;
};

const TOPUP_QA = [
  {
    question: "Apa bedanya top up kredit dengan paket langganan?",
    answer:
      "Top up kredit hanya menambah saldo kredit sekali bayar. Paket langganan membuka benefit bulanan seperti akses fitur, quota, dan kredit rutin sesuai paket.",
  },
  {
    question: "Apakah kredit top up langsung masuk?",
    answer:
      "Kredit masuk otomatis setelah payment gateway mengirim status pembayaran berhasil. Jika status masih pending, tunggu beberapa menit lalu cek kembali halaman riwayat atau dashboard.",
  },
  {
    question: "Apakah kredit top up bisa kedaluwarsa?",
    answer:
      "Kredit top up tersimpan sebagai saldo kredit berbayar. Jika admin menetapkan aturan masa aktif, informasi masa aktif akan mengikuti kebijakan yang tampil di aplikasi.",
  },
  {
    question: "Bisa memakai saldo dompet afiliasi untuk membeli kredit?",
    answer:
      "Bisa. Buka menu Dompet, lalu gunakan saldo yang tersedia untuk dikonversi menjadi paket kredit tanpa pembayaran baru.",
  },
];

export default function TopupPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({});

  const midtrans = paymentConfig.midtrans;
  const { SnapScript, pay, scriptLoaded } = useMidtransSnap({
    clientKey: midtrans?.clientKey || "",
    isSandbox: midtrans?.isSandbox ?? true,
  });

  useEffect(() => {
    let active = true;

    const loadTopupData = async () => {
      try {
        const [packageRes, configRes] = await Promise.all([
          fetch("/api/credit-packages"),
          fetch("/api/payment/config"),
        ]);
        const packageData = await packageRes.json().catch(() => null);
        const configData = await configRes.json().catch(() => null);

        if (!packageRes.ok) throw new Error(packageData?.error || "Gagal memuat paket kredit");
        if (!configRes.ok) throw new Error(configData?.error || "Gagal memuat konfigurasi pembayaran");

        if (active) {
          setCreditPackages(packageData?.packages || []);
          setPaymentConfig(configData || {});
        }
      } catch (event) {
        if (active) {
          setError(event instanceof Error ? event.message : "Gagal memuat data top up");
        }
      } finally {
        if (active) setInitialLoading(false);
      }
    };

    void loadTopupData();
    return () => {
      active = false;
    };
  }, []);

  const completePayment = async (json: {
    transactionId: string;
    gateway: string;
    snapToken?: string;
    redirectUrl?: string;
    checkoutUrl?: string;
  }) => {
    if (json.gateway === "midtrans" && json.snapToken) {
      if (!scriptLoaded || !midtrans?.clientKey) {
        if (json.redirectUrl) {
          window.location.href = json.redirectUrl;
          return;
        }
        throw new Error("Midtrans belum dikonfigurasi. Hubungi admin.");
      }

      pay(json.snapToken, {
        onSuccess: async () => {
          await update();
          router.push(`/dashboard/billing/success?id=${json.transactionId}`);
        },
        onPending: () => {
          router.push(`/dashboard/billing/success?id=${json.transactionId}&status=pending`);
        },
        onError: (r) => {
          setError(
            typeof r === "object" && r && "message" in r
              ? String((r as { message: string }).message)
              : "Pembayaran gagal"
          );
        },
        onClose: () => setLoading(null),
      });
      return;
    }

    if (json.gateway === "tripay" && json.checkoutUrl) {
      window.open(json.checkoutUrl, "_blank");
      router.push(`/dashboard/billing/success?id=${json.transactionId}&status=pending`);
      return;
    }

    throw new Error("Gateway tidak merespons");
  };

  const handleTopup = async (slug: string) => {
    const key = `topup:${slug}`;
    setLoading(key);
    setError("");

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditPackageSlug: slug }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal membuat pembayaran");
      await completePayment(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat pembayaran");
    } finally {
      setLoading(null);
    }
  };

  return (
    <DashboardShell
      activePath="/dashboard/topup"
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
      {midtrans?.clientKey && SnapScript}

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Top Up Kredit</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Tambah kredit sekali bayar untuk menjalankan generator dokumen tanpa
                  mengubah paket langganan.
                </p>
              </div>
              <Badge variant="success" className="gap-1 px-3 py-1">
                <Coins className="h-3.5 w-3.5" />
                {session?.user?.creditsRemaining ?? 0} kredit
              </Badge>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground">Pembelian cepat</p>
                <p className="mt-1 text-lg font-semibold">Top up sekali bayar</p>
              </div>
              <div className="rounded-xl border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground">Kredit fleksibel</p>
                <p className="mt-1 text-lg font-semibold">Tidak mengubah paket</p>
              </div>
              <div className="rounded-xl border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground">Butuh paket?</p>
                <Link href="/dashboard/billing" className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-primary">
                  Lihat langganan <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <Card className="border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Punya saldo afiliasi?</p>
                  <p className="text-sm text-muted-foreground">
                    Pakai saldo dompet untuk membeli kredit tanpa pembayaran baru.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="mt-5 w-full">
                <Link href="/dashboard/wallet">Kelola Dompet</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {initialLoading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Card key={item} className="h-64 animate-pulse border-slate-200 bg-slate-50" />
            ))}
          </div>
        ) : creditPackages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="font-semibold text-slate-950">Belum ada paket kredit aktif</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Paket top up belum tersedia. Hubungi admin jika Bapak/Ibu ingin
                menambah kredit secara manual.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
          {creditPackages.map((pkg) => {
            const key = `topup:${pkg.slug}`;
            return (
              <Card
                key={pkg.id}
                className={`relative overflow-hidden ${pkg.isPopular ? "border-primary ring-2 ring-primary/15" : ""}`}
              >
                {pkg.isPopular && (
                  <Badge className="absolute right-4 top-4">Terlaris</Badge>
                )}
                <CardHeader>
                  <CardTitle>{pkg.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{pkg.description}</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-3xl font-bold">{pkg.totalCredits} kredit</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCurrency(pkg.price)}
                      {pkg.bonusCredits > 0 ? ` · bonus ${pkg.bonusCredits} kredit` : ""}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Kredit top up tidak bergantung paket bulanan
                    </div>
                  </div>
                  <Button
                    variant={pkg.isPopular ? "brand" : "outline"}
                    className="w-full"
                    disabled={loading !== null}
                    onClick={() => handleTopup(pkg.slug)}
                  >
                    {loading === key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Top Up Sekarang
                        <ExternalLink className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}

        <QaSection
          title="Q&A Top Up Kredit"
          description="Panduan singkat agar guru baru paham kapan perlu top up dan bagaimana kredit masuk."
          items={TOPUP_QA}
        />
      </div>
    </DashboardShell>
  );
}
