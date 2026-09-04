/**
 * Audit reward fase 1 & 2.
 * Jalankan: npx tsx scripts/audit-reward.ts
 */
import { PrismaClient } from "@prisma/client";
import { getRewardConfig } from "../src/lib/reward";
import { getRewardAdConfig } from "../src/lib/reward-ad";
import {
  claimRewardMission,
  getMissionsForUser,
} from "../src/lib/reward-missions";
import {
  completeRewardAdSession,
  createRewardAdSession,
} from "../src/lib/reward-ad-service";
import { applyCreditChange } from "../src/lib/credit-ledger";

const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const rewardConfig = await getRewardConfig();
  checks.push({
    name: "Reward program enabled",
    ok: rewardConfig.enabled,
    detail: `enabled=${rewardConfig.enabled}`,
  });

  const adConfig = await getRewardAdConfig();
  checks.push({
    name: "Ad config loaded",
    ok: adConfig.maxAdsPerDay >= 1,
    detail: `provider=${adConfig.provider}, max=${adConfig.maxAdsPerDay}`,
  });

  const teacher = await prisma.user.findUnique({
    where: { email: "guru@demo.sch.id" },
  });
  if (!teacher) {
    checks.push({
      name: "Demo teacher exists",
      ok: false,
      detail: "guru@demo.sch.id not found",
    });
    printReport(checks);
    return;
  }

  const missions = await getMissionsForUser(teacher.id);
  checks.push({
    name: "Missions loaded for demo teacher",
    ok: missions.length >= 4,
    detail: `count=${missions.length}`,
  });

  const watchAd = missions.find((m) => m.slug === "watch-ad");
  checks.push({
    name: "watch-ad mission active (fase 2)",
    ok: !!watchAd && watchAd.status !== "disabled",
    detail: `status=${watchAd?.status}`,
  });

  // Daily login claim
  try {
    const before = await prisma.user.findUnique({
      where: { id: teacher.id },
      select: { creditsRemaining: true },
    });
    await claimRewardMission(teacher.id, "daily-login");
    const afterLogin = await prisma.user.findUnique({
      where: { id: teacher.id },
      select: { creditsRemaining: true },
    });
    checks.push({
      name: "Daily login claim adds credit",
      ok: (afterLogin?.creditsRemaining ?? 0) > (before?.creditsRemaining ?? 0),
      detail: `${before?.creditsRemaining} -> ${afterLogin?.creditsRemaining}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    checks.push({
      name: "Daily login claim adds credit",
      ok: msg === "ALREADY_CLAIMED",
      detail: msg === "ALREADY_CLAIMED" ? "already claimed today (ok)" : msg,
    });
  }

  // watch-ad cannot use regular claim
  try {
    await claimRewardMission(teacher.id, "watch-ad");
    checks.push({
      name: "watch-ad blocked from regular claim",
      ok: false,
      detail: "should have thrown USE_AD_FLOW",
    });
  } catch (e) {
    checks.push({
      name: "watch-ad blocked from regular claim",
      ok: e instanceof Error && e.message === "USE_AD_FLOW",
      detail: e instanceof Error ? e.message : "error",
    });
  }

  // Sandbox ad flow
  const creditsBeforeAd = (
    await prisma.user.findUnique({
      where: { id: teacher.id },
      select: { creditsRemaining: true },
    })
  )?.creditsRemaining ?? 0;

  const session = await createRewardAdSession(teacher.id, "sandbox");
  await new Promise((r) => setTimeout(r, (adConfig.minWatchSeconds + 1) * 1000));

  try {
    const adResult = await completeRewardAdSession({
      sessionId: session.id,
      userId: teacher.id,
      provider: "sandbox",
    });
    checks.push({
      name: "Sandbox ad grants credits",
      ok: adResult.credits > 0,
      detail: `+${adResult.credits}, balance=${adResult.balanceAfter}`,
    });
  } catch (e) {
    checks.push({
      name: "Sandbox ad grants credits",
      ok: e instanceof Error && e.message === "DAILY_LIMIT_REACHED",
      detail: e instanceof Error ? e.message : "error",
    });
  }

  const ledgerAd = await prisma.creditLedger.findFirst({
    where: { userId: teacher.id, source: "REWARDED_AD" },
    orderBy: { createdAt: "desc" },
  });
  checks.push({
    name: "REWARDED_AD ledger entry exists",
    ok: !!ledgerAd,
    detail: ledgerAd ? `amount=${ledgerAd.amount}` : "none",
  });

  // Duplicate complete rejected
  try {
    await completeRewardAdSession({
      sessionId: session.id,
      userId: teacher.id,
      provider: "sandbox",
    });
    checks.push({
      name: "Duplicate ad complete rejected",
      ok: false,
      detail: "should fail",
    });
  } catch (e) {
    checks.push({
      name: "Duplicate ad complete rejected",
      ok: e instanceof Error && e.message === "SESSION_NOT_PENDING",
      detail: e instanceof Error ? e.message : "error",
    });
  }

  // Spend credits via ledger
  const testUser = await prisma.user.create({
    data: {
      email: `audit-reward-${Date.now()}@test.local`,
      name: "Audit Reward",
      passwordHash: "x",
      creditsRemaining: 5,
    },
  });
  await applyCreditChange({
    userId: testUser.id,
    amount: -1,
    source: "SPEND_GENERATE",
    description: "Audit spend test",
  });
  const afterSpend = await prisma.user.findUnique({
    where: { id: testUser.id },
    select: { creditsRemaining: true },
  });
  checks.push({
    name: "Ledger spend decrements balance",
    ok: afterSpend?.creditsRemaining === 4,
    detail: `balance=${afterSpend?.creditsRemaining}`,
  });

  await prisma.creditLedger.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });

  printReport(checks);
}

function printReport(checks: Check[]) {
  console.log("\n=== Audit Reward Fase 1 & 2 ===\n");
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    if (!c.ok) failed++;
    console.log(`[${mark}] ${c.name}`);
    console.log(`       ${c.detail}\n`);
  }
  console.log(failed === 0 ? "Semua cek lulus.\n" : `${failed} cek gagal.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
