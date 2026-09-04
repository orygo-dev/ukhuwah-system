/**
 * Audit alur afiliasi: config, idempotensi komisi, mode all_payments.
 * Jalankan: npx tsx scripts/audit-affiliate.ts
 */
import { PrismaClient } from "@prisma/client";
import { getAffiliateConfig } from "../src/lib/affiliate";
import {
  processAffiliateCommission,
  recordAffiliateReferral,
} from "../src/lib/affiliate-commission";
import { activateTransaction } from "../src/lib/payment/activate";

const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const config = await getAffiliateConfig();
  checks.push({
    name: "Config commissionOn = all_payments",
    ok: config.commissionOn === "all_payments",
    detail: `commissionOn=${config.commissionOn}`,
  });

  const affiliate = await prisma.user.findFirst({
    where: { referralCode: { not: null }, role: "TEACHER" },
    select: { id: true, referralCode: true, email: true },
  });
  if (!affiliate?.referralCode) {
    checks.push({
      name: "Affiliate demo exists",
      ok: false,
      detail: "Tidak ada guru dengan referralCode",
    });
    printReport(checks);
    return;
  }

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { slug: { not: "free" }, priceMonthly: { gt: 0 } },
  });
  if (!plan) {
    checks.push({
      name: "Paid plan exists",
      ok: false,
      detail: "Tidak ada paket berbayar",
    });
    printReport(checks);
    return;
  }

  const gateway = await prisma.paymentGateway.findFirst({
    where: { isActive: true },
  });
  if (!gateway) {
    checks.push({
      name: "Payment gateway exists",
      ok: false,
      detail: "Tidak ada gateway aktif",
    });
    printReport(checks);
    return;
  }

  const amount = Number(plan.priceMonthly);

  const suffix = Date.now().toString(36);
  const referredEmail = `audit-ref-${suffix}@test.local`;

  const referred = await prisma.user.create({
    data: {
      name: `Audit Ref ${suffix}`,
      email: referredEmail,
      passwordHash: "audit",
      creditsRemaining: 10,
    },
  });

  await recordAffiliateReferral(referred.id, affiliate.referralCode);
  const referredAfter = await prisma.user.findUnique({
    where: { id: referred.id },
    select: { referredById: true },
  });
  checks.push({
    name: "recordAffiliateReferral sets referredById",
    ok: referredAfter?.referredById === affiliate.id,
    detail: `referredById=${referredAfter?.referredById}`,
  });

  const tx1 = await prisma.transaction.create({
    data: {
      userId: referred.id,
      planId: plan.id,
      gatewayId: gateway.id,
      gatewayRef: `audit-${suffix}-1`,
      amount,
      status: "PENDING",
    },
  });
  const tx2 = await prisma.transaction.create({
    data: {
      userId: referred.id,
      planId: plan.id,
      gatewayId: gateway.id,
      gatewayRef: `audit-${suffix}-2`,
      amount,
      status: "PENDING",
    },
  });

  await activateTransaction(tx1.id, "audit");
  await activateTransaction(tx1.id, "audit_retry");
  await activateTransaction(tx2.id, "audit");

  const commissions = await prisma.affiliateCommission.findMany({
    where: { affiliateId: affiliate.id, transactionId: { in: [tx1.id, tx2.id] } },
    orderBy: { createdAt: "asc" },
  });

  checks.push({
    name: "Dua pembayaran → dua komisi (all_payments)",
    ok: commissions.length === 2,
    detail: `count=${commissions.length}`,
  });

  checks.push({
    name: "Webhook retry tidak duplikat komisi",
    ok:
      commissions.filter((c) => c.transactionId === tx1.id).length === 1,
    detail: `tx1 commissions=${commissions.filter((c) => c.transactionId === tx1.id).length}`,
  });

  await processAffiliateCommission(tx1.id);
  const afterRetry = await prisma.affiliateCommission.count({
    where: { transactionId: tx1.id },
  });
  checks.push({
    name: "processAffiliateCommission idempotent",
    ok: afterRetry === 1,
    detail: `tx1 count=${afterRetry}`,
  });

  // Cleanup
  await prisma.affiliateCommission.deleteMany({
    where: { transactionId: { in: [tx1.id, tx2.id] } },
  });
  await prisma.affiliateReferral.deleteMany({ where: { referredUserId: referred.id } });
  await prisma.transaction.deleteMany({ where: { id: { in: [tx1.id, tx2.id] } } });
  await prisma.user.delete({ where: { id: referred.id } });

  printReport(checks);
}

function printReport(checks: Check[]) {
  console.log("\n=== Audit Afiliasi ===\n");
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
