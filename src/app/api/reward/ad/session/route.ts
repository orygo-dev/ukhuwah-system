import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRewardConfig } from "@/lib/reward";
import {
  canStartAdSession,
  getRewardAdConfig,
  getCooldownRemainingSeconds,
  getLastCompletedAdAt,
} from "@/lib/reward-ad";
import { createRewardAdSession } from "@/lib/reward-ad-service";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export const runtime = "nodejs";

function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Iklan reward hanya tersedia untuk akun guru.");
  }

  const rewardConfig = await getRewardConfig();
  if (!rewardConfig.enabled) {
    return NextResponse.json({ error: "Program reward tidak aktif" }, { status: 400 });
  }

  const adConfig = await getRewardAdConfig();
  if (!adConfig.enabled) {
    return NextResponse.json({ error: "Iklan reward tidak aktif" }, { status: 400 });
  }

  const gate = await canStartAdSession(session.user.id);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason || "Tidak bisa memulai iklan" }, { status: 400 });
  }

  const adSession = await createRewardAdSession(
    session.user.id,
    adConfig.provider,
    clientIp(req)
  );

  const lastCompleted = await getLastCompletedAdAt(session.user.id);

  return NextResponse.json({
    sessionId: adSession.id,
    provider: adConfig.provider,
    minWatchSeconds: adConfig.minWatchSeconds,
    creditsPerAd: adConfig.creditsPerAd,
    expiresAt: adSession.expiresAt.toISOString(),
    customData: adSession.id,
    userId: session.user.id,
    admobAdUnitId: adConfig.admobAdUnitId || null,
    cooldownRemaining: getCooldownRemainingSeconds(
      lastCompleted,
      adConfig.cooldownSeconds
    ),
  });
}
