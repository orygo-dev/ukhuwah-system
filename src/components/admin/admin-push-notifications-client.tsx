"use client";

import { useEffect, useRef, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  FileJson,
  Globe2,
  Info,
  Loader2,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  UploadCloud,
  Wifi,
} from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PushNotificationPublicConfig } from "@/lib/push-notification-settings";

const EMPTY: PushNotificationPublicConfig = {
  enabled: false,
  provider: "FCM",
  projectId: "",
  androidChannelId: "genpro_default",
  configured: false,
  credentialMode: "MISSING",
  serverKeyMasked: "",
  web: {
    configured: false,
    apiKey: "",
    authDomain: "",
    projectId: "",
    messagingSenderId: "",
    appId: "",
    vapidKey: "",
  },
};

export function AdminPushNotificationsClient() {
  const credentialInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<PushNotificationPublicConfig>(EMPTY);
  const [serverKey, setServerKey] = useState("");
  const [credentialFile, setCredentialFile] = useState<{
    name: string;
    projectId: string;
  } | null>(null);
  const [showWebSettings, setShowWebSettings] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error" | "warn";
    text: string;
    steps?: string[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/push-notifications")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat pengaturan.");
        if (active) setConfig(data.config);
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
    if (config.enabled && !serverKey && config.credentialMode === "MISSING") {
      setMessage({
        tone: "error",
        text: "Upload file service account JSON Firebase terlebih dahulu.",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/push-notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          provider: "FCM",
          projectId: config.projectId,
          androidChannelId: config.androidChannelId,
          serverKey: serverKey || undefined,
          webApiKey: config.web.apiKey,
          webAuthDomain: config.web.authDomain,
          webMessagingSenderId: config.web.messagingSenderId,
          webAppId: config.web.appId,
          webVapidKey: config.web.vapidKey,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan.");
      setConfig(data.config);
      setServerKey("");
      setCredentialFile(null);
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

  const selectCredentialFile = async (file?: File) => {
    if (!file) return;
    setMessage(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setMessage({ tone: "error", text: "Pilih file dengan format .json." });
      return;
    }
    if (file.size > 20_000) {
      setMessage({
        tone: "error",
        text: "Ukuran file terlalu besar. Pilih private key Firebase Admin SDK yang asli.",
      });
      return;
    }
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "").trim();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (parsed.project_info || Array.isArray(parsed.client)) {
        throw new Error(
          "File ini adalah google-services.json. Upload private key dari Firebase Admin SDK."
        );
      }
      const projectId = String(parsed.project_id ?? "").trim();
      const clientEmail = String(parsed.client_email ?? "").trim();
      const privateKey = String(parsed.private_key ?? "");
      if (
        !projectId ||
        !clientEmail.includes("@") ||
        !privateKey.includes("BEGIN PRIVATE KEY") ||
        !privateKey.includes("END PRIVATE KEY")
      ) {
        throw new Error(
          "File bukan service account Firebase yang valid. Generate file melalui Firebase Admin SDK."
        );
      }
      setServerKey(text);
      setCredentialFile({ name: file.name, projectId });
      setConfig((current) => ({ ...current, enabled: true, projectId }));
      setMessage({
        tone: "ok",
        text: `File valid untuk project ${projectId}. Klik Simpan pengaturan untuk mengaktifkan push.`,
      });
    } catch (error) {
      setServerKey("");
      setCredentialFile(null);
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "File JSON tidak dapat dibaca.",
      });
    } finally {
      if (credentialInputRef.current) credentialInputRef.current.value = "";
    }
  };

  const validateCredential = async () => {
    setValidating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/push-notifications/validate", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Validasi gagal.");
      setMessage({ tone: "ok", text: data.message });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Validasi gagal.",
      });
    } finally {
      setValidating(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/push-notifications/test", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pengiriman uji gagal.");
      if (data.warning) {
        setMessage({ tone: "warn", text: data.message, steps: data.steps });
      } else {
        setMessage({ tone: "ok", text: data.message });
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Pengiriman uji gagal.",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <AdminShell activePath="/admin/push-notifications">
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Memuat pengaturan push...
        </div>
      </AdminShell>
    );
  }

  const credentialStored = config.credentialMode === "SERVICE_ACCOUNT";
  const credentialFromServer = config.credentialMode === "ADC";
  const credentialReady = Boolean(credentialFile || credentialStored || credentialFromServer);
  const serviceStatus =
    config.enabled && config.configured
      ? "Aktif dan siap"
      : config.configured
        ? "Siap, belum diaktifkan"
        : "Perlu konfigurasi";

  return (
    <AdminShell activePath="/admin/push-notifications">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 pb-10">
        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_20px_60px_rgba(37,99,235,0.08)]">
          <div className="flex flex-col gap-5 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_58%,#ecfeff_100%)] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                Push Notifikasi
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload satu file Firebase Admin, lalu simpan. Project ID dan konfigurasi
                Android akan disiapkan otomatis.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl ${
                  config.enabled && config.configured
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {config.enabled && config.configured ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <BellRing className="h-5 w-5" />
                )}
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-500">Status layanan</p>
                <p className="text-sm font-extrabold text-slate-900">
                  {serviceStatus}
                </p>
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div
            role="status"
            className={`rounded-2xl border px-4 py-4 text-sm font-semibold ${
              message.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : message.tone === "warn"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <div className="flex items-start gap-3">
              {message.tone === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : message.tone === "warn" ? (
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p>{message.text}</p>
                {message.steps && message.steps.length > 0 ? (
                  <ol className="mt-3 space-y-2 rounded-xl border border-amber-200/60 bg-white/60 p-4 text-xs leading-5 text-amber-900">
                    {message.steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-200 text-[10px] font-black text-amber-800">
                          {index + 1}
                        </span>
                        <span className="flex-1">{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <Card className="overflow-hidden rounded-[26px] border-slate-200 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
          <CardHeader className="border-b border-slate-100 bg-white px-5 py-5 sm:px-6">
            <CardTitle className="flex items-center gap-3 text-base font-extrabold text-slate-950">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)]">
                <FileJson className="h-5 w-5" />
              </span>
              Hubungkan Firebase
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <input
              ref={credentialInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void selectCredentialFile(event.target.files?.[0])}
            />

            <div
              className={`rounded-[22px] border-2 border-dashed p-5 transition-colors ${
                credentialReady
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-emerald-200 bg-emerald-50/50"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                      credentialReady
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-white text-emerald-700 shadow-sm"
                    }`}
                  >
                    {credentialReady ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <UploadCloud className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-950">
                      {credentialFile
                        ? credentialFile.name
                        : credentialStored
                          ? "Firebase Admin JSON tersimpan"
                          : credentialFromServer
                            ? "Kredensial server terdeteksi"
                            : "Upload service account JSON"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {credentialFile
                        ? `Project ${credentialFile.projectId} terdeteksi otomatis.`
                        : credentialStored
                          ? `Terhubung ke project ${config.projectId}. Upload hanya jika ingin mengganti file.`
                          : credentialFromServer
                            ? config.projectId
                              ? `Server terhubung ke project ${config.projectId}.`
                              : "Kredensial tersedia di server. Isi Project ID pada pengaturan teknis."
                            : "Gunakan file dari Project settings → Service accounts → Generate new private key."}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={credentialReady ? "outline" : "default"}
                  onClick={() => credentialInputRef.current?.click()}
                  className="h-11 shrink-0 rounded-xl px-5 text-sm font-extrabold"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {credentialReady ? "Ganti file" : "Pilih file JSON"}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <div>
                <Label className="text-sm font-extrabold text-slate-900">
                  Aktifkan push Android
                </Label>
                <p className="mt-1 text-xs text-slate-500">
                  Pengguna akan diminta memberi izin notifikasi setelah login.
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(enabled) =>
                  setConfig((current) => ({ ...current, enabled }))
                }
              />
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <Button
                onClick={() => void save()}
                disabled={saving || testing || validating}
                className="h-11 rounded-xl px-5 font-extrabold"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Simpan pengaturan
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void validateCredential()}
                disabled={saving || testing || validating || !config.enabled || !config.configured}
                className="h-11 rounded-xl px-5 font-extrabold"
              >
                {validating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="mr-2 h-4 w-4" />
                )}
                Cek koneksi Firebase
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void sendTest()}
                disabled={saving || testing || validating || !config.enabled || !config.configured}
                className="h-11 rounded-xl px-5 font-extrabold"
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Kirim notifikasi uji
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowWebSettings((current) => !current)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 sm:px-6"
            aria-expanded={showWebSettings}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Globe2 className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-extrabold text-slate-950">
                  Push browser/web
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Opsional, hanya untuk notifikasi di browser.
                </span>
              </span>
            </span>
            <span className="flex items-center gap-3">
              <Badge
                className={
                  config.web.configured
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }
              >
                {config.web.configured ? "Sudah lengkap" : "Opsional"}
              </Badge>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  showWebSettings ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {showWebSettings ? (
            <div className="grid gap-4 border-t border-slate-100 px-5 py-5 sm:grid-cols-2 sm:px-6">
              <div className="space-y-2">
                <Label htmlFor="web-api-key">Web API Key</Label>
                <Input
                  id="web-api-key"
                  value={config.web.apiKey}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      web: { ...current.web, apiKey: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="web-auth-domain">Auth Domain</Label>
                <Input
                  id="web-auth-domain"
                  value={config.web.authDomain}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      web: { ...current.web, authDomain: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="web-sender-id">Messaging Sender ID</Label>
                <Input
                  id="web-sender-id"
                  value={config.web.messagingSenderId}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      web: { ...current.web, messagingSenderId: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="web-app-id">Web App ID</Label>
                <Input
                  id="web-app-id"
                  value={config.web.appId}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      web: { ...current.web, appId: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="web-vapid-key">Public VAPID key</Label>
                <Input
                  id="web-vapid-key"
                  value={config.web.vapidKey}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      web: { ...current.web, vapidKey: event.target.value },
                    }))
                  }
                />
                <p className="text-xs leading-5 text-slate-500">
                  Ditemukan di Firebase Project settings → Cloud Messaging → Web Push
                  certificates.
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowAdvancedSettings((current) => !current)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 sm:px-6"
            aria-expanded={showAdvancedSettings}
          >
            <span className="flex items-center gap-3 text-sm font-extrabold text-slate-800">
              <Settings2 className="h-4 w-4 text-slate-500" />
              Pengaturan teknis
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${
                showAdvancedSettings ? "rotate-180" : ""
              }`}
            />
          </button>
          {showAdvancedSettings ? (
            <div className="grid gap-4 border-t border-slate-100 px-5 py-5 sm:grid-cols-2 sm:px-6">
              <div className="space-y-2">
                <Label htmlFor="fcm-project">Project ID</Label>
                <Input
                  id="fcm-project"
                  value={config.projectId}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, projectId: event.target.value }))
                  }
                  placeholder="Terisi otomatis dari file JSON"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fcm-channel">Android channel ID</Label>
                <Input
                  id="fcm-channel"
                  value={config.androidChannelId}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      androidChannelId: event.target.value,
                    }))
                  }
                  placeholder="genpro_default"
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
