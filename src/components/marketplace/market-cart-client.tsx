"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Package,
  CreditCard,
  Loader2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMidtransSnap } from "@/components/payment/midtrans-snap";
import { readResponseJson } from "@/lib/http-json";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_KIND_LABELS, type ProductKind } from "@/lib/marketplace.shared";

type CartItem = {
  id: string;
  quantity: number;
  lineTotal: number;
  product: {
    id: string;
    title: string;
    kind: ProductKind;
    price: number;
    stock: number;
    physical: boolean;
    imageUrl: string | null;
    store: { name: string };
  };
};

type CheckoutInfo = {
  shipping: { shippingName: string; shippingPhone: string; shippingAddress: string; shippingCity: string };
  payment: { gateway: { slug: string; name: string; isSandbox: boolean } | null; midtrans: { clientKey: string; isSandbox: boolean } | null };
};

// Group items by store
function groupByStore(items: CartItem[]) {
  const map = new Map<string, { storeName: string; items: CartItem[] }>();
  for (const item of items) {
    const name = item.product.store.name;
    if (!map.has(name)) map.set(name, { storeName: name, items: [] });
    map.get(name)!.items.push(item);
  }
  return [...map.values()];
}

export function MarketCartClient({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState({ goods: 0, shipping: 0, total: 0 });
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [shipping, setShipping] = useState({ shippingName: "", shippingPhone: "", shippingAddress: "", shippingCity: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [step, setStep] = useState<"cart" | "checkout">("cart");

  const midtrans = info?.payment.midtrans;
  const { SnapScript, pay, scriptLoaded } = useMidtransSnap({
    clientKey: midtrans?.clientKey || "",
    isSandbox: midtrans?.isSandbox ?? true,
  });

  const load = useCallback(async () => {
    const [cartRes, checkoutRes] = await Promise.all([
      fetch("/api/market/cart"),
      fetch("/api/market/checkout"),
    ]);
    const cart = await readResponseJson<{ items: CartItem[]; summary: { goods: number; shipping: number; total: number } }>(cartRes);
    if (!cartRes.ok) throw new Error(cart.error || "Gagal memuat keranjang");
    const checkout = await readResponseJson<CheckoutInfo>(checkoutRes);
    if (!checkoutRes.ok) throw new Error(checkout.error || "Gagal memuat checkout");
    setItems(cart.items);
    setSummary(cart.summary);
    setInfo(checkout);
    setShipping((current) =>
      current.shippingName ? current : checkout.shipping,
    );
  }, []);

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat"));
  }, [load]);

  async function updateQty(id: string, quantity: number) {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/market/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, quantity }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal mengubah jumlah");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah");
    } finally {
      setUpdatingId(null);
    }
  }

  async function doCheckout() {
    if (items.length === 0) {
      setError("Keranjang kosong. Tambah produk sebelum bayar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/market/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipping),
      });
      const json = await readResponseJson<{
        orderId?: string;
        gateway?: string;
        snapToken?: string;
        redirectUrl?: string;
        checkoutUrl?: string;
      }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal checkout");
      if (json.gateway === "midtrans" && json.snapToken) {
        if (!scriptLoaded || !midtrans?.clientKey) {
          if (json.redirectUrl) {
            window.location.href = json.redirectUrl;
            return;
          }
          throw new Error("Midtrans belum siap. Muat ulang halaman.");
        }
        pay(json.snapToken, {
          onSuccess: () => router.push(`${basePath}/orders/${json.orderId}`),
          onPending: () => router.push(`${basePath}/orders/${json.orderId}`),
          onError: (value) =>
            setError(
              typeof value === "object" && value && "message" in value
                ? String((value as { message: string }).message)
                : "Pembayaran gagal."
            ),
          onClose: () => router.push(`${basePath}/orders/${json.orderId}`),
        });
        return;
      }
      if (json.gateway === "tripay" && json.checkoutUrl) {
        window.open(json.checkoutUrl, "_blank", "noopener,noreferrer");
        router.push(`${basePath}/orders/${json.orderId}`);
        return;
      }
      throw new Error("Gateway tidak mengembalikan halaman pembayaran.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout gagal");
    } finally {
      setBusy(false);
    }
  }

  const storeGroups = groupByStore(items);
  const hasPhysical = items.some((i) => i.product.physical);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {midtrans?.clientKey ? SnapScript : null}

      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm text-slate-500">
          <Link href={basePath} className="flex items-center gap-1 font-semibold hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Katalog
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-900">
            {step === "cart" ? "Keranjang" : "Checkout"}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${step === "cart" ? "bg-primary text-white" : "bg-emerald-100 text-primary"}`}
          >
            1
          </div>
          <span className={`text-sm font-bold ${step === "cart" ? "text-slate-900" : "text-slate-400"}`}>Keranjang</span>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${step === "checkout" ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}
          >
            2
          </div>
          <span className={`text-sm font-bold ${step === "checkout" ? "text-slate-900" : "text-slate-400"}`}>Checkout & Pembayaran</span>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Main content */}
          <div>
            {step === "cart" ? (
              /* ── STEP 1: CART ── */
              <div className="space-y-4">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
                    <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-slate-200" />
                    <p className="font-bold text-slate-400">Keranjang kosong</p>
                    <Button asChild variant="link" className="mt-2 text-primary">
                      <Link href={basePath}>Lihat katalog</Link>
                    </Button>
                  </div>
                ) : (
                  storeGroups.map((group) => (
                    <div key={group.storeName} className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                      {/* Store header */}
                      <div className="flex items-center gap-2 border-b border-slate-50 px-5 py-3">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-black text-sm text-slate-800">{group.storeName}</span>
                      </div>
                      {/* Items */}
                      {group.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`flex gap-4 p-4 ${idx < group.items.length - 1 ? "border-b border-slate-50" : ""}`}
                        >
                          {/* Image */}
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                            {item.product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.product.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <ShoppingBag className="h-6 w-6 text-slate-300" />
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-black text-sm text-slate-900">{item.product.title}</p>
                            <p className="text-xs text-slate-400">{PRODUCT_KIND_LABELS[item.product.kind]}</p>
                            <p className="mt-0.5 text-sm font-bold text-primary">{formatCurrency(item.product.price)}</p>
                          </div>
                          {/* Controls */}
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                                onClick={() => void updateQty(item.id, item.quantity - 1)}
                                disabled={!!updatingId}
                              >
                                {updatingId === item.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Minus className="h-3 w-3" />
                                )}
                              </button>
                              <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                                onClick={() => void updateQty(item.id, item.quantity + 1)}
                                disabled={!!updatingId || (item.product.physical && item.quantity >= item.product.stock)}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                onClick={() => void updateQty(item.id, 0)}
                                disabled={!!updatingId}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="text-sm font-black text-slate-800">{formatCurrency(item.lineTotal)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* ── STEP 2: CHECKOUT FORM ── */
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="font-black text-slate-900">Alamat Pengiriman</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nama penerima <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="Nama lengkap"
                      value={shipping.shippingName}
                      onChange={(e) => setShipping({ ...shipping, shippingName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nomor WhatsApp <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="08xxxxxxxxxx"
                      value={shipping.shippingPhone}
                      onChange={(e) => setShipping({ ...shipping, shippingPhone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Alamat lengkap {hasPhysical && <span className="text-red-500">*</span>}</Label>
                    <Textarea
                      placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan..."
                      rows={3}
                      value={shipping.shippingAddress}
                      onChange={(e) => setShipping({ ...shipping, shippingAddress: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kota / Kabupaten {hasPhysical && <span className="text-red-500">*</span>}</Label>
                    <Input
                      placeholder="Jakarta Selatan"
                      value={shipping.shippingCity}
                      onChange={(e) => setShipping({ ...shipping, shippingCity: e.target.value })}
                    />
                  </div>
                </div>
                {!hasPhysical && (
                  <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
                    Semua item dalam pesanan ini adalah produk digital. Alamat dipakai sebagai referensi tagihan.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Order Summary — sticky */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-black text-slate-900">Ringkasan Pesanan</h2>

              {/* Items summary */}
              <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">
                      {item.quantity}× {item.product.title}
                    </span>
                    <span className="shrink-0 font-semibold">{formatCurrency(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal barang</span>
                  <span className="font-semibold">{formatCurrency(summary.goods)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ongkos kirim</span>
                  <span className="font-semibold">{formatCurrency(summary.shipping)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-3">
                  <span className="font-black text-slate-900">Total Pembayaran</span>
                  <span className="font-black text-primary text-lg">{formatCurrency(summary.total)}</span>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {step === "cart" ? (
                  <Button
                    className="w-full gap-2 rounded-xl py-5 text-base font-black"
                    disabled={items.length === 0}
                    onClick={() => setStep("checkout")}
                  >
                    <CreditCard className="h-4 w-4" />
                    Lanjut ke Checkout
                  </Button>
                ) : (
                  <>
                    <Button
                      className="w-full gap-2 rounded-xl py-5 text-base font-black"
                      disabled={busy || items.length === 0}
                      onClick={() => void doCheckout()}
                    >
                      {busy ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Memproses...</>
                      ) : (
                        <><CreditCard className="h-4 w-4" />Bayar Sekarang</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-slate-500"
                      onClick={() => setStep("cart")}
                    >
                      ← Kembali ke keranjang
                    </Button>
                  </>
                )}
              </div>

              <p className="mt-3 text-center text-[11px] text-slate-400">
                Pembayaran aman · Kredit AI tidak dipakai
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
