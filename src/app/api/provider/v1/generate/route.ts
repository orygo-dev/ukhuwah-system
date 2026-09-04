import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/lib/ai/generate";
import {
  assertProviderCanUseTool,
  authenticateProviderClient,
  createProviderUsageLog,
  hashProviderInput,
  validateProviderGeneratePayload,
} from "@/lib/provider-api";
import { getGeneratorTool } from "@/lib/generator-catalog";

export const runtime = "nodejs";
export const maxDuration = 180;

const requestSchema = z.object({
  toolSlug: z.string().min(1),
  data: z.record(z.unknown()),
  externalTenantId: z.string().max(191).optional(),
  externalUserId: z.string().max(191).optional(),
  externalRequestId: z.string().max(191).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function isProviderInputError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.startsWith("Data ") ||
    err.message.startsWith("Jumlah Pertemuan") ||
    err.message.startsWith("Topik / Materi") ||
    err.message.startsWith("Pilih minimal") ||
    err.message.includes("belum tersedia di Navalogi")
  );
}

function prismaErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

class ProviderQuotaRaceError extends Error {
  constructor() {
    super("Kuota kredit provider Navalogi sudah habis untuk periode ini.");
    this.name = "ProviderQuotaRaceError";
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = randomUUID();
  let parsedBody: z.infer<typeof requestSchema> | null = null;
  let providerClientId: string | null = null;

  const auth = await authenticateProviderClient(req);
  if (!auth.ok) {
    return errorResponse(auth.status, auth.code, auth.message);
  }
  providerClientId = auth.client.id;

  try {
    const body = await req.json();
    parsedBody = requestSchema.parse(body);

    if (parsedBody.externalRequestId) {
      const existing = await prisma.providerUsageLog.findUnique({
        where: {
          providerClientId_externalRequestId: {
            providerClientId: auth.client.id,
            externalRequestId: parsedBody.externalRequestId,
          },
        },
      });

      if (existing?.status === "SUCCESS") {
        return errorResponse(
          409,
          "DUPLICATE_EXTERNAL_REQUEST",
          "externalRequestId ini sudah pernah berhasil diproses."
        );
      }
    }

    const generatorTool = await getGeneratorTool(parsedBody.toolSlug);
    if (!generatorTool) {
      return errorResponse(404, "TOOL_NOT_FOUND", "Generator tidak dikenal.");
    }

    if (!generatorTool.isActive) {
      return errorResponse(403, "TOOL_INACTIVE", "Generator ini sedang dinonaktifkan oleh admin Navalogi.");
    }

    validateProviderGeneratePayload(parsedBody.toolSlug, parsedBody.data);

    const creditCost = generatorTool.creditCost;
    const quota = await assertProviderCanUseTool(auth.client, parsedBody.toolSlug, creditCost);
    if (!quota.ok) {
      return errorResponse(quota.status, quota.code, quota.message);
    }

    const result = await generateDocument({
      toolSlug: parsedBody.toolSlug,
      data: parsedBody.data,
      requestId,
    });

    await prisma.$transaction(async (tx) => {
      const charged = await tx.providerClient.updateMany({
        where: {
          id: auth.client.id,
          status: "ACTIVE",
          usedCredits: {
            lte: Math.max(0, auth.client.monthlyCreditLimit - creditCost),
          },
        },
        data: { usedCredits: { increment: creditCost } },
      });
      if (charged.count !== 1) throw new ProviderQuotaRaceError();

      await tx.providerUsageLog.create({
        data: {
          requestId,
          providerClientId: auth.client.id,
          toolSlug: parsedBody!.toolSlug,
          externalTenantId: parsedBody!.externalTenantId,
          externalUserId: parsedBody!.externalUserId,
          externalRequestId: parsedBody!.externalRequestId,
          status: "SUCCESS",
          creditCharged: creditCost,
          providerUsed: result.providerUsed,
          isDemo: result.isDemo,
          latencyMs: Date.now() - startedAt,
          inputHash: hashProviderInput(parsedBody!.data),
          responseTitle: result.title,
          usageRequestId: result.usageRequestId,
          metadata: toJsonValue({
            requestMetadata: parsedBody!.metadata || {},
            resultMetadata: result.meta || {},
          }),
        },
      });

    });

    return NextResponse.json({
      ok: true,
      requestId,
      provider: {
        client: auth.client.slug,
        providerUsed: result.providerUsed,
        isDemo: result.isDemo,
      },
      billing: {
        creditCost,
        usedCredits: auth.client.usedCredits + creditCost,
        monthlyCreditLimit: auth.client.monthlyCreditLimit,
      },
      document: {
        title: result.title,
        content: result.content,
        toolSlug: parsedBody.toolSlug,
        metadata: result.meta || {},
      },
    });
  } catch (err) {
    if (err instanceof ProviderQuotaRaceError) {
      return errorResponse(402, "PROVIDER_QUOTA_EXCEEDED", err.message);
    }
    if (prismaErrorCode(err) === "P2002" && parsedBody?.externalRequestId) {
      return errorResponse(
        409,
        "DUPLICATE_EXTERNAL_REQUEST",
        "externalRequestId ini sudah pernah diproses.",
      );
    }
    const isBadRequest = err instanceof z.ZodError || isProviderInputError(err);
    const status = isBadRequest ? 400 : 500;
    const code = isBadRequest ? "INVALID_REQUEST" : "GENERATION_FAILED";
    const message = err instanceof z.ZodError ? err.errors[0]?.message || "Payload tidak valid." : err instanceof Error ? err.message : "Gagal generate dokumen.";

    if (providerClientId && parsedBody) {
      try {
        await createProviderUsageLog({
          requestId,
          providerClient: { connect: { id: providerClientId } },
          toolSlug: parsedBody.toolSlug,
          externalTenantId: parsedBody.externalTenantId,
          externalUserId: parsedBody.externalUserId,
          externalRequestId: parsedBody.externalRequestId,
          status: "FAILED",
          creditCharged: 0,
          latencyMs: Date.now() - startedAt,
          errorCode: code,
          errorMessage: message.slice(0, 5000),
          inputHash: hashProviderInput(parsedBody.data),
          metadata: toJsonValue(parsedBody.metadata || {}),
        });
      } catch (logErr) {
        console.error("Provider usage failure log failed:", logErr);
      }
    }

    console.error("Provider generate error:", err);
    return errorResponse(status, code, message);
  }
}
