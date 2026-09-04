"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readResponseJson } from "@/lib/http-json";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PRODUCT_KIND_LABELS } from "@/lib/marketplace.shared";

type SubOrder = {
  id: string;
  status: string;
  goodsAmount: number;
  shippingAmount: number;
  courier: string | null;
  trackingNumber: string | null;
  order: {
    shippingName: string;
    shippingPhone: string;
    shippingAddress: string;
    shippingCity: string | null;
    createdAt: string;
    status: string;
  };
  items: { id: string; title: string; kind: "BOOK_PHYSICAL" | "BOOK_DIGITAL" | "STATIONERY"; quantity: number; unitPrice: number }[];
};

export function MerchantOrdersClient() {
  const [orders, setOrders] = useState<SubOrder[]>([]);
  const [courier, setCourier] = useState<Record<string, string>>({});
  const [resi, setResi] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const res = await fetch("/api/merchant/orders");
    const json = await readResponseJson<{ orders: SubOrder[] }>(res);
    if (!res.ok) throw new Error(json.error || "Gagal memuat pesanan");
    setOrders(json.orders);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"));
  }, []);

  async function ship(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/merchant/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, courier: courier[id], trackingNumber: resi[id] }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal mengisi resi");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengisi resi");
    } finally {
      setBusy("");
    }
  }

  async function markReady(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/merchant/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, markReady: true }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal menandai siap");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai siap");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Pesanan toko</h1>
        <p className="text-sm text-slate-500">Isi kurir dan resi untuk barang fisik. Tandai siap untuk pesanan digital.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {orders.length === 0 ? <p className="text-sm text-slate-500">Belum ada pesanan.</p> : null}
      {orders.map((order) => {
        const physical = order.items.some((item) => item.kind !== "BOOK_DIGITAL");
        return (
          <Card key={order.id} className="rounded-3xl">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{ORDER_STATUS_LABELS[order.status] || order.status}</Badge>
                <span className="text-sm text-slate-500">{new Date(order.order.createdAt).toLocaleString("id-ID")}</span>
              </div>
              <p className="font-semibold">{order.order.shippingName} · {order.order.shippingPhone}</p>
              <p className="text-sm text-slate-600">{order.order.shippingAddress}{order.order.shippingCity ? `, ${order.order.shippingCity}` : ""}</p>
              <ul className="text-sm">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.title} · {PRODUCT_KIND_LABELS[item.kind]} · x{item.quantity} · {formatCurrency(item.unitPrice)}
                  </li>
                ))}
              </ul>
              <p className="text-sm font-bold">
                Barang {formatCurrency(order.goodsAmount)} + ongkir {formatCurrency(order.shippingAmount)}
              </p>
              {physical && order.status !== "SHIPPED" ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input placeholder="Kurir" value={courier[order.id] || order.courier || ""} onChange={(e) => setCourier({ ...courier, [order.id]: e.target.value })} />
                  <Input placeholder="Nomor resi" value={resi[order.id] || order.trackingNumber || ""} onChange={(e) => setResi({ ...resi, [order.id]: e.target.value })} />
                  <Button disabled={busy === order.id} onClick={() => ship(order.id)}>Simpan resi</Button>
                </div>
              ) : null}
              {!physical && order.status === "PAID" ? (
                <Button disabled={busy === order.id} onClick={() => markReady(order.id)}>Tandai digital siap</Button>
              ) : null}
              {order.trackingNumber ? <p className="text-sm text-emerald-700">Resi {order.courier}: {order.trackingNumber}</p> : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
