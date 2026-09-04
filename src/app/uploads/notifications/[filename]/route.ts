import { servePublicUpload } from "@/lib/serve-public-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(_req: Request, ctx: RouteContext) {
  const { filename } = await ctx.params;
  return servePublicUpload(["notifications", filename], true);
}

export async function HEAD(_req: Request, ctx: RouteContext) {
  const { filename } = await ctx.params;
  return servePublicUpload(["notifications", filename], false);
}
