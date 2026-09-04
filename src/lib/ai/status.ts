import { prisma } from "@/lib/prisma";
import { isPlaceholderKey } from "@/lib/ai/constants";
import { providerHasValidKey } from "@/lib/ai/provider";
import { listProvidersForGenerate } from "@/lib/ai/admin-providers";
import type { AiProvider } from "@prisma/client";

const ENV_KEYS = [
  { env: "OPENAI_API_KEY", label: "OpenAI (env)" },
  { env: "GEMINI_API_KEY", label: "Gemini (env)" },
  { env: "OPENROUTER_API_KEY", label: "OpenRouter (env)" },
] as const;

export type AiAvailability = {
  demoMode: boolean;
  hasRealAi: boolean;
  activeProvider: string | null;
  primarySlug: string | null;
  configuredProviders: {
    name: string;
    slug: string;
    isActive: boolean;
    isFallback: boolean;
  }[];
  message: string;
};

export function sortProviders(providers: AiProvider[]): AiProvider[] {
  return [...providers].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isFallback !== b.isFallback) return a.isFallback ? 1 : -1;
    return b.priority - a.priority;
  });
}

export async function getAiAvailability(): Promise<AiAvailability> {
  const demoMode = process.env.DEMO_MODE === "true";
  const allProviders = await prisma.aiProvider.findMany({
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });

  const withValidKey = allProviders.filter((p) => providerHasValidKey(p));
  const configuredProviders = withValidKey.map((p) => ({
    name: p.name,
    slug: p.slug,
    isActive: p.isActive,
    isFallback: p.isFallback,
  }));

  const primary = withValidKey.find((p) => p.isActive);
  if (primary) {
    return {
      demoMode,
      hasRealAi: true,
      activeProvider: primary.name,
      primarySlug: primary.slug,
      configuredProviders,
      message: `Generate memakai ${primary.name} (provider utama)`,
    };
  }

  if (demoMode) {
    const names = withValidKey.map((p) => p.name).join(", ");
    return {
      demoMode: true,
      hasRealAi: false,
      activeProvider: null,
      primarySlug: null,
      configuredProviders,
      message:
        withValidKey.length > 0
          ? `Mode demo aktif. API key tersimpan (${names}), tetapi tidak ada provider utama yang aktif.`
          : "Mode demo aktif. Generate memakai template simulasi sampai provider AI diaktifkan.",
    };
  }

  if (withValidKey.length > 0) {
    const names = withValidKey.map((p) => p.name).join(", ");
    return {
      demoMode,
      hasRealAi: false,
      activeProvider: null,
      primarySlug: null,
      configuredProviders,
      message: `API key tersimpan (${names}) tetapi belum ada provider utama. Pilih provider utama di Super Admin → Pengaturan AI.`,
    };
  }

  for (const ep of ENV_KEYS) {
    const key = process.env[ep.env];
    if (key && !isPlaceholderKey(key)) {
      return {
        demoMode,
        hasRealAi: true,
        activeProvider: ep.label,
        primarySlug: null,
        configuredProviders,
        message: `AI aktif via .env — ${ep.label}`,
      };
    }
  }

  return {
    demoMode: false,
    hasRealAi: false,
    activeProvider: null,
    primarySlug: null,
    configuredProviders,
    message: "Tidak ada provider AI. Atur di Super Admin → Pengaturan AI.",
  };
}

export { listProvidersForGenerate };
