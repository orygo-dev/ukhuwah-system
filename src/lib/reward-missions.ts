import type { RewardMission, RewardMissionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credit-ledger";
import { isTeacherProfileComplete } from "@/lib/teacher-profile";
import { ensureAffiliateProfile } from "@/lib/affiliate-commission";
import { getRewardAdConfig, countTodayCompletedAds } from "@/lib/reward-ad";
import { getCooldownRemainingSeconds, getLastCompletedAdAt } from "@/lib/reward-ad";

export type MissionStatus = "locked" | "ready" | "claimed" | "claimed_today" | "disabled";

export type MissionView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  creditReward: number;
  missionType: RewardMissionType;
  actionUrl: string | null;
  icon: string;
  status: MissionStatus;
  statusLabel: string;
  claimsToday: number;
  maxPerDay: number;
};

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function countTodayMissionClaims(
  missionId: string,
  claims: { missionId: string; claimKey: string }[],
  date = new Date()
) {
  const prefix = todayKey(date);
  return claims.filter(
    (c) => c.missionId === missionId && c.claimKey.startsWith(prefix)
  ).length;
}

function nextDailyClaimKey(
  missionId: string,
  claims: { missionId: string; claimKey: string }[]
) {
  const prefix = todayKey();
  const todayCount = countTodayMissionClaims(missionId, claims);
  return `${prefix}-${todayCount + 1}`;
}

export async function evaluateMission(
  userId: string,
  mission: RewardMission,
  _claims: { missionId: string; claimKey: string }[]
): Promise<{ eligible: boolean; hint?: string }> {
  void _claims;

  switch (mission.slug) {
    case "complete-profile": {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, nip: true, phone: true, profileDefaults: true },
      });
      if (!user || !isTeacherProfileComplete(user)) {
        return {
          eligible: false,
          hint: "Lengkapi profil guru di menu Profil Guru",
        };
      }
      return { eligible: true };
    }
    case "first-document": {
      const count = await prisma.document.count({ where: { userId } });
      if (count < 1) {
        return {
          eligible: false,
          hint: "Buat dokumen pertama lewat Generator",
        };
      }
      return { eligible: true };
    }
    case "daily-login":
      return { eligible: true };
    case "share-affiliate": {
      const referralCount = await prisma.affiliateReferral.count({
        where: { affiliateId: userId },
      });
      if (referralCount < 1) {
        return {
          eligible: false,
          hint: "Undang minimal 1 guru yang mendaftar lewat link afiliasi Anda",
        };
      }
      const profile = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (!profile?.name) {
        return { eligible: false, hint: "Akun tidak ditemukan" };
      }
      await ensureAffiliateProfile(userId, profile.name);
      return { eligible: true };
    }
    case "watch-ad": {
      const adConfig = await getRewardAdConfig();
      if (!adConfig.enabled) {
        return { eligible: false, hint: "Iklan reward sedang tidak aktif" };
      }
      const watched = await countTodayCompletedAds(userId);
      if (watched >= adConfig.maxAdsPerDay) {
        return { eligible: false, hint: "Kuota iklan hari ini sudah habis" };
      }
      const lastAd = await getLastCompletedAdAt(userId);
      const cooldown = getCooldownRemainingSeconds(
        lastAd,
        adConfig.cooldownSeconds
      );
      if (cooldown > 0) {
        return {
          eligible: false,
          hint: `Tunggu ${cooldown} detik sebelum iklan berikutnya`,
        };
      }
      return { eligible: true };
    }
    default:
      return { eligible: false, hint: "Misi belum dikonfigurasi" };
  }
}

function resolveStatus(
  mission: RewardMission,
  claims: { missionId: string; claimKey: string }[],
  eligible: boolean,
  adsWatchedToday?: number,
  maxPerDayOverride?: number
): { status: MissionStatus; statusLabel: string; claimsToday: number } {
  if (!mission.isActive) {
    return { status: "disabled", statusLabel: "Nonaktif", claimsToday: 0 };
  }

  const missionClaims = claims.filter((c) => c.missionId === mission.id);

  if (mission.slug === "watch-ad") {
    const todayCount = adsWatchedToday ?? countTodayMissionClaims(mission.id, claims);
    const limit = maxPerDayOverride ?? mission.maxPerDay;
    if (todayCount >= limit) {
      return {
        status: "claimed_today",
        statusLabel: "Kuota hari ini habis",
        claimsToday: todayCount,
      };
    }
    if (!eligible) {
      return {
        status: "locked",
        statusLabel: "Belum tersedia",
        claimsToday: todayCount,
      };
    }
    return {
      status: "ready",
      statusLabel: "Siap ditonton",
      claimsToday: todayCount,
    };
  }

  const todayClaims = countTodayMissionClaims(mission.id, claims);

  if (mission.missionType === "ONE_TIME") {
    const claimed = missionClaims.some((c) => c.claimKey === "once");
    if (claimed) {
      return { status: "claimed", statusLabel: "Sudah diklaim", claimsToday: 0 };
    }
    if (!eligible) {
      return { status: "locked", statusLabel: "Belum memenuhi syarat", claimsToday: 0 };
    }
    return { status: "ready", statusLabel: "Siap diklaim", claimsToday: 0 };
  }

  if (todayClaims >= mission.maxPerDay) {
    return {
      status: "claimed_today",
      statusLabel: "Sudah diklaim hari ini",
      claimsToday: todayClaims,
    };
  }
  if (!eligible) {
    return { status: "locked", statusLabel: "Belum memenuhi syarat", claimsToday: todayClaims };
  }
  return { status: "ready", statusLabel: "Siap diklaim", claimsToday: todayClaims };
}

export async function getMissionsForUser(userId: string): Promise<MissionView[]> {
  const missions = await prisma.rewardMission.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  const claims = await prisma.rewardMissionClaim.findMany({
    where: { userId },
    select: { missionId: true, claimKey: true },
  });

  const adsWatchedToday = await countTodayCompletedAds(userId);
  const adConfig = await getRewardAdConfig();

  const views: MissionView[] = [];

  for (const mission of missions) {
    const evaluation = await evaluateMission(userId, mission, claims);
    const missionMaxPerDay =
      mission.slug === "watch-ad" ? adConfig.maxAdsPerDay : mission.maxPerDay;
    const { status, statusLabel, claimsToday } = resolveStatus(
      mission,
      claims,
      evaluation.eligible,
      mission.slug === "watch-ad" ? adsWatchedToday : undefined,
      missionMaxPerDay
    );

    const showMission = mission.isActive || mission.slug === "watch-ad";
    if (!showMission) continue;

    views.push({
      id: mission.id,
      slug: mission.slug,
      title: mission.title,
      description: mission.description,
      creditReward: mission.creditReward,
      missionType: mission.missionType,
      actionUrl: mission.actionUrl,
      icon: mission.icon,
      status: mission.isActive ? status : "disabled",
      statusLabel: mission.isActive ? statusLabel : "Segera hadir",
      claimsToday:
        mission.slug === "watch-ad" ? adsWatchedToday : claimsToday,
      maxPerDay: missionMaxPerDay,
    });
  }

  return views;
}

export async function claimRewardMission(
  userId: string,
  missionSlug: string
): Promise<{ credits: number; balanceAfter: number; missionTitle: string }> {
  const mission = await prisma.rewardMission.findUnique({
    where: { slug: missionSlug },
  });
  if (!mission || !mission.isActive) {
    throw new Error("MISSION_NOT_FOUND");
  }

  if (mission.slug === "watch-ad") {
    throw new Error("USE_AD_FLOW");
  }

  const claims = await prisma.rewardMissionClaim.findMany({
    where: { userId, missionId: mission.id },
    select: { claimKey: true, missionId: true },
  });

  const evaluation = await evaluateMission(userId, mission, claims);
  const { status } = resolveStatus(mission, claims, evaluation.eligible);

  if (status === "claimed" || status === "claimed_today") {
    throw new Error("ALREADY_CLAIMED");
  }
  if (status === "locked" || status === "disabled") {
    throw new Error(evaluation.hint || "MISSION_LOCKED");
  }

  const key =
    mission.missionType === "ONE_TIME"
      ? "once"
      : nextDailyClaimKey(mission.id, claims);

  return prisma.$transaction(async (tx) => {
    if (mission.missionType === "DAILY") {
      const todayCount = await tx.rewardMissionClaim.count({
        where: {
          userId,
          missionId: mission.id,
          claimKey: { startsWith: todayKey() },
        },
      });
      if (todayCount >= mission.maxPerDay) {
        throw new Error("ALREADY_CLAIMED");
      }
    }

    const existing = await tx.rewardMissionClaim.findUnique({
      where: {
        userId_missionId_claimKey: {
          userId,
          missionId: mission.id,
          claimKey: key,
        },
      },
    });
    if (existing) {
      throw new Error("ALREADY_CLAIMED");
    }

    const claim = await tx.rewardMissionClaim.create({
      data: {
        userId,
        missionId: mission.id,
        credits: mission.creditReward,
        claimKey: key,
      },
    });

    const { balanceAfter } = await grantCredits(
      userId,
      mission.creditReward,
      "REWARD_MISSION",
      claim.id,
      `Misi: ${mission.title}`,
      tx,
      {
        idempotencyKey: `reward-mission:${claim.id}`,
        metadata: {
          missionId: mission.id,
          missionSlug: mission.slug,
          claimKey: key,
        },
      }
    );

    return {
      credits: mission.creditReward,
      balanceAfter,
      missionTitle: mission.title,
    };
  });
}
