import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TOOLS } from "@/lib/constants";
import { TOOL_PROMPTS } from "@/lib/ai/prompts";

export const runtime = "nodejs";

async function assertSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

const toolPatchSchema = z.object({
  toolSlug: z.string().min(1),
  creditCost: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const putSchema = z.object({
  tools: z.array(toolPatchSchema).min(1),
});

async function getDefaultProviderId() {
  const provider = await prisma.aiProvider.findFirst({
    orderBy: [{ isActive: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return provider?.id ?? null;
}

function serializeToolConfig(
  tool: (typeof TOOLS)[number],
  config?: {
    id: string;
    creditCost: number;
    isActive: boolean;
    sortOrder: number;
    providerId: string;
  }
) {
  return {
    id: config?.id ?? null,
    toolSlug: tool.slug,
    toolName: tool.name,
    category: tool.category,
    description: tool.description,
    creditCost: config?.creditCost ?? tool.creditCost,
    isActive: config?.isActive ?? true,
    sortOrder: config?.sortOrder ?? TOOLS.findIndex((item) => item.slug === tool.slug),
    providerId: config?.providerId ?? null,
  };
}

export async function GET() {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const configs = await prisma.aiToolConfig.findMany({
    select: {
      id: true,
      toolSlug: true,
      creditCost: true,
      isActive: true,
      sortOrder: true,
      providerId: true,
    },
  });
  const configMap = new Map(configs.map((config) => [config.toolSlug, config]));

  return NextResponse.json({
    tools: TOOLS.map((tool) => serializeToolConfig(tool, configMap.get(tool.slug))),
  });
}

export async function PUT(req: Request) {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = putSchema.parse(await req.json());
    const defaultProviderId = await getDefaultProviderId();
    if (!defaultProviderId) {
      return NextResponse.json(
        { error: "Konfigurasikan minimal satu AI provider sebelum mengatur harga generator." },
        { status: 400 }
      );
    }

    const toolMap = new Map(TOOLS.map((tool) => [tool.slug, tool]));

    await prisma.$transaction(
      body.tools.map((patch) => {
        const tool = toolMap.get(patch.toolSlug);
        if (!tool) throw new Error(`Generator tidak dikenal: ${patch.toolSlug}`);

        return prisma.aiToolConfig.upsert({
          where: { toolSlug: patch.toolSlug },
          update: {
            creditCost: patch.creditCost,
            isActive: patch.isActive ?? true,
            sortOrder:
              patch.sortOrder ?? TOOLS.findIndex((item) => item.slug === patch.toolSlug),
          },
          create: {
            toolSlug: tool.slug,
            toolName: tool.name,
            category: tool.category,
            description: tool.description,
            providerId: defaultProviderId,
            systemPrompt: TOOL_PROMPTS[tool.slug] ?? TOOL_PROMPTS["modul-ajar"],
            creditCost: patch.creditCost,
            isActive: patch.isActive ?? true,
            sortOrder:
              patch.sortOrder ?? TOOLS.findIndex((item) => item.slug === patch.toolSlug),
          },
        });
      })
    );

    const configs = await prisma.aiToolConfig.findMany({
      select: {
        id: true,
        toolSlug: true,
        creditCost: true,
        isActive: true,
        sortOrder: true,
        providerId: true,
      },
    });
    const configMap = new Map(configs.map((config) => [config.toolSlug, config]));

    return NextResponse.json({
      success: true,
      tools: TOOLS.map((tool) => serializeToolConfig(tool, configMap.get(tool.slug))),
    });
  } catch (err) {
    console.error("AI tool config save error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan harga generator" },
      { status: 400 }
    );
  }
}
