"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Loader2, Plus, Save } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type CreditPackageRow = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  credits: number;
  bonusCredits: number;
  price: number;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
};

const emptyPackage: CreditPackageRow = {
  name: "",
  slug: "",
  description: "",
  credits: 10,
  bonusCredits: 0,
  price: 10000,
  isActive: true,
  isPopular: false,
  sortOrder: 99,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numberOrMin(value: string, min: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.floor(n));
}

export default function AdminCreditPackagesPage() {
  const [packages, setPackages] = useState<CreditPackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/credit-packages");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal memuat paket kredit");
      setPackages(json?.packages || []);
    } catch (event) {
      setMessage(event instanceof Error ? event.message : "Gagal memuat paket kredit");
      setMessageOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (idx: number, patch: Partial<CreditPackageRow>) => {
    setPackages((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  const saveRow = async (row: CreditPackageRow) => {
    setSaving(row.slug || "new");
    setMessage("");
    setMessageOk(true);
    try {
      const payload: CreditPackageRow = {
        ...row,
        name: row.name.trim(),
        slug: row.slug || slugify(row.name),
        description: row.description?.trim() || null,
        credits: numberOrMin(String(row.credits), 1),
        bonusCredits: numberOrMin(String(row.bonusCredits), 0),
        price: numberOrMin(String(row.price), 1000),
        sortOrder: numberOrMin(String(row.sortOrder), 0),
      };
      const res = await fetch("/api/admin/credit-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan paket kredit");
      setMessage("Paket kredit tersimpan");
      setMessageOk(true);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan");
      setMessageOk(false);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <AdminShell activePath="/admin/credit-packages">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/credit-packages">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Paket Top Up Kredit</h1>
            <p className="text-muted-foreground">
              Atur katalog kredit sekali beli, bonus, harga, dan paket unggulan.
            </p>
          </div>
          <Button
            onClick={() => setPackages((rows) => [...rows, { ...emptyPackage }])}
          >
            <Plus className="h-4 w-4" />
            Tambah Paket
          </Button>
        </div>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              messageOk
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {message}
          </div>
        )}

        {packages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="font-semibold text-slate-950">Belum ada paket kredit</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Tambahkan paket topup pertama agar guru bisa membeli kredit dari dashboard.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
          {packages.map((pkg, idx) => {
            const total = Number(pkg.credits || 0) + Number(pkg.bonusCredits || 0);
            return (
              <Card key={pkg.id || `new-${idx}`} className={pkg.isPopular ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Coins className="h-4 w-4 text-primary" />
                        {pkg.name || "Paket Baru"}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {total} kredit · {formatCurrency(pkg.price || 0)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {pkg.isPopular && <Badge>Unggulan</Badge>}
                      {!pkg.isActive && <Badge variant="secondary">Nonaktif</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nama Paket</Label>
                    <Input
                      value={pkg.name}
                      onChange={(e) =>
                        updateRow(idx, {
                          name: e.target.value,
                          slug: pkg.slug || slugify(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={pkg.slug}
                      onChange={(e) => updateRow(idx, { slug: slugify(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kredit Utama</Label>
                    <Input
                      type="number"
                      min={1}
                      value={pkg.credits}
                      onChange={(e) =>
                        updateRow(idx, { credits: numberOrMin(e.target.value, 1) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bonus Kredit</Label>
                    <Input
                      type="number"
                      min={0}
                      value={pkg.bonusCredits}
                      onChange={(e) =>
                        updateRow(idx, { bonusCredits: numberOrMin(e.target.value, 0) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Harga</Label>
                    <Input
                      type="number"
                      min={1000}
                      value={pkg.price}
                      onChange={(e) =>
                        updateRow(idx, { price: numberOrMin(e.target.value, 1000) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Urutan</Label>
                    <Input
                      type="number"
                      min={0}
                      value={pkg.sortOrder}
                      onChange={(e) =>
                        updateRow(idx, { sortOrder: numberOrMin(e.target.value, 0) })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Deskripsi</Label>
                    <Textarea
                      value={pkg.description || ""}
                      onChange={(e) => updateRow(idx, { description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Aktif</p>
                      <p className="text-xs text-muted-foreground">Tampil di halaman top up</p>
                    </div>
                    <Switch
                      checked={pkg.isActive}
                      onCheckedChange={(v) => updateRow(idx, { isActive: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Unggulan</p>
                      <p className="text-xs text-muted-foreground">Diberi aksen di UI</p>
                    </div>
                    <Switch
                      checked={pkg.isPopular}
                      onCheckedChange={(v) => updateRow(idx, { isPopular: v })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      className="w-full"
                      onClick={() => saveRow(pkg)}
                      disabled={saving !== null}
                    >
                      {saving === (pkg.slug || "new") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Simpan Paket
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
