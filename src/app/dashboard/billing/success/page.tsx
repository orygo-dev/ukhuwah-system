"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";

function BillingSuccessInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, update } = useSession();
  const id = searchParams.get("id");
  const statusParam = searchParams.get("status");
  const [status, setStatus] = useState<string>(statusParam || "checking");
  const [planName, setPlanName] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [error, setError] = useState("");
  const refreshedAfterPaid = useRef(false);
  const syncAttempted = useRef(false);

  useEffect(() => {
    if (!id) {
      setStatus("FAILED");
      setError("ID transaksi tidak ditemukan.");
      return;
    }

    const check = async () => {
      try {
        const res = await fetch(`/api/payment/status/${id}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Gagal mengecek status pembayaran");
        if (!data?.transaction) throw new Error("Data transaksi tidak ditemukan");

        let currentStatus = data.transaction.status;
        if (currentStatus === "PENDING" && !syncAttempted.current) {
          syncAttempted.current = true;
          const syncRes = await fetch(`/api/payment/status/${id}`, { method: "POST" });
          const syncData = await syncRes.json().catch(() => null);
          if (syncRes.ok && syncData?.status === "PAID") {
            currentStatus = "PAID";
          }
        }

        setError("");
        setStatus(currentStatus);
        setPlanName(data.transaction.planName || "");
        setTransactionType(data.transaction.type || "");
        if (currentStatus === "PAID" && !refreshedAfterPaid.current) {
          refreshedAfterPaid.current = true;
          await update();
          router.refresh();
        }
      } catch (event) {
        setError(event instanceof Error ? event.message : "Gagal mengecek status pembayaran");
      }
    };

    void check();
    const interval = setInterval(() => void check(), 3000);
    const timeout = setTimeout(() => clearInterval(interval), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [id, router, update]);

  const isPaid = status === "PAID";
  const isPending =
    status === "PENDING" || statusParam === "pending" || status === "checking";
  const isFailed = status === "FAILED" || status === "EXPIRED";

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
      <div className="mx-auto max-w-lg py-12">
        <Card>
          <CardContent className="flex flex-col items-center p-8 text-center">
            {isPaid ? (
              <>
                <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-500" />
                <h1 className="text-2xl font-bold">Pembayaran Berhasil!</h1>
                <p className="mt-2 text-muted-foreground">
                  {transactionType === "CREDIT_TOPUP" ? "Top up" : "Paket"}{" "}
                  <strong>{planName}</strong> aktif. Kredit:{" "}
                  <strong>{session?.user?.creditsRemaining}</strong>
                </p>
              </>
            ) : isPending ? (
              <>
                <Clock className="mb-4 h-16 w-16 text-amber-500" />
                <h1 className="text-2xl font-bold">Menunggu Pembayaran</h1>
                <p className="mt-2 text-muted-foreground">
                  Selesaikan pembayaran. Halaman ini akan update otomatis.
                </p>
                {error ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {error}
                  </p>
                ) : null}
                <Loader2 className="mt-4 h-6 w-6 animate-spin text-primary" />
              </>
            ) : isFailed ? (
              <>
                <AlertCircle className="mb-4 h-16 w-16 text-destructive" />
                <h1 className="text-2xl font-bold">
                  {status === "EXPIRED" ? "Pembayaran Kedaluwarsa" : "Pembayaran Gagal"}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  {error || (
                    <>
                      Transaksi <strong>{planName || "pembayaran"}</strong> belum berhasil.
                    </>
                  )}{" "}
                  Silakan buat pembayaran baru atau pilih metode lain.
                </p>
              </>
            ) : (
              <h1 className="text-2xl font-bold">Status: {status}</h1>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="brand" asChild>
                <Link href="/dashboard/tools">Mulai Generate</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/billing">Kembali</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <BillingSuccessInner />
    </Suspense>
  );
}
