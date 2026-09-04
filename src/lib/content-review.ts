import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CONTENT_REVIEW_SETTING_KEY = "content_review";

export type ContentReviewFeature = "spotlight" | "mading";
export type ContentReviewerRole = "TEACHER" | "SCHOOL_ADMIN";

export type FeatureReviewSettings = {
  reviewEnabled: boolean;
  reviewerRoles: ContentReviewerRole[];
};

export type ContentReviewSettings = {
  spotlight: FeatureReviewSettings;
  mading: FeatureReviewSettings;
};

const DEFAULT_ROLES: ContentReviewerRole[] = ["TEACHER", "SCHOOL_ADMIN"];

export const DEFAULT_CONTENT_REVIEW_SETTINGS: ContentReviewSettings = {
  spotlight: { reviewEnabled: false, reviewerRoles: [...DEFAULT_ROLES] },
  mading: { reviewEnabled: true, reviewerRoles: [...DEFAULT_ROLES] },
};

function normalizeRoles(value: unknown): ContentReviewerRole[] {
  if (!Array.isArray(value)) return [...DEFAULT_ROLES];
  const allowed = new Set<ContentReviewerRole>(["TEACHER", "SCHOOL_ADMIN"]);
  const roles = value.filter(
    (item): item is ContentReviewerRole =>
      typeof item === "string" && allowed.has(item as ContentReviewerRole)
  );
  return roles.length > 0 ? Array.from(new Set(roles)) : [...DEFAULT_ROLES];
}

function normalizeFeature(
  value: unknown,
  fallback: FeatureReviewSettings
): FeatureReviewSettings {
  if (!value || typeof value !== "object") return { ...fallback, reviewerRoles: [...fallback.reviewerRoles] };
  const raw = value as Partial<FeatureReviewSettings>;
  return {
    reviewEnabled: typeof raw.reviewEnabled === "boolean" ? raw.reviewEnabled : fallback.reviewEnabled,
    reviewerRoles: normalizeRoles(raw.reviewerRoles),
  };
}

export function mergeContentReviewSettings(value: unknown): ContentReviewSettings {
  if (!value || typeof value !== "object") {
    return {
      spotlight: {
        ...DEFAULT_CONTENT_REVIEW_SETTINGS.spotlight,
        reviewerRoles: [...DEFAULT_CONTENT_REVIEW_SETTINGS.spotlight.reviewerRoles],
      },
      mading: {
        ...DEFAULT_CONTENT_REVIEW_SETTINGS.mading,
        reviewerRoles: [...DEFAULT_CONTENT_REVIEW_SETTINGS.mading.reviewerRoles],
      },
    };
  }
  const raw = value as Partial<ContentReviewSettings>;
  return {
    spotlight: {
      ...normalizeFeature(raw.spotlight, DEFAULT_CONTENT_REVIEW_SETTINGS.spotlight),
      // Spotlight memakai publikasi langsung dan moderasi berbasis laporan.
      reviewEnabled: false,
    },
    mading: normalizeFeature(raw.mading, DEFAULT_CONTENT_REVIEW_SETTINGS.mading),
  };
}

export async function getContentReviewSettings(): Promise<ContentReviewSettings> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: CONTENT_REVIEW_SETTING_KEY },
    select: { value: true },
  });
  return mergeContentReviewSettings(setting?.value);
}

export async function upsertContentReviewSettings(
  input: ContentReviewSettings
): Promise<ContentReviewSettings> {
  const next = mergeContentReviewSettings(input);
  if (next.spotlight.reviewerRoles.length === 0 || next.mading.reviewerRoles.length === 0) {
    throw new Error("Minimal satu role reviewer harus dipilih untuk tiap fitur.");
  }
  await prisma.platformSetting.upsert({
    where: { key: CONTENT_REVIEW_SETTING_KEY },
    create: { key: CONTENT_REVIEW_SETTING_KEY, value: next },
    update: { value: next },
  });
  return next;
}

export function canReviewContent(
  role: UserRole,
  feature: ContentReviewFeature,
  settings: ContentReviewSettings
) {
  if (role === "SUPER_ADMIN") return true;
  const featureSettings = settings[feature];
  if (!featureSettings.reviewEnabled) {
    // Even when auto-publish is on, configured reviewers (and super admin) may still manage archive/reject.
    return featureSettings.reviewerRoles.includes(role as ContentReviewerRole);
  }
  return featureSettings.reviewerRoles.includes(role as ContentReviewerRole);
}

export function initialStudentContentStatus(
  feature: ContentReviewFeature,
  settings: ContentReviewSettings
): "PENDING_REVIEW" | "PUBLISHED" {
  if (feature === "spotlight") return "PUBLISHED";
  return settings[feature].reviewEnabled ? "PENDING_REVIEW" : "PUBLISHED";
}

export function isContentReviewEnabled(
  feature: ContentReviewFeature,
  settings: ContentReviewSettings
) {
  return settings[feature].reviewEnabled;
}
