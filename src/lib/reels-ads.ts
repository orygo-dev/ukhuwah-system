import { prisma } from "@/lib/prisma";
import {
  DEFAULT_REELS_ADS_CONFIG,
  REELS_ADS_KEY,
  activeReelsAds,
  normalizeReelsAdsConfig,
  type ReelsAdsConfig,
} from "@/lib/reels-ads.shared";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

export {
  REELS_ADS_KEY,
  DEFAULT_REELS_ADS_CONFIG,
  activeReelsAds,
  buildSpotlightFeedWithAds,
  createReelsAd,
  getGoogleAdmobAdUnit,
  getStudentGoogleAdmobPlacements,
  isGoogleAdmobAdUnitId,
  isGoogleAdmobAppId,
  isGoogleAdmobConfigurationReady,
  isGoogleAdmobReady,
  isGoogleAdsenseReady,
  normalizeEveryNPosts,
  normalizeReelsAdsConfig,
} from "@/lib/reels-ads.shared";

export type {
  GoogleAdmobConfig,
  StudentGoogleAdmobPlacements,
  GoogleAdsenseConfig,
  ReelsAd,
  ReelsAdsConfig,
  ReelsAdMediaType,
  ReelsAdsProvider,
} from "@/lib/reels-ads.shared";

function normalizeConfig(raw: unknown): ReelsAdsConfig {
  const config = normalizeReelsAdsConfig(raw);
  return {
    ...config,
    googleAdsense: { ...config.googleAdsense },
    googleAdmob: { ...config.googleAdmob },
    ads: config.ads.map((ad) => ({
      ...ad,
      mediaUrl: toSameOriginUploadUrl(ad.mediaUrl),
    })),
  };
}

let cache: { value: ReelsAdsConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function invalidateReelsAdsCache() {
  cache = null;
}

export async function getReelsAdsConfig(): Promise<ReelsAdsConfig> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: REELS_ADS_KEY },
      select: { value: true },
    });
    const value = normalizeConfig(row?.value);
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    return DEFAULT_REELS_ADS_CONFIG;
  }
}

export async function saveReelsAdsConfig(config: ReelsAdsConfig): Promise<ReelsAdsConfig> {
  const normalized = normalizeConfig(config);
  await prisma.platformSetting.upsert({
    where: { key: REELS_ADS_KEY },
    create: { key: REELS_ADS_KEY, value: normalized as object },
    update: { value: normalized as object },
  });
  cache = { value: normalized, expiresAt: Date.now() + CACHE_TTL_MS };
  return normalized;
}

export async function getPublicReelsAdsPayload() {
  const config = await getReelsAdsConfig();
  return {
    enabled: config.enabled,
    provider: config.provider,
    everyNPosts: config.everyNPosts,
    googleAdsense:
      config.provider === "google-adsense"
        ? {
            publisherId: config.googleAdsense.publisherId,
            slotId: config.googleAdsense.slotId,
            ageTreatment: config.googleAdsense.ageTreatment,
            policyConfirmed: true,
          }
        : null,
    ads: activeReelsAds(config).map((ad) => ({
      id: ad.id,
      type: ad.type,
      mediaUrl: toSameOriginUploadUrl(ad.mediaUrl),
      title: ad.title,
      caption: ad.caption,
      linkUrl: ad.linkUrl,
      ctaLabel: ad.ctaLabel,
    })),
  };
}

export async function trackReelsAdEvent(adId: string, event: "impression" | "click") {
  const config = await getReelsAdsConfig();
  const index = config.ads.findIndex((ad) => ad.id === adId);
  if (index < 0) return null;
  const ads = [...config.ads];
  const current = ads[index];
  ads[index] = {
    ...current,
    impressionCount:
      event === "impression" ? current.impressionCount + 1 : current.impressionCount,
    clickCount: event === "click" ? current.clickCount + 1 : current.clickCount,
  };
  return saveReelsAdsConfig({ ...config, ads });
}
