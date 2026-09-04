"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type {
  AffiliateCommissionTier,
  AffiliateConfig,
  AffiliateRankLevel,
} from "@/lib/affiliate";

type PayoutRow = {
  id: string;
  affiliateName: string;
  affiliateEmail: string;
  amount: number;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  createdAt: string;
};

const rankColorOptions = [
  { value: "slate", label: "Slate" },
  { value: "amber", label: "Bronze" },
  { value: "zinc", label: "Silver" },
  { value: "yellow", label: "Gold" },
  { value: "blue", label: "Platinum" },
  { value: "emerald", label: "Emerald" },
  { value: "violet", label: "Violet" },
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminAffiliateClient() {
  const [config, setConfig] = useState<AffiliateConfig | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);

  const load = useCallback(async () => {
    try {
      const [cfgRes, payRes] = await Promise.all([
        fetch("/api/admin/affiliate"),
        fetch("/api/admin/affiliate/payouts"),
      ]);
      const cfgData = await cfgRes.json().catch(() => null);
      const payData = await payRes.json().catch(() => null);
      if (!cfgRes.ok) throw new Error(cfgData?.error || "Gagal memuat pengaturan afiliasi");
      if (!payRes.ok) throw new Error(payData?.error || "Gagal memuat pencairan afiliasi");
      setConfig(cfgData?.config ?? null);
      setPayouts(payData?.payouts || []);
    } catch (event) {
      setMessage(event instanceof Error ? event.message : "Gagal memuat afiliasi");
      setMessageOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setMessage("");
    setMessageOk(true);
    try {
      const res = await fetch("/api/admin/affiliate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan pengaturan afiliasi");
      setConfig(data.config);
      setMessage("Pengaturan afiliasi tersimpan");
      setMessageOk(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan");
      setMessageOk(false);
    } finally {
      setSaving(false);
    }
  };

  const processPayout = async (payoutId: string, action: "approve" | "reject") => {
    setProcessing(payoutId);
    setMessage("");
    setMessageOk(true);
    try {
      const res = await fetch("/api/admin/affiliate/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId, action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal memproses pencairan");
      setMessage(action === "approve" ? "Pencairan ditandai dibayar" : "Pencairan ditolak");
      setMessageOk(true);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal memproses");
      setMessageOk(false);
    } finally {
      setProcessing(null);
    }
  };

  const updateCommissionTier = (
    id: string,
    patch: Partial<AffiliateCommissionTier>
  ) => {
    setConfig((current) =>
      current
        ? {
            ...current,
            commissionTiers: current.commissionTiers.map((tier) =>
              tier.id === id ? { ...tier, ...patch } : tier
            ),
          }
        : current
    );
  };

  const addCommissionTier = () => {
    setConfig((current) =>
      current
        ? {
            ...current,
            commissionTiers: [
              ...current.commissionTiers,
              {
                id: createId("tier"),
                name: "Tier Baru",
                minReferrals: 0,
                maxReferrals: null,
                commissionPercent: current.commissionPercent,
                isActive: true,
              },
            ],
          }
        : current
    );
  };

  const removeCommissionTier = (id: string) => {
    setConfig((current) =>
      current && current.commissionTiers.length > 1
        ? {
            ...current,
            commissionTiers: current.commissionTiers.filter((tier) => tier.id !== id),
          }
        : current
    );
  };

  const updateRankLevel = (id: string, patch: Partial<AffiliateRankLevel>) => {
    setConfig((current) =>
      current
        ? {
            ...current,
            rankLevels: current.rankLevels.map((rank) =>
              rank.id === id ? { ...rank, ...patch } : rank
            ),
          }
        : current
    );
  };

  const addRankLevel = () => {
    setConfig((current) =>
      current
        ? {
            ...current,
            rankLevels: [
              ...current.rankLevels,
              {
                id: createId("rank"),
                name: "Rank Baru",
                minReferrals: 0,
                color: "blue",
                description: "Deskripsi rank affiliate.",
                sortOrder: current.rankLevels.length,
                isActive: true,
              },
            ],
          }
        : current
    );
  };

  const removeRankLevel = (id: string) => {
    setConfig((current) =>
      current && current.rankLevels.length > 1
        ? {
            ...current,
            rankLevels: current.rankLevels.filter((rank) => rank.id !== id),
          }
        : current
    );
  };

  if (loading || !config) {
    return (
      <AdminShell activePath="/admin/affiliate">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/affiliate">
      <div className="space-y-6">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-primary">Monetisasi</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">Afiliasi Guru</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Atur komisi referral guru, rank affiliate, dan pencairan komisi guru.
            </p>
          </div>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Pengaturan
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

        <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <CardTitle className="text-base font-extrabold text-slate-950">Pengaturan Komisi Affiliate Guru</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 bg-white p-5 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:col-span-2">
              <div>
                <p className="font-medium">Program aktif</p>
                <p className="text-sm text-muted-foreground">Nonaktifkan untuk stop referral baru dari guru.</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => setConfig((c) => c && { ...c, enabled: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>Komisi default / fallback (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={config.commissionPercent}
                onChange={(e) =>
                  setConfig((c) =>
                    c ? { ...c, commissionPercent: Number(e.target.value) } : c
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Dipakai hanya jika tidak ada tier aktif yang cocok.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Komisi dihitung dari</Label>
              <Select
                value={config.commissionOn}
                onValueChange={(v: AffiliateConfig["commissionOn"]) =>
                  setConfig((c) => c && { ...c, commissionOn: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_payment">Pembayaran pertama saja</SelectItem>
                  <SelectItem value="all_payments">Setiap pembayaran</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Sumber transaksi yang mendapat komisi</Label>
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">Paket premium/langganan</p>
                    <Switch checked disabled />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Komisi hanya dari pembayaran paket premium, perpanjangan, dan upgrade paket.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left opacity-80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">Top up kredit</p>
                    <Switch checked={false} disabled />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tidak dikomisikan agar margin biaya AI tetap aman.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left opacity-80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">Penggunaan kredit</p>
                    <Switch checked={false} disabled />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Generate dokumen bukan objek komisi.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Skema komisi bertingkat</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Range dihitung dari jumlah referral affiliate saat transaksi dibayar.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCommissionTier}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Tier
                </Button>
              </div>
              <div className="space-y-3">
                {[...config.commissionTiers]
                  .sort((a, b) => a.minReferrals - b.minReferrals)
                  .map((tier) => (
                    <div key={tier.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_110px_110px_120px_90px_auto]">
                        <div className="space-y-2">
                          <Label>Nama tier</Label>
                          <Input
                            value={tier.name}
                            onChange={(e) => updateCommissionTier(tier.id, { name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Minimal</Label>
                          <Input
                            type="number"
                            min={0}
                            value={tier.minReferrals}
                            onChange={(e) =>
                              updateCommissionTier(tier.id, {
                                minReferrals: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Maksimal</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Tanpa batas"
                            value={tier.maxReferrals ?? ""}
                            onChange={(e) =>
                              updateCommissionTier(tier.id, {
                                maxReferrals: e.target.value === "" ? null : Number(e.target.value),
                              })
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
                            value={tier.commissionPercent}
                            onChange={(e) =>
                              updateCommissionTier(tier.id, {
                                commissionPercent: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Aktif</Label>
                          <div className="flex h-10 items-center">
                            <Switch
                              checked={tier.isActive}
                              onCheckedChange={(isActive) =>
                                updateCommissionTier(tier.id, { isActive })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={config.commissionTiers.length <= 1}
                            onClick={() => removeCommissionTier(tier.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Rank level affiliate</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Rank tampil sebagai badge di profil guru dan beranda guru.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRankLevel}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Rank
                </Button>
              </div>
              <div className="space-y-3">
                {[...config.rankLevels]
                  .sort((a, b) => a.minReferrals - b.minReferrals || a.sortOrder - b.sortOrder)
                  .map((rank) => (
                    <div key={rank.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_140px_90px_auto]">
                        <div className="space-y-2">
                          <Label>Nama rank</Label>
                          <Input
                            value={rank.name}
                            onChange={(e) => updateRankLevel(rank.id, { name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Min referral</Label>
                          <Input
                            type="number"
                            min={0}
                            value={rank.minReferrals}
                            onChange={(e) =>
                              updateRankLevel(rank.id, {
                                minReferrals: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Warna badge</Label>
                          <Select
                            value={rank.color}
                            onValueChange={(color) => updateRankLevel(rank.id, { color })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {rankColorOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Aktif</Label>
                          <div className="flex h-10 items-center">
                            <Switch
                              checked={rank.isActive}
                              onCheckedChange={(isActive) => updateRankLevel(rank.id, { isActive })}
                            />
                          </div>
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={config.rankLevels.length <= 1}
                            onClick={() => removeRankLevel(rank.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="space-y-2 lg:col-span-5">
                          <Label>Deskripsi</Label>
                          <Input
                            value={rank.description}
                            onChange={(e) =>
                              updateRankLevel(rank.id, { description: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Window attribution (hari)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={config.attributionDays}
                onChange={(e) =>
                  setConfig((c) =>
                    c ? { ...c, attributionDays: Number(e.target.value) } : c
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Hold komisi (hari)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={config.holdDays}
                onChange={(e) =>
                  setConfig((c) => c && { ...c, holdDays: Number(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum pencairan (Rp)</Label>
              <Input
                type="number"
                min={0}
                value={config.minPayout}
                onChange={(e) =>
                  setConfig((c) => c && { ...c, minPayout: Number(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Judul program (tampil ke guru)</Label>
              <Input
                value={config.programTitle}
                onChange={(e) =>
                  setConfig((c) => c && { ...c, programTitle: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Deskripsi program</Label>
              <Textarea
                rows={3}
                value={config.programDescription}
                onChange={(e) =>
                  setConfig((c) => c && { ...c, programDescription: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <CardTitle className="text-base font-extrabold text-slate-950">Permintaan Pencairan Affiliate Guru</CardTitle>
          </CardHeader>
          <CardContent className="bg-white p-5">
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada permintaan pending.</p>
            ) : (
              <div className="space-y-4">
                {payouts.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{p.affiliateName}</p>
                        <p className="text-sm text-muted-foreground">{p.affiliateEmail}</p>
                        <p className="mt-2 text-lg font-bold">{formatCurrency(p.amount)}</p>
                        <p className="text-sm">
                          {p.bankName} - {p.bankAccount} - a.n. {p.bankHolder}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="brand"
                          disabled={processing !== null}
                          onClick={() => processPayout(p.id, "approve")}
                        >
                          Tandai Dibayar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processing !== null}
                          onClick={() => processPayout(p.id, "reject")}
                        >
                          Tolak
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
