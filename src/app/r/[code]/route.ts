import { NextResponse } from "next/server";
import { getAffiliateConfig } from "@/lib/affiliate";

type Params = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Params) {
  const { code } = await params;
  const config = await getAffiliateConfig();
  const origin = new URL(req.url).origin;
  const redirectUrl = new URL("/register", origin);
  redirectUrl.searchParams.set("ref", code.toUpperCase());

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set("gs_ref", code.toUpperCase(), {
    maxAge: 60 * 60 * 24 * config.attributionDays,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
