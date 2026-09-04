"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ShoppingBag, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readResponseJson } from "@/lib/http-json";
import { STORE_STATUS_LABELS } from "@/lib/marketplace.shared";

type StorePayload = {
  store: {
    name: string;
    status: string;
    rejectionNote?: string | null;
    city?: string | null;
  };
  stats: { productCount: number; pendingOrders: number };
};

export function MerchantHomeClient() {
  const [data, setData] = useState<StorePayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/merchant/store")
      .then(async (res) => {
        const json = await readResponseJson<StorePayload>(res);
        if (!res.ok) throw new Error(json.error || "Gagal memuat toko");
        setData(json);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"));
  }, []);

  if (error) return <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Memuat toko...</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Portal Merchant</p>
        <h1 className="text-2xl font-black">{data.store.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge>{STORE_STATUS_LABELS[data.store.status] || data.store.status}</Badge>
          {data.store.city ? <span className="text-sm text-slate-500">{data.store.city}</span> : null}
        </div>
        {data.store.status === "PENDING_REVIEW" ? (
          <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            Toko menunggu persetujuan Super Admin. Anda tetap bisa menyiapkan produk sebagai draf.
          </p>
        ) : null}
        {data.store.status === "REJECTED" ? (
          <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            Toko ditolak. {data.store.rejectionNote || "Perbarui data toko lalu hubungi admin."}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-3xl">
          <CardContent className="flex items-center gap-4 p-5">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Produk</p>
              <p className="text-2xl font-black">{data.stats.productCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardContent className="flex items-center gap-4 p-5">
            <ShoppingBag className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Pesanan perlu diproses</p>
              <p className="text-2xl font-black">{data.stats.pendingOrders}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/merchant/store"><Store className="mr-2 h-4 w-4" />Kelola toko</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/merchant/products">Tambah produk</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/merchant/orders">Lihat pesanan</Link>
        </Button>
      </div>
    </div>
  );
}
