"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  PlugZap,
  Save,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type GatewayProvider = "FONNTE" | "WABLAS" | "CUSTOM";
type Purpose =
  | "OTP_REGISTER"
  | "OTP_PASSWORD_RESET"
  | "OTP_AFFILIATE_PAYOUT"
  | "TOPUP_SUCCESS"
  | "AFFILIATE_PAYOUT_SUCCESS"
  | "SUBSCRIPTION_PURCHASE"
  | "SUBSCRIPTION_EXPIRY_REMINDER"
  | "TEST";

type Gateway = {
  id: string;
  name: string;
  provider: GatewayProvider;
  baseUrl: string | null;
  sender: string | null;
  isActive: boolean;
  isDefault: boolean;
  isSandbox: boolean;
  tokenMasked: string;
  hasToken: boolean;
};

type Template = {
  enabled: boolean;
  title: string;
  message: string;
};

type LogRow = {
  id: string;
  gatewayName: string;
  provider: GatewayProvider | null;
  purpose: Purpose;
  target: string;
  status: "PENDING" | "SENT" | "FAILED";
  error: string | null;
  createdAt: string;
  sentAt: string | null;
};

type Payload = {
  gateways: Gateway[];
  templates: Record<Purpose, Template>;
  logs: LogRow[];
};

const EMPTY_FORM = {
  id: "",
  name: "Fonnte Utama",
  provider: "FONNTE" as GatewayProvider,
  baseUrl: "https://api.fonnte.com/send",
  token: "",
  sender: "",
  isActive: true,
  isDefault: true,
  isSandbox: false,
};

const PURPOSE_LABELS: Record<Purpose, string> = {
  OTP_REGISTER: "OTP Registrasi",
  OTP_PASSWORD_RESET: "OTP Reset Password",
  OTP_AFFILIATE_PAYOUT: "OTP Penarikan Komisi",
  TOPUP_SUCCESS: "Top Up Berhasil",
  AFFILIATE_PAYOUT_SUCCESS: "Penarikan Komisi Berhasil",
  SUBSCRIPTION_PURCHASE: "Pembelian Paket",
  SUBSCRIPTION_EXPIRY_REMINDER: "Reminder Expired Paket",
  TEST: "Test Gateway",
};

const PROVIDER_LABELS: Record<GatewayProvider, string> = {
  FONNTE: "Fonnte",
  WABLAS: "Wablas",
  CUSTOM: "Custom HTTP",
};

export function AdminWhatsAppGatewayClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testTarget, setTestTarget] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Halo Admin, ini pesan test WhatsApp Gateway Navalogi."
  );
  const [testGatewayId, setTestGatewayId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeGateway = useMemo(
    () => data?.gateways.find((gateway) => gateway.isActive && gateway.isDefault) ||
      data?.gateways.find((gateway) => gateway.isActive),
    [data?.gateways]
  );

  const load = async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/whatsapp-gateways");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal memuat gateway");
      if (!json?.gateways || !json?.templates) {
        throw new Error("Data WhatsApp Gateway tidak lengkap");
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat data"));
  }, []);

  const setField = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const editGateway = (gateway: Gateway) => {
    setForm({
      id: gateway.id,
      name: gateway.name,
      provider: gateway.provider,
      baseUrl: gateway.baseUrl || defaultBaseUrl(gateway.provider),
      token: "",
      sender: gateway.sender || "",
      isActive: gateway.isActive,
      isDefault: gateway.isDefault,
      isSandbox: gateway.isSandbox,
    });
    setMessage(`Mengedit ${gateway.name}. Token lama tetap dipakai jika kolom token dikosongkan.`);
  };

  const submit = async (body: unknown, success: string, savingKey: string) => {
    setSaving(savingKey);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan");
      if (!json?.gateways || !json?.templates) {
        throw new Error("Data WhatsApp Gateway tidak lengkap");
      }
      setData(json);
      setMessage(success);
      if (savingKey === "gateway") setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses");
    } finally {
      setSaving(null);
    }
  };

  const saveGateway = () => {
    submit(
      {
        action: "save-gateway",
        gateway: form,
      },
      "Gateway berhasil disimpan",
      "gateway"
    );
  };

  const deleteGateway = (id: string) => {
    if (!window.confirm("Hapus gateway ini? Log lama tetap tersimpan.")) return;
    submit({ action: "delete-gateway", id }, "Gateway berhasil dihapus", "delete");
  };

  const updateTemplate = (purpose: Purpose, patch: Partial<Template>) => {
    if (!data) return;
    setData({
      ...data,
      templates: {
        ...data.templates,
        [purpose]: { ...data.templates[purpose], ...patch },
      },
    });
  };

  const saveTemplates = () => {
    if (!data) return;
    submit(
      { action: "save-templates", templates: data.templates },
      "Template pesan berhasil disimpan",
      "templates"
    );
  };

  const sendTest = () => {
    submit(
      {
        action: "test-send",
        gatewayId: testGatewayId || undefined,
        target: testTarget,
        message: testMessage,
      },
      "Pesan test berhasil dikirim atau diterima provider",
      "test"
    );
  };

  return (
    <AdminShell activePath="/admin/whatsapp-gateways">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[22px] border bg-white shadow-sm">
          <div className="grid gap-6 bg-gradient-to-br from-emerald-950 via-slate-950 to-blue-950 p-6 text-white lg:grid-cols-[1fr_360px] lg:p-8">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                <MessageCircle className="h-3.5 w-3.5" />
                Komunikasi transaksi & OTP
              </div>
              <h1 className="text-3xl font-bold tracking-tight">WhatsApp Gateway</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">
                Atur provider WhatsApp untuk OTP, notifikasi top up, langganan, dan
                pencairan komisi. Provider aktif akan dipakai oleh service notifikasi aplikasi.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm text-emerald-100">Gateway aktif</p>
              <p className="mt-2 text-2xl font-bold">
                {activeGateway ? activeGateway.name : "Belum tersedia"}
              </p>
              <p className="mt-1 text-sm text-emerald-100">
                {activeGateway ? PROVIDER_LABELS[activeGateway.provider] : "Tambahkan provider dulu"}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border bg-white py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Memuat pengaturan WhatsApp...
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PlugZap className="h-4 w-4 text-emerald-600" />
                    Konfigurasi Gateway
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nama gateway</Label>
                      <Input value={form.name} onChange={(e) => setField("name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select
                        value={form.provider}
                        onValueChange={(value: GatewayProvider) =>
                          setForm((prev) => ({
                            ...prev,
                            provider: value,
                            baseUrl: defaultBaseUrl(value),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Base URL</Label>
                      <Input
                        value={form.baseUrl}
                        onChange={(e) => setField("baseUrl", e.target.value)}
                        placeholder={defaultBaseUrl(form.provider)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Token / API Key</Label>
                      <Input
                        type="password"
                        value={form.token}
                        onChange={(e) => setField("token", e.target.value)}
                        placeholder={form.id ? "Kosongkan jika tidak ingin mengubah token" : "Masukkan token provider"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sender / Device ID</Label>
                      <Input
                        value={form.sender}
                        onChange={(e) => setField("sender", e.target.value)}
                        placeholder="Opsional"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3 rounded-xl border bg-slate-50 p-3">
                      <Toggle label="Aktif" checked={form.isActive} onChange={(v) => setField("isActive", v)} />
                      <Toggle label="Default" checked={form.isDefault} onChange={(v) => setField("isDefault", v)} />
                      <Toggle label="Sandbox" checked={form.isSandbox} onChange={(v) => setField("isSandbox", v)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveGateway} disabled={saving !== null}>
                      {saving === "gateway" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Simpan Gateway
                    </Button>
                    {form.id && (
                      <Button variant="outline" onClick={() => setForm(EMPTY_FORM)} disabled={saving !== null}>
                        Batal Edit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Gateway Tersimpan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!data?.gateways.length ? (
                    <Empty text="Belum ada gateway. Tambahkan Fonnte atau provider lain." />
                  ) : (
                    data.gateways.map((gateway) => (
                      <div key={gateway.id} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{gateway.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {PROVIDER_LABELS[gateway.provider]} · Token {gateway.tokenMasked || "belum diisi"}
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {gateway.isDefault && <Badge>Default</Badge>}
                            <Badge variant={gateway.isActive ? "success" : "secondary"}>
                              {gateway.isActive ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => editGateway(gateway)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => deleteGateway(gateway.id)}
                            disabled={saving !== null}
                          >
                            <Trash2 className="h-4 w-4" />
                            Hapus
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-base">Template Pesan</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Gunakan variabel seperti {"{name}"}, {"{otp}"}, {"{amount}"}, {"{packageName}"}, {"{expiredAt}"}, {"{appName}"}.
                    </p>
                  </div>
                  <Button onClick={saveTemplates} disabled={saving !== null}>
                    {saving === "templates" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                {data &&
                  (Object.keys(data.templates) as Purpose[]).map((purpose) => (
                    <div key={purpose} className="rounded-xl border p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{PURPOSE_LABELS[purpose]}</p>
                          <p className="text-xs text-muted-foreground">{purpose}</p>
                        </div>
                        <Switch
                          checked={data.templates[purpose].enabled}
                          onCheckedChange={(checked) => updateTemplate(purpose, { enabled: checked })}
                        />
                      </div>
                      <Textarea
                        value={data.templates[purpose].message}
                        onChange={(e) => updateTemplate(purpose, { message: e.target.value })}
                        className="min-h-28"
                      />
                    </div>
                  ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="h-4 w-4 text-emerald-600" />
                    Test Kirim
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Gateway</Label>
                    <Select value={testGatewayId || "auto"} onValueChange={(value) => setTestGatewayId(value === "auto" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Otomatis: gateway default aktif</SelectItem>
                        {data?.gateways.map((gateway) => (
                          <SelectItem key={gateway.id} value={gateway.id}>
                            {gateway.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nomor tujuan</Label>
                    <Input value={testTarget} onChange={(e) => setTestTarget(e.target.value)} placeholder="08123456789" />
                  </div>
                  <div className="space-y-2">
                    <Label>Pesan</Label>
                    <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
                  </div>
                  <Button onClick={sendTest} disabled={saving !== null}>
                    {saving === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Kirim Test
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Log Pengiriman Terbaru</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {!data?.logs.length ? (
                    <Empty text="Belum ada log pengiriman." />
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-3 pr-4 font-medium">Status</th>
                          <th className="pb-3 pr-4 font-medium">Keperluan</th>
                          <th className="pb-3 pr-4 font-medium">Tujuan</th>
                          <th className="pb-3 pr-4 font-medium">Gateway</th>
                          <th className="pb-3 font-medium">Waktu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.logs.map((log) => (
                          <tr key={log.id} className="border-b last:border-0">
                            <td className="py-3 pr-4">
                              <span className="inline-flex items-center gap-1.5">
                                {log.status === "SENT" ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : log.status === "FAILED" ? (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                ) : (
                                  <Loader2 className="h-4 w-4 text-muted-foreground" />
                                )}
                                {log.status}
                              </span>
                              {log.error && <p className="mt-1 max-w-xs text-xs text-red-600">{log.error}</p>}
                            </td>
                            <td className="py-3 pr-4">{PURPOSE_LABELS[log.purpose]}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{log.target}</td>
                            <td className="py-3 pr-4">{log.gatewayName}</td>
                            <td className="py-3 text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex flex-col items-center justify-center gap-2 text-xs font-medium">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-slate-50 px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function defaultBaseUrl(provider: GatewayProvider) {
  if (provider === "FONNTE") return "https://api.fonnte.com/send";
  if (provider === "WABLAS") return "https://wablas.com/api/send-message";
  return "";
}
