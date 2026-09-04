"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readResponseJson } from "@/lib/http-json";

type Store = {
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  flatShippingFee: number;
  status: string;
};

export function MerchantStoreClient() {
  const [store, setStore] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/merchant/store")
      .then(async (res) => {
        const json = await readResponseJson<{ store: Store }>(res);
        if (!res.ok) throw new Error(json.error || "Gagal memuat toko");
        setStore(json.store);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!store) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/merchant/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(store),
      });
      const json = await readResponseJson<{ store: Store }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      setStore(json.store);
      setMessage("Data toko disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (error && !store) return <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>;
  if (!store) return <p className="text-sm text-slate-500">Memuat toko...</p>;

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Profil toko</CardTitle>
        <p className="text-sm text-slate-500">Alamat kirim asal, rekening, dan ongkir flat per pesanan fisik.</p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={save}>
          <div className="space-y-1.5">
            <Label>Nama toko</Label>
            <Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Textarea value={store.description || ""} onChange={(e) => setStore({ ...store, description: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Alamat kirim asal</Label>
              <Input value={store.address || ""} onChange={(e) => setStore({ ...store, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Kota</Label>
              <Input value={store.city || ""} onChange={(e) => setStore({ ...store, city: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Bank</Label>
              <Input value={store.bankName || ""} onChange={(e) => setStore({ ...store, bankName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>No. rekening</Label>
              <Input value={store.bankAccount || ""} onChange={(e) => setStore({ ...store, bankAccount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nama rekening</Label>
              <Input value={store.bankHolder || ""} onChange={(e) => setStore({ ...store, bankHolder: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ongkir flat (Rp)</Label>
            <Input
              type="number"
              min={0}
              value={store.flatShippingFee}
              onChange={(e) => setStore({ ...store, flatShippingFee: Number(e.target.value) || 0 })}
            />
          </div>
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan toko"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
