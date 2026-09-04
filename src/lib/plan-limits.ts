import { prisma } from "@/lib/prisma";
import { getSchoolAccessForUser } from "@/lib/school-commercialization";

export type PlanFeatures = {
  export_pdf?: boolean;
  export_docx?: boolean;
  can_use_ai_assistant?: boolean;
  can_use_affiliate?: boolean;
  can_use_premium_generators?: boolean;
  max_generate_per_month?: number;
  max_classes?: number;
  max_students?: number;
  allowed_generators?: string[];
  monthly_credit_bonus?: number;
  priority?: boolean;
};

export type PlanEntitlements = {
  canExportPdf: boolean;
  canExportDocx: boolean;
  canUseAiAssistant: boolean;
  canUseAffiliate: boolean;
  canUsePremiumGenerators: boolean;
  maxGeneratePerMonth: number | null;
  maxClasses: number | null;
  maxStudents: number | null;
  allowedGenerators: string[] | null;
  monthlyCreditBonus: number;
};

type MembershipPlanInput = {
  name: string;
  slug: string;
} | null;

export type MembershipPlanStatus = "active" | "free" | "expired";

export type MembershipPlanSummary = {
  name: string;
  slug: string;
  expiresAt: string | null;
  status: MembershipPlanStatus;
  isActive: boolean;
};

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeFeatures(features: unknown): PlanFeatures {
  return features && typeof features === "object" && !Array.isArray(features)
    ? (features as PlanFeatures)
    : {};
}

export function resolvePlanEntitlements(features: unknown): PlanEntitlements {
  const f = normalizeFeatures(features);
  const allowedGenerators = Array.isArray(f.allowed_generators)
    ? f.allowed_generators.filter((item) => typeof item === "string")
    : null;

  return {
    canExportPdf: f.export_pdf !== false,
    canExportDocx: f.export_docx !== false,
    canUseAiAssistant: f.can_use_ai_assistant !== false,
    canUseAffiliate: f.can_use_affiliate !== false,
    canUsePremiumGenerators: f.can_use_premium_generators !== false,
    maxGeneratePerMonth: asNumber(f.max_generate_per_month),
    maxClasses: asNumber(f.max_classes),
    maxStudents: asNumber(f.max_students),
    allowedGenerators: allowedGenerators && allowedGenerators.length > 0 ? allowedGenerators : null,
    monthlyCreditBonus: asNumber(f.monthly_credit_bonus) ?? 0,
  };
}

export function isPlanCurrentlyActive(
  plan: MembershipPlanInput,
  planExpiresAt?: Date | string | null,
  now = new Date()
) {
  if (!plan) return false;
  if (plan.slug === "free") return true;
  if (!planExpiresAt) return false;

  const expiresAt =
    planExpiresAt instanceof Date ? planExpiresAt : new Date(planExpiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export function serializeActiveMembershipPlan(
  plan: MembershipPlanInput,
  planExpiresAt?: Date | string | null,
  now = new Date()
): MembershipPlanSummary | null {
  if (!plan) return null;
  const isFree = plan.slug === "free";
  const isActive = isPlanCurrentlyActive(plan, planExpiresAt, now);

  if (!isFree && !isActive) return null;

  const expiresAt =
    planExpiresAt instanceof Date
      ? planExpiresAt.toISOString()
      : planExpiresAt || null;

  return {
    name: plan.name,
    slug: plan.slug,
    expiresAt,
    status: isFree ? "free" : "active",
    isActive,
  };
}

export async function getUserPlanEntitlements(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      planExpiresAt: true,
      plan: {
        select: {
          id: true,
          name: true,
          slug: true,
          features: true,
        },
      },
    },
  });

  const planIsActive = isPlanCurrentlyActive(user?.plan ?? null, user?.planExpiresAt);
  const effectivePlan =
    user?.plan && planIsActive
      ? user.plan
      : await prisma.subscriptionPlan.findUnique({
          where: { slug: "free" },
          select: {
            id: true,
            name: true,
            slug: true,
            features: true,
          },
        });

  const personalEntitlements = resolvePlanEntitlements(effectivePlan?.features);
  const schoolAccess = await getSchoolAccessForUser(userId);
  const schoolCanProvideGenerators = schoolAccess?.features.teacher_generators === true;
  const schoolAllowed = schoolCanProvideGenerators && Array.isArray(schoolAccess.features.allowed_generators)
    ? schoolAccess.features.allowed_generators
    : null;
  const entitlements = schoolCanProvideGenerators
    ? {
        ...personalEntitlements,
        canExportPdf: personalEntitlements.canExportPdf || schoolAccess.features.export_pdf === true,
        canExportDocx: personalEntitlements.canExportDocx || schoolAccess.features.export_docx === true,
        allowedGenerators:
          personalEntitlements.allowedGenerators === null || schoolAllowed === null
            ? null
            : [...new Set([...personalEntitlements.allowedGenerators, ...schoolAllowed])],
      }
    : personalEntitlements;

  return {
    plan: effectivePlan ?? null,
    entitlements,
    schoolAccess: schoolCanProvideGenerators ? schoolAccess : null,
  };
}

export async function countGenerateThisMonth(userId: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.document.count({
    where: {
      userId,
      createdAt: { gte: start },
    },
  });
}

export function canUseGenerator(
  entitlements: PlanEntitlements,
  toolSlug: string
) {
  return !entitlements.allowedGenerators || entitlements.allowedGenerators.includes(toolSlug);
}
