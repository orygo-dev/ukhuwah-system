import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import {
  getReelsAdsConfig,
  getStudentGoogleAdmobPlacements,
  isGoogleAdmobReady,
} from "@/lib/reels-ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT" && session.user.role !== "TEACHER") {
    return mobileForbidden();
  }

  const config = await getReelsAdsConfig();
  const enabled = isGoogleAdmobReady(config.googleAdmob);
  const student =
    session.user.role === "STUDENT"
      ? getStudentGoogleAdmobPlacements(config.googleAdmob)
      : null;

  return NextResponse.json({
    enabled,
    ageTreatment: 2,
    madingEveryNPosts: config.googleAdmob.madingEveryNPosts,
    student,
  });
}
