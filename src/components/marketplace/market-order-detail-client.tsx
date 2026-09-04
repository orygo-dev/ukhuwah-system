"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  Truck,
  FileDown,
  MapPin,
  Phone,
  CreditCard,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMidtransSnap } from "@/components/payment/midtrans-snap";
import { readResponseJson } from "@/lib/http-json";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PRODUCT_KIND_LABELS, type ProductKind } from "@/lib/marketplace.shared";
import { cn } from "@/lib/utils";

type OrderDetail = {
  id: string;
  status: string;
  amount: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string | null;
  createdAt: string;
  paidAt: string | null;
  sandbox: boolean;
  snapToken?: string;
  redirectUrl?: string;
  checkoutUrl?: string;
  items: {
    id: string;
    title: string;
    kind: ProductKind;
    quantity: number;
    unitPrice: number;
    downloadable: boolean;
  }[];
  subOrders: {
    id: string;
    status: string;
    storeName: string;
    goodsAmount: number;
    shippingAmount: number;
    courier: string | null;
    trackingNumber: string | null;
  }[];
};

// Timeline steps
const TIMELINE_STEPS = [
  { key: "PENDING", label: "Menunggu Pembayaran", icon: Clock },
  { key: "PAID", label: "Pembayaran Diterima", icon: CheckCircle2 },
  { key: "COMPLETED", label: "Selesai", icon: Package },
];

function StatusTimeline({ status }: { status: string }) {
  const isFailed = ["FAILED", "EXPIRED", "CANCELLED"].includes(status);
  const activeIdx = isFailed ? 0 : TIMELINE_STEPS.findIndex((s) => s.key === status);
  const displaySteps = isFailed
    ? [{ key: status, label: ORDER_STATUS_LABELS[status] || status, icon: XCircle }]
    : TIMELINE_STEPS;

  if (isFailed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4">
        <XCircle className="h-6 w-6 text-red-500" />
        <div>
          <p className="font-black text-red-700">{ORDER_STATUS_LABELS[status] || status}</p>
          <p className="text-xs text-red-400">Pesanan ini tidak dapat diproses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0">
      {displaySteps.map((step, idx) => {
        const Icon = step.icon;
        const done = activeIdx >= idx;
        const active = activeIdx === idx;
        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                  done
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-300",
                  active && "ring-4 ring-primary/20"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className={cn("max-w-[80px] text-center text-[10px] font-bold leading-snug", done ? "text-primary" : "text-slate-300")}>
                {step.label}
              </p>
            </div>
            {idx < displaySteps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-1 mb-4 transition-colors",
                  activeIdx > idx ? "bg-primary" : "bg-slate-100"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MarketOrderDetailClient({
  basePath,
  orderId,
}: {
  basePath: string;
  orderId: string;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [midtrans, setMidtrans] = useState<{ clientKey: string; isSandbox: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const { SnapScript, pay, scriptLoaded } = useMidtransSnap({
    clientKey: midtrans?.clientKey || "",
    isSandbox: midtrans?.isSandbox ?? true,
  });

  const load = useCallback(async () => {
    const [orderRes, checkoutRes] = await Promise.all([
      fetch(`/api/market/orders/${orderId}`),
      fetch("/api/market/checkout"),
    ]);
    const json = await readResponseJson<{ order: OrderDetail }>(orderRes);
    if (!orderRes.ok) throw new Error(json.error || "Pesanan tidak ditemukan");
    setOrder(json.order);
    const checkout = await readResponseJson<{ payment?: { midtrans?: { clientKey: string; isSandbox: boolean } | null } }>(checkoutRes);
    if (checkout.payment?.midtrans) setMidtrans(checkout.payment.midtrans);
  }, [orderId]);

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"));
  }, [load]);

  async function markSandboxPaid() {
    setBusy(true);
    try {
      const res = await fetch(`/api/market/orders/${orderId}`, { method: "POST" });
      const json = await readResponseJson<{ status?: string; message?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal memperbarui status");
      setMessage(json.message || `Status diperbarui ke: ${json.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-2xl bg-red-50 p-6">
          <p className="font-bold text-red-700">{error}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${basePath}/orders`}><ArrowLeft className="mr-2 h-4 w-4" />Semua pesanan</Link>
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  const isPending = order.status === "PENDING";
  const isPaid = order.status === "PAID" || order.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {midtrans?.clientKey ? SnapScript : null}

      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-2 text-sm text-slate-500">
          <Link href={`${basePath}/orders`} className="flex items-center gap-1 font-semibold hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Riwayat Pesanan
          </Link>
          <span>/</span>
          <span className="font-mono font-bold text-slate-900">#{order.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        {message ? (
          <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</div>
        ) : null}
        {error ? (
          <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>
        ) : null}

        {/* Status timeline */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status Pesanan</p>
          <StatusTimeline status={order.status} />
          {order.paidAt && (
            <p className="mt-3 text-xs text-slate-400">
              Dibayar pada {new Date(order.paidAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
            </p>
          )}
        </div>

        {/* Payment actions (pending) */}
        {isPending && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <p className="mb-3 font-black text-amber-800">Menunggu Pembayaran</p>
            <p className="mb-4 text-sm text-amber-700">
              Total: <span className="font-black">{formatCurrency(order.amount)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {order.snapToken && midtrans?.clientKey ? (
                <Button
                  className="gap-2"
                  onClick={() =>
                    pay(order.snapToken!, {
                      onSuccess: () => void load(),
                      onPending: () => void load(),
                      onClose: () => void load(),
                    })
                  }
                  disabled={!scriptLoaded}
                >
                  <CreditCard className="h-4 w-4" />
                  Lanjutkan Pembayaran
                </Button>
              ) : null}
              {order.checkoutUrl ? (
                <Button asChild variant="outline" className="gap-2">
                  <a href={order.checkoutUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Buka Tripay
                  </a>
                </Button>
              ) : null}
              {order.sandbox ? (
                <Button variant="outline" className="gap-2" disabled={busy} onClick={() => void markSandboxPaid()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Simulasi Bayar (Sandbox)
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-50 px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Item Pesanan</p>
          </div>
          {order.items.map((item, idx) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-4 px-5 py-4",
                idx < order.items.length - 1 && "border-b border-slate-50"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                <Package className="h-5 w-5 text-slate-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-900 truncate">{item.title}</p>
                <p className="text-xs text-slate-400">
                  {PRODUCT_KIND_LABELS[item.kind]} · x{item.quantity} · {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-slate-800">{formatCurrency(item.unitPrice * item.quantity)}</p>
                {item.downloadable ? (
                  <a
                    href={`/api/market/orders/${order.id}/items/${item.id}/download`}
                    className="mt-1 inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-primary/90"
                  >
                    <FileDown className="h-3 w-3" />
                    Unduh File
                  </a>
                ) : item.kind === "BOOK_DIGITAL" ? (
                  <p className="mt-1 text-[11px] text-amber-600 font-semibold">
                    {isPaid ? "Siap diunduh" : "Tersedia setelah bayar"}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Shipping address */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Alamat Pengiriman</p>
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="text-sm text-slate-700 space-y-0.5">
                <p className="font-black text-slate-900">{order.shippingName}</p>
                <p className="flex items-center gap-1 text-slate-500">
                  <Phone className="h-3 w-3" />
                  {order.shippingPhone}
                </p>
                <p>{order.shippingAddress}</p>
                {order.shippingCity && <p>{order.shippingCity}</p>}
              </div>
            </div>
          </div>

          {/* Payment summary */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Ringkasan Biaya</p>
            <div className="space-y-2 text-sm">
              {order.subOrders.map((sub) => (
                <div key={sub.id}>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{sub.storeName} (barang)</span>
                    <span className="font-semibold">{formatCurrency(sub.goodsAmount)}</span>
                  </div>
                  {sub.shippingAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{sub.storeName} (ongkir)</span>
                      <span className="font-semibold">{formatCurrency(sub.shippingAmount)}</span>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="font-black text-slate-900">Total</span>
                <span className="font-black text-primary">{formatCurrency(order.amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-order shipping info (for physical) */}
        {order.subOrders.some((s) => s.courier || s.trackingNumber) && (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-50 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Info Pengiriman</p>
            </div>
            {order.subOrders.filter((s) => s.courier || s.trackingNumber).map((sub) => (
              <div key={sub.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <Truck className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-black text-slate-900">{sub.storeName}</p>
                  <p className="text-sm text-slate-500">
                    {sub.courier && <span>{sub.courier} </span>}
                    {sub.trackingNumber && (
                      <span className="font-mono font-bold text-slate-700">{sub.trackingNumber}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center">
          <Button asChild variant="ghost" className="text-slate-400">
            <Link href={`${basePath}/orders`}><ArrowLeft className="mr-2 h-4 w-4" />Semua Pesanan</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
