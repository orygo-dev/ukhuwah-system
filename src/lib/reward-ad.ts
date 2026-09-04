import { prisma } from "@/lib/prisma";
import { isSandboxRewardAllowed } from "@/lib/runtime-config";

export const REWARD_AD_CONFIG_KEY = "reward_ad_config";

export type RewardAdProvider = "sandbox" | "admob";

export type RewardAdConfig = {
  enabled: boolean;
  provider: RewardAdProvider;
  creditsPerAd: number;
  maxAdsPerDay: number;
  minWatchSeconds: number;
  sessionExpiresMinutes: number;
  cooldownSeconds: number;
  admobAppId: string;
  admobAdUnitId: string;
};

export const DEFAULT_REWARD_AD_CONFIG: RewardAdConfig = {
  enabled: false,
  provider: "sandbox",
  creditsPerAd: 1,
  maxAdsPerDay: 5,
  minWatchSeconds: 5,
  sessionExpiresMinutes: 10,
  cooldownSeconds: 30,
  admobAppId: "",
  admobAdUnitId: "",
};

export async function getRewardAdConfig(): Promise<RewardAdConfig> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: REWARD_AD_CONFIG_KEY },
    });
    if (!row?.value || typeof row.value !== "object") {
      return DEFAULT_REWARD_AD_CONFIG;
    }
    const merged = { ...DEFAULT_REWARD_AD_CONFIG, ...(row.value as RewardAdConfig) };
    if (merged.provider === "sandbox" && !isSandboxRewardAllowed()) {
      return { ...merged, enabled: false };
    }
    return merged;
  } catch {
    return DEFAULT_REWARD_AD_CONFIG;
  }
}

export async function saveRewardAdConfig(
  config: RewardAdConfig
): Promise<RewardAdConfig> {
  const sanitized =
    config.provider === "sandbox" && !isSandboxRewardAllowed()
      ? { ...config, enabled: false }
      : config;
  await prisma.platformSetting.upsert({
    where: { key: REWARD_AD_CONFIG_KEY },
    create: { key: REWARD_AD_CONFIG_KEY, value: sanitized as object },
    update: { value: sanitized as object },
  });
  return sanitized;
}

function startOfToday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function countTodayCompletedAds(userId: string): Promise<number> {
  return prisma.rewardAdSession.count({
    where: {
      userId,
      status: "COMPLETED",
      completedAt: { gte: startOfToday() },
    },
  });
}

export async function getLastCompletedAdAt(userId: string): Promise<Date | null> {
  const last = await prisma.rewardAdSession.findFirst({
    where: { userId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });
  return last?.completedAt ?? null;
}

export function getCooldownRemainingSeconds(
  lastCompletedAt: Date | null,
  cooldownSeconds: number,
  now = new Date()
): number {
  if (!lastCompletedAt || cooldownSeconds <= 0) return 0;
  const elapsed = Math.floor((now.getTime() - lastCompletedAt.getTime()) / 1000);
  return Math.max(0, cooldownSeconds - elapsed);
}

export async function canStartAdSession(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  adsWatchedToday: number;
  cooldownRemaining: number;
}> {
  const config = await getRewardAdConfig();
  if (!config.enabled) {
    return {
      allowed: false,
      reason: "Iklan reward sedang tidak aktif",
      adsWatchedToday: 0,
      cooldownRemaining: 0,
    };
  }

  const adsWatchedToday = await countTodayCompletedAds(userId);
  if (adsWatchedToday >= config.maxAdsPerDay) {
    return {
      allowed: false,
      reason: "Kuota iklan hari ini sudah habis",
      adsWatchedToday,
      cooldownRemaining: 0,
    };
  }

  const lastCompleted = await getLastCompletedAdAt(userId);
  const cooldownRemaining = getCooldownRemainingSeconds(
    lastCompleted,
    config.cooldownSeconds
  );
  if (cooldownRemaining > 0) {
    return {
      allowed: false,
      reason: `Tunggu ${cooldownRemaining} detik sebelum iklan berikutnya`,
      adsWatchedToday,
      cooldownRemaining,
    };
  }

  const pending = await prisma.rewardAdSession.findFirst({
    where: {
      userId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
  if (pending) {
    return {
      allowed: true,
      adsWatchedToday,
      cooldownRemaining: 0,
    };
  }

  return { allowed: true, adsWatchedToday, cooldownRemaining: 0 };
}

export function buildSsvCallbackUrl(origin?: string): string {
  const base =
    origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/reward/ad/ssv`;
}
