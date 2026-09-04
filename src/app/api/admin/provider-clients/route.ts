import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TOOLS } from "@/lib/constants";
import { generateProviderApiKey, hashProviderApiKey } from "@/lib/provider-api";

export const runtime = "nodejs";

const statusSchema = z.enum(["ACTIVE", "SUSPENDED", "EXPIRED"]);

const clientSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().min(2, "Nama client wajib diisi"),
  slug: z
    .string()
    .min(2, "Slug client wajib diisi")
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda -"),
  status: statusSchema.default("ACTIVE"),
  planName: z.string().min(2, "Nama paket wajib diisi"),
  monthlyCreditLimit: z.coerce.number().int().min(1).max(1_000_000),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  allowedTools: z.array(z.string()).default([]),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email("Email kontak tidak valid").optional().nullable().or(z.literal("")),
  billingRateIdr: z.coerce.number().int().min(0).max(100_000_000).optional().default(0),
  overageEnabled: z.boolean().optional().default(false),
  overageRateIdr: z.coerce.number().int().min(0).max(100_000_000).optional().default(0),
  webhookUrl: z.string().url("Webhook URL tidak valid").optional().nullable().or(z.literal("")),
  allowedOrigins: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), client: clientSchema }),
  z.object({ action: z.literal("rotate_key"), id: z.string().min(1) }),
  z.object({ action: z.literal("reset_usage"), id: z.string().min(1) }),
  z.object({ action: z.literal("delete"), id: z.string().min(1) }),
]);

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function readAllowedTools(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "object") {
    const tools = (value as Record<string, unknown>).tools;
    if (Array.isArray(tools)) return tools.filter((item): item is string => typeof item === "string");
  }
  return [];
}

async function serializeClient(client: Awaited<ReturnType<typeof prisma.providerClient.findMany>>[number]) {
  const allowedTools = readAllowedTools(client.allowedTools);
  const logs = "usageLogs" in client ? client.usageLogs : [];
  const metadata =
    client.metadata && typeof client.metadata === "object"
      ? (client.metadata as Record<string, unknown>)
      : {};
  const recentUsage = Array.isArray(logs)
    ? logs.map((log) => ({
        id: log.id,
        requestId: log.requestId,
        toolSlug: log.toolSlug,
        status: log.status,
        creditCharged: log.creditCharged,
        providerUsed: log.providerUsed,
        latencyMs: log.latencyMs,
        externalTenantId: log.externalTenantId,
        externalUserId: log.externalUserId,
        externalRequestId: log.externalRequestId,
        responseTitle: log.responseTitle,
        errorCode: log.errorCode,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt.toISOString(),
      }))
    : [];
  const successRequests = recentUsage.filter((log) => log.status === "SUCCESS").length;
  const failedRequests = recentUsage.filter((log) => log.status !== "SUCCESS").length;
  const latencies = recentUsage.map((log) => log.latencyMs || 0).filter((value) => value > 0);
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    status: client.status,
    planName: client.planName,
    monthlyCreditLimit: client.monthlyCreditLimit,
    usedCredits: client.usedCredits,
    periodStart: client.periodStart.toISOString(),
    periodEnd: client.periodEnd?.toISOString() ?? null,
    allowedTools,
    contactName: String(metadata.contactName || ""),
    contactEmail: String(metadata.contactEmail || ""),
    billingRateIdr: Number(metadata.billingRateIdr || 0),
    overageEnabled: Boolean(metadata.overageEnabled || false),
    overageRateIdr: Number(metadata.overageRateIdr || 0),
    webhookUrl: String(metadata.webhookUrl || ""),
    allowedOrigins: String(metadata.allowedOrigins || ""),
    notes: String(metadata.notes || ""),
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    remainingCredits: Math.max(0, client.monthlyCreditLimit - client.usedCredits),
    lastUsedAt: recentUsage[0]?.createdAt ?? null,
    lastStatus: recentUsage[0]?.status ?? null,
    successRequests,
    failedRequests,
    avgLatencyMs: latencies.length
      ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length)
      : null,
    recentUsage,
  };
}

export async function GET() {
  try {
    await requireSuperAdmin();

    const [clients, recentLogs, usageTotals, latencyAggregate] = await Promise.all([
      prisma.providerClient.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          usageLogs: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      }),
      prisma.providerUsageLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          providerClient: { select: { name: true, slug: true } },
        },
      }),
      prisma.providerUsageLog.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { creditCharged: true },
      }),
      prisma.providerUsageLog.aggregate({
        _avg: { latencyMs: true },
      }),
    ]);

    const summary = clients.reduce(
      (acc, client) => {
        acc.totalClients += 1;
        if (client.status === "ACTIVE") acc.activeClients += 1;
        acc.totalLimit += client.monthlyCreditLimit;
        acc.totalUsed += client.usedCredits;
        return acc;
      },
      {
        totalClients: 0,
        activeClients: 0,
        totalLimit: 0,
        totalUsed: 0,
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        billedCredits: 0,
        avgLatencyMs: Math.round(latencyAggregate._avg.latencyMs || 0),
      }
    );
    for (const row of usageTotals) {
      summary.totalRequests += row._count._all;
      summary.billedCredits += row._sum.creditCharged || 0;
      if (row.status === "SUCCESS") summary.successRequests += row._count._all;
      else summary.failedRequests += row._count._all;
    }

    return NextResponse.json({
      summary,
      tools: TOOLS.map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        category: tool.category,
        creditCost: tool.creditCost,
      })),
      clients: await Promise.all(clients.map(serializeClient)),
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        clientName: log.providerClient.name,
        clientSlug: log.providerClient.slug,
        requestId: log.requestId,
        toolSlug: log.toolSlug,
        status: log.status,
        creditCharged: log.creditCharged,
        providerUsed: log.providerUsed,
        latencyMs: log.latencyMs,
        externalTenantId: log.externalTenantId,
        externalUserId: log.externalUserId,
        externalRequestId: log.externalRequestId,
        responseTitle: log.responseTitle,
        errorCode: log.errorCode,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Gagal memuat provider client" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const body = actionSchema.parse(await req.json());

    if (body.action === "delete") {
      await prisma.providerClient.delete({ where: { id: body.id } });
      return NextResponse.json({ success: true });
    }

    if (body.action === "reset_usage") {
      const client = await prisma.providerClient.update({
        where: { id: body.id },
        data: { usedCredits: 0, periodStart: new Date() },
      });
      return NextResponse.json({ success: true, client: await serializeClient(client) });
    }

    if (body.action === "rotate_key") {
      const apiKey = generateProviderApiKey();
      const client = await prisma.providerClient.update({
        where: { id: body.id },
        data: { apiKeyHash: hashProviderApiKey(apiKey) },
      });
      return NextResponse.json({ success: true, apiKey, client: await serializeClient(client) });
    }

    const input = body.client;
    const allowedTools = input.allowedTools.filter((slug) => TOOLS.some((tool) => tool.slug === slug));
    const periodStart = parseDate(input.periodStart) || new Date();
    const periodEnd = parseDate(input.periodEnd);
    const data = {
      name: input.name.trim(),
      slug: input.slug.trim(),
      status: input.status,
      planName: input.planName.trim(),
      monthlyCreditLimit: input.monthlyCreditLimit,
      periodStart,
      periodEnd,
      allowedTools: allowedTools.length > 0 ? toJson(allowedTools) : Prisma.JsonNull,
      metadata: toJson({
        contactName: input.contactName?.trim() || "",
        contactEmail: input.contactEmail?.trim() || "",
        billingRateIdr: input.billingRateIdr || 0,
        overageEnabled: Boolean(input.overageEnabled),
        overageRateIdr: input.overageRateIdr || 0,
        webhookUrl: input.webhookUrl?.trim() || "",
        allowedOrigins: input.allowedOrigins?.trim() || "",
        notes: input.notes?.trim() || "",
      }),
    };

    if (input.id) {
      const client = await prisma.providerClient.update({
        where: { id: input.id },
        data,
      });
      return NextResponse.json({ success: true, client: await serializeClient(client) });
    }

    const apiKey = generateProviderApiKey();
    const client = await prisma.providerClient.create({
      data: {
        ...data,
        apiKeyHash: hashProviderApiKey(apiKey),
      },
    });
    return NextResponse.json({ success: true, apiKey, client: await serializeClient(client) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Slug client atau API key sudah digunakan." }, { status: 409 });
    }
    console.error("Admin provider client error:", err);
    return NextResponse.json({ error: "Gagal menyimpan provider client" }, { status: 500 });
  }
}
