"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readResponseJson } from "@/lib/http-json";
import { formatCurrency } from "@/lib/utils";
import {
  PRODUCT_KIND_LABELS,
  PRODUCT_STATUS_LABELS,
  STORE_STATUS_LABELS,
  type ProductKind,
} from "@/lib/marketplace.shared";

type StoreRow = {
  id: string;
  name: string;
  status: string;
  city: string | null;
  ownerName: string;
  ownerEmail: string;
  productCount: number;
  rejectionNote: string | null;
};

type ProductRow = {
  id: string;
  title: string;
  kind: ProductKind;
  status: string;
  price: number;
  stock: number;
  hasDigitalFile: boolean;
  storeName: string;
  storeStatus: string;
  rejectionNote: string | null;
};

export function AdminMarketClient() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [commissionPercent, setCommissionPercent] = useState(5);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const res = await fetch("/api/admin/market");
    const json = await readResponseJson<{
      stores: StoreRow[];
      products: ProductRow[];
      commissionPercent: number;
    }>(res);
    if (!res.ok) throw new Error(json.error || "Gagal memuat marketplace");
    setStores(json.stores);
    setProducts(json.products);
    setCommissionPercent(json.commissionPercent);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"));
  }, []);

  async function patch(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/market", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      setMessage("Perubahan disimpan.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Super Admin</p>
        <h1 className="text-2xl font-black">Marketplace</h1>
        <p className="text-sm text-slate-500">Setujui toko dan produk. Komisi platform disimpan, payout otomatis belum aktif.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>Komisi platform</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Input
            className="w-32"
            type="number"
            min={0}
            max={100}
            value={commissionPercent}
            onChange={(e) => setCommissionPercent(Number(e.target.value) || 0)}
          />
          <Button disabled={busy === "commission"} onClick={() => patch({ commissionPercent }, "commission")}>
            Simpan komisi
          </Button>
          <p className="text-xs text-slate-500">Persen dari subtotal barang. Belum ada payout otomatis (Fase 2).</p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>Toko</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {stores.map((store) => (
            <div key={store.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{store.name}</p>
                  <p className="text-sm text-slate-500">{store.ownerName} · {store.ownerEmail} · {store.productCount} produk</p>
                </div>
                <Badge>{STORE_STATUS_LABELS[store.status] || store.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy === store.id} onClick={() => patch({ storeId: store.id, action: "approve" }, store.id)}>Setujui</Button>
                <Button size="sm" variant="outline" disabled={busy === store.id} onClick={() => patch({ storeId: store.id, action: "reject", note }, store.id)}>Tolak</Button>
                <Button size="sm" variant="outline" disabled={busy === store.id} onClick={() => patch({ storeId: store.id, action: "suspend", note }, store.id)}>Tangguhkan</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>Produk</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Catatan penolakan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{product.title}</p>
                  <p className="text-sm text-slate-500">
                    {product.storeName} · {PRODUCT_KIND_LABELS[product.kind]} · {formatCurrency(product.price)}
                    {product.kind === "BOOK_DIGITAL" ? product.hasDigitalFile ? " · file ada" : " · file belum ada" : ` · stok ${product.stock}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge>{PRODUCT_STATUS_LABELS[product.status] || product.status}</Badge>
                  <Badge variant="secondary">{STORE_STATUS_LABELS[product.storeStatus] || product.storeStatus}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy === product.id} onClick={() => patch({ productId: product.id, action: "approve" }, product.id)}>Setujui</Button>
                <Button size="sm" variant="outline" disabled={busy === product.id} onClick={() => patch({ productId: product.id, action: "reject", note }, product.id)}>Tolak</Button>
                <Button size="sm" variant="outline" disabled={busy === product.id} onClick={() => patch({ productId: product.id, action: "suspend" }, product.id)}>Arsipkan</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
