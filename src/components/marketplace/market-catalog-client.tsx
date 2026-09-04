"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Search, ShoppingBag, ShoppingCart, Filter, X, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readResponseJson } from "@/lib/http-json";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_KIND_LABELS, type ProductKind } from "@/lib/marketplace.shared";
import { cn } from "@/lib/utils";

export type CatalogProduct = {
  id: string;
  title: string;
  description: string | null;
  kind: ProductKind;
  price: number;
  stock: number;
  imageUrl: string | null;
  physical: boolean;
  store: { id: string; name: string; city: string | null; shippingFee: number };
};

const KIND_TABS = [
  { value: "", label: "Semua" },
  ...Object.entries(PRODUCT_KIND_LABELS).map(([value, label]) => ({ value, label })),
];

function ProductSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="h-48 bg-slate-100" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-16 rounded bg-slate-100" />
        <div className="h-4 w-3/4 rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
        <div className="h-5 w-1/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function MarketCatalogClient({ basePath }: { basePath: string }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(nextQ = q, nextKind = kind) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextQ) params.set("q", nextQ);
      if (nextKind) params.set("kind", nextKind);
      const res = await fetch(`/api/market/products?${params.toString()}`);
      const json = await readResponseJson<{ products: CatalogProduct[] }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal memuat katalog");
      setProducts(json.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  async function loadCart() {
    try {
      const res = await fetch("/api/market/cart");
      const json = await readResponseJson<{ items: { id: string }[] }>(res);
      if (res.ok) setCartCount(json.items?.length ?? 0);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void load();
    void loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void load(value, kind);
    }, 400);
  }

  function handleKindChange(value: string) {
    setKind(value);
    void load(q, value);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="rounded-xl border-slate-200 pl-9 pr-4 shadow-none focus-visible:ring-primary/30"
                placeholder="Cari judul, toko, atau jenis produk..."
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {q ? (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  onClick={() => handleSearch("")}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Button asChild variant="outline" size="sm" className="relative shrink-0 rounded-xl">
              <Link href={`${basePath}/cart`}>
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Keranjang</span>
                {cartCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          </div>
          {/* Kind filter chips */}
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
            {KIND_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleKindChange(tab.value)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                  kind === tab.value
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Page header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Marketplace</p>
            <h1 className="text-2xl font-black text-slate-900">Toko Buku & ATK</h1>
            <p className="mt-0.5 text-sm text-slate-500">Produk fisik dan digital dari merchant Navalogi</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`${basePath}/orders`} className="text-slate-500">Riwayat Pesanan</Link>
          </Button>
        </div>

        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            <X className="h-4 w-4 shrink-0" />{error}
          </div>
        ) : null}

        {/* Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center">
            <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-slate-200" />
            <p className="font-bold text-slate-400">Tidak ada produk ditemukan</p>
            {q || kind ? (
              <Button variant="link" className="mt-1 text-primary" onClick={() => { setQ(""); void handleKindChange(""); }}>
                Hapus filter
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <Link key={product.id} href={`${basePath}/${product.id}`} className="group block">
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-emerald-50 to-blue-50">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="h-14 w-14 text-emerald-200" />
                      </div>
                    )}
                    {/* Badges overlay */}
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm backdrop-blur-sm">
                        {PRODUCT_KIND_LABELS[product.kind]}
                      </span>
                      {!product.physical && (
                        <span className="rounded-full bg-blue-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                          Digital
                        </span>
                      )}
                      {product.physical && product.stock <= 5 && product.stock > 0 && (
                        <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                          Stok sisa {product.stock}
                        </span>
                      )}
                      {product.physical && product.stock === 0 && (
                        <span className="rounded-full bg-slate-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                          Habis
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <p className="mb-0.5 truncate text-[11px] font-semibold text-slate-400">
                      {product.store.name}{product.store.city ? ` · ${product.store.city}` : ""}
                    </p>
                    <h2 className="mb-2 line-clamp-2 text-sm font-black leading-snug text-slate-900">
                      {product.title}
                    </h2>
                    <p className="text-base font-black text-primary">{formatCurrency(product.price)}</p>
                    {product.physical && (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        + ongkir {formatCurrency(product.store.shippingFee)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
