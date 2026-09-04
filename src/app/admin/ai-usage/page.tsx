import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiBalanceCheckButton } from "@/components/admin/ai-balance-check-button";
import { prisma } from "@/lib/prisma";
import { TOOLS } from "@/lib/constants";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Coins,
  DatabaseZap,
  Gauge,
  TrendingUp,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

const toolNameMap = new Map(TOOLS.map((tool) => [tool.slug, tool.name]));

function formatIdr(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatUsd(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(Number(value || 0));
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("id-ID").format(Number(value || 0));
}

function dateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(3, Math.min(100, Math.round((value / total) * 100)));
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof BarChart3;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader className="border-b border-slate-100 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-950">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon className="h-4 w-4" />
            </span>
            {title}
          </CardTitle>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
    </CardHeader>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
        <CheckCircle2 className="h-3 w-3" />
        Sukses
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-100">
      <AlertTriangle className="h-3 w-3" />
      Gagal
    </span>
  );
}

export default async function AdminAiUsagePage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    total,
    month,
    byTool,
    byProvider,
    recentLogs,
    providers,
    latestSnapshots,
    successCount,
    failedCount,
  ] = await Promise.all([
    prisma.aiUsageLog.aggregate({
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        providerCostUsd: true,
        providerCostIdr: true,
        revenueIdr: true,
        marginIdr: true,
        creditCharged: true,
      },
      _avg: { latencyMs: true },
    }),
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: {
        providerCostUsd: true,
        providerCostIdr: true,
        revenueIdr: true,
        marginIdr: true,
        creditCharged: true,
      },
      _avg: { latencyMs: true },
    }),
    prisma.aiUsageLog.groupBy({
      by: ["toolSlug"],
      _count: { _all: true },
      _sum: {
        totalTokens: true,
        providerCostIdr: true,
        revenueIdr: true,
        marginIdr: true,
        creditCharged: true,
      },
      orderBy: { _count: { toolSlug: "desc" } },
      take: 8,
    }),
    prisma.aiUsageLog.groupBy({
      by: ["providerSlug", "providerName"],
      _count: { _all: true },
      _sum: {
        totalTokens: true,
        providerCostIdr: true,
        revenueIdr: true,
        marginIdr: true,
      },
      _avg: { latencyMs: true },
      orderBy: { _count: { providerSlug: "desc" } },
      take: 6,
    }),
    prisma.aiUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true, email: true } },
        document: { select: { id: true, title: true } },
      },
    }),
    prisma.aiProvider.findMany({
      orderBy: [{ isActive: "desc" }, { priority: "desc" }, { name: "asc" }],
      include: {
        balanceSnapshots: {
          orderBy: { checkedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.aiProviderBalanceSnapshot.findMany({
      orderBy: { checkedAt: "desc" },
      take: 6,
      include: { provider: { select: { name: true, slug: true } } },
    }),
    prisma.aiUsageLog.count({ where: { status: "SUCCESS" } }),
    prisma.aiUsageLog.count({ where: { status: "FAILED" } }),
  ]);

  const totalCount = total._count._all || 0;
  const successRate = totalCount ? Math.round((successCount / totalCount) * 100) : 0;
  const monthCost = Number(month._sum.providerCostIdr || 0);
  const monthRevenue = Number(month._sum.revenueIdr || 0);
  const maxToolCost = Math.max(...byTool.map((row) => Number(row._sum.providerCostIdr || 0)), 1);
  const monthCompareTotal = Math.max(monthCost, monthRevenue, 1);

  const kpis = [
    {
      label: "Request AI",
      value: formatNumber(totalCount),
      detail: `${formatNumber(month._count._all)} bulan ini`,
      icon: Activity,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "Token",
      value: formatNumber(total._sum.totalTokens),
      detail: `${formatNumber(total._sum.inputTokens)} input / ${formatNumber(total._sum.outputTokens)} output`,
      icon: DatabaseZap,
      color: "text-cyan-700",
      bg: "bg-cyan-50",
    },
    {
      label: "Biaya Provider",
      value: formatIdr(total._sum.providerCostIdr),
      detail: formatUsd(total._sum.providerCostUsd),
      icon: Coins,
      color: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "Margin",
      value: formatIdr(total._sum.marginIdr),
      detail: `${formatNumber(total._sum.creditCharged)} kredit`,
      icon: TrendingUp,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <AdminShell activePath="/admin/ai-usage">
      <div className="space-y-5">
        <section className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="border border-emerald-100 bg-emerald-50 text-emerald-700">
                  AI Finance Control
                </Badge>
                <span className="text-xs font-semibold text-slate-400">
                  Usage, cost, margin, provider health
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">
                AI Usage & Cost Tracking
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Pantau biaya AI, penggunaan token, kredit yang dipotong, margin, request gagal,
                latency provider, dan saldo provider tanpa mengubah alur generator.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Success Rate
                    </p>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-slate-950">{successRate}%</p>
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${successRate}%` }} />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Avg Latency
                    </p>
                    <Clock3 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-slate-950">
                    {formatNumber(Math.round(Number(total._avg.latencyMs || 0)))}
                    <span className="text-sm font-bold text-slate-400"> ms</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Rata-rata semua request</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Request Gagal
                    </p>
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-slate-950">
                    {formatNumber(failedCount)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Tercatat untuk audit provider</p>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Bulan Ini</p>
                  <h2 className="mt-1 text-lg font-extrabold text-slate-950">Profit Snapshot</h2>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Revenue Kredit</span>
                    <span>{formatIdr(monthRevenue)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${percent(monthRevenue, monthCompareTotal)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Biaya Provider</span>
                    <span>{formatIdr(monthCost)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-amber-500" style={{ width: `${percent(monthCost, monthCompareTotal)}%` }} />
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">Estimasi Margin Bulan Ini</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-950">
                    {formatIdr(month._sum.marginIdr)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatNumber(month._sum.creditCharged)} kredit digunakan
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="rounded-[18px] border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.bg} ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                      <p className="mt-1 truncate text-xl font-extrabold text-slate-950">{item.value}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <Card className="rounded-[20px] border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={BarChart3}
              title="Biaya per Generator"
              description="Tabel dibuat full-width di desktop agar tidak perlu scroll horizontal."
              action={<Badge variant="secondary" className="bg-slate-100 text-slate-600">Top 8</Badge>}
            />
            <CardContent className="p-0">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Generator</th>
                    <th className="px-2 py-3">Req</th>
                    <th className="px-2 py-3">Token</th>
                    <th className="px-2 py-3">Biaya</th>
                    <th className="px-2 py-3">Revenue</th>
                    <th className="px-4 py-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byTool.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        Belum ada usage AI yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    byTool.map((row) => {
                      const cost = Number(row._sum.providerCostIdr || 0);
                      return (
                        <tr key={row.toolSlug} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                                <Zap className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-950">
                                  {toolNameMap.get(row.toolSlug) || row.toolSlug}
                                </p>
                                <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${percent(cost, maxToolCost)}%` }} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 font-semibold text-slate-700">{formatNumber(row._count._all)}</td>
                          <td className="px-2 py-3 text-xs text-slate-600">{formatNumber(row._sum.totalTokens)}</td>
                          <td className="px-2 py-3 text-xs text-slate-600">{formatIdr(row._sum.providerCostIdr)}</td>
                          <td className="px-2 py-3 text-xs text-slate-600">{formatIdr(row._sum.revenueIdr)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">
                            {formatIdr(row._sum.marginIdr)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="rounded-[20px] border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={Gauge}
              title="Provider Balance"
              description="Saldo realtime jika provider mendukung."
            />
            <CardContent className="space-y-3 p-4">
              {providers.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Belum ada provider AI.
                </p>
              ) : (
                providers.map((provider) => {
                  const latest = provider.balanceSnapshots[0];
                  return (
                    <div key={provider.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-slate-950">{provider.name}</p>
                            {provider.isActive ? <Badge>Primary</Badge> : null}
                            {provider.isFallback ? <Badge variant="secondary">Fallback</Badge> : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">{provider.defaultModel}</p>
                        </div>
                        <AiBalanceCheckButton providerId={provider.id} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="font-bold uppercase tracking-wide text-slate-400">Saldo</p>
                          <p className="mt-1 font-semibold text-slate-950">
                            {latest?.amount != null
                              ? `${latest.currency || "USD"} ${Number(latest.amount).toFixed(4)}`
                              : "Tidak tersedia"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="font-bold uppercase tracking-wide text-slate-400">Cek</p>
                          <p className="mt-1 font-semibold text-slate-950">{dateTime(latest?.checkedAt)}</p>
                        </div>
                      </div>
                      {latest?.error ? (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                          {latest.error}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <Card className="rounded-[20px] border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={Clock3}
              title="Performa Provider"
              description="Ringkasan token, biaya, dan latency."
            />
            <CardContent className="space-y-3 p-4">
              {byProvider.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Belum ada data provider.
                </p>
              ) : (
                byProvider.map((row) => (
                  <div key={`${row.providerSlug}-${row.providerName}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{row.providerName}</p>
                        <p className="text-xs text-slate-500">{row.providerSlug}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {formatNumber(row._count._all)} req
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-emerald-50 p-2.5">
                        <p className="font-bold text-emerald-700">Token</p>
                        <p className="mt-1 font-semibold text-slate-950">{formatNumber(row._sum.totalTokens)}</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 p-2.5">
                        <p className="font-bold text-amber-700">Biaya</p>
                        <p className="mt-1 font-semibold text-slate-950">{formatIdr(row._sum.providerCostIdr)}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-2.5">
                        <p className="font-bold text-emerald-700">Latency</p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {formatNumber(Math.round(Number(row._avg.latencyMs || 0)))}ms
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[20px] border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={Activity}
              title="Audit Trail Request"
              description="Request terbaru, termasuk error provider dan fase Modul Ajar."
              action={<Badge variant="secondary" className="bg-slate-100 text-slate-600">Live</Badge>}
            />
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {recentLogs.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    Belum ada request AI.
                  </p>
                ) : (
                  recentLogs.map((log) => (
                    <div key={log.id} className="grid gap-3 px-4 py-3 hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_190px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={log.status} />
                          <p className="truncate font-semibold text-slate-950">
                            {toolNameMap.get(log.toolSlug) || log.toolSlug}
                          </p>
                          {log.phase ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {log.phase}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {log.user.name} · {log.providerName} · {log.model}
                        </p>
                        {log.errorMessage ? (
                          <p className="mt-2 line-clamp-2 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                            {log.errorMessage}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-left text-xs text-slate-500 lg:text-right">
                        <p>{dateTime(log.createdAt)}</p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {formatNumber(log.totalTokens)} token
                        </p>
                        <p className="mt-0.5">
                          {formatIdr(log.providerCostIdr)} · {log.latencyMs ? `${formatNumber(log.latencyMs)}ms` : "-"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {latestSnapshots.length > 0 ? (
          <Card className="rounded-[20px] border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={Gauge}
              title="Riwayat Cek Saldo Provider"
              description="Snapshot terakhir dari provider yang pernah dicek."
            />
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {latestSnapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-950">{snapshot.provider.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{dateTime(snapshot.checkedAt)}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    {snapshot.amount != null
                      ? `${snapshot.currency || "USD"} ${Number(snapshot.amount).toFixed(4)}`
                      : snapshot.error || "Tidak tersedia"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
