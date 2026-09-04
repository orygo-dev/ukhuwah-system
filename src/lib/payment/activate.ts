import { prisma } from "@/lib/prisma";
import { processAffiliateCommission } from "@/lib/affiliate-commission";
import { grantCredits } from "@/lib/credit-ledger";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { resolvePlanEntitlements } from "@/lib/plan-limits";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

async function notifySuccessfulPayment(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      user: { select: { id: true, name: true, phone: true, planExpiresAt: true } },
      plan: true,
      creditPackage: true,
    },
  });
  const phone = transaction?.user.phone;
  if (!transaction || !phone) return;

  try {
    if (transaction.type === "CREDIT_TOPUP" && transaction.creditPackage) {
      await sendWhatsAppMessage({
        target: phone,
        userId: transaction.userId,
        purpose: "TOPUP_SUCCESS",
        variables: {
          name: transaction.user.name,
          credits: transaction.creditPackage.credits + transaction.creditPackage.bonusCredits,
          amount: formatCurrency(Number(transaction.amount)),
        },
      });
      return;
    }

    if (transaction.plan) {
      await sendWhatsAppMessage({
        target: phone,
        userId: transaction.userId,
        purpose: "SUBSCRIPTION_PURCHASE",
        variables: {
          name: transaction.user.name,
          packageName: transaction.plan.name,
          amount: formatCurrency(Number(transaction.amount)),
          expiredAt:
            (
              await prisma.user.findUnique({
                where: { id: transaction.userId },
                select: { planExpiresAt: true },
              })
            )?.planExpiresAt?.toLocaleDateString("id-ID") || "-",
        },
      });
    }
  } catch (err) {
    console.error("[whatsapp payment notification]", err);
  }
}

export async function activateTransaction(
  transactionId: string,
  paymentMethod?: string
) {
  let activated = false;

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { plan: true, creditPackage: true },
    });

    if (!transaction) {
      throw new Error("TRANSACTION_NOT_FOUND");
    }

    if (transaction.type === "CREDIT_TOPUP" && !transaction.creditPackage) {
      throw new Error("TRANSACTION_PRODUCT_MISSING");
    }

    if (transaction.type === "SUBSCRIPTION" && (!transaction.planId || !transaction.plan)) {
      throw new Error("TRANSACTION_PRODUCT_MISSING");
    }

    const creditPackage = transaction.creditPackage;
    const plan = transaction.plan;

    const markedPaid = await tx.transaction.updateMany({
      where: {
        id: transactionId,
        status: "PENDING",
      },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: paymentMethod || transaction.paymentMethod || "unknown",
      },
    });

    if (markedPaid.count !== 1) {
      return;
    }

    activated = true;

    if (transaction.type === "CREDIT_TOPUP") {
      if (!creditPackage) {
        throw new Error("TRANSACTION_PRODUCT_MISSING");
      }
      const totalCredits =
        creditPackage.credits + creditPackage.bonusCredits;
      if (totalCredits > 0) {
        await grantCredits(
          transaction.userId,
          totalCredits,
          "TOPUP",
          transaction.id,
          `Top up kredit ${creditPackage.name}`,
          tx,
          {
            creditType: "PAID_TOPUP",
            idempotencyKey: `topup:${transaction.id}`,
            metadata: {
              packageId: creditPackage.id,
              paidCredits: creditPackage.credits,
              bonusCredits: creditPackage.bonusCredits,
            },
          }
        );
      }
      return;
    }

    const user = await tx.user.findUnique({
      where: { id: transaction.userId },
      select: { planExpiresAt: true },
    });

    if (!plan || !transaction.planId) {
      throw new Error("TRANSACTION_PRODUCT_MISSING");
    }

    const baseDate =
      user?.planExpiresAt && user.planExpiresAt > new Date()
        ? new Date(user.planExpiresAt)
        : new Date();
    const expires = new Date(baseDate);
    expires.setMonth(expires.getMonth() + 1);

    await tx.user.update({
      where: { id: transaction.userId },
      data: {
        planId: transaction.planId,
        planExpiresAt: expires,
      },
    });

    const entitlements = resolvePlanEntitlements(plan.features);
    const totalMonthlyCredits =
      plan.creditsMonthly + entitlements.monthlyCreditBonus;

    if (totalMonthlyCredits > 0) {
      await grantCredits(
        transaction.userId,
        totalMonthlyCredits,
        "SUBSCRIPTION",
        transaction.id,
        `Aktivasi langganan ${plan.name}`,
        tx,
        {
          creditType: "SUBSCRIPTION",
          idempotencyKey: `subscription:${transaction.id}`,
          metadata: {
            planId: plan.id,
            baseCredits: plan.creditsMonthly,
            bonusCredits: entitlements.monthlyCreditBonus,
          },
        }
      );
    }
  });

  if (activated) {
    await processAffiliateCommission(transactionId);
    await notifySuccessfulPayment(transactionId);
  }

  return prisma.transaction.findUnique({ where: { id: transactionId } });
}
