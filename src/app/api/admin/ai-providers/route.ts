import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { testProviderConnection } from "@/lib/ai/provider";
import { AI_PROVIDERS, normalizeGeminiModel } from "@/lib/ai/constants";
import {
  activatePrimaryProvider,
  listAdminProviders,
  saveProviderConfig,
} from "@/lib/ai/admin-providers";
import type { AiProvider } from "@prisma/client";

export const runtime = "nodejs";

async function assertSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await listAdminProviders();
  return NextResponse.json({
    ...data,
    // backward compat
    providers: data.providers.map((p) => ({
      ...p,
      hasApiKey: p.hasValidKey,
    })),
  });
}

export async function POST(req: Request) {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();

    if (body.action === "set-primary") {
      const slug = body.slug as string;
      if (!slug || !AI_PROVIDERS[slug as keyof typeof AI_PROVIDERS]) {
        return NextResponse.json({ error: "Provider tidak dikenal" }, { status: 400 });
      }
      const provider = await activatePrimaryProvider(slug);
      return NextResponse.json({
        success: true,
        message: `${provider.name} sekarang provider utama`,
        primarySlug: slug,
      });
    }

    const provider = await saveProviderConfig({
      slug: body.slug,
      name: body.name,
      baseUrl: body.baseUrl,
      defaultModel: body.defaultModel,
      apiKey: body.apiKey,
      isActive: body.isActive,
      isFallback: body.isFallback,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
    });

    return NextResponse.json({
      success: true,
      provider: { id: provider.id, slug: provider.slug, isActive: provider.isActive },
      primarySlug: provider.isActive ? provider.slug : null,
    });
  } catch (err) {
    console.error("AI provider save error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan" },
      { status: 400 }
    );
  }
}

export async function PUT(req: Request) {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { slug, apiKey: testApiKey, defaultModel: testModel } = body;

    let provider = await prisma.aiProvider.findUnique({ where: { slug } });

    if (!provider && testApiKey) {
      const catalog = AI_PROVIDERS[slug as keyof typeof AI_PROVIDERS];
      if (!catalog) {
        return NextResponse.json({ error: "Provider tidak dikenal" }, { status: 400 });
      }
      provider = {
        id: "test",
        name: catalog.name,
        slug,
        baseUrl: catalog.baseUrl,
        apiKey: testApiKey.trim(),
        defaultModel: testModel
          ? slug === "gemini"
            ? normalizeGeminiModel(testModel)
            : testModel
          : catalog.defaultModel,
        isActive: false,
        isFallback: false,
        maxTokens: 4096,
        temperature: 0.7,
        priority: 0,
        costPer1kIn: 0,
        costPer1kOut: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AiProvider;
    }

    if (!provider) {
      return NextResponse.json(
        { error: "Simpan API key terlebih dahulu sebelum test" },
        { status: 404 }
      );
    }

    if (testApiKey?.trim()) {
      provider = { ...provider, apiKey: testApiKey.trim() };
    }

    if (testModel && provider.slug === "gemini") {
      provider = { ...provider, defaultModel: normalizeGeminiModel(testModel) };
    } else if (testModel) {
      provider = { ...provider, defaultModel: testModel };
    } else if (provider.slug === "gemini") {
      provider = {
        ...provider,
        defaultModel: normalizeGeminiModel(provider.defaultModel),
      };
    }

    const result = await testProviderConnection(provider);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Test gagal" },
      { status: 500 }
    );
  }
}
