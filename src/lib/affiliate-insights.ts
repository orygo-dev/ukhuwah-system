import { prisma } from "@/lib/prisma";
import {
  getAffiliateConfig,
  resolveAffiliateRank,
  type AffiliateRankLevel,
} from "@/lib/affiliate";

export type AffiliateRankSnapshot = {
  rank: AffiliateRankLevel;
  referralCount: number;
};

export type AffiliateLeaderboardEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  referralCount: number;
  commissionTotal: number;
  rank: AffiliateRankLevel;
};

export async function getAffiliateRankSnapshot(
  userId: string
): Promise<AffiliateRankSnapshot> {
  const [config, referralCount] = await Promise.all([
    getAffiliateConfig(),
    prisma.affiliateReferral.count({ where: { affiliateId: userId } }),
  ]);

  return {
    rank: resolveAffiliateRank(config, referralCount),
    referralCount,
  };
}

export async function getAffiliateLeaderboard(
  take = 5
): Promise<AffiliateLeaderboardEntry[]> {
  const configPromise = getAffiliateConfig();
  const grouped = await prisma.affiliateReferral.groupBy({
    by: ["affiliateId"],
    _count: { affiliateId: true },
    orderBy: { _count: { affiliateId: "desc" } },
    take,
  });

  if (!grouped.length) return [];

  const affiliateIds = grouped.map((row) => row.affiliateId);
  const [config, users, commissions] = await Promise.all([
    configPromise,
    prisma.user.findMany({
      where: { id: { in: affiliateIds } },
      select: { id: true, name: true, avatarUrl: true },
    }),
    prisma.affiliateCommission.groupBy({
      by: ["affiliateId"],
      where: { affiliateId: { in: affiliateIds } },
      _sum: { commissionAmount: true },
    }),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const commissionById = new Map(
    commissions.map((row) => [
      row.affiliateId,
      Number(row._sum.commissionAmount ?? 0),
    ])
  );

  return grouped
    .map((row) => {
      const user = userById.get(row.affiliateId);
      if (!user) return null;
      const referralCount = row._count.affiliateId;
      return {
        userId: row.affiliateId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        referralCount,
        commissionTotal: commissionById.get(row.affiliateId) ?? 0,
        rank: resolveAffiliateRank(config, referralCount),
      };
    })
    .filter((row): row is AffiliateLeaderboardEntry => Boolean(row));
}
