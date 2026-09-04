import { prisma } from "@/lib/prisma";
import { getAffiliateConfig, resolveCommissionTier } from "@/lib/affiliate";
import { creditWallet } from "@/lib/wallet-ledger";

export async function recordAffiliateReferral(
  referredUserId: string,
  referralCode: string
): Promise<void> {
  const config = await getAffiliateConfig();
  if (!config.enabled) return;

  const code = referralCode.trim().toUpperCase();
  if (!code) return;

  const affiliate = await prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true, referralCode: true },
  });

  if (!affiliate || affiliate.id === referredUserId) return;

  const existing = await prisma.affiliateReferral.findUnique({
    where: { referredUserId },
  });
  if (existing) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: referredUserId },
      data: { referredById: affiliate.id },
    }),
    prisma.affiliateReferral.create({
      data: {
        affiliateId: affiliate.id,
        referredUserId,
        referralCode: code,
      },
    }),
  ]);
}

export async function processAffiliateCommission(
  transactionId: string
): Promise<void> {
  const config = await getAffiliateConfig();
  if (!config.enabled) return;

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          referredById: true,
          schoolId: true,
          school: { select: { id: true, regencyId: true } },
          teachingProfiles: {
            where: { isPrimary: true },
            take: 1,
            select: {
              schoolId: true,
              school: { select: { id: true, regencyId: true } },
            },
          },
        },
      },
    },
  });

  if (!transaction || transaction.status !== "PAID") return;
  if (transaction.type !== "SUBSCRIPTION") return;
  if (!transaction.planId || !transaction.plan) return;
  if (!config.commissionTargets.includes("subscription")) return;
  if (Number(transaction.amount) <= 0) return;

  let affiliateRate = 0;

  if (
    transaction.user.referredById &&
    transaction.user.referredById !== transaction.userId
  ) {
    const existingCommission = await prisma.affiliateCommission.findUnique({
      where: { transactionId },
    });

    if (!existingCommission) {
      let allowAffiliateCommission = true;

      if (config.commissionOn === "first_payment") {
        const priorPaid = await prisma.transaction.count({
          where: {
            userId: transaction.userId,
            status: "PAID",
            type: "SUBSCRIPTION",
            id: { not: transactionId },
            amount: { gt: 0 },
          },
        });
        allowAffiliateCommission = priorPaid === 0;
      }

      const referral = await prisma.affiliateReferral.findUnique({
        where: { referredUserId: transaction.userId },
      });

      if (referral) {
        const attributionEnds = new Date(referral.createdAt);
        attributionEnds.setDate(attributionEnds.getDate() + config.attributionDays);
        if (transaction.paidAt && transaction.paidAt > attributionEnds) {
          allowAffiliateCommission = false;
        }
      }

      const affiliateId = referral?.affiliateId ?? transaction.user.referredById;

      if (
        allowAffiliateCommission &&
        affiliateId &&
        affiliateId === transaction.user.referredById
      ) {
        let referralId = referral?.id;
        if (!referralId) {
          const affiliateUser = await prisma.user.findUnique({
            where: { id: affiliateId },
            select: { referralCode: true },
          });
          const backfill = await prisma.affiliateReferral.create({
            data: {
              affiliateId,
              referredUserId: transaction.userId,
              referralCode: affiliateUser?.referralCode || "UNKNOWN",
            },
          });
          referralId = backfill.id;
        }

        const referralCount = await prisma.affiliateReferral.count({
          where: { affiliateId },
        });
        const commissionTier = resolveCommissionTier(config, referralCount);
        affiliateRate = commissionTier.commissionPercent;

        if (commissionTier.commissionPercent > 0) {
          const orderAmount = Number(transaction.amount);
          const commissionAmount =
            Math.round(orderAmount * (commissionTier.commissionPercent / 100) * 100) / 100;

          if (commissionAmount > 0) {
            const availableAt = new Date();
            availableAt.setDate(availableAt.getDate() + config.holdDays);

            await prisma.affiliateCommission.create({
              data: {
                affiliateId,
                referralId,
                transactionId: transaction.id,
                orderAmount,
                commissionRate: commissionTier.commissionPercent,
                commissionAmount,
                status: "PENDING",
                availableAt,
              },
            });
          }
        }
      }
    } else {
      affiliateRate = Number(existingCommission.commissionRate);
    }
  }

  if (config.partnerCommissionEnabled) {
    await processPartnerCommission(transaction.id, affiliateRate);
  }
}

async function processPartnerCommission(transactionId: string, affiliateRate: number) {
  const config = await getAffiliateConfig();
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          schoolId: true,
          school: { select: { id: true, regencyId: true } },
          teachingProfiles: {
            where: { isPrimary: true },
            take: 1,
            select: {
              schoolId: true,
              school: { select: { id: true, regencyId: true } },
            },
          },
        },
      },
    },
  });

  if (!transaction || transaction.status !== "PAID") return;
  if (transaction.type !== "SUBSCRIPTION" || !transaction.plan) return;

  const primaryProfile = transaction.user.teachingProfiles[0];
  const schoolIds = Array.from(
    new Set(
      [transaction.user.schoolId, primaryProfile?.schoolId, transaction.user.school?.id, primaryProfile?.school?.id]
        .filter(Boolean) as string[]
    )
  );
  const regencyIds = Array.from(
    new Set(
      [transaction.user.school?.regencyId, primaryProfile?.school?.regencyId].filter(
        Boolean
      ) as string[]
    )
  );

  if (schoolIds.length === 0 && regencyIds.length === 0) return;

  const partners = await prisma.affiliatePartner.findMany({
    where: {
      isActive: true,
      OR: [
        ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : []),
        ...(regencyIds.length ? [{ regencyId: { in: regencyIds } }] : []),
      ],
    },
    orderBy: [{ schoolId: "desc" }, { createdAt: "asc" }],
  });

  const partner =
    partners.find((row) => row.schoolId && schoolIds.includes(row.schoolId)) ||
    partners.find((row) => row.regencyId && regencyIds.includes(row.regencyId));

  if (!partner) return;

  const remainingRate = Math.max(0, config.maxTotalCommissionPercent - affiliateRate);
  const partnerRate = Math.min(Number(partner.commissionPercent), remainingRate);
  if (partnerRate <= 0) return;

  const existing = await prisma.partnerCommission.findUnique({
    where: {
      partnerId_transactionId: {
        partnerId: partner.id,
        transactionId: transaction.id,
      },
    },
  });
  if (existing) return;

  const orderAmount = Number(transaction.amount);
  const commissionAmount = Math.round(orderAmount * (partnerRate / 100) * 100) / 100;
  if (commissionAmount <= 0) return;

  const availableAt = new Date();
  availableAt.setDate(availableAt.getDate() + config.holdDays);

  await prisma.partnerCommission.create({
    data: {
      partnerId: partner.id,
      transactionId: transaction.id,
      referredUserId: transaction.userId,
      orderAmount,
      commissionRate: partnerRate,
      commissionAmount,
      status: "PENDING",
      availableAt,
    },
  });
}

export async function settleAvailableAffiliateCommissions(affiliateId?: string) {
  const now = new Date();
  const commissions = await prisma.affiliateCommission.findMany({
    where: {
      ...(affiliateId ? { affiliateId } : {}),
      status: "PENDING",
      walletSettledAt: null,
      availableAt: { lte: now },
    },
    orderBy: { availableAt: "asc" },
  });

  for (const commission of commissions) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.affiliateCommission.findUnique({
        where: { id: commission.id },
      });
      if (!fresh || fresh.walletSettledAt || fresh.status !== "PENDING") return;

      const markedSettled = await tx.affiliateCommission.updateMany({
        where: { id: fresh.id, status: "PENDING", walletSettledAt: null },
        data: {
          status: "APPROVED",
          approvedAt: now,
          walletSettledAt: now,
        },
      });
      if (markedSettled.count !== 1) return;

      await creditWallet(
        fresh.affiliateId,
        Number(fresh.commissionAmount),
        "AFFILIATE_COMMISSION",
        fresh.id,
        "Komisi afiliasi tersedia",
        tx,
        {
          idempotencyKey: `affiliate-commission:${fresh.id}`,
          metadata: {
            transactionId: fresh.transactionId,
            referralId: fresh.referralId,
          },
        }
      );
    });
  }
}

export async function settleAvailablePartnerCommissions(partnerId?: string) {
  const now = new Date();
  const commissions = await prisma.partnerCommission.findMany({
    where: {
      ...(partnerId ? { partnerId } : {}),
      status: "PENDING",
      walletSettledAt: null,
      availableAt: { lte: now },
    },
    orderBy: { availableAt: "asc" },
  });

  for (const commission of commissions) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.partnerCommission.findUnique({
        where: { id: commission.id },
      });
      if (!fresh || fresh.walletSettledAt || fresh.status !== "PENDING") return;

      const markedSettled = await tx.partnerCommission.updateMany({
        where: { id: fresh.id, status: "PENDING", walletSettledAt: null },
        data: {
          status: "APPROVED",
          approvedAt: now,
          walletSettledAt: now,
        },
      });
      if (markedSettled.count !== 1) return;

      await tx.affiliatePartner.update({
        where: { id: fresh.partnerId },
        data: {
          walletBalance: { increment: fresh.commissionAmount },
        },
      });
    });
  }
}

export async function ensureAffiliateProfile(userId: string, name: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, affiliateProfile: true },
  });
  if (!user) return null;

  let code = user.referralCode;
  if (!code) {
    const { generateReferralCode } = await import("@/lib/affiliate");
    let attempts = 0;
    while (attempts < 5) {
      const candidate = generateReferralCode(name);
      const taken = await prisma.user.findUnique({
        where: { referralCode: candidate },
      });
      if (!taken) {
        code = candidate;
        break;
      }
      attempts++;
    }
    if (!code) return null;
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });
  }

  if (!user.affiliateProfile) {
    await prisma.affiliateProfile.create({
      data: { userId, isActive: true },
    });
  }

  return code;
}
