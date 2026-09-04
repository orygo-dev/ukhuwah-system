import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { readRequestJson } from "@/lib/http-json";
import { deleteLocalUploadByUrl } from "@/lib/media-upload";
import {
  DEFAULT_REELS_ADS_CONFIG,
  getReelsAdsConfig,
  isGoogleAdmobAdUnitId,
  isGoogleAdmobAppId,
  saveReelsAdsConfig,
  type GoogleAdmobConfig,
  type ReelsAdsConfig,
} from "@/lib/reels-ads";

export const runtime = "nodejs";

const adSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum(["image", "video"]),
  mediaUrl: z.string().trim().max(1000),
  title: z.string().trim().max(120).default(""),
  caption: z.string().trim().max(500).default(""),
  linkUrl: z
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
    .default(""),
  ctaLabel: z.string().trim().max(40).default("Pelajari"),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  impressionCount: z.number().int().min(0).optional(),
  clickCount: z.number().int().min(0).optional(),
});

const googleAdmobSchema = z.object({
  enabled: z.boolean().default(false),
  studentAndroidAdUnitId: z.string().trim().max(48).default(""),
  teacherAndroidAdUnitId: z.string().trim().max(48).default(""),
  studentMadingNativeAdUnitId: z.string().trim().max(48).default(""),
  studentReadingBannerAdUnitId: z.string().trim().max(48).default(""),
  studentMadingBannerAdUnitId: z.string().trim().max(48).default(""),
  studentAssignmentsBannerAdUnitId: z.string().trim().max(48).default(""),
  studentQuizBannerAdUnitId: z.string().trim().max(48).default(""),
  everyNPosts: z.number().int().min(3).max(20).default(6),
  madingEveryNPosts: z.number().int().min(4).max(20).default(5),
  ageTreatment: z.literal(2).default(2),
  policyConfirmed: z.boolean().default(false),
});

function validateGoogleAdmob(value: GoogleAdmobConfig, ctx: z.RefinementCtx) {
  const units = [
    ["studentAndroidAdUnitId", value.studentAndroidAdUnitId],
    ["teacherAndroidAdUnitId", value.teacherAndroidAdUnitId],
    ["studentMadingNativeAdUnitId", value.studentMadingNativeAdUnitId],
    ["studentReadingBannerAdUnitId", value.studentReadingBannerAdUnitId],
    ["studentMadingBannerAdUnitId", value.studentMadingBannerAdUnitId],
    ["studentAssignmentsBannerAdUnitId", value.studentAssignmentsBannerAdUnitId],
    ["studentQuizBannerAdUnitId", value.studentQuizBannerAdUnitId],
  ] as const;
  for (const [field, unitId] of units) {
    if (!unitId || isGoogleAdmobAdUnitId(unitId)) continue;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: isGoogleAdmobAppId(unitId)
        ? "Ini App ID AdMob (menggunakan ~), bukan Ad Unit ID. Salin ID unit iklan yang menggunakan /."
        : "Ad Unit ID harus berformat ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY.",
    });
  }
  if (!value.enabled) return;
  if (!units.some(([, unitId]) => isGoogleAdmobAdUnitId(unitId))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["studentAndroidAdUnitId"],
      message: "Isi minimal satu Ad Unit ID sebelum mengaktifkan AdMob.",
    });
  }
  if (!value.policyConfirmed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["policyConfirmed"],
      message: "Konfirmasi kesiapan kebijakan Google sebelum mengaktifkan AdMob.",
    });
  }
}

const admobPatchSchema = z
  .object({
    action: z.literal("save-admob"),
    googleAdmob: googleAdmobSchema,
  })
  .superRefine((value, ctx) => validateGoogleAdmob(value.googleAdmob, ctx));

const configSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["platform", "google-adsense"]).default("platform"),
  everyNPosts: z.number().int().min(3).max(20),
  googleAdsense: z
    .object({
      publisherId: z.string().trim().max(32).default(""),
      slotId: z.string().trim().max(20).default(""),
      ageTreatment: z.literal(2).default(2),
      policyConfirmed: z.boolean().default(false),
    })
    .default({
      publisherId: "",
      slotId: "",
      ageTreatment: 2,
      policyConfirmed: false,
    }),
  googleAdmob: googleAdmobSchema
    .default({
      enabled: false,
      studentAndroidAdUnitId: "",
      teacherAndroidAdUnitId: "",
      studentMadingNativeAdUnitId: "",
      studentReadingBannerAdUnitId: "",
      studentMadingBannerAdUnitId: "",
      studentAssignmentsBannerAdUnitId: "",
      studentQuizBannerAdUnitId: "",
      everyNPosts: 6,
      madingEveryNPosts: 5,
      ageTreatment: 2,
      policyConfirmed: false,
    }),
  ads: z.array(adSchema).max(30),
}).superRefine((value, ctx) => {
  if (value.enabled && value.provider === "google-adsense") {
    if (!/^ca-pub-\d{16}$/.test(value.googleAdsense.publisherId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["googleAdsense", "publisherId"],
        message: "Publisher ID AdSense harus berformat ca-pub- diikuti 16 digit",
      });
    }
    if (!/^\d{5,20}$/.test(value.googleAdsense.slotId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["googleAdsense", "slotId"],
        message: "Ad Slot ID harus berisi 5–20 digit",
      });
    }
    if (!value.googleAdsense.policyConfirmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["googleAdsense", "policyConfirmed"],
        message: "Konfirmasi kesiapan kebijakan Google sebelum mengaktifkan AdSense",
      });
    }
  }
  const nestedIssues: z.ZodIssue[] = [];
  validateGoogleAdmob(value.googleAdmob, {
    addIssue: (issue) => nestedIssues.push(issue as z.ZodIssue),
    path: [],
  });
  for (const issue of nestedIssues) {
    ctx.addIssue({ ...issue, path: ["googleAdmob", ...issue.path] });
  }
});

async function cleanupRemoved(previous: ReelsAdsConfig, next: ReelsAdsConfig) {
  const prevUrls = new Set(
    previous.ads.filter((ad) => ad.type === "image" && ad.mediaUrl).map((ad) => ad.mediaUrl)
  );
  const nextUrls = new Set(
    next.ads.filter((ad) => ad.type === "image" && ad.mediaUrl).map((ad) => ad.mediaUrl)
  );
  const removed = [...prevUrls].filter((url) => !nextUrls.has(url));
  const results = await Promise.allSettled(
    removed.map((url) => deleteLocalUploadByUrl(url))
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    console.error(`[reels-ads cleanup] ${failed.length} upload gagal dibersihkan`);
  }
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const config = await getReelsAdsConfig();
    return NextResponse.json({ config, defaults: DEFAULT_REELS_ADS_CONFIG });
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
    const body = await readRequestJson(req);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Data pengaturan tidak valid." }, { status: 400 });
    }
    const current = await getReelsAdsConfig();

    if ("action" in body && body.action === "reset") {
      const config = await saveReelsAdsConfig(DEFAULT_REELS_ADS_CONFIG);
      await cleanupRemoved(current, config);
      return NextResponse.json({ config });
    }

    if ("action" in body && body.action === "save-admob") {
      const parsed = admobPatchSchema.parse(body);
      const config = await saveReelsAdsConfig({
        ...current,
        googleAdmob: parsed.googleAdmob,
      });
      return NextResponse.json({ config });
    }

    const parsed = configSchema.parse(body) as ReelsAdsConfig;
    const withCounters: ReelsAdsConfig = {
      ...parsed,
      ads: parsed.ads.map((ad) => {
        const existing = current.ads.find((item) => item.id === ad.id);
        return {
          ...ad,
          impressionCount: existing?.impressionCount ?? ad.impressionCount ?? 0,
          clickCount: existing?.clickCount ?? ad.clickCount ?? 0,
        };
      }),
    };
    const config = await saveReelsAdsConfig(withCounters);
    await cleanupRemoved(current, config);
    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: err.errors[0]?.message || "Data tidak valid",
          issues: err.errors.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
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
    console.error("[reels-ads PATCH]", err);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
