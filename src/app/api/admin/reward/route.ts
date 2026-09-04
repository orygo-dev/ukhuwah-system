import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_REWARD_CONFIG,
  getRewardConfig,
  saveRewardConfig,
  type RewardConfig,
} from "@/lib/reward";
import {
  DEFAULT_REWARD_AD_CONFIG,
  buildSsvCallbackUrl,
  getRewardAdConfig,
  saveRewardAdConfig,
  type RewardAdConfig,
} from "@/lib/reward-ad";

const configSchema = z.object({
  enabled: z.boolean(),
  pageTitle: z.string().trim().min(1),
  pageDescription: z.string().trim(),
  lowCreditThreshold: z.coerce.number().int().min(0).max(100),
});

const adConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["sandbox", "admob"]),
  creditsPerAd: z.coerce.number().int().min(0).max(100),
  maxAdsPerDay: z.coerce.number().int().min(1).max(50),
  minWatchSeconds: z.coerce.number().int().min(1).max(120),
  sessionExpiresMinutes: z.coerce.number().int().min(1).max(60),
  cooldownSeconds: z.coerce.number().int().min(0).max(600),
  admobAppId: z.string().trim(),
  admobAdUnitId: z.string().trim(),
});

const missionPatchSchema = z.object({
  missions: z
    .array(
      z.object({
        slug: z.string().trim().min(1),
        creditReward: z.coerce.number().int().min(0).max(1000).optional(),
        isActive: z.boolean().optional(),
        title: z.string().trim().min(1).optional(),
        description: z.string().trim().optional(),
      })
    )
    .optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const [config, adConfig, missions] = await Promise.all([
      getRewardConfig(),
      getRewardAdConfig(),
      prisma.rewardMission.findMany({ orderBy: [{ sortOrder: "asc" }] }),
    ]);

    return NextResponse.json({
      config,
      adConfig,
      adDefaults: DEFAULT_REWARD_AD_CONFIG,
      ssvCallbackUrl: buildSsvCallbackUrl(),
      defaults: DEFAULT_REWARD_CONFIG,
      missions: missions.map((m) => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        description: m.description,
        creditReward: m.creditReward,
        missionType: m.missionType,
        maxPerDay: m.maxPerDay,
        isActive: m.isActive,
        sortOrder: m.sortOrder,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    let config: RewardConfig | undefined;
    if (
      body.enabled !== undefined ||
      body.pageTitle !== undefined ||
      body.pageDescription !== undefined ||
      body.lowCreditThreshold !== undefined
    ) {
      const current = await getRewardConfig();
      config = await saveRewardConfig(
        configSchema.parse({ ...current, ...body }) as RewardConfig
      );
    }

    let adConfig: RewardAdConfig | undefined;
    if (
      body.adEnabled !== undefined ||
      body.provider !== undefined ||
      body.creditsPerAd !== undefined ||
      body.maxAdsPerDay !== undefined ||
      body.minWatchSeconds !== undefined ||
      body.sessionExpiresMinutes !== undefined ||
      body.cooldownSeconds !== undefined ||
      body.admobAppId !== undefined ||
      body.admobAdUnitId !== undefined ||
      body.adConfig !== undefined
    ) {
      const currentAd = await getRewardAdConfig();
      const merged = {
        ...currentAd,
        ...(body.adConfig || {}),
        ...(body.adEnabled !== undefined ? { enabled: body.adEnabled } : {}),
        ...(body.provider !== undefined ? { provider: body.provider } : {}),
        ...(body.creditsPerAd !== undefined
          ? { creditsPerAd: body.creditsPerAd }
          : {}),
        ...(body.maxAdsPerDay !== undefined
          ? { maxAdsPerDay: body.maxAdsPerDay }
          : {}),
        ...(body.minWatchSeconds !== undefined
          ? { minWatchSeconds: body.minWatchSeconds }
          : {}),
        ...(body.sessionExpiresMinutes !== undefined
          ? { sessionExpiresMinutes: body.sessionExpiresMinutes }
          : {}),
        ...(body.cooldownSeconds !== undefined
          ? { cooldownSeconds: body.cooldownSeconds }
          : {}),
        ...(body.admobAppId !== undefined ? { admobAppId: body.admobAppId } : {}),
        ...(body.admobAdUnitId !== undefined
          ? { admobAdUnitId: body.admobAdUnitId }
          : {}),
      };
      adConfig = await saveRewardAdConfig(adConfigSchema.parse(merged));
    }

    const missionUpdates = missionPatchSchema.parse(body).missions;
    if (missionUpdates?.length) {
      for (const m of missionUpdates) {
        const { slug, ...data } = m;
        await prisma.rewardMission.update({
          where: { slug },
          data,
        });
      }
    }

    const missions = await prisma.rewardMission.findMany({
      orderBy: [{ sortOrder: "asc" }],
    });

    return NextResponse.json({
      config: config || (await getRewardConfig()),
      adConfig: adConfig || (await getRewardAdConfig()),
      ssvCallbackUrl: buildSsvCallbackUrl(),
      missions,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
