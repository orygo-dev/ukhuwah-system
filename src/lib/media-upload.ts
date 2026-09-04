import { randomUUID } from "crypto";
import { deleteStoredObject, storeObject } from "@/lib/object-storage";
import { detectImageMime } from "@/lib/image-signature";

export const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type UploadKind =
  | "logo"
  | "auth-logo"
  | "banner"
  | "desktop-banner"
  | "popup"
  | "reels-ad"
  | "quick-menu-icon"
  | "splash-logo"
  | "splash-background";

export function extFromImageMime(mime: string): string {
  return MIME_EXT[mime] || "bin";
}

export async function saveAppDisplayImage(
  file: File,
  kind: UploadKind
): Promise<string> {
  if (!ALLOWED_IMAGE_MIME.has(file.type)) {
    throw new Error("Format gambar tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.");
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error("Ukuran gambar maksimal 5 MB.");
  }
  if (file.size === 0) {
    throw new Error("File gambar kosong.");
  }

  const ext = extFromImageMime(file.type);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (detectImageMime(buffer) !== file.type) {
    throw new Error("Isi file tidak cocok dengan format gambar yang dipilih.");
  }

  const stored = await storeObject({
    folder: `app-display/${kind}`,
    extension: ext,
    bytes: buffer,
    contentType: file.type,
    filename: `${randomUUID()}.${ext}`,
  });
  // Always expose a same-origin path for admin preview / popup rendering.
  return stored.key.startsWith("uploads/") ? `/${stored.key}` : stored.url;
}

export function isLocalUploadUrl(url: string): boolean {
  return (
    url.startsWith("/uploads/app-display/") ||
    (() => {
      try {
        const parsed = new URL(url);
        return parsed.pathname.startsWith("/uploads/app-display/");
      } catch {
        return false;
      }
    })()
  );
}

export async function deleteLocalUploadByUrl(url: string | null | undefined) {
  if (!url || !isLocalUploadUrl(url)) return;
  await deleteStoredObject(url);
}
