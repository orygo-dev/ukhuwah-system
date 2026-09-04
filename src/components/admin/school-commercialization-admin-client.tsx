"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readResponseJson } from "@/lib/http-json";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: string | number;
  priceYearly: string | number;
  maxTeacherSeats: number;
  maxStudents: number;
  monthlyAiCredits: number;
  features: Record<string, unknown> | null;
  isActive: boolean;
  _count: { subscriptions: number };
};
type School = { id: string; name: string; npsn: string | null };
type Subscription = { id: string; status: string; creditBalance: number; school: School; plan: Plan; pjjAddOnEnabled: boolean };
type SchoolPayment = { id: string; status: string; amount: string | number; billingCycle: "MONTHLY" | "YEARLY"; createdAt: string; school: School; plan: { name: string }; gateway: { name: string }; invoice: { number: string } };

const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";
const defaultFeatures = {
  administration: true,
  ai_drafts: true,
  scheduling: true,
  teacher_generators: true,
  export_pdf: true,
  export_docx: true,
  allowed_generators: [],
};

function formatRupiah(value: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function SchoolCommercializationAdminClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<SchoolPayment[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/school-commercialization", { cache: "no-store" });
    const data = await readResponseJson<{ plans: Plan[]; schools: School[]; subscriptions: Subscription[]; payments: SchoolPayment[] }>(response);
    if (!response.ok) throw new Error(data.error || "Gagal memuat paket sekolah.");
    setPlans(data.plans);
    setSchools(data.schools);
    setSubscriptions(data.subscriptions);
    setPayments(data.payments);
  }, []);

  useEffect(() => {
    load().catch((value) => setError(value instanceof Error ? value.message : "Gagal memuat data."));
  }, [load]);

  async function send(body: object, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/school-commercialization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Operasi gagal.");
      setMessage(success);
      await load();
      return true;
    } catch (value) {
      setError(value instanceof Error ? value.message : "Operasi gagal.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await send(
      {
        action: "upsert-plan",
        id: editingPlan?.id,
        name: form.get("name"),
        slug: form.get("slug"),
        description: form.get("description"),
        priceMonthly: Number(form.get("priceMonthly")),
        priceYearly: Number(form.get("priceYearly")),
        maxTeacherSeats: Number(form.get("maxTeacherSeats")),
        maxStudents: Number(form.get("maxStudents")),
        monthlyAiCredits: Number(form.get("monthlyAiCredits")),
        features: editingPlan?.features || defaultFeatures,
      },
      editingPlan ? "Paket sekolah berhasil diperbarui." : "Paket sekolah berhasil dibuat."
    );
    if (saved) {
      formElement.reset();
      setEditingPlan(null);
    }
  }

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawEnd = String(form.get("periodEnd") || "");
    await send(
      {
        action: "activate-subscription",
        schoolId: form.get("schoolId"),
        planId: form.get("planId"),
        status: form.get("status"),
        periodEnd: rawEnd ? new Date(rawEnd).toISOString() : undefined,
        pjjAddOnEnabled: form.get("pjjAddOnEnabled") === "on",
      },
      "Subscription sekolah berhasil diaktifkan."
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Monetisasi terisolasi</p>
        <h1 className="text-2xl font-black">Paket Sekolah</h1>
        <p className="text-sm text-slate-500">Kelola paket, kapasitas, kredit, dan aktivasi lisensi sekolah.</p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Daftar paket tersedia</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{plans.length} paket tersimpan</p>
          </div>
          <Button variant="outline" onClick={() => setEditingPlan(null)}>Buat paket baru</Button>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
              Belum ada paket sekolah. Gunakan form di bawah untuk membuat paket pertama.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{plan.name}</p>
                      <p className="text-xs font-semibold text-slate-400">{plan.slug}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${plan.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {plan.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="mt-3 min-h-10 text-sm text-slate-500">{plan.description || "Tanpa deskripsi"}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-emerald-50 p-2"><span className="block text-xs text-slate-500">Bulanan</span><strong>{formatRupiah(plan.priceMonthly)}</strong></div>
                    <div className="rounded-xl bg-emerald-50 p-2"><span className="block text-xs text-slate-500">Tahunan</span><strong>{formatRupiah(plan.priceYearly)}</strong></div>
                    <div className="rounded-xl bg-slate-50 p-2"><span className="block text-xs text-slate-500">Seat guru</span><strong>{plan.maxTeacherSeats}</strong></div>
                    <div className="rounded-xl bg-slate-50 p-2"><span className="block text-xs text-slate-500">Batas siswa</span><strong>{plan.maxStudents}</strong></div>
                    <div className="rounded-xl bg-slate-50 p-2"><span className="block text-xs text-slate-500">Kredit AI</span><strong>{plan.monthlyAiCredits}/bulan</strong></div>
                    <div className="rounded-xl bg-slate-50 p-2"><span className="block text-xs text-slate-500">Dipakai</span><strong>{plan._count.subscriptions} sekolah</strong></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingPlan(plan)}>Edit</Button>
                    <Button
                      size="sm"
                      variant={plan.isActive ? "outline" : "default"}
                      disabled={busy}
                      onClick={() => void send(
                        { action: "set-plan-active", planId: plan.id, isActive: !plan.isActive },
                        `Paket ${plan.isActive ? "dinonaktifkan" : "diaktifkan"}.`
                      )}
                    >
                      {plan.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{editingPlan ? `Edit ${editingPlan.name}` : "Buat paket"}</CardTitle></CardHeader>
          <CardContent>
            <form key={editingPlan?.id || "new"} onSubmit={savePlan} className="grid gap-3 md:grid-cols-2">
              <input required name="name" defaultValue={editingPlan?.name} placeholder="School Core" className={field}/>
              <input required name="slug" defaultValue={editingPlan?.slug} placeholder="school-core" className={field}/>
              <textarea name="description" defaultValue={editingPlan?.description || ""} placeholder="Deskripsi" className={`${field} md:col-span-2`}/>
              <input required type="number" min="0" name="priceMonthly" defaultValue={editingPlan ? Number(editingPlan.priceMonthly) : undefined} placeholder="Harga bulanan" className={field}/>
              <input required type="number" min="0" name="priceYearly" defaultValue={editingPlan ? Number(editingPlan.priceYearly) : undefined} placeholder="Harga tahunan" className={field}/>
              <input required type="number" min="1" name="maxTeacherSeats" defaultValue={editingPlan?.maxTeacherSeats} placeholder="Seat guru" className={field}/>
              <input required type="number" min="1" name="maxStudents" defaultValue={editingPlan?.maxStudents} placeholder="Batas siswa" className={field}/>
              <input required type="number" min="0" name="monthlyAiCredits" defaultValue={editingPlan?.monthlyAiCredits} placeholder="Kredit AI/bulan" className={field}/>
              <div className="flex gap-2">
                <Button disabled={busy}>{editingPlan ? "Simpan perubahan" : "Simpan paket"}</Button>
                {editingPlan ? <Button type="button" variant="ghost" onClick={() => setEditingPlan(null)}>Batal</Button> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Aktifkan untuk sekolah</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={activate} className="space-y-3">
              <select required name="schoolId" className={field}><option value="">Pilih sekolah</option>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}{item.npsn ? ` · ${item.npsn}` : ""}</option>)}</select>
              <select required name="planId" className={field}><option value="">Pilih paket aktif</option>{plans.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <select name="status" className={field}><option>TRIAL</option><option>ACTIVE</option><option>GRACE</option><option>READ_ONLY</option><option>SUSPENDED</option><option>EXPIRED</option></select>
              <input type="datetime-local" name="periodEnd" className={field}/>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="pjjAddOnEnabled"/> Aktifkan PJJ add-on (hard cap 25)</label>
              <Button disabled={busy || plans.every((item) => !item.isActive)}>Aktifkan subscription</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Subscription terkini</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {subscriptions.length === 0 ? <p className="text-sm text-slate-500">Belum ada subscription sekolah.</p> : subscriptions.map((item) => (
            <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm">
              <span className="font-bold">{item.school.name} · {item.plan.name}</span>
              <span>{item.status} · kredit {item.creditBalance} · PJJ {item.pjjAddOnEnabled ? "aktif" : "nonaktif"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pembayaran sekolah terbaru</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {payments.length === 0 ? <p className="text-sm text-slate-500">Belum ada pembayaran mandiri sekolah.</p> : payments.map((item) => (
            <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm">
              <div><p className="font-bold">{item.school.name} · {item.plan.name}</p><p className="text-xs text-slate-500">{item.invoice.number} · {item.gateway.name} · {item.billingCycle === "YEARLY" ? "Tahunan" : "Bulanan"}</p></div>
              <span className="font-bold">{item.status} · {formatRupiah(item.amount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
