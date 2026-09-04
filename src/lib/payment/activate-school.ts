import { prisma } from "@/lib/prisma";
import { grantSchoolCredits } from "@/lib/school-credit-ledger";
import { addSchoolBillingPeriod } from "@/lib/school-billing-policy";

export async function activateSchoolPayment(transactionId: string, paymentMethod?: string) {
  let activated = false;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.schoolPaymentTransaction.findUnique({
      where: { id: transactionId },
      include: { plan: true },
    });
    if (!payment) throw new Error("SCHOOL_PAYMENT_NOT_FOUND");

    const markedPaid = await tx.schoolPaymentTransaction.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), paymentMethod: paymentMethod || payment.paymentMethod || "unknown", activeCheckoutKey: null },
    });
    if (markedPaid.count !== 1) return;

    activated = true;
    const now = new Date();
    const current = await tx.schoolSubscription.findFirst({
      where: { schoolId: payment.schoolId, status: { not: "CANCELED" } },
      orderBy: { createdAt: "desc" },
    });
    const continuingSamePlan = current?.planId === payment.planId && current.status === "ACTIVE" && current.currentPeriodEnd && current.currentPeriodEnd > now;
    const periodStart = continuingSamePlan ? current.currentPeriodEnd! : now;
    const periodEnd = addSchoolBillingPeriod(periodStart, payment.billingCycle);
    const subscription = current
      ? await tx.schoolSubscription.update({
          where: { id: current.id },
          data: {
            planId: payment.planId,
            status: "ACTIVE",
            startsAt: continuingSamePlan ? current.startsAt : now,
            trialEndsAt: null,
            currentPeriodEnd: periodEnd,
            graceEndsAt: null,
            version: { increment: 1 },
          },
        })
      : await tx.schoolSubscription.create({
          data: { schoolId: payment.schoolId, planId: payment.planId, status: "ACTIVE", startsAt: now, currentPeriodEnd: periodEnd },
        });

    const activeSeats = await tx.schoolSeat.findMany({
      where: { subscriptionId: subscription.id, releasedAt: null },
      orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const excessSeats = activeSeats.slice(payment.plan.maxTeacherSeats);
    if (excessSeats.length > 0) {
      await tx.schoolSeat.updateMany({ where: { id: { in: excessSeats.map((seat) => seat.id) }, releasedAt: null }, data: { releasedAt: now } });
      await tx.schoolSubscriptionAudit.create({
        data: { subscriptionId: subscription.id, schoolId: payment.schoolId, actorId: payment.createdById, action: "SEATS_RELEASED_FOR_PLAN_LIMIT", metadata: { releasedSeatIds: excessSeats.map((seat) => seat.id), limit: payment.plan.maxTeacherSeats } },
      });
    }

    await tx.schoolPaymentTransaction.update({ where: { id: payment.id }, data: { subscriptionId: subscription.id } });
    await tx.schoolInvoice.update({
      where: { id: payment.invoiceId },
      data: { subscriptionId: subscription.id, status: "PAID", paidAt: now },
    });
    await tx.schoolSubscriptionAudit.create({
      data: {
        subscriptionId: subscription.id,
        schoolId: payment.schoolId,
        actorId: payment.createdById,
        action: "PAYMENT_ACTIVATED",
        metadata: { paymentId: payment.id, planId: payment.planId, billingCycle: payment.billingCycle, amount: Number(payment.amount) },
      },
    });
    if (payment.plan.monthlyAiCredits > 0) {
      await grantSchoolCredits({
        schoolId: payment.schoolId,
        subscriptionId: subscription.id,
        amount: payment.plan.monthlyAiCredits,
        source: "SUBSCRIPTION_GRANT",
        referenceId: payment.id,
        description: `Aktivasi paket sekolah ${payment.plan.name}`,
        idempotencyKey: `school-payment:${payment.id}:initial`,
      }, tx);
    }
  }, { isolationLevel: "Serializable" });

  return { activated, transaction: await prisma.schoolPaymentTransaction.findUnique({ where: { id: transactionId } }) };
}

export async function refundSchoolPayment(transactionId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.schoolPaymentTransaction.findUnique({ where: { id: transactionId } });
    if (!payment) throw new Error("SCHOOL_PAYMENT_NOT_FOUND");
    const refunded = await tx.schoolPaymentTransaction.updateMany({ where: { id: payment.id, status: "PAID" }, data: { status: "REFUNDED", activeCheckoutKey: null } });
    if (refunded.count !== 1) return false;
    await tx.schoolInvoice.updateMany({ where: { id: payment.invoiceId }, data: { status: "VOID" } });
    if (payment.subscriptionId) {
      const newerPayment = await tx.schoolPaymentTransaction.count({
        where: { subscriptionId: payment.subscriptionId, status: "PAID", createdAt: { gt: payment.createdAt } },
      });
      if (newerPayment === 0) {
        const changed = await tx.schoolSubscription.updateMany({
          where: { id: payment.subscriptionId, status: { in: ["ACTIVE", "GRACE", "TRIAL"] } },
          data: { status: "READ_ONLY", version: { increment: 1 } },
        });
        if (changed.count === 1) await tx.schoolSubscriptionAudit.create({
          data: { subscriptionId: payment.subscriptionId, schoolId: payment.schoolId, action: "PAYMENT_REFUNDED", metadata: { paymentId: payment.id } },
        });
      }
    }
    return true;
  }, { isolationLevel: "Serializable" });
}
