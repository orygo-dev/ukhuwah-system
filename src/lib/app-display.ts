import { prisma } from "@/lib/prisma";
import { displayAppName, displayLogoUrl } from "@/lib/constants";
import {
  APP_DISPLAY_KEY,
  DEFAULT_APP_DISPLAY,
  LOCKED_SPLASH,
  mergeAppDisplay,
  sanitizePublicLoginSubtitle,
  syncBannerEnabled,
  type AppDisplayConfig,
} from "@/lib/app-display.shared";

export {
  APP_DISPLAY_KEY,
  DEFAULT_APP_DISPLAY,
  LOCKED_SPLASH,
  activeSlides,
  createMediaSlide,
  mergeAppDisplay,
  resolveAppName,
  shouldShowBanners,
  shouldShowDesktopBanners,
  syncBannerEnabled,
} from "@/lib/app-display.shared";

export type {
  AppBranding,
  AppDisplayConfig,
  DashboardBannerConfig,
  DashboardPopupConfig,
  SplashScreenConfig,
  QuickMenuIconConfig,
  QuickMenuIconKey,
  MediaSlide,
  MediaSlideType,
} from "@/lib/app-display.shared";

function withLockedSplash(config: AppDisplayConfig): AppDisplayConfig {
  return {
    ...config,
    branding: {
      ...config.branding,
      appName: displayAppName(config.branding.appName),
      logoUrl: displayLogoUrl(config.branding.logoUrl),
      authLogoUrl: displayLogoUrl(
        config.branding.authLogoUrl || config.branding.logoUrl,
      ),
      loginSubtitle: sanitizePublicLoginSubtitle(config.branding.loginSubtitle),
    },
    splash: LOCKED_SPLASH,
  };
}

let appDisplayCache: { value: AppDisplayConfig; expiresAt: number } | null = null;
const APP_DISPLAY_CACHE_TTL_MS = 60_000;

export async function getAppDisplayConfig(): Promise<AppDisplayConfig> {
  const now = Date.now();
  if (appDisplayCache && appDisplayCache.expiresAt > now) {
    return appDisplayCache.value;
  }

  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: APP_DISPLAY_KEY },
    });
    if (!row?.value) {
      const value = withLockedSplash(DEFAULT_APP_DISPLAY);
      appDisplayCache = {
        value,
        expiresAt: now + APP_DISPLAY_CACHE_TTL_MS,
      };
      return value;
    }
    const merged = mergeAppDisplay(DEFAULT_APP_DISPLAY, row.value);
    const synced = withLockedSplash(syncBannerEnabled(merged));
    if (synced.banners.enabled !== merged.banners.enabled) {
      await saveAppDisplayConfig(synced);
    }
    appDisplayCache = {
      value: synced,
      expiresAt: now + APP_DISPLAY_CACHE_TTL_MS,
    };
    return synced;
  } catch {
    return withLockedSplash(DEFAULT_APP_DISPLAY);
  }
}

export async function saveAppDisplayConfig(
  config: AppDisplayConfig
): Promise<AppDisplayConfig> {
  const synced = withLockedSplash(syncBannerEnabled(config));
  await prisma.platformSetting.upsert({
    where: { key: APP_DISPLAY_KEY },
    create: { key: APP_DISPLAY_KEY, value: synced as object },
    update: { value: synced as object },
  });
  appDisplayCache = {
    value: synced,
    expiresAt: Date.now() + APP_DISPLAY_CACHE_TTL_MS,
  };
  return synced;
}
