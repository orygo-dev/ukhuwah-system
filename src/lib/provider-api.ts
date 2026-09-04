import { createHash, randomUUID, timingSafeEqual } from "crypto";
import type { Prisma, ProviderClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getToolFormSteps } from "@/lib/tool-forms";

export const PROVIDER_API_KEY_PREFIX = "gs_live_";

const MODUL_AJAR_REQUIRED_FIELDS = [
  "sekolah",
  "namaGuru",
  "semester",
  "tahunAjaran",
  "jumlahPertemuan",
] as const;

export type ProviderAuthResult =
  | { ok: true; client: ProviderClient }
  | { ok: false; status: number; code: string; message: string };

export type ProviderQuotaResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

export function hashProviderApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function generateProviderApiKey(): string {
  return `${PROVIDER_API_KEY_PREFIX}${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
}

function readBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return (
    bearer ||
    req.headers.get("x-navalogi-api-key")?.trim() ||
    req.headers.get("x-guruspace-api-key")?.trim() ||
    null
  );
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function hasMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return value !== null && value !== undefined;
}

function allowedToolsIncludes(client: ProviderClient, toolSlug: string): boolean {
  const allowed = client.allowedTools;
  if (!allowed) return true;
  if (Array.isArray(allowed)) {
    return allowed.map(String).includes(toolSlug);
  }
  if (typeof allowed === "object") {
    const tools = (allowed as Record<string, unknown>).tools;
    if (Array.isArray(tools)) return tools.map(String).includes(toolSlug);
  }
  return false;
}

export async function authenticateProviderClient(req: Request): Promise<ProviderAuthResult> {
  const apiKey = readBearerToken(req);
  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      code: "MISSING_API_KEY",
      message: "API key Navalogi provider wajib dikirim melalui Authorization: Bearer.",
    };
  }

  const incomingHash = hashProviderApiKey(apiKey);
  const client = await prisma.providerClient.findUnique({
    where: { apiKeyHash: incomingHash },
  });

  if (!client || !safeEqualHex(client.apiKeyHash, incomingHash)) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_API_KEY",
      message: "API key Navalogi provider tidak valid.",
    };
  }

  if (client.status !== "ACTIVE") {
    return {
      ok: false,
      status: 403,
      code: "CLIENT_INACTIVE",
      message: `Akses provider ${client.name} berstatus ${client.status}.`,
    };
  }

  if (client.periodEnd && client.periodEnd.getTime() < Date.now()) {
    await prisma.providerClient.update({
      where: { id: client.id },
      data: { status: "EXPIRED" },
    });
    return {
      ok: false,
      status: 403,
      code: "SUBSCRIPTION_EXPIRED",
      message: "Masa langganan provider sudah berakhir.",
    };
  }

  return { ok: true, client };
}

export function validateProviderGeneratePayload(toolSlug: string, data: Record<string, unknown>) {
  const steps = getToolFormSteps(toolSlug);
  if (steps.length === 0) {
    throw new Error(`Tool ${toolSlug} belum tersedia di Navalogi.`);
  }

  const fieldLabels = new Map(
    steps.flatMap((step) => step.fields.map((field) => [field.name, field.label]))
  );
  const requiredFields = new Set(
    steps.flatMap((step) => step.fields.filter((field) => field.required).map((field) => field.name))
  );

  if (toolSlug === "modul-ajar") {
    for (const field of MODUL_AJAR_REQUIRED_FIELDS) {
      requiredFields.add(field);
    }
  }

  const missing = [...requiredFields].filter((field) => !hasMeaningfulValue(data[field]));
  if (missing.length > 0) {
    const labels = missing.map((field) => fieldLabels.get(field) || field);
    throw new Error(`Data ${toolSlug} belum lengkap: ${labels.join(", ")}.`);
  }

  if (toolSlug === "modul-ajar") {
    const jumlahPertemuan = Number(String(data.jumlahPertemuan ?? "").trim());
    if (!Number.isInteger(jumlahPertemuan) || jumlahPertemuan <= 0 || jumlahPertemuan > 16) {
      throw new Error("Jumlah Pertemuan harus berupa angka bulat antara 1 sampai 16.");
    }

    const topik = String(data.topik ?? "").trim();
    if (topik.length < 5) {
      throw new Error("Topik / Materi Pembelajaran minimal 5 karakter agar modul ajar tidak terlalu umum.");
    }

    const dpl = String(data.dimensiProfilLulusan ?? "")
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean);
    if (dpl.length === 0) {
      throw new Error("Pilih minimal 1 Dimensi Profil Lulusan.");
    }
  }
}

export async function assertProviderCanUseTool(
  client: ProviderClient,
  toolSlug: string,
  creditCost: number
): Promise<ProviderQuotaResult> {
  if (!allowedToolsIncludes(client, toolSlug)) {
    return {
      ok: false,
      status: 403,
      code: "TOOL_NOT_ALLOWED",
      message: `Client ${client.name} belum memiliki akses ke generator ${toolSlug}.`,
    };
  }

  if (client.usedCredits + creditCost > client.monthlyCreditLimit) {
    return {
      ok: false,
      status: 402,
      code: "PROVIDER_QUOTA_EXCEEDED",
      message: "Kuota kredit provider Navalogi sudah habis untuk periode ini.",
    };
  }

  return { ok: true };
}

export function hashProviderInput(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export async function createProviderUsageLog(data: Prisma.ProviderUsageLogCreateInput) {
  return prisma.providerUsageLog.create({ data });
}

export async function chargeProviderCredits(clientId: string, credits: number) {
  if (credits <= 0) return;
  await prisma.providerClient.update({
    where: { id: clientId },
    data: { usedCredits: { increment: credits } },
  });
}
