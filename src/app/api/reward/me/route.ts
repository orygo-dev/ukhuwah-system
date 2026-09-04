import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CREDIT_LEDGER_LABELS, getRewardConfig } from "@/lib/reward";
import { getMissionsForUser } from "@/lib/reward-missions";
import {
  buildSsvCallbackUrl,
  canStartAdSession,
  getRewardAdConfig,
} from "@/lib/reward-ad";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Reward kredit hanya tersedia untuk akun guru.");
  }

  const config = await getRewardConfig();
  const userId = session.user.id;

  const [user, missions, ledger, adConfig, adGate] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { creditsRemaining: true },
    }),
    getMissionsForUser(userId),
    prisma.creditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getRewardAdConfig(),
    canStartAdSession(userId),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    config,
    creditsRemaining: user.creditsRemaining,
    missions,
    ad: {
      enabled: adConfig.enabled,
      provider: adConfig.provider,
      creditsPerAd: adConfig.creditsPerAd,
      maxAdsPerDay: adConfig.maxAdsPerDay,
      minWatchSeconds: adConfig.minWatchSeconds,
      adsWatchedToday: adGate.adsWatchedToday,
      cooldownRemaining: adGate.cooldownRemaining,
      canWatch: adGate.allowed,
      ssvCallbackUrl: buildSsvCallbackUrl(),
    },
    ledger: ledger.map((row) => ({
      id: row.id,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      source: row.source,
      sourceLabel: CREDIT_LEDGER_LABELS[row.source] || row.source,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
