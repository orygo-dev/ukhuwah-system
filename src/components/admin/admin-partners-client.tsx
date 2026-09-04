"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type PartnerRow = {
  id: string;
  name: string;
  type: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  code: string;
  regencyId: string | null;
  schoolId: string | null;
  commissionPercent: number;
  walletBalance: number;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  notes: string | null;
  isActive: boolean;
  totalCommissions: number;
  regency?: { name: string; code: string | null; province: { name: string } } | null;
  school?: { name: string; npsn: string | null } | null;
};

type PartnerCommissionRow = {
  id: string;
  partnerName: string;
  teacherName: string;
  orderAmount: number;
  amount: number;
  rate: number;
  status: string;
};

type PartnerPayoutRow = {
  id: string;
  partnerName: string;
  partnerCode: string;
  amount: number;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
};

type RegencyOption = {
  id: string;
  name: string;
  code: string | null;
  provinceName: string;
};

type SchoolOption = {
  id: string;
  name: string;
  npsn: string | null;
  regencyId: string | null;
};

type PartnerDraft = {
  id?: string;
  name: string;
  type: string;
  contactName: string;
  phone: string;
  email: string;
  code: string;
  regencyId: string;
  schoolId: string;
  commissionPercent: number;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  notes: string;
  portalPassword: string;
  isActive: boolean;
};

const emptyPartnerDraft: PartnerDraft = {
  name: "",
  type: "REGION",
  contactName: "",
  phone: "",
  email: "",
  code: "",
  regencyId: "",
  schoolId: "",
  commissionPercent: 5,
  bankName: "",
  bankAccount: "",
  bankHolder: "",
  notes: "",
  portalPassword: "",
  isActive: true,
};

function createPartnerCode(name: string) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return `MITRA-${slug || "BARU"}`;
}

export function AdminPartnersClient() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [partnerCommissions, setPartnerCommissions] = useState<PartnerCommissionRow[]>([]);
  const [partnerPayouts, setPartnerPayouts] = useState<PartnerPayoutRow[]>([]);
  const [regencies, setRegencies] = useState<RegencyOption[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [partnerDraft, setPartnerDraft] = useState<PartnerDraft>(emptyPartnerDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/affiliate/partners");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal memuat mitra wilayah");
      setPartners(data.partners || []);
      setPartnerCommissions(data.commissions || []);
      setPartnerPayouts(data.payouts || []);
      setRegencies(data.regencies || []);
      setSchools(data.schools || []);
    } catch (event) {
      setMessage(event instanceof Error ? event.message : "Gagal memuat mitra wilayah");
      setMessageOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    return partners.reduce(
      (acc, partner) => {
        acc.wallet += partner.walletBalance;
        acc.commissions += partner.totalCommissions;
        if (partner.isActive) acc.active += 1;
        return acc;
      },
      { wallet: 0, commissions: 0, active: 0 }
    );
  }, [partners]);

  const savePartner = async () => {
    setSaving(true);
    setMessage("");
    setMessageOk(true);
    try {
      const payload = {
        ...partnerDraft,
        code: partnerDraft.code || createPartnerCode(partnerDraft.name),
        regencyId: partnerDraft.regencyId || null,
        schoolId: partnerDraft.schoolId || null,
      };
      const res = await fetch("/api/admin/affiliate/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan mitra");
      setPartnerDraft(emptyPartnerDraft);
      setMessage("Mitra wilayah tersimpan");
      setMessageOk(true);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan mitra");
      setMessageOk(false);
    } finally {
      setSaving(false);
    }
  };

  const editPartner = (partner: PartnerRow) => {
    setPartnerDraft({
      id: partner.id,
      name: partner.name,
      type: partner.type,
      contactName: partner.contactName || "",
      phone: partner.phone || "",
      email: partner.email || "",
      code: partner.code,
      regencyId: partner.regencyId || "",
      schoolId: partner.schoolId || "",
      commissionPercent: partner.commissionPercent,
      bankName: partner.bankName || "",
      bankAccount: partner.bankAccount || "",
      bankHolder: partner.bankHolder || "",
      notes: partner.notes || "",
      portalPassword: "",
      isActive: partner.isActive,
    });
  };

  const deletePartner = async (id: string) => {
    if (processing !== null) return;
    if (!confirm("Hapus mitra ini? Komisi yang sudah tercatat ikut terhapus.")) return;
    setProcessing(id);
    setMessage("");
    setMessageOk(true);
    try {
      const res = await fetch("/api/admin/affiliate/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus mitra");
      setMessage("Mitra dihapus");
      setMessageOk(true);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menghapus mitra");
      setMessageOk(false);
    } finally {
      setProcessing(null);
    }
  };

  const settlePartners = async () => {
    if (processing !== null) return;
    setProcessing("partner-settle");
    setMessage("");
    setMessageOk(true);
    try {
      const res = await fetch("/api/admin/affiliate/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settle" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal memproses komisi mitra");
      setMessage("Komisi mitra yang tersedia sudah dimasukkan ke saldo");
      setMessageOk(true);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal memproses komisi mitra");
      setMessageOk(false);
    } finally {
      setProcessing(null);
    }
  };

  const processPartnerPayout = async (
    payoutId: string,
    action: "approve_payout" | "reject_payout"
  ) => {
    if (processing !== null) return;
    setProcessing(payoutId);
    setMessage("");
    setMessageOk(true);
    try {
      const res = await fetch("/api/admin/affiliate/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payoutId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal memproses pencairan mitra");
      setMessage(
        action === "approve_payout"
          ? "Pencairan mitra ditandai dibayar"
          : "Pencairan mitra ditolak"
      );
      setMessageOk(true);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal memproses pencairan mitra");
      setMessageOk(false);
    } finally {
      setProcessing(null);
    }
  };

  const partnerPortalUrl = () => {
    if (typeof window === "undefined") return "/partner/login";
    return `${window.location.origin}/partner/login`;
  };

  const copyPartnerAccess = async (partner: PartnerRow) => {
    const text = [
      "Akses Portal Mitra Navalogi",
      `URL: ${partnerPortalUrl()}`,
      `Kode Mitra: ${partner.code}`,
      "Password: sesuai password yang diberikan admin",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setMessage(`Akses portal mitra ${partner.name} disalin`);
    } catch {
      setMessage("Gagal menyalin akses portal mitra");
    }
  };

  if (loading) {
    return (
      <AdminShell activePath="/admin/partners">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/partners">
      <div className="space-y-6">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-primary">Monetisasi</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">Mitra Wilayah</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Kelola partner non-guru, area kerja, portal mitra, komisi premium, dan pencairan.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={processing !== null}
            onClick={settlePartners}
          >
            {processing === "partner-settle" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Proses Saldo Mitra
          </Button>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              messageOk
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[20px] border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mitra Aktif</p>
                <p className="text-2xl font-bold">{totals.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[20px] border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Saldo Mitra</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.wallet)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[20px] border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Komisi Tercatat</p>
                <p className="text-2xl font-bold">{totals.commissions}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <CardTitle className="text-base font-extrabold text-slate-950">
              {partnerDraft.id ? "Edit Mitra" : "Tambah Mitra"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 bg-white p-5 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label>Nama mitra</Label>
              <Input
                value={partnerDraft.name}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({
                    ...draft,
                    name: e.target.value,
                    code: draft.code || createPartnerCode(e.target.value),
                  }))
                }
                placeholder="Contoh: Koordinator Kab. Banjar"
              />
            </div>
            <div className="space-y-2">
              <Label>Kode mitra</Label>
              <Input
                value={partnerDraft.code}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({ ...draft, code: e.target.value.toUpperCase() }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Komisi (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={partnerDraft.commissionPercent}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({
                    ...draft,
                    commissionPercent: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe mitra</Label>
              <Select
                value={partnerDraft.type}
                onValueChange={(type) => setPartnerDraft((draft) => ({ ...draft, type }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGION">Koordinator Wilayah</SelectItem>
                  <SelectItem value="SCHOOL">Mitra Sekolah</SelectItem>
                  <SelectItem value="COMMUNITY">Komunitas</SelectItem>
                  <SelectItem value="INSTITUTION">Institusi/Yayasan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kabupaten/Kota</Label>
              <Select
                value={partnerDraft.regencyId || "__none"}
                onValueChange={(regencyId) =>
                  setPartnerDraft((draft) => ({
                    ...draft,
                    regencyId: regencyId === "__none" ? "" : regencyId,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih wilayah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Tidak spesifik</SelectItem>
                  {regencies.map((regency) => (
                    <SelectItem key={regency.id} value={regency.id}>
                      {regency.name} - {regency.provinceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Sekolah khusus</Label>
              <Select
                value={partnerDraft.schoolId || "__none"}
                onValueChange={(schoolId) =>
                  setPartnerDraft((draft) => ({
                    ...draft,
                    schoolId: schoolId === "__none" ? "" : schoolId,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opsional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Tidak spesifik</SelectItem>
                  {schools
                    .filter(
                      (school) =>
                        !partnerDraft.regencyId || school.regencyId === partnerDraft.regencyId
                    )
                    .slice(0, 120)
                    .map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kontak</Label>
              <Input
                value={partnerDraft.contactName}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({ ...draft, contactName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>No. WhatsApp</Label>
              <Input
                value={partnerDraft.phone}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({ ...draft, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={partnerDraft.email}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({ ...draft, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Password portal</Label>
              <Input
                type="password"
                value={partnerDraft.portalPassword}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({ ...draft, portalPassword: e.target.value }))
                }
                placeholder={partnerDraft.id ? "Kosongkan jika tidak diubah" : "Minimal 6 karakter"}
              />
            </div>
            <div className="flex items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div>
                <p className="font-medium">Status aktif</p>
                <p className="text-xs text-muted-foreground">Nonaktifkan jika kerja sama berhenti.</p>
              </div>
              <Switch
                checked={partnerDraft.isActive}
                onCheckedChange={(isActive) =>
                  setPartnerDraft((draft) => ({ ...draft, isActive }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Bank</Label>
              <Input
                value={partnerDraft.bankName}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({ ...draft, bankName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>No. rekening</Label>
              <Input
                value={partnerDraft.bankAccount}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({ ...draft, bankAccount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nama pemilik rekening</Label>
              <Input
                value={partnerDraft.bankHolder}
                onChange={(e) =>
                  setPartnerDraft((draft) => ({ ...draft, bankHolder: e.target.value }))
                }
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={savePartner} disabled={saving || processing !== null || !partnerDraft.name}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {partnerDraft.id ? "Update Mitra" : "Tambah Mitra"}
              </Button>
              {partnerDraft.id && (
                <Button type="button" variant="outline" onClick={() => setPartnerDraft(emptyPartnerDraft)}>
                  Batal
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <CardTitle className="text-base font-extrabold text-slate-950">Daftar Mitra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 bg-white p-5">
              {partners.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                  Belum ada mitra wilayah.
                </p>
              ) : (
                partners.map((partner) => (
                  <div key={partner.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{partner.name}</p>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {partner.code}
                          </span>
                          {!partner.isActive && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              Nonaktif
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {partner.school?.name || partner.regency?.name || "Wilayah belum ditentukan"} - Komisi {partner.commissionPercent}%
                        </p>
                        <p className="mt-2 text-sm">
                          Saldo: <span className="font-semibold">{formatCurrency(partner.walletBalance)}</span> - {partner.totalCommissions} komisi
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href="/partner/login" target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Portal
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyPartnerAccess(partner)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Salin Akses
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => editPartner(partner)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={processing !== null}
                          onClick={() => deletePartner(partner.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
              <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <CardTitle className="text-base font-extrabold text-slate-950">Komisi Mitra Terbaru</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 bg-white p-5">
                {partnerCommissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada komisi mitra.</p>
                ) : (
                  partnerCommissions.slice(0, 8).map((commission) => (
                    <div key={commission.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{commission.partnerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {commission.teacherName} - {commission.rate}% dari {formatCurrency(commission.orderAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(commission.amount)}</p>
                          <p className="text-xs text-muted-foreground">{commission.status}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
              <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <CardTitle className="text-base font-extrabold text-slate-950">Permintaan Pencairan Mitra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 bg-white p-5">
                {partnerPayouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Tidak ada permintaan pencairan mitra pending.
                  </p>
                ) : (
                  partnerPayouts.map((payout) => (
                    <div key={payout.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{payout.partnerName}</p>
                          <p className="text-sm text-muted-foreground">{payout.partnerCode}</p>
                          <p className="mt-2 text-lg font-bold">{formatCurrency(payout.amount)}</p>
                          <p className="text-sm">
                            {payout.bankName} - {payout.bankAccount} - a.n. {payout.bankHolder}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="brand"
                            disabled={processing !== null}
                            onClick={() => processPartnerPayout(payout.id, "approve_payout")}
                          >
                            Tandai Dibayar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processing !== null}
                            onClick={() => processPartnerPayout(payout.id, "reject_payout")}
                          >
                            Tolak
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
