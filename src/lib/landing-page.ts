import { prisma } from "@/lib/prisma";
import { cache } from "react";
import { APP_DISPLAY_KEY } from "./app-display.shared";
import { landingBrand } from "./landing-experience";
import {
  DEFAULT_LANDING_PAGE,
  LANDING_PAGE_KEY,
  normalizeLandingPage,
  type LandingPageConfig,
} from "./landing-page.shared";
export * from "./landing-page.shared";

/** Read the existing Super Admin branding without changing app-wide defaults or settings. */
export const getLandingBranding = cache(async () => {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: APP_DISPLAY_KEY },
    });
    const value = row?.value as {
      branding?: { appName?: unknown; logoUrl?: unknown };
    } | null;
    return landingBrand({
      appName:
        typeof value?.branding?.appName === "string"
          ? value.branding.appName
          : undefined,
      logoUrl:
        typeof value?.branding?.logoUrl === "string"
          ? value.branding.logoUrl
          : undefined,
    });
  } catch {
    return landingBrand();
  }
});

let landingCache: { value: LandingPageConfig; expiresAt: number } | null = null;
let landingCacheRevision = 0;
const LANDING_CACHE_TTL_MS = 60_000;

export async function getLandingPageConfig(): Promise<LandingPageConfig> {
  const now = Date.now();
  const revision = landingCacheRevision;
  if (landingCache && landingCache.expiresAt > now) {
    return landingCache.value;
  }

  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: LANDING_PAGE_KEY },
    });
    const value = row?.value
      ? normalizeLandingPage(row.value)
      : DEFAULT_LANDING_PAGE;
    // A read started before a completed save must not restore stale copy.
    if (revision !== landingCacheRevision && landingCache)
      return landingCache.value;
    landingCache = { value, expiresAt: now + LANDING_CACHE_TTL_MS };
    return value;
  } catch {
    if (revision !== landingCacheRevision && landingCache)
      return landingCache.value;
    return DEFAULT_LANDING_PAGE;
  }
}

export async function saveLandingPageConfig(
  config: LandingPageConfig,
): Promise<LandingPageConfig> {
  await prisma.platformSetting.upsert({
    where: { key: LANDING_PAGE_KEY },
    create: { key: LANDING_PAGE_KEY, value: config as object },
    update: { value: config as object },
  });
  landingCacheRevision += 1;
  landingCache = {
    value: config,
    expiresAt: Date.now() + LANDING_CACHE_TTL_MS,
  };
  return config;
}
