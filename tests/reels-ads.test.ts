import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

import {
  DEFAULT_REELS_ADS_CONFIG,
  buildSpotlightFeedWithAds,
  getGoogleAdmobAdUnit,
  getStudentGoogleAdmobPlacements,
  isGoogleAdmobAdUnitId,
  isGoogleAdmobAppId,
  isGoogleAdmobConfigurationReady,
  isGoogleAdmobReady,
  isGoogleAdsenseReady,
  normalizeReelsAdsConfig,
  type ReelsAdsConfig,
} from "../src/lib/reels-ads.shared";

const requireModule = createRequire(import.meta.url);

function load(file: string, mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports: Record<string, (...args: unknown[]) => unknown> = {};
  new Function("require", "exports", code)(
    (name: string) => (Object.hasOwn(mocks, name) ? mocks[name] : requireModule(name)),
    exports
  );
  return exports;
}

test("legacy platform ads remain backward compatible", () => {
  const config = normalizeReelsAdsConfig({
    enabled: true,
    everyNPosts: 3,
    ads: [
      {
        id: "legacy-ad",
        type: "image",
        mediaUrl: "/uploads/reels-ad/example.webp",
        title: "Promo",
        isActive: true,
        sortOrder: 0,
      },
    ],
  });

  assert.equal(config.provider, "platform");
  assert.equal(config.googleAdsense.ageTreatment, 2);
  assert.equal(config.ads.length, 1);
  assert.equal(config.ads[0]?.id, "legacy-ad");
});

test("Google AdSense configuration fails closed until every requirement is valid", () => {
  assert.equal(isGoogleAdsenseReady(DEFAULT_REELS_ADS_CONFIG.googleAdsense), false);
  assert.equal(
    isGoogleAdsenseReady({
      publisherId: "ca-pub-1234567890123456",
      slotId: "1234567890",
      ageTreatment: 2,
      policyConfirmed: true,
    }),
    true
  );

  for (const unsafe of [
    { publisherId: "pub-123", slotId: "1234567890" },
    { publisherId: "ca-pub-1234567890123456", slotId: "slot<script>" },
    { publisherId: "ca-pub-1234567890123456", slotId: "1234567890", policyConfirmed: false },
  ]) {
    const config = normalizeReelsAdsConfig({
      enabled: true,
      provider: "google-adsense",
      everyNPosts: 3,
      googleAdsense: unsafe,
    });
    assert.equal(config.enabled, false);
  }
});

test("Google AdMob configuration is independent and fails closed", () => {
  const webOnly = normalizeReelsAdsConfig({
    enabled: true,
    provider: "google-adsense",
    everyNPosts: 3,
    googleAdsense: {
      publisherId: "ca-pub-1234567890123456",
      slotId: "1234567890",
      policyConfirmed: true,
    },
  });
  assert.equal(webOnly.enabled, true);
  assert.equal(webOnly.googleAdmob.enabled, false);

  const mobile = normalizeReelsAdsConfig({
    googleAdmob: {
      enabled: true,
      androidAdUnitId: "ca-app-pub-1234567890123456/1234567890",
      everyNPosts: 4,
      policyConfirmed: true,
    },
  });
  assert.equal(mobile.enabled, false);
  assert.equal(isGoogleAdmobReady(mobile.googleAdmob), true);
  assert.equal(isGoogleAdmobConfigurationReady(mobile.googleAdmob), true);
  assert.equal(
    isGoogleAdmobAppId("ca-app-pub-1234567890123456~1234567890"),
    true
  );
  assert.equal(
    isGoogleAdmobAdUnitId("ca-app-pub-1234567890123456/1234567890"),
    true
  );
  assert.equal(mobile.googleAdmob.everyNPosts, 4);
  assert.equal(mobile.googleAdmob.ageTreatment, 2);
  assert.equal(
    mobile.googleAdmob.studentAndroidAdUnitId,
    "ca-app-pub-1234567890123456/1234567890"
  );
  assert.equal(
    mobile.googleAdmob.teacherAndroidAdUnitId,
    "ca-app-pub-1234567890123456/1234567890"
  );

  for (const unsafeId of ["", "ca-pub-123", "ca-app-pub-123/456"]) {
    const unsafe = normalizeReelsAdsConfig({
      googleAdmob: {
        enabled: true,
        androidAdUnitId: unsafeId,
        policyConfirmed: true,
      },
    });
    assert.equal(unsafe.googleAdmob.enabled, false);
  }
});

test("Google ad units are inserted deterministically without replacing organic posts", () => {
  const config = normalizeReelsAdsConfig({
    enabled: true,
    provider: "google-adsense",
    everyNPosts: 3,
    googleAdsense: {
      publisherId: "ca-pub-1234567890123456",
      slotId: "1234567890",
      policyConfirmed: true,
    },
  });
  const posts = Array.from({ length: 7 }, (_, index) => ({ id: `post-${index + 1}` }));
  const items = buildSpotlightFeedWithAds(posts, config);

  assert.deepEqual(
    items.map((item) => item.kind),
    ["post", "post", "post", "google-ad", "post", "post", "post", "google-ad", "post"]
  );
  assert.deepEqual(
    items.filter((item) => item.kind === "post").map((item) => item.post.id),
    posts.map((post) => post.id)
  );
  assert.ok(items.every((item) => item.kind !== "google-ad" || item.config.ageTreatment === 2));
});

test("Google ad rendering uses teen treatment and never sends custom click or impression events", () => {
  const source = readFileSync("src/components/spotlight/spotlight-feed.tsx", "utf8");
  assert.match(source, /data-tag-for-age-treatment=\{2\}/);
  assert.match(source, /data-ad-client=\{config\.publisherId\}/);
  assert.match(source, /data-ad-slot=\{config\.slotId\}/);
  assert.match(source, /item\.kind === "google-ad"/);
  assert.doesNotMatch(source, /GoogleAdsenseSlide[\s\S]*onClick:/);
});

test("ads failure is isolated and feed requests clean up without pagination races", () => {
  const source = readFileSync("src/components/spotlight/spotlight-feed.tsx", "utf8");
  assert.match(source, /return \(\) => controller\.abort\(\)/);
  assert.match(source, /if \(!container \|\| !nextCursor \|\| loadingMoreRef\.current\) return/);
  assert.match(source, /loadingMoreRef\.current = true/);
  assert.match(source, /setLoadMoreError\("Gagal memuat Zona Kreasi lainnya\."\)/);
  assert.match(source, /onError=\{\(\) => setAdsScriptFailed\(true\)\}/);
  assert.doesNotMatch(source, /onError=\{\(\) => setLoadError\("Script Google AdSense/);
});

test("Super Admin API rejects unsafe Google activation before persistence", async () => {
  let saves = 0;
  const route = load("src/app/api/admin/reels-ads/route.ts", {
    "@/lib/auth": { requireSuperAdmin: async () => ({ id: "admin" }) },
    "@/lib/http-json": { readRequestJson: async (request: Request) => request.json() },
    "@/lib/media-upload": { deleteLocalUploadByUrl: async () => undefined },
    "@/lib/reels-ads": {
      DEFAULT_REELS_ADS_CONFIG,
      getReelsAdsConfig: async () => DEFAULT_REELS_ADS_CONFIG,
      isGoogleAdmobAdUnitId,
      isGoogleAdmobAppId,
      saveReelsAdsConfig: async (config: unknown) => {
        saves += 1;
        return config;
      },
    },
  });

  const response = (await route.PATCH(
    new Request("https://example.test/api/admin/reels-ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        provider: "google-adsense",
        everyNPosts: 3,
        googleAdsense: {
          publisherId: "javascript:alert(1)",
          slotId: "not-a-slot",
          ageTreatment: 2,
          policyConfirmed: false,
        },
        ads: [],
      }),
    })
  )) as Response;

  assert.equal(response.status, 400);
  assert.equal(saves, 0);
});

test("Super Admin API persists a valid teen-treated Google unit", async () => {
  let saved: unknown;
  const route = load("src/app/api/admin/reels-ads/route.ts", {
    "@/lib/auth": { requireSuperAdmin: async () => ({ id: "admin" }) },
    "@/lib/http-json": { readRequestJson: async (request: Request) => request.json() },
    "@/lib/media-upload": { deleteLocalUploadByUrl: async () => undefined },
    "@/lib/reels-ads": {
      DEFAULT_REELS_ADS_CONFIG,
      getReelsAdsConfig: async () => DEFAULT_REELS_ADS_CONFIG,
      isGoogleAdmobAdUnitId,
      isGoogleAdmobAppId,
      saveReelsAdsConfig: async (config: unknown) => {
        saved = config;
        return config;
      },
    },
  });
  const payload = {
    enabled: true,
    provider: "google-adsense",
    everyNPosts: 6,
    googleAdsense: {
      publisherId: "ca-pub-1234567890123456",
      slotId: "1234567890",
      ageTreatment: 2,
      policyConfirmed: true,
    },
    googleAdmob: {
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
    },
    ads: [],
  };

  const response = (await route.PATCH(
    new Request("https://example.test/api/admin/reels-ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  )) as Response;

  assert.equal(response.status, 200);
  assert.deepEqual(saved, payload);
});

test("Super Admin API validates and persists AdMob without enabling web ads", async () => {
  let saved: ReelsAdsConfig | undefined;
  const route = load("src/app/api/admin/reels-ads/route.ts", {
    "@/lib/auth": { requireSuperAdmin: async () => ({ id: "admin" }) },
    "@/lib/http-json": { readRequestJson: async (request: Request) => request.json() },
    "@/lib/media-upload": { deleteLocalUploadByUrl: async () => undefined },
    "@/lib/reels-ads": {
      DEFAULT_REELS_ADS_CONFIG,
      getReelsAdsConfig: async () => DEFAULT_REELS_ADS_CONFIG,
      isGoogleAdmobAdUnitId,
      isGoogleAdmobAppId,
      saveReelsAdsConfig: async (config: ReelsAdsConfig) => {
        saved = config;
        return config;
      },
    },
  });
  const payload = {
    ...DEFAULT_REELS_ADS_CONFIG,
    googleAdmob: {
      enabled: true,
      studentAndroidAdUnitId: "ca-app-pub-1234567890123456/1234567890",
      teacherAndroidAdUnitId: "",
      everyNPosts: 5,
      ageTreatment: 2,
      policyConfirmed: true,
    },
  };
  const response = (await route.PATCH(
    new Request("https://example.test/api/admin/reels-ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  )) as Response;

  assert.equal(response.status, 200);
  assert.equal(saved?.enabled, false);
  assert.equal(saved?.googleAdmob.enabled, true);

  const invalidResponse = (await route.PATCH(
    new Request("https://example.test/api/admin/reels-ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        googleAdmob: { ...payload.googleAdmob, studentAndroidAdUnitId: "invalid" },
      }),
    })
  )) as Response;
  assert.equal(invalidResponse.status, 400);
});

test("Super Admin dapat menyimpan AdMob terpisah dari konfigurasi web", async () => {
  const current: ReelsAdsConfig = {
    ...DEFAULT_REELS_ADS_CONFIG,
    enabled: true,
    provider: "google-adsense",
    googleAdsense: {
      ...DEFAULT_REELS_ADS_CONFIG.googleAdsense,
      publisherId: "belum-lengkap",
    },
  };
  let saved: ReelsAdsConfig | undefined;
  const route = load("src/app/api/admin/reels-ads/route.ts", {
    "@/lib/auth": { requireSuperAdmin: async () => ({ id: "admin" }) },
    "@/lib/http-json": { readRequestJson: async (request: Request) => request.json() },
    "@/lib/media-upload": { deleteLocalUploadByUrl: async () => undefined },
    "@/lib/reels-ads": {
      DEFAULT_REELS_ADS_CONFIG,
      getReelsAdsConfig: async () => current,
      isGoogleAdmobAdUnitId,
      isGoogleAdmobAppId,
      saveReelsAdsConfig: async (config: ReelsAdsConfig) => {
        saved = config;
        return config;
      },
    },
  });

  const response = (await route.PATCH(
    new Request("https://example.test/api/admin/reels-ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-admob",
        googleAdmob: {
          enabled: true,
          studentAndroidAdUnitId: "ca-app-pub-1234567890123456/1234567890",
          teacherAndroidAdUnitId: "",
          everyNPosts: 6,
          ageTreatment: 2,
          policyConfirmed: true,
        },
      }),
    })
  )) as Response;

  assert.equal(response.status, 200);
  assert.equal(saved?.googleAdsense.publisherId, "belum-lengkap");
  assert.equal(saved?.googleAdmob.enabled, true);

  const appIdResponse = (await route.PATCH(
    new Request("https://example.test/api/admin/reels-ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-admob",
        googleAdmob: {
          enabled: true,
          studentAndroidAdUnitId: "ca-app-pub-1234567890123456~1234567890",
          teacherAndroidAdUnitId: "",
          everyNPosts: 6,
          ageTreatment: 2,
          policyConfirmed: true,
        },
      }),
    })
  )) as Response;
  const error = (await appIdResponse.json()) as {
    issues: Array<{ message: string }>;
  };
  assert.equal(appIdResponse.status, 400);
  assert.match(error.issues[0]?.message ?? "", /App ID AdMob/);
});

test("mobile AdMob endpoint exposes only a ready unit to student and teacher roles", async () => {
  const ready = normalizeReelsAdsConfig({
    googleAdmob: {
      enabled: true,
      studentAndroidAdUnitId: "ca-app-pub-1234567890123456/1234567890",
      teacherAndroidAdUnitId: "ca-app-pub-1234567890123456/0987654321",
      everyNPosts: 5,
      policyConfirmed: true,
    },
  });
  let role = "STUDENT";
  const route = load("src/app/api/mobile/v1/spotlight/reels-ads/route.ts", {
    "@/lib/auth": { auth: async () => ({ user: { id: "user-1", role } }) },
    "@/lib/mobile-api": {
      mobileUnauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
      mobileForbidden: () => Response.json({ error: "Forbidden" }, { status: 403 }),
    },
    "@/lib/reels-ads": {
      getReelsAdsConfig: async () => ready,
      getGoogleAdmobAdUnit,
    },
  });

  const studentResponse = (await route.GET()) as Response;
  assert.equal(studentResponse.status, 200);
  assert.deepEqual(await studentResponse.json(), {
    enabled: true,
    androidAdUnitId: "ca-app-pub-1234567890123456/1234567890",
    everyNPosts: 5,
    ageTreatment: 2,
  });

  role = "TEACHER";
  const teacherResponse = (await route.GET()) as Response;
  assert.equal(teacherResponse.status, 200);
  assert.equal(
    ((await teacherResponse.json()) as { androidAdUnitId: string }).androidAdUnitId,
    "ca-app-pub-1234567890123456/0987654321"
  );

  role = "SCHOOL_ADMIN";
  assert.equal(((await route.GET()) as Response).status, 403);
});

test("mobile ads endpoint exposes placement-specific student units and no secrets", async () => {
  const ready = normalizeReelsAdsConfig({
    googleAdmob: {
      enabled: true,
      studentAndroidAdUnitId: "ca-app-pub-1234567890123456/1000000001",
      studentMadingNativeAdUnitId: "ca-app-pub-1234567890123456/1000000002",
      studentReadingBannerAdUnitId: "ca-app-pub-1234567890123456/1000000003",
      studentMadingBannerAdUnitId: "ca-app-pub-1234567890123456/1000000004",
      studentAssignmentsBannerAdUnitId: "ca-app-pub-1234567890123456/1000000005",
      studentQuizBannerAdUnitId: "ca-app-pub-1234567890123456/1000000006",
      madingEveryNPosts: 5,
      policyConfirmed: true,
    },
  });
  const route = load("src/app/api/mobile/v1/ads/route.ts", {
    "@/lib/auth": { auth: async () => ({ user: { id: "student-1", role: "STUDENT" } }) },
    "@/lib/mobile-api": {
      mobileUnauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
      mobileForbidden: () => Response.json({ error: "Forbidden" }, { status: 403 }),
    },
    "@/lib/reels-ads": {
      getReelsAdsConfig: async () => ready,
      getStudentGoogleAdmobPlacements,
      isGoogleAdmobReady,
    },
  });

  const response = (await route.GET()) as Response;
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal(payload.enabled, true);
  assert.equal(payload.ageTreatment, 2);
  assert.equal(payload.madingEveryNPosts, 5);
  assert.deepEqual(payload.student, {
    spotlightNative: "ca-app-pub-1234567890123456/1000000001",
    madingNative: "ca-app-pub-1234567890123456/1000000002",
    readingBanner: "ca-app-pub-1234567890123456/1000000003",
    madingBanner: "ca-app-pub-1234567890123456/1000000004",
    assignmentsBanner: "ca-app-pub-1234567890123456/1000000005",
    quizBanner: "ca-app-pub-1234567890123456/1000000006",
  });
  assert.equal(JSON.stringify(payload).includes("App ID"), false);
});
