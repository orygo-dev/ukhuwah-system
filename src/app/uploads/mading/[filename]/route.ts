import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const contentTypes: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
type RouteContext = { params: Promise<{ filename: string }> };

async function serveFile(ctx: RouteContext, includeBody: boolean) {
  const { filename } = await ctx.params;
  if (!filename || filename.includes("/") || filename.includes("\\")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const root = path.resolve(process.cwd(), "public", "uploads", "mading");
  const filePath = path.resolve(root, filename);
  if (!filePath.startsWith(root + path.sep)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const contentType = contentTypes[path.extname(filePath).toLowerCase()];
  if (!contentType) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not found");
    const headers = new Headers({ "Cache-Control": "public, max-age=31536000, immutable", "Content-Length": String(info.size), "Content-Type": contentType });
    if (!includeBody) return new Response(null, { headers });
    return new Response(Readable.toWeb(createReadStream(filePath)) as BodyInit, { headers });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export function GET(_req: Request, ctx: RouteContext) { return serveFile(ctx, true); }
export function HEAD(_req: Request, ctx: RouteContext) { return serveFile(ctx, false); }
