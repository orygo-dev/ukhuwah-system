"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMidtransSnap } from "@/components/payment/midtrans-snap";
import { readResponseJson } from "@/lib/http-json";

type Plan = { id: string; name: string; slug: string; description: string | null; priceMonthly: string | number; priceYearly: string | number; maxTeacherSeats: number; maxStudents: number; monthlyAiCredits: number };
type Subscription = { id: string; status: string; creditBalance: number; currentPeriodEnd: string | null; pjjAddOnEnabled: boolean; plan: Plan };
type Transaction = { id: string; status: string; amount: string | number; billingCycle: "MONTHLY" | "YEARLY"; createdAt: string; plan: { name: string }; gateway: { name: string }; invoice: { id: string; number: string } };
type BillingData = {
  plans: Plan[]; subscription: Subscription | null; transactions: Transaction[];
  payment: { available: boolean; gateway: { name: string; slug: string; isSandbox: boolean } | null; midtrans: { clientKey: string; isSandbox: boolean } | null };
};
type AccessData = { seats: { id: string; name: string; email: string }[]; teachers: { id: string; name: string; email: string }[] };
type CheckoutResponse = { transactionId: string; gateway: string; snapToken?: string; redirectUrl?: string; checkoutUrl?: string };

function rupiah(value: string | number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
}

function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "-";
}

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700", PAID: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700", TRIAL: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700", EXPIRED: "bg-slate-100 text-slate-600",
};

export function SchoolSubscriptionClient() {
  const [data, setData] = useState<BillingData | null>(null);
  const [access, setAccess] = useState<AccessData | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const midtrans = data?.payment.midtrans;
  const { SnapScript, pay, scriptLoaded } = useMidtransSnap({ clientKey: midtrans?.clientKey || "", isSandbox: midtrans?.isSandbox ?? true });

  const load = useCallback(async () => {
    const billingResponse = await fetch("/api/school/billing", { cache: "no-store" });
    const billing = await readResponseJson<BillingData & { error?: string }>(billingResponse);
    if (!billingResponse.ok) throw new Error(billing.error || "Gagal memuat paket sekolah.");
    setData(billing);
    if (billing.subscription) {
      const accessResponse = await fetch("/api/school/commercialization", { cache: "no-store" });
      const accessPayload = await readResponseJson<AccessData & { error?: string }>(accessResponse);
      if (!accessResponse.ok) throw new Error(accessPayload.error || "Gagal memuat seat sekolah.");
      setAccess(accessPayload);
    } else setAccess(null);
  }, []);

  useEffect(() => { load().catch((value) => setError(value instanceof Error ? value.message : "Gagal memuat data.")); }, [load]);

  async function purchase(plan: Plan) {
    if (access && access.seats.length > plan.maxTeacherSeats) {
      const confirmed = window.confirm(`${access.seats.length - plan.maxTeacherSeats} seat guru terbaru akan dilepas karena batas paket ini lebih kecil. Lanjutkan ke pembayaran?`);
      if (!confirmed) return;
    }
    setBusy(`plan:${plan.id}`); setError(""); setMessage("");
    try {
      const response = await fetch("/api/school/billing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, billingCycle: cycle, idempotencyKey: crypto.randomUUID() }),
      });
      const checkout = await readResponseJson<CheckoutResponse & { error?: string }>(response);
      if (!response.ok) throw new Error(checkout.error || "Gagal membuat pembayaran sekolah.");
      if (checkout.gateway === "midtrans" && checkout.snapToken) {
        if (!scriptLoaded || !midtrans?.clientKey) {
          if (checkout.redirectUrl) { window.location.href = checkout.redirectUrl; return; }
          throw new Error("Midtrans belum siap. Muat ulang halaman atau hubungi Super Admin.");
        }
        pay(checkout.snapToken, {
          onSuccess: () => { setMessage("Pembayaran diterima. Memperbarui status paket…"); void load(); },
          onPending: () => { setMessage("Pembayaran masih diproses. Gunakan tombol Perbarui status."); void load(); },
          onError: (value) => setError(typeof value === "object" && value && "message" in value ? String((value as { message: string }).message) : "Pembayaran gagal."),
          onClose: () => void load(),
        });
      } else if (checkout.gateway === "tripay" && checkout.checkoutUrl) {
        window.open(checkout.checkoutUrl, "_blank", "noopener,noreferrer");
        setMessage("Halaman pembayaran dibuka. Setelah selesai, kembali ke sini dan perbarui status.");
        await load();
      } else throw new Error("Payment gateway tidak mengembalikan halaman pembayaran.");
    } catch (value) { setError(value instanceof Error ? value.message : "Gagal membuat pembayaran."); }
    finally { setBusy(""); }
  }

  async function changeSeat(action: "assign-seat" | "release-seat", userId: string) {
    setBusy(`seat:${userId}`); setError("");
    try {
      const response = await fetch("/api/school/commercialization", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId }) });
      const payload = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || "Perubahan seat gagal.");
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : "Perubahan seat gagal."); }
    finally { setBusy(""); }
  }

  if (error && !data) return <Card><CardContent className="p-6 text-sm font-semibold text-red-600">{error}</CardContent></Card>;
  if (!data) return <p className="text-sm text-slate-500">Memuat paket sekolah…</p>;
  const seatIds = new Set(access?.seats.map((seat) => seat.id) || []);

  return <div className="space-y-6">
    {midtrans?.clientKey ? SnapScript : null}
    <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Lisensi milik sekolah</p><h1 className="text-2xl font-black">Paket Sekolah</h1><p className="text-sm text-slate-500">Pilih paket, lakukan pembayaran, dan kelola akses guru dari satu halaman.</p></div>
    {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
    {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}

    {data.subscription ? <Card><CardHeader><CardTitle>Paket aktif</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-4">
      <div><p className="text-xs text-slate-500">Paket</p><p className="font-black">{data.subscription.plan.name}</p></div>
      <div><p className="text-xs text-slate-500">Status</p><span className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${statusStyle[data.subscription.status] || "bg-slate-100"}`}>{data.subscription.status}</span></div>
      <div><p className="text-xs text-slate-500">Berlaku sampai</p><p className="font-bold">{dateLabel(data.subscription.currentPeriodEnd)}</p></div>
      <div><p className="text-xs text-slate-500">Kredit AI sekolah</p><p className="font-black">{data.subscription.creditBalance}</p></div>
    </CardContent></Card> : <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="font-black text-emerald-950">Sekolah belum memiliki paket aktif</p><p className="mt-1 text-sm text-emerald-700">Pilih paket di bawah. Paket akan aktif otomatis setelah pembayaran terverifikasi.</p></div>}

    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Pilih paket</CardTitle><p className="mt-1 text-sm text-slate-500">Harga dan benefit ditentukan Super Admin.</p></div><div className="flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setCycle("MONTHLY")} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${cycle === "MONTHLY" ? "bg-white shadow-sm" : "text-slate-500"}`}>Bulanan</button><button type="button" onClick={() => setCycle("YEARLY")} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${cycle === "YEARLY" ? "bg-white shadow-sm" : "text-slate-500"}`}>Tahunan</button></div></div></CardHeader>
      <CardContent>{data.plans.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Belum ada paket sekolah aktif. Hubungi Super Admin.</p> : <div className="grid gap-4 lg:grid-cols-3">{data.plans.map((plan) => {
        const price = cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
        const current = data.subscription?.plan.id === plan.id;
        return <div key={plan.id} className={`rounded-2xl border p-5 ${current ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}><div className="flex justify-between gap-2"><h3 className="font-black">{plan.name}</h3>{current ? <span className="text-xs font-bold text-emerald-600">PAKET SAAT INI</span> : null}</div><p className="mt-2 min-h-10 text-sm text-slate-500">{plan.description || "Paket lisensi sekolah"}</p><p className="mt-4 text-2xl font-black">{rupiah(price)}<span className="text-xs font-medium text-slate-500">/{cycle === "YEARLY" ? "tahun" : "bulan"}</span></p><ul className="my-4 space-y-1.5 text-sm text-slate-600"><li>{plan.maxTeacherSeats} seat guru</li><li>Maksimal {plan.maxStudents} siswa</li><li>{plan.monthlyAiCredits} kredit AI/bulan</li></ul><Button className="w-full" disabled={!!busy || !data.payment.available || Number(price) <= 0} onClick={() => void purchase(plan)}>{busy === `plan:${plan.id}` ? "Membuat checkout…" : current ? "Perpanjang paket" : data.subscription ? "Pilih paket ini" : "Berlangganan"}</Button></div>;
      })}</div>}
      {!data.payment.available ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">Pembayaran otomatis belum tersedia. Hubungi Super Admin untuk aktivasi manual.</p> : <p className="mt-4 text-xs text-slate-500">Pembayaran diproses oleh {data.payment.gateway?.name}{data.payment.gateway?.isSandbox ? " (mode sandbox/testing)" : ""}. Paket hanya aktif setelah callback pembayaran terverifikasi.</p>}</CardContent>
    </Card>

    {data.subscription && access ? <Card><CardHeader><CardTitle>Penempatan seat guru ({access.seats.length}/{data.subscription.plan.maxTeacherSeats})</CardTitle></CardHeader><CardContent className="space-y-2">{access.teachers.length ? access.teachers.map((teacher) => <div key={teacher.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-bold">{teacher.name}</p><p className="text-xs text-slate-500">{teacher.email}</p></div><Button disabled={!!busy} variant={seatIds.has(teacher.id) ? "outline" : "default"} onClick={() => void changeSeat(seatIds.has(teacher.id) ? "release-seat" : "assign-seat", teacher.id)}>{busy === `seat:${teacher.id}` ? "Memproses…" : seatIds.has(teacher.id) ? "Lepas seat" : "Beri seat"}</Button></div>) : <p className="text-sm text-slate-500">Belum ada akun guru di sekolah.</p>}</CardContent></Card> : null}

    <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Riwayat pembayaran</CardTitle><Button variant="outline" size="sm" disabled={!!busy} onClick={() => { setBusy("refresh"); setError(""); load().catch((value) => setError(value instanceof Error ? value.message : "Gagal memperbarui status.")).finally(() => setBusy("")); }}>Perbarui status</Button></div></CardHeader><CardContent className="space-y-2">{data.transactions.length ? data.transactions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><div><p className="font-bold">{item.plan.name} · {item.billingCycle === "YEARLY" ? "Tahunan" : "Bulanan"}</p><p className="text-xs text-slate-500">{item.invoice.number} · {dateLabel(item.createdAt)}</p><a className="mt-1 inline-block text-xs font-bold text-emerald-600 hover:underline" href={`/api/school/billing/invoices/${item.invoice.id}`}>Unduh invoice PDF</a></div><div className="text-right"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusStyle[item.status] || "bg-slate-100"}`}>{item.status}</span><p className="mt-1 font-bold">{rupiah(item.amount)}</p></div></div>) : <p className="text-sm text-slate-500">Belum ada transaksi sekolah.</p>}</CardContent></Card>
  </div>;
}
