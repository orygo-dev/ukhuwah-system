import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

import {

  callProviderDetailed,

  generateDemoContent,

  providerHasValidKey,

} from "@/lib/ai/provider";

import { isPlaceholderKey } from "@/lib/ai/constants";

import type { AiProvider } from "@prisma/client";

import {

  TOOL_PROMPTS,

  buildUserPrompt,

  getDocumentTitle,

  type GenerateInput,

} from "@/lib/ai/prompts";

import { sanitizeDocumentContent } from "@/lib/document-format";

import { listProvidersForGenerate, sortProviders } from "@/lib/ai/status";
import { generateModulAjarWithProvider } from "@/lib/ai/modul-ajar-generate";
import type { AiUsageContext } from "@/lib/ai/usage-tracking";
import { getStaticGeneratorTool } from "@/lib/generator-catalog";



export type GenerateResult = {

  content: string;

  title: string;

  creditCost: number;

  providerUsed: string;

  isDemo: boolean;

  meta?: Record<string, unknown>;
  usageRequestId?: string;

};

export type GenerateDocumentInput = GenerateInput & {
  userId?: string;
  requestId?: string;
};



function finalizeResult(

  content: string,

  title: string,

  creditCost: number,

  providerUsed: string,

  isDemo: boolean,

  meta?: Record<string, unknown>

): GenerateResult {

  return {

    content: sanitizeDocumentContent(content),

    title,

    creditCost,

    providerUsed,

    isDemo,

    meta,

  };

}



const ENV_PROVIDERS = [

  { env: "OPENAI_API_KEY", slug: "openai", name: "OpenAI (env)", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },

  { env: "GEMINI_API_KEY", slug: "gemini", name: "Gemini (env)", model: "gemini-2.5-flash", baseUrl: null },

  { env: "OPENROUTER_API_KEY", slug: "openrouter", name: "OpenRouter (env)", model: "openai/gpt-4o-mini", baseUrl: "https://openrouter.ai/api/v1" },

] as const;



async function tryEnvProviders(

  systemPrompt: string,

  userPrompt: string,
  context?: AiUsageContext

): Promise<{ content: string; name: string } | null> {

  for (const ep of ENV_PROVIDERS) {

    const key = process.env[ep.env];

    if (!key || isPlaceholderKey(key)) continue;



    try {

      const result = await callProviderDetailed(

        {

          id: "env",

          name: ep.name,

          slug: ep.slug,

          baseUrl: ep.baseUrl,

          apiKey: key,

          defaultModel: ep.model,

          isActive: true,

          isFallback: false,

          maxTokens: 4096,

          temperature: 0.7,

          priority: 0,

          costPer1kIn: 0,

          costPer1kOut: 0,

          createdAt: new Date(),

          updatedAt: new Date(),

        } as unknown as AiProvider,

        [

          { role: "system", content: systemPrompt },

          { role: "user", content: userPrompt },

        ],
        undefined,
        context

      );

      const content = result.content;
      if (content) return { content, name: ep.name };

    } catch (err) {

      console.error(`${ep.name} env failed:`, err);

    }

  }

  return null;

}



async function tryProvider(

  provider: AiProvider,

  messages: { role: "system" | "user"; content: string }[],

  modelOverride?: string | null,
  context?: AiUsageContext

): Promise<string> {

  const result = await callProviderDetailed(provider, messages, modelOverride, context);
  const content = result.content;

  if (!content?.trim()) {

    throw new Error(`${provider.name}: respons AI kosong`);

  }

  return content;

}



export async function generateDocument(input: GenerateDocumentInput): Promise<GenerateResult> {
  const staticTool = getStaticGeneratorTool(input.toolSlug);
  if (!staticTool) {
    throw new Error(`Generator tidak dikenal: ${input.toolSlug}`);
  }

  const toolConfig = await prisma.aiToolConfig.findUnique({

    where: { toolSlug: input.toolSlug },

    include: { provider: true },

  });



  if (toolConfig && !toolConfig.isActive) {
    throw new Error("Generator ini sedang dinonaktifkan oleh admin.");
  }

  const creditCost = toolConfig?.creditCost ?? staticTool.creditCost;
  const usageRequestId = input.requestId || randomUUID();
  const defaultSystemPrompt =
    TOOL_PROMPTS[input.toolSlug] || TOOL_PROMPTS["modul-ajar"];
  const systemPrompt = toolConfig?.systemPrompt?.trim() || defaultSystemPrompt;

  const userPrompt = buildUserPrompt(input.toolSlug, input.data);

  const title = getDocumentTitle(input.toolSlug, input.data);

  const demoMode = process.env.DEMO_MODE === "true";



  const messages = [

    { role: "system" as const, content: systemPrompt },

    { role: "user" as const, content: userPrompt },

  ];



  const candidates: AiProvider[] = [];

  const seen = new Set<string>();



  const addCandidate = (p: AiProvider | null | undefined) => {

    if (!p || seen.has(p.id) || !providerHasValidKey(p)) return;

    seen.add(p.id);

    candidates.push(p);

  };



  // Tool-specific provider first (if valid key)

  if (
    toolConfig?.isActive &&
    toolConfig.provider &&
    (toolConfig.provider.isActive || toolConfig.provider.isFallback)
  ) {

    addCandidate(toolConfig.provider);

  }



  for (const p of await listProvidersForGenerate()) {

    addCandidate(p);

  }



  const ordered = sortProviders(candidates);

  let lastError: Error | null = null;

  const hadConfiguredProvider = ordered.length > 0;



  for (const provider of ordered) {
    try {
      const baseContext: AiUsageContext | undefined = input.userId
        ? {
            requestId: usageRequestId,
            userId: input.userId,
            feature: "generator",
            toolSlug: input.toolSlug,
            creditCost,
          }
        : undefined;
      if (input.toolSlug === "modul-ajar") {
        const modul = await generateModulAjarWithProvider(
          input,
          provider,
          toolConfig?.systemPrompt,
          baseContext
        );
        return {
          ...finalizeResult(
            modul.content,
            modul.title,
            creditCost,
            `${provider.name} · ${modul.phases} fase AI`,
            false,
            {
              phases: modul.phases,
              wordCount: modul.quality.wordCount,
              tableCount: modul.quality.tableCount,
              qualityOk: modul.quality.ok,
              qualityMessage: modul.quality.message,
            }
          ),
          usageRequestId,
        };
      }

      const content = await tryProvider(
        provider,
        messages,
        toolConfig?.providerId === provider.id ? toolConfig.modelOverride : undefined,
        baseContext
      );
      return {
        ...finalizeResult(content, title, creditCost, provider.name, false),
        usageRequestId,
      };
    } catch (err) {

      lastError = err instanceof Error ? err : new Error(String(err));

      console.error(`Provider ${provider.slug} failed:`, lastError.message);

    }

  }



  // In demo mode, prefer the local template flow immediately when no DB provider is active.
  // This avoids long waits from stale env keys during local/browser testing.
  if (demoMode && !hadConfiguredProvider) {
    return {
      ...finalizeResult(
        generateDemoContent(input.toolSlug, input.data),
        title,
        creditCost,
        "demo",
        true
      ),
      usageRequestId,
    };
  }

  // Environment keys

  const envContext: AiUsageContext | undefined = input.userId
    ? {
        requestId: usageRequestId,
        userId: input.userId,
        feature: "generator",
        toolSlug: input.toolSlug,
        creditCost,
      }
    : undefined;
  const envResult = await tryEnvProviders(systemPrompt, userPrompt, envContext);

  if (envResult) {

    return {
      ...finalizeResult(

      envResult.content,

      title,

      creditCost,

      envResult.name,

      false

      ),
      usageRequestId,
    };

  }



  // API key ada di DB/env tapi semua panggilan gagal — jangan diam-diam pakai demo

  if (hadConfiguredProvider && lastError) {

    throw new Error(

      `AI gagal menghasilkan dokumen (${lastError.message}). Periksa API key, kuota, dan model di Super Admin → Pengaturan AI.`

    );

  }



  if (demoMode) {

    return {
      ...finalizeResult(

      generateDemoContent(input.toolSlug, input.data),

      title,

      creditCost,

      "demo",

      true

      ),
      usageRequestId,
    };

  }



  throw new Error(

    "Tidak ada provider AI aktif. Atur API key di Super Admin → Pengaturan AI, nyalakan Primary aktif, lalu Simpan."

  );

}


