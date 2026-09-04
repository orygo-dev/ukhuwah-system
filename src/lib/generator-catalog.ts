import type { AiToolConfig } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TOOLS, type Tool, type ToolData } from "@/lib/constants";

type ToolConfigLite = Pick<AiToolConfig, "toolSlug" | "creditCost" | "isActive">;

export type ResolvedGeneratorTool = Tool & {
  isActive: boolean;
};

export type ResolvedGeneratorToolData = ToolData & {
  isActive: boolean;
};

export function getStaticGeneratorTool(toolSlug: string) {
  return TOOLS.find((tool) => tool.slug === toolSlug) ?? null;
}

function mergeToolConfig(tool: Tool, config?: ToolConfigLite): ResolvedGeneratorTool {
  return {
    ...tool,
    creditCost: config?.creditCost ?? tool.creditCost,
    isActive: config?.isActive ?? true,
  };
}

export function toToolData(tool: ResolvedGeneratorTool): ResolvedGeneratorToolData {
  return {
    slug: tool.slug,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    creditCost: tool.creditCost,
    popular: tool.popular,
    isActive: tool.isActive,
  };
}

export async function getGeneratorCatalog(): Promise<ResolvedGeneratorTool[]> {
  const configs = await prisma.aiToolConfig.findMany({
    select: {
      toolSlug: true,
      creditCost: true,
      isActive: true,
    },
  });
  const configMap = new Map(configs.map((config) => [config.toolSlug, config]));
  return TOOLS.map((tool) => mergeToolConfig(tool, configMap.get(tool.slug)));
}

export async function getGeneratorTool(toolSlug: string) {
  const tool = getStaticGeneratorTool(toolSlug);
  if (!tool) return null;

  const config = await prisma.aiToolConfig.findUnique({
    where: { toolSlug },
    select: {
      toolSlug: true,
      creditCost: true,
      isActive: true,
    },
  });

  return mergeToolConfig(tool, config ?? undefined);
}
