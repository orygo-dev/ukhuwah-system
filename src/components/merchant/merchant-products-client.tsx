"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { readResponseJson } from "@/lib/http-json";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_KIND_LABELS, PRODUCT_STATUS_LABELS, type ProductKind } from "@/lib/marketplace.shared";

type Product = {
  id: string;
  title: string;
  description: string | null;
  kind: ProductKind;
  price: number;
  stock: number;
  imageUrl: string | null;
  status: string;
  hasDigitalFile?: boolean;
};

const KINDS: ProductKind[] = ["BOOK_PHYSICAL", "BOOK_DIGITAL", "STATIONERY"];

export function MerchantProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ProductKind>("BOOK_PHYSICAL");
  const [price, setPrice] = useState(25000);
  const [stock, setStock] = useState(10);
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/merchant/products");
    const json = await readResponseJson<{ products: Product[] }>(res);
    if (!res.ok) throw new Error(json.error || "Gagal memuat produk");
    setProducts(json.products);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"));
  }, []);

  async function uploadCover(file: File) {
    const form = new FormData();
    form.set("kind", "image");
    form.set("file", file);
    const res = await fetch("/api/merchant/products/upload", { method: "POST", body: form });
    const json = await readResponseJson<{ url?: string }>(res);
    if (!res.ok || !json.url) throw new Error(json.error || "Unggah gambar gagal");
    setImageUrl(json.url);
  }

  async function uploadDigital(productId: string, file: File) {
    const form = new FormData();
    form.set("kind", "digital");
    form.set("productId", productId);
    form.set("file", file);
    const res = await fetch("/api/merchant/products/upload", { method: "POST", body: form });
    const json = await readResponseJson<{ error?: string }>(res);
    if (!res.ok) throw new Error(json.error || "Unggah file digital gagal");
  }

  async function createProduct() {
    setBusy("create");
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/merchant/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          kind,
          price,
          stock: kind === "BOOK_DIGITAL" ? 0 : stock,
          imageUrl: imageUrl || null,
        }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal menambah produk");
      setTitle("");
      setDescription("");
      setImageUrl("");
      setMessage("Produk disimpan sebagai draf.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah produk");
    } finally {
      setBusy("");
    }
  }

  async function submitReview(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/merchant/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal mengirim review");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim review");
    } finally {
      setBusy("");
    }
  }

  async function archive(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/merchant/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal mengarsipkan");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengarsipkan");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Produk</h1>
        <p className="text-sm text-slate-500">Simpan draf, unggah file digital, lalu kirim untuk review Super Admin.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>Produk baru</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Judul</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis</Label>
              <select
                className="h-10 w-full rounded-xl border px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as ProductKind)}
              >
                {KINDS.map((value) => (
                  <option key={value} value={value}>{PRODUCT_KIND_LABELS[value]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Harga (Rp)</Label>
              <Input type="number" min={1000} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
            </div>
            {kind !== "BOOK_DIGITAL" ? (
              <div className="space-y-1.5">
                <Label>Stok</Label>
                <Input type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value) || 0)} />
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Sampul</Label>
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadCover(file).catch((err) => setError(err instanceof Error ? err.message : "Unggah gagal"));
            }} />
            {imageUrl ? <p className="text-xs text-emerald-700">Gambar siap.</p> : null}
          </div>
          <Button type="button" onClick={createProduct} disabled={busy === "create" || title.trim().length < 2}>
            Simpan draf
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {products.map((product) => (
          <Card key={product.id} className="rounded-3xl">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt="" className="h-24 w-24 rounded-2xl object-cover" />
              ) : (
                <div className="h-24 w-24 rounded-2xl bg-slate-100" />
              )}
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black">{product.title}</h2>
                  <Badge>{PRODUCT_STATUS_LABELS[product.status] || product.status}</Badge>
                  <Badge variant="secondary">{PRODUCT_KIND_LABELS[product.kind]}</Badge>
                </div>
                <p className="text-sm text-slate-500">{formatCurrency(product.price)} · stok {product.stock}</p>
                {product.kind === "BOOK_DIGITAL" ? (
                  <div className="pt-2">
                    <Label className="text-xs">File digital (PDF/EPUB/ZIP)</Label>
                    <Input type="file" accept=".pdf,.epub,.zip" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBusy(product.id);
                      uploadDigital(product.id, file)
                        .then(() => load())
                        .catch((err) => setError(err instanceof Error ? err.message : "Unggah gagal"))
                        .finally(() => setBusy(""));
                    }} />
                    {product.hasDigitalFile ? <p className="mt-1 text-xs text-emerald-700">File terunggah.</p> : <p className="mt-1 text-xs text-amber-700">Belum ada file.</p>}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                {product.status === "DRAFT" || product.status === "REJECTED" ? (
                  <Button size="sm" disabled={busy === product.id} onClick={() => submitReview(product.id)}>
                    Kirim review
                  </Button>
                ) : null}
                {product.status !== "ARCHIVED" ? (
                  <Button size="sm" variant="outline" disabled={busy === product.id} onClick={() => archive(product.id)}>
                    Arsipkan
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
