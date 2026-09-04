import type { AiProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AiUsageStatus = "SUCCESS" | "FAILED";

export type NormalizedAiUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number | null;
  estimated: boolean;
  raw?: Prisma.InputJsonValue;
};

export type AiUsageContext = {
  requestId: string;
  userId: string;
  feature: string;
  toolSlug: string;
  phase?: string;
  creditCost?: number;
};

export type AiUsageLogInput = {
  context?: AiUsageContext;
  provider: AiProvider;
  model: string;
  status: AiUsageStatus;
  usage?: NormalizedAiUsage;
  latencyMs?: number;
  errorMessage?: string;
  metadata?: Prisma.InputJsonValue;
};

export type AiUsageFinancials = {
  providerCostUsd: number | null;
  providerCostIdr: number | null;
  revenueIdr: number | null;
  marginIdr: number | null;
};

export const DEFAULT_USD_TO_IDR = Number(process.env.AI_USD_TO_IDR || 16500);
export const DEFAULT_CREDIT_PRICE_IDR = Number(process.env.AI_CREDIT_PRICE_IDR || 1000);

function asNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readPath(source: unknown, path: string[]): unknown {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function estimateTokensFromMessagesAndContent(
  messages: { content: string }[],
  content = ""
): NormalizedAiUsage {
  const inputChars = messages.reduce((total, message) => total + message.content.length, 0);
  const outputChars = content.length;
  const inputTokens = Math.max(1, Math.ceil(inputChars / 4));
  const outputTokens = content ? Math.max(1, Math.ceil(outputChars / 4)) : null;
  return {
    inputTokens,
    outputTokens,
    reasoningTokens: null,
    cachedTokens: null,
    totalTokens: outputTokens ? inputTokens + outputTokens : inputTokens,
    estimated: true,
  };
}

export function normalizeOpenAiUsage(raw: unknown): NormalizedAiUsage {
  const usage = readPath(raw, ["usage"]) || raw;
  const inputTokens =
    asNumber(readPath(usage, ["prompt_tokens"])) ??
    asNumber(readPath(usage, ["input_tokens"]));
  const outputTokens =
    asNumber(readPath(usage, ["completion_tokens"])) ??
    asNumber(readPath(usage, ["output_tokens"]));
  const reasoningTokens =
    asNumber(readPath(usage, ["completion_tokens_details", "reasoning_tokens"])) ??
    asNumber(readPath(usage, ["output_tokens_details", "reasoning_tokens"]));
  const cachedTokens =
    asNumber(readPath(usage, ["prompt_tokens_details", "cached_tokens"])) ??
    asNumber(readPath(usage, ["input_tokens_details", "cached_tokens"]));
  const totalTokens =
    asNumber(readPath(usage, ["total_tokens"])) ??
    (inputTokens !== null || outputTokens !== null
      ? (inputTokens || 0) + (outputTokens || 0)
      : null);

  return {
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedTokens,
    totalTokens,
    estimated: false,
    raw: usage as Prisma.InputJsonValue,
  };
}

export function normalizeGeminiUsage(raw: unknown): NormalizedAiUsage {
  const usage = readPath(raw, ["usageMetadata"]) || raw;
  const inputTokens = asNumber(readPath(usage, ["promptTokenCount"]));
  const outputTokens = asNumber(readPath(usage, ["candidatesTokenCount"]));
  const cachedTokens = asNumber(readPath(usage, ["cachedContentTokenCount"]));
  const totalTokens =
    asNumber(readPath(usage, ["totalTokenCount"])) ??
    (inputTokens !== null || outputTokens !== null
      ? (inputTokens || 0) + (outputTokens || 0)
      : null);

  return {
    inputTokens,
    outputTokens,
    reasoningTokens: null,
    cachedTokens,
    totalTokens,
    estimated: false,
    raw: usage as Prisma.InputJsonValue,
  };
}

export function calculateAiFinancials({
  provider,
  usage,
  creditCharged = 0,
}: {
  provider: AiProvider;
  usage?: NormalizedAiUsage;
  creditCharged?: number;
}): AiUsageFinancials {
  const inputTokens = usage?.inputTokens || 0;
  const outputTokens = usage?.outputTokens || 0;
  const costIn = (inputTokens / 1000) * Number(provider.costPer1kIn || 0);
  const costOut = (outputTokens / 1000) * Number(provider.costPer1kOut || 0);
  const providerCostUsd = costIn + costOut;
  const providerCostIdr = providerCostUsd * DEFAULT_USD_TO_IDR;
  const revenueIdr = creditCharged > 0 ? creditCharged * DEFAULT_CREDIT_PRICE_IDR : null;
  const marginIdr = revenueIdr !== null ? revenueIdr - providerCostIdr : null;

  return {
    providerCostUsd: providerCostUsd > 0 ? providerCostUsd : null,
    providerCostIdr: providerCostIdr > 0 ? providerCostIdr : null,
    revenueIdr,
    marginIdr,
  };
}

export async function recordAiUsage(input: AiUsageLogInput): Promise<string | null> {
  if (!input.context?.userId) return null;

  try {
    const financials = calculateAiFinancials({
      provider: input.provider,
      usage: input.usage,
      creditCharged: 0,
    });

    const row = await prisma.aiUsageLog.create({
      data: {
        requestId: input.context.requestId,
        userId: input.context.userId,
        providerId: input.provider.id === "env" ? null : input.provider.id,
        feature: input.context.feature,
        toolSlug: input.context.toolSlug,
        phase: input.context.phase,
        providerSlug: input.provider.slug,
        providerName: input.provider.name,
        model: input.model,
        status: input.status,
        inputTokens: input.usage?.inputTokens ?? null,
        outputTokens: input.usage?.outputTokens ?? null,
        reasoningTokens: input.usage?.reasoningTokens ?? null,
        cachedTokens: input.usage?.cachedTokens ?? null,
        totalTokens: input.usage?.totalTokens ?? null,
        usageEstimated: input.usage?.estimated ?? false,
        providerCostUsd: financials.providerCostUsd,
        providerCostIdr: financials.providerCostIdr,
        revenueIdr: financials.revenueIdr,
        marginIdr: financials.marginIdr,
        latencyMs: input.latencyMs,
        errorMessage: input.errorMessage?.slice(0, 5000),
        rawUsage: input.usage?.raw,
        metadata: input.metadata,
      },
      select: { id: true },
    });

    return row.id;
  } catch (err) {
    console.error("AI usage log failed:", err);
    return null;
  }
}

export async function attachUsageLogsToDocument({
  requestId,
  documentId,
  creditCharged,
}: {
  requestId: string;
  documentId: string;
  creditCharged: number;
}) {
  const logs = await prisma.aiUsageLog.findMany({
    where: { requestId },
    orderBy: { createdAt: "asc" },
    include: { provider: true },
  });
  const successLogs = logs.filter((log) => log.status === "SUCCESS");
  const baseCredit =
    successLogs.length > 0 ? Math.floor(creditCharged / successLogs.length) : 0;
  const remainder =
    successLogs.length > 0 ? creditCharged % successLogs.length : 0;
  const creditByLogId = new Map(
    successLogs.map((log, index) => [
      log.id,
      baseCredit + (index < remainder ? 1 : 0),
    ])
  );

  await prisma.$transaction(
    logs.map((log) => {
      const providerCostIdr = log.providerCostIdr ? Number(log.providerCostIdr) : 0;
      const chargedCredits = creditByLogId.get(log.id) ?? 0;
      const revenueIdr = chargedCredits > 0 ? chargedCredits * DEFAULT_CREDIT_PRICE_IDR : null;
      const marginIdr = revenueIdr !== null ? revenueIdr - providerCostIdr : null;

      return prisma.aiUsageLog.update({
        where: { id: log.id },
        data: {
          documentId,
          creditCharged: chargedCredits,
          revenueIdr,
          marginIdr,
        },
      });
    })
  );
}
