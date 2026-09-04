"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, RadioTower, RefreshCw, Save, Server, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Config = {
  enabled: boolean;
  provider: "SELF_HOSTED" | "CLOUD";
  wsUrl: string;
  apiUrl: string;
  recordingEnabled: boolean;
  maxParticipants: number;
  configured: boolean;
  apiKeyMasked: string;
  apiSecretMasked: string;
  webhookUrl: string;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
};

const EMPTY: Config = {
  enabled: false,
  provider: "SELF_HOSTED",
  wsUrl: "",
  apiUrl: "",
  recordingEnabled: false,
  maxParticipants: 50,
  configured: false,
  apiKeyMasked: "",
  apiSecretMasked: "",
  webhookUrl: "",
};

export function LiveKitSettingsClient() {
  const [config, setConfig] = useState<Config>(EMPTY);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/livekit")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat pengaturan.");
        if (active) setConfig(data.config);
      })
      .catch((error) => active && setMessage({ tone: "error", text: error.message }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/livekit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          provider: config.provider,
          wsUrl: config.wsUrl,
          apiUrl: config.apiUrl,
          apiKey: apiKey || undefined,
          apiSecret: apiSecret || undefined,
          recordingEnabled: config.recordingEnabled,
          maxParticipants: Number(config.maxParticipants),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan pengaturan.");
      setConfig(data.config);
      setApiKey("");
      setApiSecret("");
      setMessage({ tone: "ok", text: data.message });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Gagal menyimpan." });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/livekit", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Uji koneksi gagal.");
      setMessage({ tone: "ok", text: data.message });
      setConfig((current) => ({
        ...current,
        lastTestOk: true,
        lastTestedAt: new Date().toISOString(),
        lastTestMessage: data.message,
      }));
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Uji koneksi gagal." });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="rounded-[24px] border border-emerald-100 bg-white p-8 text-sm font-semibold text-slate-500">Memuat pengaturan LiveKit...</div>;
  }

  return (
    <div className="space-y-6 rounded-[24px] bg-white p-4 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Integrasi PJJ</Badge>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Server LiveKit</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Hubungkan Navalogi dengan LiveKit untuk kelas video, berbagi layar, moderasi, dan pencatatan kehadiran PJJ.
          </p>
        </div>
        <Badge variant="outline" className={config.enabled && config.configured ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
          {config.enabled && config.configured ? "Aktif" : "Belum aktif"}
        </Badge>
      </div>

      {message ? (
        <div role="status" className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_0.78fr]">
        <Card className="rounded-[24px] border-emerald-100 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Server className="h-5 w-5 text-emerald-700" />Koneksi server</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div><p className="font-extrabold text-slate-950">Aktifkan LiveKit</p><p className="mt-1 text-xs text-slate-500">Kelas virtual hanya dapat dimulai ketika integrasi aktif.</p></div>
              <Switch checked={config.enabled} onCheckedChange={(enabled) => setConfig((current) => ({ ...current, enabled }))} aria-label="Aktifkan LiveKit" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="provider">Jenis layanan</Label><select id="provider" value={config.provider} onChange={(event) => setConfig((current) => ({ ...current, provider: event.target.value as Config["provider"] }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="SELF_HOSTED">Server Mandiri</option><option value="CLOUD">LiveKit Cloud</option></select></div>
              <div className="space-y-2"><Label htmlFor="maxParticipants">Batas peserta</Label><Input id="maxParticipants" type="number" min={2} max={500} value={config.maxParticipants} onChange={(event) => setConfig((current) => ({ ...current, maxParticipants: Number(event.target.value) }))} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="wsUrl">WebSocket URL</Label><Input id="wsUrl" placeholder="wss://livekit.domain.id" value={config.wsUrl} onChange={(event) => setConfig((current) => ({ ...current, wsUrl: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="apiUrl">API URL</Label><Input id="apiUrl" placeholder="https://livekit.domain.id" value={config.apiUrl} onChange={(event) => setConfig((current) => ({ ...current, apiUrl: event.target.value }))} /><p className="text-xs text-slate-500">Boleh dikosongkan agar dibuat otomatis dari WebSocket URL.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="apiKey">API Key</Label><Input id="apiKey" autoComplete="off" placeholder={config.apiKeyMasked || "Masukkan API Key"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="apiSecret">API Secret</Label><Input id="apiSecret" type="password" autoComplete="new-password" placeholder={config.apiSecretMasked || "Masukkan API Secret"} value={apiSecret} onChange={(event) => setApiSecret(event.target.value)} /></div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border p-4"><div><p className="font-extrabold">Rekaman kelas</p><p className="mt-1 text-xs text-slate-500">Memerlukan layanan Egress dan penyimpanan pada server.</p></div><Switch checked={config.recordingEnabled} onCheckedChange={(recordingEnabled) => setConfig((current) => ({ ...current, recordingEnabled }))} aria-label="Aktifkan rekaman" /></div>
            <div className="flex flex-wrap gap-3"><Button onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "Menyimpan..." : "Simpan Pengaturan"}</Button><Button variant="outline" onClick={testConnection} disabled={testing || !config.configured}><RefreshCw className={`h-4 w-4 ${testing ? "animate-spin" : ""}`} />{testing ? "Menguji..." : "Uji Koneksi"}</Button></div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[24px] border-emerald-100 bg-slate-950 text-white shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><RadioTower className="h-5 w-5 text-cyan-300" />Webhook</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-6 text-slate-300">Daftarkan URL ini pada konfigurasi webhook LiveKit agar kehadiran tercatat otomatis.</p><div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"><code className="min-w-0 flex-1 break-all text-xs text-cyan-100">{config.webhookUrl}</code><Button type="button" size="icon" variant="ghost" className="shrink-0 text-white hover:bg-white/10 hover:text-white" onClick={() => navigator.clipboard.writeText(config.webhookUrl)} aria-label="Salin URL webhook"><Copy className="h-4 w-4" /></Button></div></CardContent>
          </Card>
          <Card className="rounded-[24px] border-emerald-100 bg-emerald-50/60 shadow-sm"><CardContent className="p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="font-extrabold text-emerald-950">Kredensial terlindungi</p><p className="mt-1 text-sm leading-6 text-emerald-800">API Key dan Secret dienkripsi di server. Browser hanya menerima token ruang berumur pendek.</p></div></div>{config.lastTestedAt ? <div className="mt-4 border-t border-emerald-200 pt-4 text-xs font-semibold text-emerald-800"><p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Uji terakhir: {new Date(config.lastTestedAt).toLocaleString("id-ID")}</p><p className="mt-1">{config.lastTestMessage}</p></div> : null}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
