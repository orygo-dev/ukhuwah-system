import { APP_NAME, DEFAULT_BRAND_LOGO_URL, displayAppName } from "@/lib/constants";

export const APP_DISPLAY_KEY = "app_display";

export type MediaSlideType = "image" | "video";

export type MediaSlide = {
  id: string;
  type: MediaSlideType;
  mediaUrl: string;
  linkUrl?: string;
  title?: string;
  isActive: boolean;
  sortOrder: number;
};

export type AppBranding = {
  appName: string;
  logoUrl: string;
  authLogoUrl: string;
  loginTagline: string;
  loginSubtitle: string;
};

export type DashboardBannerConfig = {
  enabled: boolean;
  autoPlayMs: number;
  slides: MediaSlide[];
};

export type DashboardPopupConfig = {
  enabled: boolean;
  revision: string;
  slides: MediaSlide[];
};

export type SplashScreenConfig = {
  enabled: boolean;
  logoUrl: string;
  backgroundUrl: string;
  durationMs: number;
};

export const QUICK_MENU_ICON_KEYS = [
  "attendance",
  "assignments",
  "quiz",
  "pjj",
  "tka",
  "reading",
  "creations",
  "board",
] as const;

export type QuickMenuIconKey = (typeof QUICK_MENU_ICON_KEYS)[number];

export type QuickMenuIconConfig = {
  revision: string;
  icons: Record<QuickMenuIconKey, string>;
};

export type AppDisplayConfig = {
  branding: AppBranding;
  banners: DashboardBannerConfig;
  desktopBanners: DashboardBannerConfig;
  popup: DashboardPopupConfig;
  splash: SplashScreenConfig;
  quickMenuIcons: QuickMenuIconConfig;
};

export const LOCKED_SPLASH: SplashScreenConfig = {
  enabled: false,
  logoUrl: "",
  backgroundUrl: "",
  durationMs: 1000,
};

export const DEFAULT_APP_DISPLAY: AppDisplayConfig = {
  branding: {
    appName: APP_NAME,
    logoUrl: DEFAULT_BRAND_LOGO_URL,
    authLogoUrl: DEFAULT_BRAND_LOGO_URL,
    loginTagline: "Platform manajemen sekolah\nYayasan Ukhuwah Kalimantan Selatan.",
    loginSubtitle:
      "Guru, admin sekolah, siswa, dan orang tua Yayasan Ukhuwah memakai pintu masuk yang sama.",
  },
  banners: {
    enabled: false,
    autoPlayMs: 5000,
    slides: [],
  },
  desktopBanners: {
    enabled: false,
    autoPlayMs: 5000,
    slides: [],
  },
  popup: {
    enabled: false,
    revision: "initial",
    slides: [],
  },
  splash: LOCKED_SPLASH,
  quickMenuIcons: {
    revision: "initial",
    icons: {
      attendance: "",
      assignments: "",
      quiz: "",
      pjj: "",
      tka: "",
      reading: "",
      creations: "",
      board: "",
    },
  },
};

const PUBLIC_LOGIN_SUBTITLE_FALLBACK =
  "Guru, admin sekolah, siswa, dan super admin memakai pintu masuk yang sama.";

/** Removes legacy demo credentials before branding is returned publicly. */
export function sanitizePublicLoginSubtitle(value: string) {
  const clean = value
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/(?:demo guru|super admin|password|kata sandi).*(?:@|\/|:)|[\w.+-]+@[\w.-]+\s*\/\s*\S+/i.test(
          line,
        ),
    )
    .join("\n")
    .trim();
  return clean || PUBLIC_LOGIN_SUBTITLE_FALLBACK;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeDeep<T>(base: T, patch: unknown): T {
  if (!isObject(patch)) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const patchVal = patch[key];
    if (Array.isArray(patchVal)) {
      out[key] = patchVal;
    } else if (isObject(baseVal) && isObject(patchVal)) {
      out[key] = mergeDeep(baseVal, patchVal);
    } else if (patchVal !== undefined) {
      out[key] = patchVal;
    }
  }
  return out as T;
}

export function mergeAppDisplay(
  base: AppDisplayConfig,
  patch: unknown
): AppDisplayConfig {
  return mergeDeep(base, patch);
}

export function createMediaSlide(partial?: Partial<MediaSlide>): MediaSlide {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `slide-${Date.now()}`,
    type: "image",
    mediaUrl: "",
    linkUrl: "",
    title: "",
    isActive: true,
    sortOrder: 0,
    ...partial,
  };
}

export function activeSlides(slides: MediaSlide[]): MediaSlide[] {
  return [...slides]
    .filter((s) => s.isActive && s.mediaUrl.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Nyalakan master banner jika ada slide aktif berisi media (hindari lupa toggle). */
export function syncBannerEnabled(config: AppDisplayConfig): AppDisplayConfig {
  const hasDisplayable = config.banners.slides.some(
    (s) => s.isActive && s.mediaUrl.trim()
  );
  const hasDesktopDisplayable = config.desktopBanners.slides.some(
    (s) => s.isActive && s.mediaUrl.trim()
  );
  if (
    (!hasDisplayable || config.banners.enabled) &&
    (!hasDesktopDisplayable || config.desktopBanners.enabled)
  ) {
    return config;
  }
  return {
    ...config,
    banners: hasDisplayable
      ? { ...config.banners, enabled: true }
      : config.banners,
    desktopBanners: hasDesktopDisplayable
      ? { ...config.desktopBanners, enabled: true }
      : config.desktopBanners,
  };
}

export function shouldShowBanners(config: AppDisplayConfig): boolean {
  const synced = syncBannerEnabled(config);
  return synced.banners.enabled && activeSlides(synced.banners.slides).length > 0;
}

export function shouldShowDesktopBanners(config: AppDisplayConfig): boolean {
  const synced = syncBannerEnabled(config);
  return (
    synced.desktopBanners.enabled &&
    activeSlides(synced.desktopBanners.slides).length > 0
  );
}

export function resolveAppName(config: AppDisplayConfig): string {
  return displayAppName(config.branding.appName);
}
