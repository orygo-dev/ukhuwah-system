import { isAllowedUploadUrl } from "@/lib/upload-url";

const BLOCKED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "tiktok.com",
  "www.tiktok.com",
];

/** Max final clip length for student Spotlight submissions (WhatsApp-status style). */
export const STUDENT_SPOTLIGHT_MAX_SECONDS = 60;

const SPOTLIGHT_MEDIA_EXT = [
  ".mp4",
  ".webm",
  ".mov",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];
const SPOTLIGHT_VIDEO_EXT = [".mp4", ".webm", ".mov"];

export function isUploadedSpotlightPath(value: string): boolean {
  return isAllowedUploadUrl(value, "spotlight", {
    extensions: SPOTLIGHT_MEDIA_EXT,
  });
}

export function isUploadedSpotlightVideoPath(value: string): boolean {
  return isAllowedUploadUrl(value, "spotlight", {
    extensions: SPOTLIGHT_VIDEO_EXT,
  });
}

export function isDirectVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return false;
    }
    const pathName = parsed.pathname.toLowerCase();
    return (
      pathName.endsWith(".mp4") ||
      pathName.endsWith(".webm") ||
      pathName.endsWith(".mov") ||
      pathName.includes("/video") ||
      host.includes("commondatastorage.googleapis.com") ||
      pathName.startsWith("/uploads/spotlight/")
    );
  } catch {
    return false;
  }
}

export function videoUrlHint(): string {
  return "Gunakan URL video langsung (MP4/WebM), bukan link YouTube, Instagram, atau TikTok.";
}

export function studentSpotlightVideoHint(): string {
  return "Unggah gambar atau video singkat (maks. 60 detik). Video lebih panjang dapat dipotong seperti status WhatsApp.";
}
