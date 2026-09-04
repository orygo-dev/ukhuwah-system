import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildReferralLink,
  getAffiliateConfig,
  resolveAffiliateRank,
  resolveCommissionTier,
} from "@/lib/affiliate";
import {
  ensureAffiliateProfile,
  settleAvailableAffiliateCommissions,
} from "@/lib/affiliate-commission";
import {
  REFERRAL_MEMBERSHIP_LABEL,
  resolveReferralMembershipStatus,
} from "@/lib/affiliate-referral-status";
import { getUserPlanEntitlements } from "@/lib/plan-limits";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Fitur afiliasi hanya tersedia untuk akun guru.");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    const { entitlements } = await getUserPlanEntitlements(session.user.id);
    if (!entitlements.canUseAffiliate) {
      return NextResponse.json(
        {
          error: "Paket langganan Anda belum mencakup fitur afiliasi.",
          code: "AFFILIATE_NOT_INCLUDED",
        },
        { status: 403 }
      );
    }
  }

  const config = await getAffiliateConfig();
  const code = await ensureAffiliateProfile(session.user.id, session.user.name);
  await settleAvailableAffiliateCommissions(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      affiliateProfile: true,
      walletLedger: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      affiliateReferrals: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          referredUser: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              planExpiresAt: true,
              plan: { select: { name: true, slug: true } },
            },
          },
        },
      },
      affiliateCommissions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          referral: {
            include: {
              referredUser: { select: { name: true } },
            },
          },
        },
      },
      affiliatePayouts: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!user || !code) {
    return NextResponse.json({ error: "Gagal memuat profil afiliasi" }, { status: 500 });
  }

  const commissions = await prisma.affiliateCommission.findMany({
    where: { affiliateId: session.user.id },
    select: { commissionAmount: true, status: true },
  });

  let pending = 0;
  let approved = 0;
  let paid = 0;
  let availableForPayout = 0;

  for (const c of commissions) {
    const amt = Number(c.commissionAmount);
    if (c.status === "PAID") paid += amt;
    else if (c.status === "APPROVED") approved += amt;
    else if (c.status === "PENDING") pending += amt;
  }
  availableForPayout = Number(user.walletBalance);

  const referralCount = await prisma.affiliateReferral.count({
    where: { affiliateId: session.user.id },
  });

  const conversionCount = await prisma.affiliateCommission.count({
    where: { affiliateId: session.user.id },
  });
  const rank = resolveAffiliateRank(config, referralCount);
  const commissionTier = resolveCommissionTier(config, referralCount);

  const referredUserIds = user.affiliateReferrals.map((r) => r.referredUser.id);
  const paidByUser =
    referredUserIds.length > 0
      ? await prisma.transaction.groupBy({
          by: ["userId"],
          where: {
            userId: { in: referredUserIds },
            status: "PAID",
            amount: { gt: 0 },
          },
          _count: { _all: true },
        })
      : [];
  const paidUserIds = new Set(paidByUser.map((row) => row.userId));

  return NextResponse.json({
    config,
    referralCode: code,
    referralLink: buildReferralLink(code),
    stats: {
      referrals: referralCount,
      conversions: conversionCount,
      pending,
      approved,
      paid,
      availableForPayout,
      walletBalance: Number(user.walletBalance),
    },
    rank: {
      current: rank,
      referralCount,
      commissionTier,
    },
    profile: user.affiliateProfile,
    referrals: user.affiliateReferrals.map((r) => {
      const membershipStatus = resolveReferralMembershipStatus({
        planSlug: r.referredUser.plan?.slug,
        planExpiresAt: r.referredUser.planExpiresAt,
        hasPaidSubscription: paidUserIds.has(r.referredUser.id),
      });

      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        membershipStatus,
        membershipLabel: REFERRAL_MEMBERSHIP_LABEL[membershipStatus],
        planName: r.referredUser.plan?.name ?? null,
        planExpiresAt: r.referredUser.planExpiresAt?.toISOString() ?? null,
        user: {
          name: r.referredUser.name,
          email: r.referredUser.email.replace(/(.{2}).*(@.*)/, "$1***$2"),
          joinedAt: r.referredUser.createdAt.toISOString(),
        },
      };
    }),
    commissions: user.affiliateCommissions.map((c) => ({
      id: c.id,
      amount: Number(c.commissionAmount),
      rate: Number(c.commissionRate),
      orderAmount: Number(c.orderAmount),
      status: c.status,
      availableAt: c.availableAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      referredName: c.referral.referredUser.name,
    })),
    payouts: user.affiliatePayouts.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      processedAt: p.processedAt?.toISOString() || null,
    })),
    walletLedger: user.walletLedger.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      balanceAfter: Number(row.balanceAfter),
      source: row.source,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
