"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ClipboardList,
  Clock3,
  Copy,
  Gauge,
  Globe2,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Wallet,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";

type ProviderStatus = "ACTIVE" | "SUSPENDED" | "EXPIRED";
type ViewMode = "overview" | "settings" | "logs";

type ToolOption = {
  slug: string;
  name: string;
  category: string;
  creditCost: number;
};

type UsageLog = {
  id: string;
  clientName?: string;
  clientSlug?: string;
  requestId: string;
  toolSlug: string;
  status: string;
  creditCharged: number;
  providerUsed: string | null;
  latencyMs: number | null;
  externalTenantId: string | null;
  externalUserId: string | null;
  externalRequestId: string | null;
  responseTitle: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type ProviderClientRow = {
  id?: string;
  name: string;
  slug: string;
  status: ProviderStatus;
  planName: string;
  monthlyCreditLimit: number;
  usedCredits: number;
  remainingCredits?: number;
  periodStart: string;
  periodEnd: string | null;
  allowedTools: string[];
  contactName: string;
  contactEmail: string;
  billingRateIdr: number;
  overageEnabled: boolean;
  overageRateIdr: number;
  webhookUrl: string;
  allowedOrigins: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string | null;
  lastStatus?: string | null;
  successRequests?: number;
  failedRequests?: number;
  avgLatencyMs?: number | null;
  recentUsage?: UsageLog[];
};

type ApiPayload = {
  summary: {
    totalClients: number;
    activeClients: number;
    totalLimit: number;
    totalUsed: number;
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    billedCredits: number;
    avgLatencyMs: number;
  };
  tools: ToolOption[];
  clients: ProviderClientRow[];
  recentLogs: UsageLog[];
};

function nextDateIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

const EMPTY_CLIENT: ProviderClientRow = {
  name: "Navalogi",
  slug: "genpro",
  status: "ACTIVE",
  planName: "provider-basic",
  monthlyCreditLimit: 1000,
  usedCredits: 0,
  remainingCredits: 1000,
  periodStart: new Date().toISOString(),
  periodEnd: nextDateIso(30),
  allowedTools: ["modul-ajar"],
  contactName: "",
  contactEmail: "",
  billingRateIdr: 0,
  overageEnabled: false,
  overageRateIdr: 0,
  webhookUrl: "",
  allowedOrigins: "",
  notes: "",
};

const PROVIDER_ENDPOINT = "/api/provider/v1/generate";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(value || 0));
}

function usagePercent(client: ProviderClientRow) {
  if (!client.monthlyCreditLimit) return 0;
  return Math.min(100, Math.round((client.usedCredits / client.monthlyCreditLimit) * 100));
}

function successRate(success: number, failed: number) {
  const total = success + failed;
  return total ? Math.round((success / total) * 100) : 0;
}

function daysLeft(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function statusTone(status: ProviderStatus | string | null | undefined) {
  if (status === "ACTIVE" || status === "SUCCESS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "SUSPENDED") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function normalizeClient(client: ProviderClientRow): ProviderClientRow {
  return {
    ...EMPTY_CLIENT,
    ...client,
    remainingCredits: client.remainingCredits ?? Math.max(0, client.monthlyCreditLimit - client.usedCredits),
    contactName: client.contactName || "",
    contactEmail: client.contactEmail || "",
    billingRateIdr: Number(client.billingRateIdr || 0),
    overageEnabled: Boolean(client.overageEnabled),
    overageRateIdr: Number(client.overageRateIdr || 0),
    webhookUrl: client.webhookUrl || "",
    allowedOrigins: client.allowedOrigins || "",
    notes: client.notes || "",
  };
}

export function AdminProviderClientsClient() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [selected, setSelected] = useState<ProviderClientRow>(EMPTY_CLIENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);
  const [newApiKey, setNewApiKey] = useState("");
  const [allowAllTools, setAllowAllTools] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProviderStatus>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [fullEndpoint, setFullEndpoint] = useState(PROVIDER_ENDPOINT);

  const clients = useMemo(() => data?.clients || [], [data?.clients]);
  const recentLogs = data?.recentLogs || [];

  const toolsByCategory = useMemo(() => {
    return (data?.tools || []).reduce<Record<string, ToolOption[]>>((acc, tool) => {
      acc[tool.category] = [...(acc[tool.category] || []), tool];
      return acc;
    }, {});
  }, [data?.tools]);

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matchStatus = statusFilter === "ALL" || client.status === statusFilter;
      const matchTerm =
        !term ||
        client.name.toLowerCase().includes(term) ||
        client.slug.toLowerCase().includes(term) ||
        client.planName.toLowerCase().includes(term) ||
        client.contactEmail?.toLowerCase().includes(term);
      return matchStatus && matchTerm;
    });
  }, [clients, query, statusFilter]);

  const selectedLogs = selected.recentUsage || [];
  const selectedDaysLeft = daysLeft(selected.periodEnd);
  const selectedRate = successRate(selected.successRequests || 0, selected.failedRequests || 0);
  const monthlyValue = selected.billingRateIdr || selected.monthlyCreditLimit * 1000;

  const showMessage = (text: string, ok = true) => {
    setMessage(text);
    setMessageOk(ok);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/provider-clients");
    const payload = await res.json();
    if (!res.ok) {
      showMessage(payload.error || "Gagal memuat provider client", false);
      setLoading(false);
      return;
    }

    const normalized = {
      ...payload,
      clients: (payload.clients || []).map(normalizeClient),
    } as ApiPayload;
    setData(normalized);
    if (normalized.clients.length > 0) {
      const current = selected.id
        ? normalized.clients.find((client) => client.id === selected.id)
        : normalized.clients[0];
      const next = current || normalized.clients[0];
      setSelected(next);
      setAllowAllTools(next.allowedTools.length === 0);
    }
    setLoading(false);
  }, [selected.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setFullEndpoint(`${window.location.origin}${PROVIDER_ENDPOINT}`);
  }, []);

  const updateSelected = (patch: Partial<ProviderClientRow>) => {
    setSelected((current) => normalizeClient({ ...current, ...patch }));
  };

  const toggleTool = (slug: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current.allowedTools);
      if (checked) next.add(slug);
      else next.delete(slug);
      return normalizeClient({ ...current, allowedTools: [...next] });
    });
  };

  const selectClient = (client: ProviderClientRow) => {
    const next = normalizeClient(client);
    setSelected(next);
    setAllowAllTools(next.allowedTools.length === 0);
    setNewApiKey("");
    showMessage("");
  };

  const createNew = () => {
    setSelected(normalizeClient({ ...EMPTY_CLIENT, slug: `client-${Date.now().toString().slice(-5)}` }));
    setAllowAllTools(false);
    setNewApiKey("");
    setViewMode("settings");
    showMessage("");
  };

  const postAction = async (body: unknown) => {
    setSaving(true);
    const res = await fetch("/api/admin/provider-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    setSaving(false);
    if (!res.ok) {
      showMessage(payload.error || "Operasi gagal", false);
      return null;
    }
    if (payload.apiKey) setNewApiKey(payload.apiKey);
    await loadData();
    if (payload.client) {
      const next = normalizeClient(payload.client);
      setSelected(next);
      setAllowAllTools(next.allowedTools.length === 0);
    }
    showMessage("Pengaturan provider berhasil disimpan.");
    return payload;
  };

  const saveClient = async () => {
    const allowedTools = allowAllTools ? [] : selected.allowedTools;
    await postAction({
      action: "save",
      client: {
        ...selected,
        allowedTools,
        periodStart: dateInput(selected.periodStart),
        periodEnd: dateInput(selected.periodEnd),
      },
    });
  };

  const rotateKey = async () => {
    if (!selected.id) return;
    const ok = window.confirm("Rotasi API key akan membuat key lama tidak berlaku. Lanjutkan?");
    if (!ok) return;
    await postAction({ action: "rotate_key", id: selected.id });
  };

  const resetUsage = async () => {
    if (!selected.id) return;
    const ok = window.confirm("Reset pemakaian kredit periode client ini ke 0?");
    if (!ok) return;
    await postAction({ action: "reset_usage", id: selected.id });
  };

  const deleteClient = async () => {
    if (!selected.id) return;
    const ok = window.confirm(`Hapus client ${selected.name}? Usage log client ini ikut terhapus.`);
    if (!ok) return;
    await postAction({ action: "delete", id: selected.id });
    createNew();
  };

  const copyText = async (value: string, successMessage: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    showMessage(successMessage);
  };

  const summary = data?.summary || {
    totalClients: 0,
    activeClients: 0,
    totalLimit: 0,
    totalUsed: 0,
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    billedCredits: 0,
    avgLatencyMs: 0,
  };
  const totalPercent = summary.totalLimit ? Math.round((summary.totalUsed / summary.totalLimit) * 100) : 0;
  const globalSuccessRate = successRate(summary.successRequests, summary.failedRequests);

  if (loading) {
    return (
      <AdminShell activePath="/admin/provider-clients">
        <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Memuat provider client...
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/provider-clients">
      <div className="space-y-4 text-[13px]">
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700">
                  Provider API
                </Badge>
                <Badge variant="outline" className="max-w-full truncate border-slate-200 text-[11px] text-slate-600">
                  {fullEndpoint}
                </Badge>
              </div>
              <h1 className="mt-2 text-xl font-black text-slate-950">Client & Langganan Provider</h1>
              <p className="mt-1 max-w-3xl text-[13px] text-slate-600">
                Kontrol langganan aplikasi pelanggan, kuota generator, rotasi credential, dan performa request dari satu panel.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void copyText(fullEndpoint, "Endpoint provider disalin.")}>
                <Copy className="mr-2 h-4 w-4" />
                Salin Endpoint
              </Button>
              <Button variant="outline" onClick={() => void loadData()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={createNew}>
                <Plus className="mr-2 h-4 w-4" />
                Client Baru
              </Button>
            </div>
          </div>
        </section>

        {message ? (
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm font-semibold",
              messageOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
            )}
          >
            {message}
          </div>
        ) : null}

        {newApiKey ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-amber-950">API key baru hanya tampil sekali</p>
                <p className="mt-2 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-950">
                  {newApiKey}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => void copyText(newApiKey, "API key disalin. Simpan di konfigurasi Navalogi.")}
                className="shrink-0 bg-white"
              >
                <Copy className="mr-2 h-4 w-4" />
                Salin API Key
              </Button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={KeyRound} label="Client Aktif" value={`${formatNumber(summary.activeClients)}/${formatNumber(summary.totalClients)}`} />
          <MetricCard icon={Gauge} label="Kredit Terpakai" value={`${totalPercent}%`} detail={`${formatNumber(summary.totalUsed)} / ${formatNumber(summary.totalLimit)}`} />
          <MetricCard icon={Activity} label="Request" value={formatNumber(summary.totalRequests)} detail={`${globalSuccessRate}% sukses`} />
          <MetricCard icon={Clock3} label="Latency Avg" value={`${formatNumber(summary.avgLatencyMs)} ms`} />
          <MetricCard icon={Wallet} label="Kredit Tertagih" value={formatNumber(summary.billedCredits)} />
        </div>

        <div className="grid gap-4 2xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="rounded-xl">
              <CardContent className="space-y-3 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari client, slug, paket..."
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value: "ALL" | ProviderStatus) => setStatusFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua status</SelectItem>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                    <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {filteredClients.length === 0 ? (
                <Card className="rounded-xl">
                  <CardContent className="p-5 text-center text-[13px] text-slate-500">Tidak ada client sesuai filter.</CardContent>
                </Card>
              ) : (
                filteredClients.map((client) => (
                  <ClientListItem
                    key={client.id}
                    client={client}
                    selected={selected.id === client.id}
                    onSelect={() => selectClient(client)}
                  />
                ))
              )}
            </div>
          </aside>

          <main className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-slate-950">{selected.name}</h2>
                    <Badge variant="outline" className={statusTone(selected.status)}>
                      {selected.status}
                    </Badge>
                    <Badge variant="secondary">{selected.planName}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="font-mono">{selected.slug}</span>
                    <span>Aktif sampai {formatDate(selected.periodEnd)}</span>
                    <span>{selectedDaysLeft === null ? "Tanpa batas" : `${selectedDaysLeft} hari tersisa`}</span>
                    <span>Last used {formatDateTime(selected.lastUsedAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setViewMode("overview")} className={viewMode === "overview" ? "border-primary text-primary" : ""}>
                    <Activity className="mr-2 h-4 w-4" />
                    Overview
                  </Button>
                  <Button variant="outline" onClick={() => setViewMode("settings")} className={viewMode === "settings" ? "border-primary text-primary" : ""}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Pengaturan
                  </Button>
                  <Button variant="outline" onClick={() => setViewMode("logs")} className={viewMode === "logs" ? "border-primary text-primary" : ""}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Log
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <MiniStat label="Sisa kuota" value={formatNumber(selected.remainingCredits)} detail={`${formatNumber(selected.usedCredits)} terpakai`} />
                <MiniStat label="Success rate" value={`${selectedRate}%`} detail={`${formatNumber(selected.successRequests)} sukses`} />
                <MiniStat label="Latency" value={`${formatNumber(selected.avgLatencyMs)} ms`} detail={selected.lastStatus || "Belum ada request"} />
                <MiniStat label="Nilai kontrak" value={formatCurrency(monthlyValue)} detail={selected.overageEnabled ? "Overage aktif" : "Tanpa overage"} />
              </div>
              <Progress value={usagePercent(selected)} className="mt-4" />
            </section>

            {viewMode === "overview" ? (
              <OverviewPanel
                selected={selected}
                recentLogs={selectedLogs}
                fullEndpoint={fullEndpoint}
                onCopyEndpoint={() => void copyText(fullEndpoint, "Endpoint provider disalin.")}
              />
            ) : null}

            {viewMode === "settings" ? (
              <SettingsPanel
                selected={selected}
                saving={saving}
                allowAllTools={allowAllTools}
                toolsByCategory={toolsByCategory}
                onAllowAllTools={setAllowAllTools}
                onUpdate={updateSelected}
                onToggleTool={toggleTool}
                onSave={() => void saveClient()}
                onRotateKey={() => void rotateKey()}
                onResetUsage={() => void resetUsage()}
                onDelete={() => void deleteClient()}
              />
            ) : null}

            {viewMode === "logs" ? (
              <LogsPanel logs={recentLogs} selectedLogs={selectedLogs} />
            ) : null}
          </main>
        </div>
      </div>
    </AdminShell>
  );
}

function ClientListItem({
  client,
  selected,
  onSelect,
}: {
  client: ProviderClientRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const percent = usagePercent(client);
  const left = daysLeft(client.periodEnd);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-primary/40",
        selected ? "border-primary ring-4 ring-primary/10" : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-black text-slate-950">{client.name}</p>
            <Badge variant="outline" className={statusTone(client.status)}>
              {client.status}
            </Badge>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">{client.slug}</p>
        </div>
        <p className="text-right text-xs font-bold text-slate-500">{percent}%</p>
      </div>
      <Progress value={percent} className="mt-2.5" />
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
        <span>{formatNumber(client.remainingCredits)} sisa kredit</span>
        <span className="text-right">{left === null ? "Tanpa batas" : `${left} hari`}</span>
      </div>
    </button>
  );
}

function OverviewPanel({
  selected,
  recentLogs,
  fullEndpoint,
  onCopyEndpoint,
}: {
  selected: ProviderClientRow;
  recentLogs: UsageLog[];
  fullEndpoint: string;
  onCopyEndpoint: () => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-950">Integrasi</h3>
            <p className="text-[12px] text-slate-500">Contract endpoint dan identitas client.</p>
          </div>
          <Button variant="outline" onClick={onCopyEndpoint}>
            <Copy className="mr-2 h-4 w-4" />
            Salin
          </Button>
        </div>
        <div className="mt-4 grid gap-3">
          <InfoRow icon={Server} label="Endpoint" value={fullEndpoint} mono />
          <InfoRow icon={KeyRound} label="Client slug" value={selected.slug} mono />
          <InfoRow icon={Webhook} label="Webhook" value={selected.webhookUrl || "-"} mono />
          <InfoRow icon={Globe2} label="Allowed origins" value={selected.allowedOrigins || "-"} mono />
          <InfoRow icon={Mail} label="Kontak" value={selected.contactEmail || selected.contactName || "-"} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-950">Request Terakhir</h3>
        <div className="mt-4 space-y-3">
          {recentLogs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-[13px] text-slate-500">Belum ada request untuk client ini.</p>
          ) : (
            recentLogs.slice(0, 4).map((log) => <UsageLogRow key={log.id} log={log} compact />)
          )}
        </div>
      </section>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-950">{title}</h3>
          {description ? <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SettingsPanel({
  selected,
  saving,
  allowAllTools,
  toolsByCategory,
  onAllowAllTools,
  onUpdate,
  onToggleTool,
  onSave,
  onRotateKey,
  onResetUsage,
  onDelete,
}: {
  selected: ProviderClientRow;
  saving: boolean;
  allowAllTools: boolean;
  toolsByCategory: Record<string, ToolOption[]>;
  onAllowAllTools: (checked: boolean) => void;
  onUpdate: (patch: Partial<ProviderClientRow>) => void;
  onToggleTool: (slug: string, checked: boolean) => void;
  onSave: () => void;
  onRotateKey: () => void;
  onResetUsage: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsSection title="Identitas Client" description="Profil dasar dan status akses aplikasi pelanggan.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nama client">
              <Input
                value={selected.name}
                onChange={(event) => {
                  const name = event.target.value;
                  onUpdate({ name, slug: selected.id ? selected.slug : slugify(name) });
                }}
              />
            </Field>
            <Field label="Slug">
              <Input value={selected.slug} onChange={(event) => onUpdate({ slug: slugify(event.target.value) })} />
            </Field>
            <Field label="Status">
              <Select value={selected.status} onValueChange={(value: ProviderStatus) => onUpdate({ status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                  <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nama paket">
              <Input value={selected.planName} onChange={(event) => onUpdate({ planName: event.target.value })} />
            </Field>
            <Field label="Kontak PIC">
              <Input value={selected.contactName} onChange={(event) => onUpdate({ contactName: event.target.value })} />
            </Field>
            <Field label="Email billing">
              <Input type="email" value={selected.contactEmail} onChange={(event) => onUpdate({ contactEmail: event.target.value })} />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Langganan & Billing" description="Kuota, periode aktif, nilai kontrak, dan overage.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Kuota kredit bulanan">
              <Input
                type="number"
                min={1}
                value={selected.monthlyCreditLimit}
                onChange={(event) => onUpdate({ monthlyCreditLimit: Number(event.target.value || 0) })}
              />
            </Field>
            <Field label="Nilai kontrak bulanan">
              <Input
                type="number"
                min={0}
                value={selected.billingRateIdr}
                onChange={(event) => onUpdate({ billingRateIdr: Number(event.target.value || 0) })}
              />
            </Field>
            <Field label="Mulai periode">
              <Input type="date" value={dateInput(selected.periodStart)} onChange={(event) => onUpdate({ periodStart: event.target.value })} />
            </Field>
            <Field label="Berakhir">
              <Input type="date" value={dateInput(selected.periodEnd)} onChange={(event) => onUpdate({ periodEnd: event.target.value || null })} />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_180px]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-extrabold text-slate-900">Overage</p>
                <p className="text-[11px] text-slate-500">Tagihan tambahan saat kuota terlampaui.</p>
              </div>
              <Switch checked={selected.overageEnabled} onCheckedChange={(checked) => onUpdate({ overageEnabled: checked })} />
            </div>
            <Field label="Tarif / kredit">
              <Input
                type="number"
                min={0}
                value={selected.overageRateIdr}
                onChange={(event) => onUpdate({ overageRateIdr: Number(event.target.value || 0) })}
                disabled={!selected.overageEnabled}
              />
            </Field>
          </div>
        </SettingsSection>
      </div>

      <SettingsSection title="Integrasi" description="Endpoint callback dan pembatasan origin untuk aplikasi client.">
        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Webhook URL">
            <Input value={selected.webhookUrl} onChange={(event) => onUpdate({ webhookUrl: event.target.value })} placeholder="https://..." />
          </Field>
          <Field label="Allowed origins">
            <Input value={selected.allowedOrigins} onChange={(event) => onUpdate({ allowedOrigins: event.target.value })} placeholder="https://genpro..." />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Akses Generator"
        description="Pilih generator yang boleh dipakai oleh client. Area ini sengaja dibuat lebar agar mudah dikelola."
        action={<Switch checked={allowAllTools} onCheckedChange={onAllowAllTools} />}
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-extrabold text-slate-900">Akses semua generator</p>
              <p className="text-[11px] text-slate-500">Aktifkan untuk memberi akses penuh tanpa memilih generator satu per satu.</p>
            </div>
          </div>
        </div>

        {!allowAllTools ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-4">
            {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
              <div key={category} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{category}</p>
                <div className="space-y-2">
                  {categoryTools.map((tool) => (
                    <label
                      key={tool.slug}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">{tool.name}</span>
                        <span className="text-[11px] text-slate-500">{tool.creditCost} kredit</span>
                      </span>
                      <Switch
                        checked={selected.allowedTools.includes(tool.slug)}
                        onCheckedChange={(checked) => onToggleTool(tool.slug, checked)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SettingsSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <SettingsSection title="Catatan Internal" description="Catatan kontrak, komunikasi, atau keputusan khusus untuk client ini.">
          <Textarea value={selected.notes} onChange={(event) => onUpdate({ notes: event.target.value })} className="min-h-28" />
        </SettingsSection>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Aksi</h3>
          <div className="mt-3 grid gap-2">
            <Button onClick={onSave} disabled={saving} className="h-9">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan
            </Button>
            <Button variant="outline" onClick={onRotateKey} disabled={!selected.id || saving} className="h-9">
              <KeyRound className="mr-2 h-4 w-4" />
              Rotasi Key
            </Button>
            <Button variant="outline" onClick={onResetUsage} disabled={!selected.id || saving} className="h-9">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Pemakaian
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={!selected.id || saving} className="h-9">
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus Client
            </Button>
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            Rotasi key langsung menonaktifkan key lama. Pastikan key baru sudah dipasang di aplikasi client.
          </p>
        </section>
      </div>
    </div>
  );
}

function LogsPanel({ logs, selectedLogs }: { logs: UsageLog[]; selectedLogs: UsageLog[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-950">Log Client Terpilih</h3>
        <div className="mt-3 space-y-2.5">
          {selectedLogs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-[13px] text-slate-500">Belum ada log untuk client ini.</p>
          ) : (
            selectedLogs.map((log) => <UsageLogRow key={log.id} log={log} />)
          )}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-950">Log Semua Client</h3>
        <div className="mt-3 space-y-2.5">
          {logs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-[13px] text-slate-500">Belum ada request provider.</p>
          ) : (
            logs.slice(0, 16).map((log) => <UsageLogRow key={log.id} log={log} />)
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-center gap-3 p-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="text-base font-black text-slate-950">{value}</p>
          {detail ? <p className="truncate text-[11px] text-slate-500">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
      {detail ? <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p> : null}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 px-3 py-2 sm:grid-cols-[135px_minmax(0,1fr)]">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn("min-w-0 break-words text-[13px] text-slate-800", mono && "font-mono text-[11px]")}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function UsageLogRow({ log, compact = false }: { log: UsageLog; compact?: boolean }) {
  const ok = log.status === "SUCCESS";
  return (
    <div className={cn("rounded-lg border border-slate-200", compact ? "p-2.5" : "p-3")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={ok ? statusTone("SUCCESS") : statusTone("FAILED")}>
              {log.status}
            </Badge>
            <span className="text-[13px] font-bold text-slate-900">{log.clientName || log.toolSlug}</span>
            <span className="font-mono text-[11px] text-slate-400">{log.toolSlug}</span>
          </div>
          <p className="mt-1 truncate text-[13px] text-slate-600">
            {log.responseTitle || log.errorMessage || log.externalRequestId || log.requestId}
          </p>
          {!compact ? (
            <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
              {log.externalTenantId || "-"} · {log.externalUserId || "-"} · {log.externalRequestId || log.requestId}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-[11px] text-slate-500 sm:text-right">
          <p>{formatDateTime(log.createdAt)}</p>
          <p>
            {log.creditCharged} kredit · {log.latencyMs || 0} ms
          </p>
        </div>
      </div>
    </div>
  );
}
