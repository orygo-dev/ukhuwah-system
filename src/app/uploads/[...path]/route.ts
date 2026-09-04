import { servePublicUpload } from "@/lib/serve-public-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_req: Request, ctx: RouteContext) {
  const { path } = await ctx.params;
  return servePublicUpload(path || [], true);
}

export async function HEAD(_req: Request, ctx: RouteContext) {
  const { path } = await ctx.params;
  return servePublicUpload(path || [], false);
}
