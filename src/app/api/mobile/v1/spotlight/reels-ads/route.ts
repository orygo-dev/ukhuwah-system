import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { getGoogleAdmobAdUnit, getReelsAdsConfig } from "@/lib/reels-ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "TEACHER" && session.user.role !== "STUDENT") {
    return mobileForbidden();
  }

  const config = await getReelsAdsConfig();
  const audience = session.user.role === "STUDENT" ? "student" : "teacher";
  const androidAdUnitId = getGoogleAdmobAdUnit(config.googleAdmob, audience);
  const enabled = Boolean(androidAdUnitId);
  return NextResponse.json({
    enabled,
    androidAdUnitId,
    everyNPosts: config.googleAdmob.everyNPosts,
    ageTreatment: 2,
  });
}
