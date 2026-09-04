import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { AI_PROVIDERS, normalizeGeminiModel } from "@/lib/ai/constants";
import { providerHasValidKey } from "@/lib/ai/provider";
import type { AiProvider } from "@prisma/client";

export type ProviderSlug = keyof typeof AI_PROVIDERS;

const ENV_KEY_BY_SLUG: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const DEFAULT_PRIORITY: Record<string, number> = {
  openai: 30,
  openrouter: 25,
  gemini: 20,
};

export type SaveProviderInput = {
  slug: string;
  name?: string;
  baseUrl?: string;
  defaultModel?: string;
  apiKey?: string;
  isActive?: boolean;
  isFallback?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type AdminProviderView = {
  id: string;
  slug: string;
  name: string;
  baseUrl: string | null;
  defaultModel: string;
  isActive: boolean;
  isFallback: boolean;
  maxTokens: number;
  temperature: number;
  priority: number;
  hasValidKey: boolean;
};

function resolveStoredApiKey(
  slug: string,
  bodyApiKey: string | undefined,
  existing: AiProvider | null
): string | undefined {
  const trimmed = bodyApiKey?.trim();
  if (trimmed && !trimmed.includes("••••")) {
    return encrypt(trimmed);
  }
  if (existing?.apiKey) return undefined;
  const envKey = ENV_KEY_BY_SLUG[slug] ? process.env[ENV_KEY_BY_SLUG[slug]] : undefined;
  if (envKey?.trim()) return encrypt(envKey.trim());
  return undefined;
}

/** Satu-satunya provider utama — nonaktifkan SEMUA provider lain (termasuk fallback). */
export async function activatePrimaryProvider(slug: string): Promise<AiProvider> {
  const provider = await prisma.aiProvider.findUnique({ where: { slug } });
  if (!provider) {
    throw new Error(`Provider ${slug} belum dikonfigurasi. Simpan API key terlebih dahulu.`);
  }
  if (!providerHasValidKey(provider)) {
    throw new Error(`API key ${provider.name} tidak valid. Simpan ulang API key yang benar.`);
  }

  await prisma.$transaction([
    prisma.aiProvider.updateMany({
      data: { isActive: false },
    }),
    prisma.aiProvider.update({
      where: { slug },
      data: { isActive: true, isFallback: false },
    }),
  ]);

  return prisma.aiProvider.findUniqueOrThrow({ where: { slug } });
}

export async function saveProviderConfig(input: SaveProviderInput): Promise<AiProvider> {
  const slug = input.slug as ProviderSlug;
  const catalog = AI_PROVIDERS[slug];
  if (!catalog) throw new Error("Provider tidak dikenal");

  const existing = await prisma.aiProvider.findUnique({ where: { slug } });
  const apiKeyUpdate = resolveStoredApiKey(slug, input.apiKey, existing);

  if (!existing && !apiKeyUpdate) {
    throw new Error("API key wajib diisi untuk provider baru");
  }

  const resolvedModel =
    slug === "gemini"
      ? normalizeGeminiModel(input.defaultModel || catalog.defaultModel)
      : input.defaultModel || catalog.defaultModel;

  const wantsPrimary = input.isActive === true;
  const wantsFallback = input.isFallback === true && !wantsPrimary;

  const data = {
    name: input.name || catalog.name,
    baseUrl: input.baseUrl || catalog.baseUrl,
    defaultModel: resolvedModel,
    isActive: wantsPrimary,
    isFallback: wantsFallback,
    maxTokens: input.maxTokens ?? existing?.maxTokens ?? 4096,
    temperature: input.temperature ?? Number(existing?.temperature ?? 0.7),
    priority: DEFAULT_PRIORITY[slug] ?? 10,
    ...(apiKeyUpdate ? { apiKey: apiKeyUpdate } : {}),
  };

  const provider = existing
    ? await prisma.aiProvider.update({ where: { slug }, data })
    : await prisma.aiProvider.create({
        data: { slug, ...data, apiKey: apiKeyUpdate! },
      });

  if (wantsPrimary) {
    await prisma.aiProvider.updateMany({
      where: { id: { not: provider.id } },
      data: { isActive: false },
    });
    await prisma.aiProvider.update({
      where: { id: provider.id },
      data: { isFallback: false },
    });
  }

  return prisma.aiProvider.findUniqueOrThrow({ where: { slug } });
}

export async function listAdminProviders(): Promise<{
  providers: AdminProviderView[];
  primarySlug: string | null;
  catalog: typeof AI_PROVIDERS;
}> {
  const providers = await prisma.aiProvider.findMany({
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });

  for (const p of providers) {
    if (p.slug === "gemini") {
      const normalized = normalizeGeminiModel(p.defaultModel);
      if (normalized !== p.defaultModel) {
        await prisma.aiProvider.update({
          where: { id: p.id },
          data: { defaultModel: normalized },
        });
        p.defaultModel = normalized;
      }
    }
  }

  const views: AdminProviderView[] = providers.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    baseUrl: p.baseUrl,
    defaultModel: p.defaultModel,
    isActive: p.isActive,
    isFallback: p.isFallback,
    maxTokens: p.maxTokens,
    temperature: Number(p.temperature),
    priority: p.priority,
    hasValidKey: providerHasValidKey(p),
  }));

  const actives = views.filter((p) => p.isActive);
  let primarySlug = actives.length === 1 ? actives[0].slug : null;

  // Perbaiki state rusak: lebih dari satu primary → pertahankan prioritas tertinggi
  if (actives.length > 1) {
    const winner = [...actives].sort((a, b) => b.priority - a.priority)[0];
    await activatePrimaryProvider(winner.slug);
    primarySlug = winner.slug;
    for (const v of views) {
      v.isActive = v.slug === primarySlug;
      if (v.isActive) v.isFallback = false;
    }
  }

  return { providers: views, primarySlug, catalog: AI_PROVIDERS };
}

/** Urutan untuk generate: primary dulu, lalu fallback berurutan prioritas. */
export async function listProvidersForGenerate(): Promise<AiProvider[]> {
  const all = await prisma.aiProvider.findMany();
  const valid = all.filter((p) => providerHasValidKey(p));

  const primary = valid.filter((p) => p.isActive);
  if (primary.length > 1) {
    const winner = [...primary].sort((a, b) => b.priority - a.priority)[0];
    await activatePrimaryProvider(winner.slug);
    return listProvidersForGenerate();
  }

  const primaryOne = valid.find((p) => p.isActive);
  const fallbacks = valid
    .filter((p) => !p.isActive && p.isFallback)
    .sort((a, b) => b.priority - a.priority);

  const ordered: AiProvider[] = [];
  if (primaryOne) ordered.push(primaryOne);
  for (const fb of fallbacks) {
    if (!ordered.some((p) => p.id === fb.id)) ordered.push(fb);
  }

  return ordered;
}
