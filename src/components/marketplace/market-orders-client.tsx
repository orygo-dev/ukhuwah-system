"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, ChevronRight, Clock, CheckCircle2, XCircle, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readResponseJson } from "@/lib/http-json";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/marketplace.shared";
import { cn } from "@/lib/utils";

type OrderRow = {
  id: string;
  status: string;
  amount: number;
  createdAt: string;
  itemCount: number;
  titles: string[];
};

function statusMeta(status: string) {
  switch (status) {
    case "PAID":
    case "COMPLETED":
      return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: ORDER_STATUS_LABELS[status] || status };
    case "PENDING":
      return { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", label: ORDER_STATUS_LABELS[status] || status };
    case "FAILED":
    case "EXPIRED":
    case "CANCELLED":
      return { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: ORDER_STATUS_LABELS[status] || status };
    default:
      return { icon: Package, color: "text-slate-500", bg: "bg-slate-100", label: ORDER_STATUS_LABELS[status] || status };
  }
}

export function MarketOrdersClient({ basePath }: { basePath: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market/orders")
      .then(async (res) => {
        const json = await readResponseJson<{ orders: OrderRow[] }>(res);
        if (!res.ok) throw new Error(json.error || "Gagal memuat pesanan");
        setOrders(json.orders);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-2 text-sm text-slate-500">
          <Link href={basePath} className="flex items-center gap-1 font-semibold hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Katalog
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-900">Riwayat Pesanan</span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Marketplace</p>
            <h1 className="text-2xl font-black text-slate-900">Riwayat Pesanan</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`${basePath}/cart`}>Keranjang</Link>
          </Button>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                  <div className="h-5 w-20 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-center">
            <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-slate-200" />
            <p className="font-bold text-slate-400">Belum ada pesanan</p>
            <Button asChild variant="link" className="mt-2 text-primary">
              <Link href={basePath}>Mulai belanja</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const meta = statusMeta(order.status);
              const Icon = meta.icon;
              return (
                <Link key={order.id} href={`${basePath}/orders/${order.id}`} className="group block">
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                    {/* Status icon */}
                    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", meta.bg)}>
                      <Icon className={cn("h-6 w-6", meta.color)} />
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-900">
                        {order.titles.join(", ") || "Pesanan"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {order.itemCount} item · {new Date(order.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    {/* Right */}
                    <div className="shrink-0 text-right">
                      <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold", meta.bg, meta.color)}>
                        {meta.label}
                      </span>
                      <p className="mt-1 font-black text-slate-900">{formatCurrency(order.amount)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-primary" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
