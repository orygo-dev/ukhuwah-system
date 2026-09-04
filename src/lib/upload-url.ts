/**
 * URL helpers that are safe to import from client components.
 * Do NOT import AWS SDK / object-storage here.
 */

function sanitizeFolder(folder: string) {
  return folder
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "");
}

function asUploadPath(pathname: string): string {
  if (pathname.startsWith("/api/media/")) {
    return `/uploads/${pathname.slice("/api/media/".length)}`;
  }
  return pathname;
}

function uploadPathname(value: string): string | null {
  const trimmed = value.trim().split("?")[0];
  if (!trimmed) return null;
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/api/media/")) {
    return asUploadPath(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    const apiIndex = parsed.pathname.indexOf("/api/media/");
    if (apiIndex >= 0) {
      return `/uploads/${parsed.pathname.slice(apiIndex + "/api/media/".length)}`;
    }
    const index = parsed.pathname.indexOf("/uploads/");
    if (index >= 0) return parsed.pathname.slice(index);
  } catch {
    const index = trimmed.indexOf("/uploads/");
    if (index >= 0) return trimmed.slice(index);
  }
  return null;
}

function publicMediaPath(uploadPath: string): string {
  if (uploadPath.startsWith("/uploads/")) {
    return `/api/media/${uploadPath.slice("/uploads/".length)}`;
  }
  return uploadPath;
}

/**
 * Prefer `/api/media/...` so mobile, FCM, and <img> hit a Next.js API route
 * even when `/uploads/...` is missing on disk or intercepted by a static 404.
 */
export function toSameOriginUploadUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const uploadPath = uploadPathname(trimmed);
  if (!uploadPath) return trimmed;
  // app-display already has a live production proxy at /uploads/app-display/...
  if (uploadPath.startsWith("/uploads/app-display/")) return uploadPath;
  return publicMediaPath(uploadPath);
}

export function publicStoredUploadUrl(input: { key: string; url: string }): string {
  if (input.key.startsWith("uploads/")) {
    return `/api/media/${input.key.slice("uploads/".length)}`;
  }
  return toSameOriginUploadUrl(input.url) || input.url;
}

/**
 * Accepts local `/uploads/{folder}/...`, `/api/media/{folder}/...`, or
 * HTTPS/HTTP URLs whose pathname is under `/uploads/{folder}/` (Cloudflare R2 / CDN),
 * or any http(s) when allowAnyHttps is true.
 */
export function isAllowedUploadUrl(
  value: string,
  folders: string | string[],
  options?: {
    allowAnyHttps?: boolean;
    publicBaseUrl?: string | null;
    extensions?: string[];
  }
): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return false;

  const folderList = (Array.isArray(folders) ? folders : [folders])
    .map((folder) => sanitizeFolder(folder))
    .filter(Boolean);

  const matchesFolderPath = (pathname: string) =>
    folderList.some((folder) => asUploadPath(pathname).startsWith(`/uploads/${folder}/`));

  const matchesExtension = (pathname: string) => {
    if (!options?.extensions?.length) return true;
    const lower = asUploadPath(pathname).toLowerCase();
    return options.extensions.some((ext) =>
      lower.endsWith(ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`)
    );
  };

  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/api/media/")) {
    return matchesFolderPath(trimmed) && matchesExtension(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const pathname = asUploadPath(parsed.pathname);
    if (!matchesExtension(pathname)) return false;

    const publicBase = options?.publicBaseUrl?.replace(/\/$/, "") || null;
    if (publicBase && trimmed.startsWith(`${publicBase}/`)) {
      return matchesFolderPath(pathname);
    }

    if (matchesFolderPath(pathname)) {
      return true;
    }

    return Boolean(options?.allowAnyHttps);
  } catch {
    return false;
  }
}
