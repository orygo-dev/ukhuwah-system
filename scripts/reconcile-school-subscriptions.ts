import { prisma } from "../src/lib/prisma";
import { grantSchoolCredits } from "../src/lib/school-credit-ledger";

async function main() {
  if (process.env.SCHOOL_COMMERCIALIZATION_ENABLED !== "true") {
    console.log("School commercialization disabled; no changes applied.");
    return;
  }
  const now = new Date();
  const expiredPayments = await prisma.schoolPaymentTransaction.findMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    select: { id: true, invoiceId: true },
    take: 1000,
  });
  for (const payment of expiredPayments) {
    await prisma.$transaction(async (tx) => {
      const expired = await tx.schoolPaymentTransaction.updateMany({
        where: { id: payment.id, status: "PENDING", expiresAt: { lte: now } },
        data: { status: "EXPIRED", activeCheckoutKey: null },
      });
      if (expired.count === 1) {
        await tx.schoolInvoice.updateMany({ where: { id: payment.invoiceId, status: "ISSUED" }, data: { status: "VOID" } });
      }
    });
  }
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const subscriptions = await prisma.schoolSubscription.findMany({
    where: { status: { in: ["TRIAL", "ACTIVE", "GRACE"] } },
    include: { plan: true },
  });
  for (const subscription of subscriptions) {
    let nextStatus: "GRACE" | "READ_ONLY" | null = null;
    if (subscription.status === "TRIAL" && subscription.trialEndsAt && subscription.trialEndsAt <= now) nextStatus = "READ_ONLY";
    if (subscription.status === "ACTIVE" && subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now) nextStatus = subscription.graceEndsAt && subscription.graceEndsAt > now ? "GRACE" : "READ_ONLY";
    if (subscription.status === "GRACE" && (!subscription.graceEndsAt || subscription.graceEndsAt <= now)) nextStatus = "READ_ONLY";
    if (nextStatus) {
      await prisma.$transaction(async (tx) => {
        const changed = await tx.schoolSubscription.updateMany({ where: { id: subscription.id, version: subscription.version }, data: { status: nextStatus!, version: { increment: 1 } } });
        if (changed.count === 1) await tx.schoolSubscriptionAudit.create({ data: { subscriptionId: subscription.id, schoolId: subscription.schoolId, action: "STATUS_RECONCILED", metadata: { from: subscription.status, to: nextStatus } } });
      });
      continue;
    }
    const sameStartMonth = subscription.startsAt.getUTCFullYear() === now.getUTCFullYear() && subscription.startsAt.getUTCMonth() === now.getUTCMonth();
    if (subscription.status === "ACTIVE" && !sameStartMonth && subscription.plan.monthlyAiCredits > 0) {
      await grantSchoolCredits({ schoolId: subscription.schoolId, subscriptionId: subscription.id, amount: subscription.plan.monthlyAiCredits, source: "MONTHLY_GRANT", description: `Kredit paket sekolah ${periodKey}`, idempotencyKey: `subscription:${subscription.id}:monthly:${periodKey}` });
    }
  }
  console.log(`Reconciled ${subscriptions.length} school subscriptions and expired ${expiredPayments.length} pending payments.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
