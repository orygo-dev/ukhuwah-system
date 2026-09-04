export const REELS_ADS_KEY = "spotlight_reels_ads";
export const GOOGLE_ADSENSE_AGE_TREATMENT = 2 as const;

export type ReelsAdMediaType = "image" | "video";
export type ReelsAdsProvider = "platform" | "google-adsense";

export type GoogleAdsenseConfig = {
  publisherId: string;
  slotId: string;
  /** Google TFAT=2: teen treatment, personalization and remarketing disabled. */
  ageTreatment: typeof GOOGLE_ADSENSE_AGE_TREATMENT;
  /** Explicit operational acknowledgement; this is not a substitute for Google approval/CMP. */
  policyConfirmed: boolean;
};

export type GoogleAdmobConfig = {
  enabled: boolean;
  /** Native ad units per Android package. App IDs remain build-time settings. */
  studentAndroidAdUnitId: string;
  teacherAndroidAdUnitId: string;
  /** Optional dedicated Native unit for the student Mading preview feed. */
  studentMadingNativeAdUnitId: string;
  /** Banner units are separate so AdMob reports each placement independently. */
  studentReadingBannerAdUnitId: string;
  studentMadingBannerAdUnitId: string;
  studentAssignmentsBannerAdUnitId: string;
  studentQuizBannerAdUnitId: string;
  everyNPosts: number;
  madingEveryNPosts: number;
  /** Google TFAT=2: teen treatment, personalization and remarketing disabled. */
  ageTreatment: typeof GOOGLE_ADSENSE_AGE_TREATMENT;
  policyConfirmed: boolean;
};

export type ReelsAd = {
  id: string;
  type: ReelsAdMediaType;
  mediaUrl: string;
  title: string;
  caption: string;
  linkUrl: string;
  ctaLabel: string;
  isActive: boolean;
  sortOrder: number;
  impressionCount: number;
  clickCount: number;
};

export type ReelsAdsConfig = {
  enabled: boolean;
  provider: ReelsAdsProvider;
  /** Sisipkan 1 iklan setelah setiap N spotlight organik (min 3). */
  everyNPosts: number;
  googleAdsense: GoogleAdsenseConfig;
  googleAdmob: GoogleAdmobConfig;
  ads: ReelsAd[];
};

export const DEFAULT_REELS_ADS_CONFIG: ReelsAdsConfig = {
  enabled: false,
  provider: "platform",
  everyNPosts: 6,
  googleAdsense: {
    publisherId: "",
    slotId: "",
    ageTreatment: GOOGLE_ADSENSE_AGE_TREATMENT,
    policyConfirmed: false,
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
    ageTreatment: GOOGLE_ADSENSE_AGE_TREATMENT,
    policyConfirmed: false,
  },
  ads: [],
};

const ADSENSE_PUBLISHER_ID = /^ca-pub-\d{16}$/;
const ADSENSE_SLOT_ID = /^\d{5,20}$/;
const ADMOB_ANDROID_AD_UNIT_ID = /^ca-app-pub-\d{16}\/\d{10}$/;
const ADMOB_ANDROID_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isGoogleAdsenseReady(config: GoogleAdsenseConfig): boolean {
  return (
    ADSENSE_PUBLISHER_ID.test(config.publisherId) &&
    ADSENSE_SLOT_ID.test(config.slotId) &&
    config.ageTreatment === GOOGLE_ADSENSE_AGE_TREATMENT &&
    config.policyConfirmed
  );
}

export function isGoogleAdmobAdUnitId(value: string): boolean {
  return ADMOB_ANDROID_AD_UNIT_ID.test(value.trim());
}

export function isGoogleAdmobAppId(value: string): boolean {
  return ADMOB_ANDROID_APP_ID.test(value.trim());
}

/** Validates the editable values without requiring the activation switch. */
export function isGoogleAdmobConfigurationReady(config: GoogleAdmobConfig): boolean {
  const units = [
    config.studentAndroidAdUnitId,
    config.teacherAndroidAdUnitId,
    config.studentMadingNativeAdUnitId,
    config.studentReadingBannerAdUnitId,
    config.studentMadingBannerAdUnitId,
    config.studentAssignmentsBannerAdUnitId,
    config.studentQuizBannerAdUnitId,
  ];
  return (
    units.some(isGoogleAdmobAdUnitId) &&
    config.everyNPosts >= 3 &&
    config.everyNPosts <= 20 &&
    config.madingEveryNPosts >= 4 &&
    config.madingEveryNPosts <= 20 &&
    config.ageTreatment === GOOGLE_ADSENSE_AGE_TREATMENT &&
    config.policyConfirmed
  );
}

export function isGoogleAdmobReady(config: GoogleAdmobConfig): boolean {
  return config.enabled && isGoogleAdmobConfigurationReady(config);
}

export function getGoogleAdmobAdUnit(
  config: GoogleAdmobConfig,
  audience: "student" | "teacher"
): string {
  if (!isGoogleAdmobReady(config)) return "";
  const value =
    audience === "student" ? config.studentAndroidAdUnitId : config.teacherAndroidAdUnitId;
  return isGoogleAdmobAdUnitId(value) ? value : "";
}

export type StudentGoogleAdmobPlacements = {
  spotlightNative: string;
  madingNative: string;
  readingBanner: string;
  madingBanner: string;
  assignmentsBanner: string;
  quizBanner: string;
};

export function getStudentGoogleAdmobPlacements(
  config: GoogleAdmobConfig
): StudentGoogleAdmobPlacements {
  const empty: StudentGoogleAdmobPlacements = {
    spotlightNative: "",
    madingNative: "",
    readingBanner: "",
    madingBanner: "",
    assignmentsBanner: "",
    quizBanner: "",
  };
  if (!isGoogleAdmobReady(config)) return empty;
  const valid = (value: string) => (isGoogleAdmobAdUnitId(value) ? value : "");
  const spotlightNative = valid(config.studentAndroidAdUnitId);
  return {
    spotlightNative,
    // Keep existing installations useful while allowing a dedicated reporting unit.
    madingNative: valid(config.studentMadingNativeAdUnitId) || spotlightNative,
    readingBanner: valid(config.studentReadingBannerAdUnitId),
    madingBanner: valid(config.studentMadingBannerAdUnitId),
    assignmentsBanner: valid(config.studentAssignmentsBannerAdUnitId),
    quizBanner: valid(config.studentQuizBannerAdUnitId),
  };
}

export function createReelsAd(partial?: Partial<ReelsAd>): ReelsAd {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ad-${Date.now()}`,
    type: "image",
    mediaUrl: "",
    title: "",
    caption: "",
    linkUrl: "",
    ctaLabel: "Pelajari",
    isActive: true,
    sortOrder: 0,
    impressionCount: 0,
    clickCount: 0,
    ...partial,
  };
}

export function activeReelsAds(config: ReelsAdsConfig): ReelsAd[] {
  return [...config.ads]
    .filter((ad) => ad.isActive && ad.mediaUrl.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function normalizeEveryNPosts(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_REELS_ADS_CONFIG.everyNPosts;
  return Math.min(20, Math.max(3, Math.trunc(value)));
}

function normalizeAd(raw: unknown, index: number): ReelsAd | null {
  if (!isObject(raw)) return null;
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 120) : `ad-${index + 1}`,
    type: raw.type === "video" ? "video" : "image",
    mediaUrl: typeof raw.mediaUrl === "string" ? raw.mediaUrl.trim().slice(0, 1000) : "",
    title: typeof raw.title === "string" ? raw.title.trim().slice(0, 120) : "",
    caption: typeof raw.caption === "string" ? raw.caption.trim().slice(0, 500) : "",
    linkUrl: typeof raw.linkUrl === "string" ? raw.linkUrl.trim().slice(0, 500) : "",
    ctaLabel:
      typeof raw.ctaLabel === "string" && raw.ctaLabel.trim()
        ? raw.ctaLabel.trim().slice(0, 40)
        : "Pelajari",
    isActive: raw.isActive !== false,
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Math.trunc(Number(raw.sortOrder)) : index,
    impressionCount: Math.max(0, Math.trunc(Number(raw.impressionCount) || 0)),
    clickCount: Math.max(0, Math.trunc(Number(raw.clickCount) || 0)),
  };
}

/** Pure, backward-compatible normalization used by server reads and deterministic tests. */
export function normalizeReelsAdsConfig(raw: unknown): ReelsAdsConfig {
  if (!isObject(raw)) {
    return {
      ...DEFAULT_REELS_ADS_CONFIG,
      googleAdsense: { ...DEFAULT_REELS_ADS_CONFIG.googleAdsense },
      googleAdmob: { ...DEFAULT_REELS_ADS_CONFIG.googleAdmob },
      ads: [],
    };
  }

  const provider: ReelsAdsProvider =
    raw.provider === "google-adsense" ? "google-adsense" : "platform";
  const rawGoogle = isObject(raw.googleAdsense) ? raw.googleAdsense : {};
  const googleAdsense: GoogleAdsenseConfig = {
    publisherId:
      typeof rawGoogle.publisherId === "string" ? rawGoogle.publisherId.trim() : "",
    slotId: typeof rawGoogle.slotId === "string" ? rawGoogle.slotId.trim() : "",
    ageTreatment: GOOGLE_ADSENSE_AGE_TREATMENT,
    policyConfirmed: rawGoogle.policyConfirmed === true,
  };
  const rawAdmob = isObject(raw.googleAdmob) ? raw.googleAdmob : {};
  const legacyAdUnitId =
    typeof rawAdmob.androidAdUnitId === "string" ? rawAdmob.androidAdUnitId.trim() : "";
  const googleAdmob: GoogleAdmobConfig = {
    enabled: rawAdmob.enabled === true,
    studentAndroidAdUnitId:
      typeof rawAdmob.studentAndroidAdUnitId === "string"
        ? rawAdmob.studentAndroidAdUnitId.trim()
        : legacyAdUnitId,
    teacherAndroidAdUnitId:
      typeof rawAdmob.teacherAndroidAdUnitId === "string"
        ? rawAdmob.teacherAndroidAdUnitId.trim()
        : legacyAdUnitId,
    studentMadingNativeAdUnitId:
      typeof rawAdmob.studentMadingNativeAdUnitId === "string"
        ? rawAdmob.studentMadingNativeAdUnitId.trim()
        : "",
    studentReadingBannerAdUnitId:
      typeof rawAdmob.studentReadingBannerAdUnitId === "string"
        ? rawAdmob.studentReadingBannerAdUnitId.trim()
        : "",
    studentMadingBannerAdUnitId:
      typeof rawAdmob.studentMadingBannerAdUnitId === "string"
        ? rawAdmob.studentMadingBannerAdUnitId.trim()
        : "",
    studentAssignmentsBannerAdUnitId:
      typeof rawAdmob.studentAssignmentsBannerAdUnitId === "string"
        ? rawAdmob.studentAssignmentsBannerAdUnitId.trim()
        : "",
    studentQuizBannerAdUnitId:
      typeof rawAdmob.studentQuizBannerAdUnitId === "string"
        ? rawAdmob.studentQuizBannerAdUnitId.trim()
        : "",
    everyNPosts: normalizeEveryNPosts(Number(rawAdmob.everyNPosts)),
    madingEveryNPosts: Math.min(
      20,
      Math.max(4, Math.trunc(Number(rawAdmob.madingEveryNPosts) || 5))
    ),
    ageTreatment: GOOGLE_ADSENSE_AGE_TREATMENT,
    policyConfirmed: rawAdmob.policyConfirmed === true,
  };
  if (!isGoogleAdmobReady(googleAdmob)) googleAdmob.enabled = false;
  const ads = Array.isArray(raw.ads)
    ? raw.ads
        .map((item, index) => normalizeAd(item, index))
        .filter((item): item is ReelsAd => Boolean(item))
        .slice(0, 30)
    : [];
  const requestedEnabled = raw.enabled === true;
  const providerReady =
    provider === "google-adsense"
      ? isGoogleAdsenseReady(googleAdsense)
      : activeReelsAds({
          enabled: requestedEnabled,
          provider,
          everyNPosts: normalizeEveryNPosts(Number(raw.everyNPosts)),
          googleAdsense,
          googleAdmob,
          ads,
        }).length > 0;

  return {
    enabled: requestedEnabled && providerReady,
    provider,
    everyNPosts: normalizeEveryNPosts(Number(raw.everyNPosts)),
    googleAdsense,
    googleAdmob,
    ads,
  };
}

export type SpotlightFeedPostItem = {
  kind: "post";
  id: string;
  post: unknown;
};

export type SpotlightFeedAdItem = {
  kind: "ad";
  id: string;
  ad: ReelsAd;
};

export type SpotlightFeedGoogleAdItem = {
  kind: "google-ad";
  id: string;
  config: GoogleAdsenseConfig;
};

export type SpotlightFeedItem =
  | SpotlightFeedPostItem
  | SpotlightFeedAdItem
  | SpotlightFeedGoogleAdItem;

/** Sisipkan iklan platform di antara reel organik. */
export function buildSpotlightFeedWithAds<T extends { id: string }>(
  posts: T[],
  config: ReelsAdsConfig
): Array<
  | { kind: "post"; id: string; post: T }
  | { kind: "ad"; id: string; ad: ReelsAd }
  | { kind: "google-ad"; id: string; config: GoogleAdsenseConfig }
> {
  const ads = activeReelsAds({
    ...config,
  });
  const everyN = normalizeEveryNPosts(config.everyNPosts);
  const googleReady =
    config.provider === "google-adsense" && isGoogleAdsenseReady(config.googleAdsense);

  if (
    !config.enabled ||
    posts.length === 0 ||
    (config.provider === "platform" && ads.length === 0) ||
    (config.provider === "google-adsense" && !googleReady)
  ) {
    return posts.map((post) => ({ kind: "post" as const, id: `post:${post.id}`, post }));
  }

  const items: Array<
    | { kind: "post"; id: string; post: T }
    | { kind: "ad"; id: string; ad: ReelsAd }
    | { kind: "google-ad"; id: string; config: GoogleAdsenseConfig }
  > = [];
  let adCursor = 0;

  posts.forEach((post, index) => {
    items.push({ kind: "post", id: `post:${post.id}`, post });
    if ((index + 1) % everyN === 0) {
      if (config.provider === "google-adsense") {
        items.push({
          kind: "google-ad",
          id: `google-ad:${index}`,
          config: config.googleAdsense,
        });
        return;
      }
      const ad = ads[adCursor % ads.length];
      items.push({
        kind: "ad",
        id: `ad:${ad.id}:${Math.floor(adCursor / ads.length)}:${index}`,
        ad,
      });
      adCursor += 1;
    }
  });

  return items;
}
