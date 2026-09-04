import type { SchoolPlan, SchoolSubscription, SchoolSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SCHOOL_PJJ_HARD_CAP = 25;

export type SchoolPlanFeatures = {
  administration?: boolean;
  ai_drafts?: boolean;
  scheduling?: boolean;
  pjj_add_on?: boolean;
  teacher_generators?: boolean;
  allowed_generators?: string[];
  export_pdf?: boolean;
  export_docx?: boolean;
};

export function isSchoolCommercializationEnabled() {
  return process.env.SCHOOL_COMMERCIALIZATION_ENABLED === "true";
}

export function isSchoolSubscriptionWritable(
  status: SchoolSubscriptionStatus,
  now = new Date(),
  limits?: Pick<SchoolSubscription, "trialEndsAt" | "currentPeriodEnd" | "graceEndsAt">
) {
  if (!isSchoolCommercializationEnabled()) return false;
  if (status === "ACTIVE") return !limits?.currentPeriodEnd || limits.currentPeriodEnd > now;
  if (status === "TRIAL") return Boolean(limits?.trialEndsAt && limits.trialEndsAt > now);
  if (status === "GRACE") return Boolean(limits?.graceEndsAt && limits.graceEndsAt > now);
  return false;
}

export function isSchoolSubscriptionReadable(status: SchoolSubscriptionStatus) {
  return isSchoolCommercializationEnabled() && status !== "CANCELED";
}

export function normalizeSchoolPlanFeatures(value: unknown): SchoolPlanFeatures {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SchoolPlanFeatures)
    : {};
}

export function mergeSchoolFeatures(base: unknown, overrides: unknown): SchoolPlanFeatures {
  return {
    ...normalizeSchoolPlanFeatures(base),
    ...normalizeSchoolPlanFeatures(overrides),
  };
}

export async function getCurrentSchoolSubscription(schoolId: string) {
  if (!isSchoolCommercializationEnabled()) return null;
  return prisma.schoolSubscription.findFirst({
    where: { schoolId, status: { not: "CANCELED" } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSchoolAccessForUser(userId: string) {
  if (!isSchoolCommercializationEnabled()) return null;
  const seat = await prisma.schoolSeat.findFirst({
    where: {
      userId,
      releasedAt: null,
      subscription: { status: { in: ["TRIAL", "ACTIVE", "GRACE"] } },
    },
    include: { subscription: { include: { plan: true } } },
    orderBy: { assignedAt: "desc" },
  });
  if (!seat || !isSchoolSubscriptionWritable(seat.subscription.status, new Date(), seat.subscription)) {
    return null;
  }
  return {
    schoolId: seat.schoolId,
    subscriptionId: seat.subscriptionId,
    plan: seat.subscription.plan,
    features: mergeSchoolFeatures(
      seat.subscription.plan.features,
      seat.subscription.featureOverrides
    ),
    creditBalance: seat.subscription.creditBalance,
    pjjAddOnEnabled: seat.subscription.pjjAddOnEnabled,
  };
}

export function schoolPlanSnapshot(plan: SchoolPlan) {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    maxTeacherSeats: plan.maxTeacherSeats,
    maxStudents: plan.maxStudents,
    monthlyAiCredits: plan.monthlyAiCredits,
    features: normalizeSchoolPlanFeatures(plan.features),
  };
}
