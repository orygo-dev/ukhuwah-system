"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  HardDrive,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
type R2PublicConfig = {
  enabled: boolean;
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  configured: boolean;
  accessKeyIdMasked: string;
  secretAccessKeyMasked: string;
  updatedById?: string;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
};

const EMPTY: R2PublicConfig = {
  enabled: false,
  accountId: "",
  bucket: "",
  publicBaseUrl: "",
  configured: false,
  accessKeyIdMasked: "",
  secretAccessKeyMasked: "",
};

export function AdminStorageSettingsClient() {
  const [config, setConfig] = useState<R2PublicConfig>(EMPTY);
  const [activeDriver, setActiveDriver] = useState<"local" | "r2">("local");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    let active = true;
    fetch("/api/admin/storage")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat pengaturan.");
        if (active) {
          setConfig(data.config);
          setActiveDriver(data.activeDriver === "r2" ? "r2" : "local");
        }
      })
      .catch((error) => {
        if (active) {
          setMessage({
            tone: "error",
            text: error instanceof Error ? error.message : "Gagal memuat.",
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          accountId: config.accountId,
          bucket: config.bucket,
          publicBaseUrl: config.publicBaseUrl,
          accessKeyId: accessKeyId || undefined,
          secretAccessKey: secretAccessKey || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan.");
      setConfig(data.config);
      setActiveDriver(data.activeDriver === "r2" ? "r2" : "local");
      setAccessKeyId("");
      setSecretAccessKey("");
      setMessage({ tone: "ok", text: data.message });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Gagal menyimpan.",
      });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/storage", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.error || "Uji koneksi gagal.");
      }
      setMessage({ tone: "ok", text: data.message });
      setConfig((current) => ({
        ...current,
        lastTestOk: true,
        lastTestedAt: new Date().toISOString(),
        lastTestMessage: data.message,
      }));
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Uji koneksi gagal.",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <AdminShell activePath="/admin/storage">
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Memuat pengaturan storage...
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/storage">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-10">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Integrasi Storage
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">
                Cloudflare R2
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Simpan gambar dan video (Zona Kreasi, mading, avatar, pemberitahuan,
                Zona Baca, branding) di Cloudflare R2. Jika R2 nonaktif, upload
                tetap ke disk lokal server.
              </p>
            </div>
            <Badge
              className={
                activeDriver === "r2"
                  ? "bg-sky-50 text-sky-700 hover:bg-sky-50"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-100"
              }
            >
              {activeDriver === "r2" ? (
                <>
                  <Cloud className="mr-1 h-3.5 w-3.5" />
                  Aktif: R2
                </>
              ) : (
                <>
                  <HardDrive className="mr-1 h-3.5 w-3.5" />
                  Aktif: Lokal
                </>
              )}
            </Badge>
          </div>
        </section>

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              message.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <Card className="rounded-[24px] border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70">
            <CardTitle className="flex items-center gap-2 text-base font-extrabold">
              <Cloud className="h-4 w-4 text-sky-600" />
              Kredensial R2
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <Label className="text-sm font-bold text-slate-900">
                  Aktifkan Cloudflare R2
                </Label>
                <p className="mt-1 text-xs text-slate-500">
                  Upload baru memakai R2 saat aktif dan kredensial lengkap.
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(enabled) =>
                  setConfig((current) => ({ ...current, enabled }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="r2-account">Account ID</Label>
                <Input
                  id="r2-account"
                  value={config.accountId}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      accountId: event.target.value,
                    }))
                  }
                  placeholder="Cloudflare Account ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r2-bucket">Bucket name</Label>
                <Input
                  id="r2-bucket"
                  value={config.bucket}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      bucket: event.target.value,
                    }))
                  }
                  placeholder="guruspace-media"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="r2-public">Public Base URL</Label>
              <Input
                id="r2-public"
                value={config.publicBaseUrl}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    publicBaseUrl: event.target.value,
                  }))
                }
                placeholder="https://cdn.guruspaceai.cloud atau https://pub-xxx.r2.dev"
              />
              <p className="text-xs text-slate-500">
                URL publik bucket (R2.dev atau custom domain). File akan muncul
                sebagai {"{base}/uploads/..."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="r2-access">Access Key ID</Label>
                <Input
                  id="r2-access"
                  value={accessKeyId}
                  onChange={(event) => setAccessKeyId(event.target.value)}
                  placeholder={
                    config.accessKeyIdMasked
                      ? `Tersimpan: ${config.accessKeyIdMasked}`
                      : "Access Key ID"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r2-secret">Secret Access Key</Label>
                <Input
                  id="r2-secret"
                  type="password"
                  value={secretAccessKey}
                  onChange={(event) => setSecretAccessKey(event.target.value)}
                  placeholder={
                    config.secretAccessKeyMasked
                      ? `Tersimpan: ${config.secretAccessKeyMasked}`
                      : "Secret Access Key"
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs leading-5 text-amber-800">
              <p className="flex items-center gap-2 font-bold">
                <ShieldCheck className="h-4 w-4" />
                Checklist bucket
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Buat R2 bucket + API token (Object Read & Write).</li>
                <li>Aktifkan Public Access / custom domain untuk Public Base URL.</li>
                <li>CORS izinkan origin aplikasi jika upload/browser langsung dibutuhkan.</li>
                <li>File lama di disk lokal tidak otomatis dipindah; upload baru ke R2.</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={saving} className="rounded-2xl">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Simpan
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void test()}
                disabled={testing}
                className="rounded-2xl"
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Uji koneksi
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
