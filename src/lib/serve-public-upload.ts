import path from "path";
import { readStoredUpload } from "@/lib/object-storage";

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function servePublicUpload(parts: string[], includeBody: boolean) {
  if (
    !parts.length ||
    parts.some((part) => !part || part === ".." || part.includes("\\") || part.includes("/"))
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const key = `uploads/${parts.join("/")}`;
  const ext = path.extname(key).toLowerCase();
  const fallbackType = CONTENT_TYPES[ext];
  if (!fallbackType) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const stored = await readStoredUpload(key);
  if (!stored) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers({
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(stored.bytes.length),
    // Object metadata may originate from an upload client. The extension is
    // generated after server-side validation and remains authoritative.
    "Content-Type": fallbackType,
    "X-Content-Type-Options": "nosniff",
  });

  if (!includeBody) {
    return new Response(null, { headers });
  }

  return new Response(new Uint8Array(stored.bytes), { headers });
}
