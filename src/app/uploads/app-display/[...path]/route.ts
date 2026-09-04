import path from "path";
import { NextResponse } from "next/server";
import { readStoredUpload } from "@/lib/object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function serveUpload(ctx: RouteContext, includeBody: boolean) {
  const params = await ctx.params;
  const parts = params.path || [];
  if (!parts.length || parts.some((part) => part === ".." || part.includes("\\"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = `uploads/app-display/${parts.join("/")}`;
  const ext = path.extname(key).toLowerCase();
  const fallbackType = CONTENT_TYPES[ext];
  if (!fallbackType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stored = await readStoredUpload(key);
  if (!stored) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = stored.contentType || fallbackType;
  const headers = new Headers({
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(stored.bytes.length),
    "Content-Type": contentType,
  });

  if (!includeBody) {
    return new Response(null, { headers });
  }

  return new Response(new Uint8Array(stored.bytes), { headers });
}

export function GET(_req: Request, ctx: RouteContext) {
  return serveUpload(ctx, true);
}

export function HEAD(_req: Request, ctx: RouteContext) {
  return serveUpload(ctx, false);
}
