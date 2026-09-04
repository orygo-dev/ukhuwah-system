import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ASSISTANT_WORKFLOWS, getAssistantTool } from "@/lib/assistant-workflows";
import { getGeneratorCatalog } from "@/lib/generator-catalog";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { getUserPlanEntitlements } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";
import { profileToFormDefaults } from "@/lib/teacher-profile";
import { getToolFormSteps } from "@/lib/tool-forms";
import { resolveDynamicOptions } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "TEACHER") return mobileForbidden();

  const [account, documents, catalog, planAccess] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        nip: true,
        phone: true,
        profileDefaults: true,
        creditsRemaining: true,
      },
    }),
    prisma.document.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        title: true,
        toolSlug: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    getGeneratorCatalog(),
    getUserPlanEntitlements(session.user.id),
  ]);

  if (!account) return mobileUnauthorized();
  const configBySlug = new Map(catalog.map((tool) => [tool.slug, tool]));

  const workflows = ASSISTANT_WORKFLOWS.map((workflow) => ({
    ...workflow,
    items: workflow.items.flatMap((item) => {
      const definition = getAssistantTool(item.toolSlug);
      const config = configBySlug.get(item.toolSlug);
      if (!definition || config?.isActive === false) return [];
      return [{
        ...item,
        tool: {
          slug: definition.slug,
          name: definition.name,
          description: definition.description,
          creditCost: config?.creditCost ?? definition.creditCost,
          formSteps: getToolFormSteps(definition.slug),
        },
      }];
    }),
  }));
  const tools = catalog.flatMap((config) => {
    const definition = getAssistantTool(config.slug);
    if (!definition || config.isActive === false) return [];
    return [{
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      creditCost: config.creditCost ?? definition.creditCost,
      formSteps: getToolFormSteps(definition.slug),
    }];
  });

  return NextResponse.json({
    canUseAssistant: planAccess.entitlements.canUseAiAssistant,
    creditsRemaining: account.creditsRemaining,
    profileDefaults: profileToFormDefaults(account),
    documents: documents.map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
    })),
    dynamicOptions: Object.fromEntries(
      ["kelas", "mapel", "model", "alokasi", "dpl", "semester"].map((source) => [
        source,
        Object.fromEntries(
          ["default", "sd", "smp", "sma", "smk"].map((jenjang) => [
            jenjang,
            resolveDynamicOptions(source, {
              jenjang: jenjang === "default" ? "" : jenjang,
            }),
          ])
        ),
      ])
    ),
    workflows,
    tools,
  });
}
