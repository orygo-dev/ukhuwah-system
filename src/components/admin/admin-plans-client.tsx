"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TOOLS } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";

type PlanFeatures = {
  export_pdf: boolean;
  export_docx: boolean;
  can_use_ai_assistant: boolean;
  can_use_affiliate: boolean;
  can_use_premium_generators: boolean;
  max_generate_per_month: number | null;
  max_classes: number | null;
  max_students: number | null;
  allowed_generators: string[];
  monthly_credit_bonus: number;
  priority: boolean;
};

type PlanRow = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  creditsMonthly: number;
  features: PlanFeatures;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
};

const DEFAULT_FEATURES: PlanFeatures = {
  export_pdf: true,
  export_docx: true,
  can_use_ai_assistant: true,
  can_use_affiliate: true,
  can_use_premium_generators: true,
  max_generate_per_month: null,
  max_classes: null,
  max_students: null,
  allowed_generators: [],
  monthly_credit_bonus: 0,
  priority: false,
};

const EMPTY_PLAN: PlanRow = {
  name: "Paket Baru",
  slug: "paket-baru",
  description: "",
  priceMonthly: 0,
  priceYearly: 0,
  creditsMonthly: 0,
  features: DEFAULT_FEATURES,
  isActive: true,
  isPopular: false,
  sortOrder: 99,
};

function normalizeFeatures(features: unknown): PlanFeatures {
  const value = features && typeof features === "object" ? (features as Partial<PlanFeatures>) : {};
  return {
    ...DEFAULT_FEATURES,
    ...value,
    max_generate_per_month: value.max_generate_per_month ?? null,
    max_classes: value.max_classes ?? null,
    max_students: value.max_students ?? null,
    allowed_generators: Array.isArray(value.allowed_generators)
      ? value.allowed_generators.filter((item) => typeof item === "string")
      : [],
    monthly_credit_bonus: Number(value.monthly_credit_bonus ?? 0),
  };
}

function makeSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function numberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function AdminPlansClient() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selected, setSelected] = useState<PlanRow>(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);
  const [allowAllGenerators, setAllowAllGenerators] = useState(true);

  const toolByCategory = useMemo(() => {
    return TOOLS.reduce<Record<string, typeof TOOLS>>((acc, tool) => {
      acc[tool.category] = [...(acc[tool.category] || []), tool];
      return acc;
    }, {});
  }, []);

  const showMessage = (text: string, ok = true) => {
    setMessage(text);
    setMessageOk(ok);
  };

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/plans");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Gagal memuat paket");
      }

      const rows: PlanRow[] = (data?.plans || []).map((plan: PlanRow & { features: unknown }) => ({
        ...plan,
        description: plan.description || "",
        features: normalizeFeatures(plan.features),
      }));
      setPlans(rows);
      if (rows.length > 0) {
        setSelected(rows[0]);
        setAllowAllGenerators(rows[0].features.allowed_generators.length === 0);
      }
    } catch (event) {
      showMessage(event instanceof Error ? event.message : "Gagal memuat paket", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const selectPlan = (plan: PlanRow) => {
    setSelected(plan);
    setAllowAllGenerators(plan.features.allowed_generators.length === 0);
    showMessage("");
  };

  const updatePlan = (patch: Partial<PlanRow>) => {
    setSelected((current) => ({ ...current, ...patch }));
  };

  const updateFeature = <K extends keyof PlanFeatures>(key: K, value: PlanFeatures[K]) => {
    setSelected((current) => ({
      ...current,
      features: { ...current.features, [key]: value },
    }));
  };

  const toggleGenerator = (slug: string, checked: boolean) => {
    setSelected((current) => {
      const currentSet = new Set(current.features.allowed_generators);
      if (checked) currentSet.add(slug);
      else currentSet.delete(slug);
      return {
        ...current,
        features: {
          ...current.features,
          allowed_generators: [...currentSet],
        },
      };
    });
  };

  const handleNew = () => {
    const nextSort = plans.length ? Math.max(...plans.map((plan) => plan.sortOrder)) + 1 : 1;
    setSelected({
      ...EMPTY_PLAN,
      features: { ...DEFAULT_FEATURES },
      slug: `paket-baru-${nextSort}`,
      sortOrder: nextSort,
    });
    setAllowAllGenerators(true);
    showMessage("");
  };

  const handleSave = async () => {
    setSaving(true);
    showMessage("");
    try {
      const features: PlanFeatures = {
        ...selected.features,
        monthly_credit_bonus: numberOrZero(
          String(selected.features.monthly_credit_bonus)
        ),
        allowed_generators: allowAllGenerators ? [] : selected.features.allowed_generators,
      };
      const payload = {
        ...selected,
        slug: selected.slug || makeSlug(selected.name),
        description: selected.description.trim(),
        priceMonthly: numberOrZero(String(selected.priceMonthly)),
        priceYearly: numberOrZero(String(selected.priceYearly)),
        creditsMonthly: numberOrZero(String(selected.creditsMonthly)),
        sortOrder: numberOrZero(String(selected.sortOrder)),
        features,
      };
      const res = await fetch("/api/admin/plans", {
        method: selected.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan paket");
      showMessage("Paket langganan berhasil disimpan.");
      await loadPlans();
      if (json?.plan) selectPlan({ ...json.plan, features: normalizeFeatures(json.plan.features) });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Gagal menyimpan paket", false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedGeneratorCount = allowAllGenerators
    ? TOOLS.length
    : selected.features.allowed_generators.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-xl shadow-blue-950/10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-100">Subscription Control</p>
          <h1 className="mt-2 text-2xl font-bold">Paket Langganan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">
            Atur harga, kredit bulanan, akses fitur, dan quota penggunaan untuk setiap
            paket. Perubahan quota langsung dipakai saat guru generate dan export dokumen.
          </p>
        </div>
        <Button variant="secondary" onClick={handleNew}>
          <Plus className="h-4 w-4" />
          Tambah Paket
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => selectPlan(plan)}
              className={cn(
                "w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                selected.id === plan.id
                  ? "border-blue-300 ring-4 ring-blue-100"
                  : "border-slate-200"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-950">{plan.name}</h2>
                    {plan.isPopular && <Badge>Populer</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.slug}</p>
                </div>
                <Badge variant={plan.isActive ? "success" : "secondary"}>
                  {plan.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">Bulanan</p>
                  <p className="font-bold text-slate-950">
                    {plan.priceMonthly === 0 ? "Gratis" : formatCurrency(plan.priceMonthly)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Kredit</p>
                  <p className="font-bold text-emerald-950">{plan.creditsMonthly}/bulan</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-5">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                Informasi Paket
              </CardTitle>
              <div className="flex items-center gap-3">
                <Label className="text-sm font-normal text-muted-foreground">Aktif</Label>
                <Switch
                  checked={selected.isActive}
                  onCheckedChange={(value) => updatePlan({ isActive: value })}
                />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nama Paket</Label>
                <Input
                  value={selected.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    updatePlan({
                      name,
                      slug: selected.id ? selected.slug : makeSlug(name),
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={selected.slug}
                  onChange={(event) => updatePlan({ slug: makeSlug(event.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Harga Bulanan</Label>
                <Input
                  type="number"
                  min={0}
                  value={selected.priceMonthly}
                  onChange={(event) => updatePlan({ priceMonthly: numberOrZero(event.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Harga Tahunan</Label>
                <Input
                  type="number"
                  min={0}
                  value={selected.priceYearly}
                  onChange={(event) => updatePlan({ priceYearly: numberOrZero(event.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Kredit Bulanan</Label>
                <Input
                  type="number"
                  min={0}
                  value={selected.creditsMonthly}
                  onChange={(event) => updatePlan({ creditsMonthly: numberOrZero(event.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bonus Kredit Bulanan</Label>
                <Input
                  type="number"
                  min={0}
                  value={selected.features.monthly_credit_bonus}
                  onChange={(event) =>
                    updateFeature("monthly_credit_bonus", numberOrZero(event.target.value))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Deskripsi</Label>
                <Textarea
                  value={selected.description}
                  onChange={(event) => updatePlan({ description: event.target.value })}
                  placeholder="Deskripsi singkat yang tampil pada paket langganan."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={selected.isPopular}
                  onCheckedChange={(value) => updatePlan({ isPopular: value })}
                />
                <Label className="font-normal">Tandai sebagai paket populer</Label>
              </div>
              <div className="space-y-2">
                <Label>Urutan Tampil</Label>
                <Input
                  type="number"
                  min={0}
                  value={selected.sortOrder}
                  onChange={(event) => updatePlan({ sortOrder: numberOrZero(event.target.value) })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Quota Penggunaan
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {[
                  ["max_generate_per_month", "Generate Dokumen / Bulan"],
                  ["max_classes", "Jumlah Kelas"],
                  ["max_students", "Jumlah Siswa"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Kosongkan untuk unlimited"
                      value={
                        selected.features[key as keyof PlanFeatures] === null
                          ? ""
                          : String(selected.features[key as keyof PlanFeatures])
                      }
                      onChange={(event) =>
                        updateFeature(
                          key as keyof PlanFeatures,
                          numberOrNull(event.target.value) as never
                        )
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BadgeCheck className="h-4 w-4 text-emerald-600" />
                  Akses Fitur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  ["export_pdf", "Export PDF"],
                  ["export_docx", "Export DOCX"],
                  ["can_use_ai_assistant", "AI Assistant"],
                  ["can_use_affiliate", "Afiliasi"],
                  ["can_use_premium_generators", "Generator Premium"],
                  ["priority", "Prioritas Layanan"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border p-3">
                    <Label className="font-medium">{label}</Label>
                    <Switch
                      checked={Boolean(selected.features[key as keyof PlanFeatures])}
                      onCheckedChange={(value) =>
                        updateFeature(key as keyof PlanFeatures, value as never)
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-violet-600" />
                Akses Generator Dokumen
              </CardTitle>
              <Badge variant="secondary">{selectedGeneratorCount} generator</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border bg-slate-50 p-4">
                <div>
                  <p className="font-medium">Izinkan semua generator</p>
                  <p className="text-sm text-muted-foreground">
                    Matikan untuk memilih generator tertentu per paket.
                  </p>
                </div>
                <Switch
                  checked={allowAllGenerators}
                  onCheckedChange={(value) => setAllowAllGenerators(value)}
                />
              </div>

              {!allowAllGenerators && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {Object.entries(toolByCategory).map(([category, tools]) => (
                    <div key={category} className="rounded-2xl border p-4">
                      <p className="mb-3 text-sm font-semibold capitalize text-slate-900">
                        {category.replace(/-/g, " ")}
                      </p>
                      <div className="space-y-2">
                        {tools.map((tool) => {
                          const checked = selected.features.allowed_generators.includes(tool.slug);
                          return (
                            <label
                              key={tool.slug}
                              className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => toggleGenerator(tool.slug, event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                              />
                              <span className="text-sm">{tool.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="text-sm">
                  {message && (
                    <p className={messageOk ? "text-emerald-600" : "text-destructive"}>
                      {message}
                    </p>
                  )}
                </div>
                <Button variant="brand" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan Paket
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
