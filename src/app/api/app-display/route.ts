import { NextResponse } from "next/server";
import {
  activeSlides,
  getAppDisplayConfig,
  LOCKED_SPLASH,
  resolveAppName,
  syncBannerEnabled,
  type MediaSlide,
} from "@/lib/app-display";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

export const runtime = "nodejs";

function normalizeSlide(slide: MediaSlide): MediaSlide {
  return {
    ...slide,
    mediaUrl: toSameOriginUploadUrl(slide.mediaUrl),
  };
}

/** Public — branding, banner, popup untuk dashboard & login */
export async function GET() {
  try {
    const config = syncBannerEnabled(await getAppDisplayConfig());
    return NextResponse.json({
      branding: {
        appName: resolveAppName(config),
        logoUrl: toSameOriginUploadUrl(config.branding.logoUrl),
        authLogoUrl: toSameOriginUploadUrl(config.branding.authLogoUrl),
        loginTagline: config.branding.loginTagline,
        loginSubtitle: config.branding.loginSubtitle,
      },
      banners: {
        enabled: config.banners.enabled,
        autoPlayMs: config.banners.autoPlayMs,
        slides: activeSlides(config.banners.slides).map(normalizeSlide),
      },
      desktopBanners: {
        enabled: config.desktopBanners.enabled,
        autoPlayMs: config.desktopBanners.autoPlayMs,
        slides: activeSlides(config.desktopBanners.slides).map(normalizeSlide),
      },
      popup: {
        enabled: config.popup.enabled,
        revision: config.popup.revision,
        slides: activeSlides(config.popup.slides).map(normalizeSlide),
      },
      splash: LOCKED_SPLASH,
      quickMenuIcons: {
        revision: config.quickMenuIcons.revision,
        icons: Object.fromEntries(
          Object.entries(config.quickMenuIcons.icons).map(([key, value]) => [
            key,
            toSameOriginUploadUrl(value),
          ])
        ),
      },
    });
  } catch (err) {
    console.error("[app-display GET]", err);
    return NextResponse.json({ error: "Gagal memuat" }, { status: 500 });
  }
}
