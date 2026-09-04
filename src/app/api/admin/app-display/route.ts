import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  DEFAULT_APP_DISPLAY,
  getAppDisplayConfig,
  LOCKED_SPLASH,
  mergeAppDisplay,
  saveAppDisplayConfig,
  type AppDisplayConfig,
} from "@/lib/app-display";
import { deleteLocalUploadByUrl } from "@/lib/media-upload";

export const runtime = "nodejs";

const safeOptionalLinkSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      !value ||
      value.startsWith("/") ||
      value.startsWith("#") ||
      /^https?:\/\//i.test(value) ||
      /^mailto:/i.test(value),
    "Link harus berupa path internal, anchor, http(s), atau mailto"
  )
  .optional();

const mediaSlideSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum(["image", "video"]),
  mediaUrl: z.string().trim().max(1000),
  linkUrl: safeOptionalLinkSchema,
  title: z.string().trim().max(120).optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

const quickMenuIconUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    if (!value) return true;
    try {
      const path = value.startsWith("/") ? value : new URL(value).pathname;
      return path.startsWith("/uploads/app-display/quick-menu-icon/");
    } catch {
      return false;
    }
  }, "Ikon menu harus berasal dari upload resmi aplikasi");

const appDisplaySchema = z.object({
  branding: z.object({
    appName: z.string().trim().min(1).max(80),
    logoUrl: z.string().trim().max(1000),
    authLogoUrl: z.string().trim().max(1000),
    loginTagline: z.string().max(500),
    loginSubtitle: z.string().max(1000),
  }),
  banners: z.object({
    enabled: z.boolean(),
    autoPlayMs: z.number().int().min(2000).max(60000),
    slides: z.array(mediaSlideSchema).max(20),
  }),
  desktopBanners: z.object({
    enabled: z.boolean(),
    autoPlayMs: z.number().int().min(2000).max(60000),
    slides: z.array(mediaSlideSchema).max(20),
  }),
  popup: z.object({
    enabled: z.boolean(),
    revision: z.string().trim().min(1).max(120).default("legacy"),
    slides: z.array(mediaSlideSchema).max(10),
  }),
  splash: z.object({
    enabled: z.boolean(),
    logoUrl: z.string().trim().max(1000),
    backgroundUrl: z.string().trim().max(1000),
    durationMs: z.number().int().min(500).max(10000),
  }),
  quickMenuIcons: z.object({
    revision: z.string().trim().min(1).max(120).default("initial"),
    icons: z.object({
      attendance: quickMenuIconUrlSchema,
      assignments: quickMenuIconUrlSchema,
      quiz: quickMenuIconUrlSchema,
      pjj: quickMenuIconUrlSchema,
      tka: quickMenuIconUrlSchema,
      reading: quickMenuIconUrlSchema,
      creations: quickMenuIconUrlSchema,
      board: quickMenuIconUrlSchema,
    }),
  }),
});

function refreshPopupRevision(
  current: AppDisplayConfig,
  next: AppDisplayConfig
): AppDisplayConfig {
  const currentCampaign = JSON.stringify({
    enabled: current.popup.enabled,
    slides: current.popup.slides,
  });
  const nextCampaign = JSON.stringify({
    enabled: next.popup.enabled,
    slides: next.popup.slides,
  });

  if (currentCampaign === nextCampaign) return next;

  return {
    ...next,
    popup: {
      ...next.popup,
      revision: randomUUID(),
    },
  };
}

function refreshQuickMenuRevision(
  current: AppDisplayConfig,
  next: AppDisplayConfig
): AppDisplayConfig {
  if (
    JSON.stringify(current.quickMenuIcons.icons) ===
    JSON.stringify(next.quickMenuIcons.icons)
  ) {
    return next;
  }
  return {
    ...next,
    quickMenuIcons: {
      ...next.quickMenuIcons,
      revision: randomUUID(),
    },
  };
}

async function cleanupRemovedUploads(
  previous: AppDisplayConfig,
  next: AppDisplayConfig
) {
  const previousUrls = new Set<string>();
  const nextUrls = new Set<string>();

  const collect = (config: AppDisplayConfig, target: Set<string>) => {
    if (config.branding.logoUrl) target.add(config.branding.logoUrl);
    if (config.branding.authLogoUrl) target.add(config.branding.authLogoUrl);
    if (config.splash.logoUrl) target.add(config.splash.logoUrl);
    if (config.splash.backgroundUrl) target.add(config.splash.backgroundUrl);
    for (const url of Object.values(config.quickMenuIcons.icons)) {
      if (url) target.add(url);
    }
    for (const slide of [
      ...config.banners.slides,
      ...config.desktopBanners.slides,
      ...config.popup.slides,
    ]) {
      if (slide.type === "image" && slide.mediaUrl) {
        target.add(slide.mediaUrl);
      }
    }
  };

  collect(previous, previousUrls);
  collect(next, nextUrls);

  const removed = [...previousUrls].filter((url) => !nextUrls.has(url));
  await Promise.all(removed.map((url) => deleteLocalUploadByUrl(url)));
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const config = await getAppDisplayConfig();
    return NextResponse.json({ config, defaults: DEFAULT_APP_DISPLAY });
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
    const body = await req.json();

    if (body.action === "reset") {
      const current = await getAppDisplayConfig();
      const config = await saveAppDisplayConfig(DEFAULT_APP_DISPLAY);
      await cleanupRemovedUploads(current, config);
      return NextResponse.json({ config });
    }

    const current = await getAppDisplayConfig();
    const parsed = appDisplaySchema.parse(body) as AppDisplayConfig;
    const next = refreshQuickMenuRevision(
      current,
      refreshPopupRevision(current, {
        ...parsed,
        splash: LOCKED_SPLASH,
      })
    );
    const config = await saveAppDisplayConfig(next);
    await cleanupRemovedUploads(current, config);
    return NextResponse.json({ config });
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
    console.error("[app-display PATCH]", err);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const current = await getAppDisplayConfig();
    const merged = mergeAppDisplay(current, body.patch ?? body);
    const parsed = appDisplaySchema.parse(merged) as AppDisplayConfig;
    const next = refreshQuickMenuRevision(
      current,
      refreshPopupRevision(current, parsed)
    );
    const config = await saveAppDisplayConfig(next);
    await cleanupRemovedUploads(current, config);
    return NextResponse.json({ config });
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
