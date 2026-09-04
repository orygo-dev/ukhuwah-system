"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Zap, MapPin, Package, FileDown, Star, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { readResponseJson } from "@/lib/http-json";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_KIND_LABELS, type ProductKind } from "@/lib/marketplace.shared";
import { cn } from "@/lib/utils";
import type { CatalogProduct } from "./market-catalog-client";

export function MarketProductDetailClient({
  basePath,
  productId,
}: {
  basePath: string;
  productId: string;
}) {
  const router = useRouter();
  const [product, setProduct] = useState<(CatalogProduct & { storeDescription?: string | null }) | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    fetch(`/api/market/products/${productId}`)
      .then(async (res) => {
        const json = await readResponseJson<{ product: CatalogProduct }>(res);
        if (!res.ok) throw new Error(json.error || "Produk tidak ditemukan");
        setProduct(json.product);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"));
  }, [productId]);

  async function addToCart(redirect = false) {
    if (!product) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/market/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: qty }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal menambah keranjang");
      if (redirect) {
        router.push(`${basePath}/cart`);
      } else {
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah keranjang");
    } finally {
      setBusy(false);
    }
  }

  if (error && !product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-2xl bg-red-50 p-6">
          <p className="font-bold text-red-700">{error}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={basePath}><ArrowLeft className="mr-2 h-4 w-4" />Kembali ke katalog</Link>
        </Button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="grid animate-pulse gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <div className="mb-4 h-[360px] rounded-2xl bg-slate-100" />
          <div className="space-y-3 rounded-2xl border p-6">
            <div className="h-4 w-16 rounded bg-slate-100" />
            <div className="h-7 w-2/3 rounded bg-slate-100" />
            <div className="h-4 w-1/3 rounded bg-slate-100" />
            <div className="h-20 rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-72 rounded-2xl bg-slate-100 lg:sticky lg:top-24" />
      </div>
    );
  }

  const kind = product.kind as ProductKind;
  const outOfStock = product.physical && product.stock < 1;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Breadcrumb */}
      <div className="bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm text-slate-500">
          <Link href={basePath} className="flex items-center gap-1 font-semibold hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Katalog
          </Link>
          <span>/</span>
          <span className="truncate font-bold text-slate-900">{product.title}</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          {/* Left: image + description */}
          <div className="space-y-4">
            {/* Product image */}
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50 shadow-sm">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="h-[340px] w-full object-cover"
                />
              ) : (
                <div className="flex h-[340px] items-center justify-center">
                  <ShoppingCart className="h-20 w-20 text-emerald-200" />
                </div>
              )}
            </div>

            {/* Description card */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">{PRODUCT_KIND_LABELS[kind]}</Badge>
                {!product.physical && <Badge className="rounded-full bg-blue-500">Digital</Badge>}
                {outOfStock && <Badge variant="secondary" className="rounded-full bg-slate-200 text-slate-600">Stok habis</Badge>}
              </div>
              <h1 className="mb-1 text-2xl font-black leading-tight text-slate-900">{product.title}</h1>
              <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-3.5 w-3.5" />
                <span>{product.store.name}{product.store.city ? ` · ${product.store.city}` : ""}</span>
              </div>
              {product.description ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Deskripsi Produk</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{product.description}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Tidak ada deskripsi.</p>
              )}
            </div>

            {/* Store info */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Info Toko</p>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black text-slate-900">{product.store.name}</p>
                  {product.store.city && <p className="text-xs text-slate-500">{product.store.city}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Right: buy panel — sticky */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="mb-1 text-3xl font-black text-primary">{formatCurrency(product.price)}</p>

              {product.physical ? (
                <div className="mb-4 space-y-1 text-sm text-slate-500">
                  <p>Stok tersedia: <span className="font-bold text-slate-700">{product.stock}</span></p>
                  <p>Ongkos kirim toko: <span className="font-bold text-slate-700">{formatCurrency(product.store.shippingFee)}</span></p>
                </div>
              ) : (
                <div className="mb-4 flex items-center gap-2 text-sm text-blue-600">
                  <FileDown className="h-4 w-4" />
                  <span>File digital — unduh setelah bayar lunas</span>
                </div>
              )}

              {/* Quantity control */}
              {!outOfStock && (
                <div className="mb-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Jumlah</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      onClick={() => setQty((v) => Math.max(1, v - 1))}
                      disabled={qty <= 1}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center text-lg font-black">{qty}</span>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      onClick={() => setQty((v) => Math.min(99, v + 1))}
                      disabled={product.physical && qty >= product.stock}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    {qty > 1 && (
                      <span className="ml-2 text-sm text-slate-500">
                        = {formatCurrency(product.price * qty)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {error ? (
                <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>
              ) : null}

              {addedToCart ? (
                <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  ✓ Ditambahkan ke keranjang!
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full gap-2 rounded-xl py-5 text-base font-black"
                  disabled={busy || outOfStock}
                  onClick={() => void addToCart(true)}
                >
                  <Zap className="h-4 w-4" />
                  {outOfStock ? "Stok Habis" : "Beli Sekarang"}
                </Button>
                {!outOfStock && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 rounded-xl py-5 text-base font-bold"
                    disabled={busy}
                    onClick={() => void addToCart(false)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Masukkan Keranjang
                  </Button>
                )}
                <Button asChild variant="ghost" className="w-full text-slate-500">
                  <Link href={basePath}>Kembali ke katalog</Link>
                </Button>
              </div>

              <p className="mt-4 text-center text-[11px] text-slate-400">
                Pembayaran aman · Kredit AI tidak dipakai
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
