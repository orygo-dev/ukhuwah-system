import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credit-ledger";
import {
  countTodayCompletedAds,
  getRewardAdConfig,
  type RewardAdProvider,
} from "@/lib/reward-ad";

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function nextDailyClaimKey(
  userId: string,
  missionId: string,
  tx: Prisma.TransactionClient
) {
  const prefix = todayKey();
  const todayClaims = await tx.rewardMissionClaim.findMany({
    where: {
      userId,
      missionId,
      claimKey: { startsWith: prefix },
    },
    select: { claimKey: true },
  });
  return `${prefix}-${todayClaims.length + 1}`;
}

export async function createRewardAdSession(
  userId: string,
  provider: RewardAdProvider,
  ipAddress?: string
) {
  const config = await getRewardAdConfig();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + config.sessionExpiresMinutes);

  const existing = await prisma.rewardAdSession.findFirst({
    where: {
      userId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
  if (existing) {
    return existing;
  }

  return prisma.rewardAdSession.create({
    data: {
      userId,
      provider,
      expiresAt,
      ipAddress: ipAddress || null,
    },
  });
}

type CompleteAdInput = {
  sessionId: string;
  userId: string;
  externalTxId?: string;
  provider: RewardAdProvider;
};

export async function completeRewardAdSession(
  input: CompleteAdInput
): Promise<{ credits: number; balanceAfter: number }> {
  const config = await getRewardAdConfig();
  const credits = config.creditsPerAd;

  if (input.externalTxId) {
    const dup = await prisma.rewardAdSession.findUnique({
      where: { externalTxId: input.externalTxId },
    });
    if (dup?.status === "COMPLETED") {
      throw new Error("ALREADY_REWARDED");
    }
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.rewardAdSession.findUnique({
      where: { id: input.sessionId },
    });

    if (!session || session.userId !== input.userId) {
      throw new Error("SESSION_NOT_FOUND");
    }
    if (session.status !== "PENDING") {
      throw new Error("SESSION_NOT_PENDING");
    }
    if (session.expiresAt < new Date()) {
      await tx.rewardAdSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
      throw new Error("SESSION_EXPIRED");
    }

    const todayCount = await tx.rewardAdSession.count({
      where: {
        userId: input.userId,
        status: "COMPLETED",
        completedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });
    if (todayCount >= config.maxAdsPerDay) {
      throw new Error("DAILY_LIMIT_REACHED");
    }

    if (input.provider === "sandbox") {
      const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
      if (elapsed < config.minWatchSeconds - 0.5) {
        throw new Error("WATCH_TOO_SHORT");
      }
    }

    const mission = await tx.rewardMission.findUnique({
      where: { slug: "watch-ad" },
    });

    const completedAt = new Date();
    const markedCompleted = await tx.rewardAdSession.updateMany({
      where: { id: session.id, status: "PENDING" },
      data: {
        status: "COMPLETED",
        completedAt,
        creditsAwarded: credits,
        externalTxId: input.externalTxId || session.externalTxId,
        provider: input.provider,
      },
    });
    if (markedCompleted.count !== 1) {
      throw new Error("SESSION_NOT_PENDING");
    }

    const { balanceAfter } = await grantCredits(
      input.userId,
      credits,
      "REWARDED_AD",
      session.id,
      "Iklan reward",
      tx,
      {
        idempotencyKey: `reward-ad:${session.id}`,
        metadata: {
          provider: input.provider,
          externalTxId: input.externalTxId || session.externalTxId || null,
        },
      }
    );

    if (mission?.isActive) {
      const claimKey = await nextDailyClaimKey(input.userId, mission.id, tx);
      try {
        await tx.rewardMissionClaim.create({
          data: {
            userId: input.userId,
            missionId: mission.id,
            credits,
            claimKey,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
      }
    }

    return { credits, balanceAfter };
  });
}

export async function completeRewardAdFromSsv(params: {
  userId: string;
  sessionId: string;
  transactionId: string;
}): Promise<{ credits: number; balanceAfter: number } | null> {
  const session = await prisma.rewardAdSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session || session.userId !== params.userId) {
    return null;
  }
  if (session.status === "COMPLETED") {
    return null;
  }

  try {
    return await completeRewardAdSession({
      sessionId: params.sessionId,
      userId: params.userId,
      externalTxId: params.transactionId,
      provider: "admob",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_REWARDED") {
      return null;
    }
    throw err;
  }
}

export async function getWatchAdMissionStats(userId: string) {
  const config = await getRewardAdConfig();
  const adsWatchedToday = await countTodayCompletedAds(userId);
  const remaining = Math.max(0, config.maxAdsPerDay - adsWatchedToday);
  return {
    enabled: config.enabled,
    adsWatchedToday,
    maxAdsPerDay: config.maxAdsPerDay,
    remaining,
    creditsPerAd: config.creditsPerAd,
    provider: config.provider,
    minWatchSeconds: config.minWatchSeconds,
  };
}
