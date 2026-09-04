"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  Sparkles,
  Wallet,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useMidtransSnap } from "@/components/payment/midtrans-snap";
import { QaSection } from "@/components/dashboard/qa-section";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number;
  creditsMonthly: number;
  features?: {
    monthly_credit_bonus?: number;
  } | null;
  isPopular: boolean;
};

type PaymentConfig = {
  midtrans?: { clientKey: string; isSandbox: boolean } | null;
};

const BILLING_QA = [
  {
    question: "Apa yang saya dapat saat berlangganan?",
    answer:
      "Paket langganan memberi benefit bulanan sesuai pengaturan admin, seperti kredit rutin, akses generator tertentu, dan batas penggunaan fitur aplikasi.",
  },
  {
    question: "Apakah kredit bulanan sama dengan kredit top up?",
    answer:
      "Kredit bulanan berasal dari paket langganan, sedangkan kredit top up dibeli terpisah. Keduanya dapat dipakai untuk menjalankan generator sesuai aturan paket dan biaya modul.",
  },
  {
    question: "Kapan paket aktif setelah pembayaran?",
    answer:
      "Paket aktif otomatis setelah payment gateway mengirim status pembayaran berhasil. Jika pembayaran masih pending, status akan diperbarui setelah gateway mengonfirmasi.",
  },
  {
    question: "Apakah saya tetap bisa top up jika sudah berlangganan?",
    answer:
      "Bisa. Top up berguna saat kredit paket bulanan sudah habis, tetapi guru masih perlu membuat dokumen tambahan.",
  },
];

export default function BillingPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [plans, setPlans] = useState<Plan[]>([]);
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

    const loadBillingData = async () => {
      try {
        const [planRes, configRes] = await Promise.all([
          fetch("/api/plans"),
          fetch("/api/payment/config"),
        ]);
        const planData = await planRes.json().catch(() => null);
        const configData = await configRes.json().catch(() => null);

        if (!planRes.ok) throw new Error(planData?.error || "Gagal memuat paket langganan");
        if (!configRes.ok) throw new Error(configData?.error || "Gagal memuat konfigurasi pembayaran");

        if (active) {
          setPlans(planData?.plans || []);
          setPaymentConfig(configData || {});
        }
      } catch (event) {
        if (active) {
          setError(event instanceof Error ? event.message : "Gagal memuat data langganan");
        }
      } finally {
        if (active) setInitialLoading(false);
      }
    };

    void loadBillingData();
    return () => {
      active = false;
    };
  }, []);

  const paidPlans = useMemo(
    () => plans.filter((plan) => plan.slug !== "free"),
    [plans]
  );

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

  const handlePurchase = async (slug: string) => {
    const key = `subscription:${slug}`;
    setLoading(key);
    setError("");

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: slug }),
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
      activePath="/dashboard/billing"
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
                <h1 className="text-2xl font-bold tracking-tight">Paket Langganan</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Aktifkan paket bulanan untuk membuka akses fitur, quota penggunaan,
                  dan kredit rutin sesuai kebutuhan mengajar.
                </p>
              </div>
              <Badge variant="success" className="gap-1 px-3 py-1">
                <Coins className="h-3.5 w-3.5" />
                {session?.user?.creditsRemaining ?? 0} kredit
              </Badge>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground">Paket aktif</p>
                <p className="mt-1 text-lg font-semibold">Benefit bulanan</p>
              </div>
              <div className="rounded-xl border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground">Kredit rutin</p>
                <p className="mt-1 text-lg font-semibold">Langganan bulanan</p>
              </div>
              <div className="rounded-xl border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground">Saldo afiliasi</p>
                <Link href="/dashboard/wallet" className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-primary">
                  Buka dompet <ExternalLink className="h-4 w-4" />
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
        ) : paidPlans.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="font-semibold text-slate-950">Belum ada paket aktif</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Paket langganan belum tersedia. Hubungi admin jika Bapak/Ibu ingin
                mengaktifkan paket premium.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {paidPlans.map((plan) => {
              const key = `subscription:${plan.slug}`;
              const bonusCredits = Number(plan.features?.monthly_credit_bonus ?? 0);
              const totalCredits = plan.creditsMonthly + bonusCredits;
              return (
                <Card
                  key={plan.id}
                  className={`relative ${plan.isPopular ? "border-primary ring-2 ring-primary/15" : ""}`}
                >
                  {plan.isPopular && (
                    <Badge className="absolute right-4 top-4">Populer</Badge>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <p className="text-3xl font-bold">{formatCurrency(plan.priceMonthly)}</p>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        {totalCredits} kredit/bulan
                        {bonusCredits > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            ({plan.creditsMonthly} + bonus {bonusCredits})
                          </span>
                        ) : null}
                      </li>
                      <li className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Cocok untuk penggunaan rutin
                      </li>
                    </ul>
                    <Button
                      variant={plan.isPopular ? "brand" : "outline"}
                      className="w-full"
                      disabled={loading !== null}
                      onClick={() => handlePurchase(plan.slug)}
                    >
                      {loading === key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Berlangganan
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
          title="Q&A Paket Langganan"
          description="Penjelasan singkat tentang benefit paket, kredit bulanan, dan kapan paket aktif."
          items={BILLING_QA}
        />
      </div>
    </DashboardShell>
  );
}
