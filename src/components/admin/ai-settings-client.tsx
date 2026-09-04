"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, FileText, Loader2, Save, Sparkles, Zap } from "lucide-react";
import { TOOLS } from "@/lib/constants";

type ProviderRow = {
  slug: string;
  name: string;
  defaultModel: string;
  baseUrl: string;
  models: readonly string[];
  isActive: boolean;
  isFallback: boolean;
  hasValidKey: boolean;
  apiKey: string;
  maxTokens: number;
  temperature: number;
};

type ToolConfigRow = {
  toolSlug: string;
  toolName: string;
  category: string;
  description: string;
  creditCost: number;
  isActive: boolean;
  sortOrder: number;
};

const SLUGS = ["openai", "gemini", "openrouter"] as const;

export function AdminAiSettingsClient() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [primarySlug, setPrimarySlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [toolConfigs, setToolConfigs] = useState<ToolConfigRow[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [savingTools, setSavingTools] = useState(false);

  const showMessage = (text: string, ok = true) => {
    setMessage(text);
    setMessageOk(ok);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ai-providers");
    const data = await res.json();
    if (!res.ok) {
      showMessage(data.error || "Gagal memuat", false);
      setLoading(false);
      return;
    }

    const catalog = data.catalog || {};
    const dbMap = new Map(
      (data.providers || []).map((p: { slug: string; [k: string]: unknown }) => [p.slug, p])
    );

    const rows: ProviderRow[] = SLUGS.map((slug) => {
      const cat = catalog[slug] || {};
      const db = dbMap.get(slug) as Record<string, unknown> | undefined;
      return {
        slug,
        name: (db?.name as string) || cat.name || slug,
        defaultModel: (db?.defaultModel as string) || cat.defaultModel || "",
        baseUrl: (db?.baseUrl as string) || cat.baseUrl || "",
        models: cat.models || [],
        isActive: (db?.isActive as boolean) ?? false,
        isFallback: (db?.isFallback as boolean) ?? false,
        hasValidKey: (db?.hasValidKey as boolean) ?? (db?.hasApiKey as boolean) ?? false,
        apiKey: "",
        maxTokens: (db?.maxTokens as number) ?? 4096,
        temperature: (db?.temperature as number) ?? 0.7,
      };
    });

    setProviders(rows);
    setPrimarySlug(data.primarySlug ?? rows.find((r) => r.isActive)?.slug ?? null);
    setLoading(false);
  }, []);

  const loadTools = useCallback(async () => {
    setLoadingTools(true);
    try {
      const res = await fetch("/api/admin/ai-tool-configs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat harga generator");
      setToolConfigs(data.tools || []);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Gagal memuat harga generator", false);
    } finally {
      setLoadingTools(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadTools();
  }, [load, loadTools]);

  const updateRow = (slug: string, patch: Partial<ProviderRow>) => {
    setProviders((rows) => rows.map((r) => (r.slug === slug ? { ...r, ...patch } : r)));
  };

  const selectPrimary = (slug: string) => {
    setPrimarySlug(slug);
    setProviders((rows) =>
      rows.map((r) => ({
        ...r,
        isActive: r.slug === slug,
        isFallback: r.slug === slug ? false : r.isFallback,
      }))
    );
  };

  const handleSetPrimary = async (slug: string) => {
    const row = providers.find((p) => p.slug === slug);
    if (!row?.hasValidKey && !row?.apiKey.trim()) {
      showMessage(`Simpan API key ${row?.name || slug} terlebih dahulu`, false);
      return;
    }

    setSettingPrimary(true);
    showMessage("");
    try {
      if (row?.apiKey.trim()) {
        await handleSave({ ...row, isActive: true, isFallback: false }, { silent: true });
      }
      const res = await fetch("/api/admin/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-primary", slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengatur provider utama");
      showMessage(`✓ ${json.message || "Provider utama diperbarui"}`);
      await load();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Gagal", false);
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleSave = async (
    row: ProviderRow,
    opts?: { silent?: boolean }
  ) => {
    if (!row.hasValidKey && !row.apiKey.trim()) {
      showMessage("API key wajib diisi", false);
      return;
    }

    setSaving(row.slug);
    if (!opts?.silent) showMessage("");

    const isPrimary = primarySlug === row.slug;

    try {
      const res = await fetch("/api/admin/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: row.slug,
          name: row.name,
          baseUrl: row.baseUrl,
          defaultModel: row.defaultModel,
          apiKey: row.apiKey || undefined,
          isActive: isPrimary,
          isFallback: isPrimary ? false : row.isFallback,
          maxTokens: row.maxTokens,
          temperature: row.temperature,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      if (!opts?.silent) {
        showMessage(
          isPrimary
            ? `✓ ${row.name} disimpan & dijadikan provider utama`
            : `✓ ${row.name} disimpan`
        );
      }
      await load();
    } catch (e) {
      if (!opts?.silent) {
        showMessage(e instanceof Error ? e.message : "Gagal menyimpan", false);
      } else {
        throw e;
      }
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (row: ProviderRow) => {
    if (!row.hasValidKey && !row.apiKey.trim()) {
      showMessage("Isi atau simpan API key dulu sebelum test", false);
      return;
    }

    setTesting(row.slug);
    showMessage("");
    try {
      const res = await fetch("/api/admin/ai-providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: row.slug,
          defaultModel: row.defaultModel,
          ...(row.apiKey.trim() ? { apiKey: row.apiKey.trim() } : {}),
        }),
      });
      const json = await res.json();
      showMessage(
        json.ok ? `✓ ${row.name}: ${json.message}` : `✗ ${row.name}: ${json.message}`,
        !!json.ok
      );
    } catch {
      showMessage(`Test ${row.name} gagal`, false);
    } finally {
      setTesting(null);
    }
  };

  const updateToolConfig = (slug: string, patch: Partial<ToolConfigRow>) => {
    setToolConfigs((rows) =>
      rows.map((row) => (row.toolSlug === slug ? { ...row, ...patch } : row))
    );
  };

  const handleSaveToolConfigs = async () => {
    setSavingTools(true);
    showMessage("");
    try {
      const res = await fetch("/api/admin/ai-tool-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tools: toolConfigs.map((tool) => ({
            toolSlug: tool.toolSlug,
            creditCost: Number(tool.creditCost),
            isActive: tool.isActive,
            sortOrder: tool.sortOrder,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan harga generator");
      setToolConfigs(json.tools || []);
      showMessage("✓ Harga generate per modul berhasil disimpan");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Gagal menyimpan harga generator", false);
    } finally {
      setSavingTools(false);
    }
  };

  const primaryRow = providers.find((p) => p.slug === primarySlug);

  if (loading) {
    return (
      <AdminShell activePath="/admin/ai-settings">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/ai-settings">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pengaturan API AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya <strong>satu provider utama</strong> yang dipakai saat generate. Provider lain
            bisa dijadikan cadangan (fallback).
          </p>
        </div>

        <Card
          className={
            primaryRow
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-amber-200 bg-amber-50/50"
          }
        >
          <CardContent className="flex items-start gap-3 pt-6">
            <CheckCircle2
              className={`mt-0.5 h-5 w-5 shrink-0 ${primaryRow ? "text-emerald-600" : "text-amber-600"}`}
            />
            <div className="text-sm">
              {primaryRow ? (
                <>
                  <p className="font-semibold text-emerald-900">
                    Provider utama: {primaryRow.name}
                  </p>
                  <p className="text-emerald-800/90">
                    Semua generate dokumen memakai {primaryRow.name} ({primaryRow.defaultModel}).
                    Provider lain tidak dipakai kecuali diaktifkan sebagai fallback.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-900">Belum ada provider utama</p>
                  <p className="text-amber-800/90">
                    Pilih provider utama di bawah, simpan API key, lalu klik &quot;Jadikan
                    Utama&quot;.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Provider utama untuk generate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {providers.map((row) => {
              const canSelect = row.hasValidKey || row.apiKey.trim().length > 8;
              return (
                <label
                  key={row.slug}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                    primarySlug === row.slug
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  } ${!canSelect ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="primary-provider"
                      checked={primarySlug === row.slug}
                      disabled={!canSelect}
                      onChange={() => selectPrimary(row.slug)}
                      className="h-4 w-4 accent-primary"
                    />
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.hasValidKey ? "API key tersimpan" : "Belum ada API key"}
                        {row.isFallback && primarySlug !== row.slug && " · Fallback"}
                      </p>
                    </div>
                  </div>
                  {primarySlug === row.slug && (
                    <Badge variant="success">Utama</Badge>
                  )}
                </label>
              );
            })}
            {primarySlug && (
              <Button
                size="sm"
                variant="brand"
                disabled={settingPrimary}
                onClick={() => void handleSetPrimary(primarySlug)}
              >
                {settingPrimary ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Terapkan provider utama
              </Button>
            )}
          </CardContent>
        </Card>

        {providers.map((row) => (
          <Card
            key={row.slug}
            className={row.slug === primarySlug ? "border-primary ring-1 ring-primary/20" : ""}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                {row.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                {row.slug === primarySlug && <Badge variant="success">Utama</Badge>}
                {row.hasValidKey && <Badge variant="secondary">Key OK</Badge>}
                {row.isFallback && row.slug !== primarySlug && (
                  <Badge variant="outline">Fallback</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder={
                      row.hasValidKey
                        ? "•••••••• (kosongkan jika tidak diubah)"
                        : "sk-... atau AIza..."
                    }
                    value={row.apiKey}
                    onChange={(e) => updateRow(row.slug, { apiKey: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={row.defaultModel}
                    onValueChange={(v) => updateRow(row.slug, { defaultModel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {row.models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={row.maxTokens}
                    onChange={(e) =>
                      updateRow(row.slug, { maxTokens: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              {row.slug !== primarySlug && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.isFallback}
                    onCheckedChange={(v) => updateRow(row.slug, { isFallback: v })}
                    disabled={!row.hasValidKey && !row.apiKey.trim()}
                  />
                  <Label className="font-normal text-muted-foreground">
                    Cadangan (fallback) — dipakai hanya jika provider utama gagal
                  </Label>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleSave(row)}
                  disabled={saving === row.slug}
                >
                  {saving === row.slug ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Simpan"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleTest(row)}
                  disabled={testing === row.slug}
                >
                  {testing === row.slug ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test Koneksi"
                  )}
                </Button>
                {primarySlug === row.slug && row.hasValidKey && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleSetPrimary(row.slug)}
                    disabled={settingPrimary}
                  >
                    Sinkronkan sebagai utama
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Harga Generate per Modul Dokumen
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Biaya ini dipakai langsung saat guru menjalankan generator dokumen.
              </p>
            </div>
            <Button
              size="sm"
              variant="brand"
              onClick={() => void handleSaveToolConfigs()}
              disabled={savingTools || loadingTools}
            >
              {savingTools ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Simpan Harga
            </Button>
          </CardHeader>
          <CardContent>
            {loadingTools ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {toolConfigs.map((tool) => {
                  const staticTool = TOOLS.find((item) => item.slug === tool.toolSlug);
                  return (
                    <div
                      key={tool.toolSlug}
                      className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px_120px]"
                    >
                      <div>
                        <p className="font-medium">{tool.toolName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {staticTool?.description || tool.description}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Biaya Kredit</Label>
                        <Input
                          type="number"
                          min={0}
                          max={999}
                          value={tool.creditCost}
                          onChange={(event) =>
                            updateToolConfig(tool.toolSlug, {
                              creditCost: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="flex items-end justify-between gap-3 md:justify-end">
                        <Label className="pb-2 text-xs text-muted-foreground">
                          {tool.isActive ? "Aktif" : "Nonaktif"}
                        </Label>
                        <Switch
                          checked={tool.isActive}
                          onCheckedChange={(value) =>
                            updateToolConfig(tool.toolSlug, { isActive: value })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Alur yang benar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>1.</strong> Masukkan API key pada provider yang diinginkan (mis. OpenAI) →
              klik <strong>Simpan</strong> → <strong>Test Koneksi</strong> harus ✓
            </p>
            <p>
              <strong>2.</strong> Pilih radio <strong>Provider utama</strong> → klik{" "}
              <strong>Terapkan provider utama</strong>
            </p>
            <p>
              <strong>3.</strong> Provider lain (mis. Gemini) otomatis nonaktif sebagai utama —
              nyalakan <strong>Fallback</strong> agar dipakai otomatis jika utama gagal (mis. kuota
              habis)
            </p>
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <strong>OpenAI 429 walau Usage $0?</strong> Normal — OpenAI menolak API sampai{" "}
              <strong>billing aktif</strong> (kartu kredit + spending limit). Usage 0 bukan berarti
              siap dipakai. Cek Settings → Billing di platform.openai.com, atau pakai{" "}
              <strong>Gemini</strong> (gratis via Google AI Studio).
            </p>
          </CardContent>
        </Card>

        {message && (
          <p
            className={`text-sm ${
              messageOk ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </AdminShell>
  );
}
