import { prisma } from "@/lib/prisma";

export const AFFILIATE_CONFIG_KEY = "affiliate_config";

export type AffiliateCommissionTier = {
  id: string;
  name: string;
  minReferrals: number;
  maxReferrals: number | null;
  commissionPercent: number;
  isActive: boolean;
};

export type AffiliateRankLevel = {
  id: string;
  name: string;
  minReferrals: number;
  color: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

export type AffiliateConfig = {
  enabled: boolean;
  commissionPercent: number;
  commissionTiers: AffiliateCommissionTier[];
  rankLevels: AffiliateRankLevel[];
  commissionOn: "first_payment" | "all_payments";
  commissionTargets: "subscription"[];
  partnerCommissionEnabled: boolean;
  maxTotalCommissionPercent: number;
  attributionDays: number;
  holdDays: number;
  minPayout: number;
  programTitle: string;
  programDescription: string;
};

export const DEFAULT_AFFILIATE_CONFIG: AffiliateConfig = {
  enabled: true,
  commissionPercent: 5,
  commissionTiers: [
    {
      id: "tier-starter",
      name: "Starter",
      minReferrals: 1,
      maxReferrals: 50,
      commissionPercent: 5,
      isActive: true,
    },
    {
      id: "tier-growth",
      name: "Growth",
      minReferrals: 51,
      maxReferrals: 100,
      commissionPercent: 10,
      isActive: true,
    },
    {
      id: "tier-pro",
      name: "Pro Affiliate",
      minReferrals: 101,
      maxReferrals: 1000,
      commissionPercent: 15,
      isActive: true,
    },
  ],
  rankLevels: [
    {
      id: "rank-new",
      name: "New Affiliate",
      minReferrals: 0,
      color: "slate",
      description: "Mulai membangun jaringan referral.",
      sortOrder: 0,
      isActive: true,
    },
    {
      id: "rank-bronze",
      name: "Bronze",
      minReferrals: 5,
      color: "amber",
      description: "Mulai konsisten mengajak guru baru.",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: "rank-silver",
      name: "Silver",
      minReferrals: 25,
      color: "zinc",
      description: "Affiliate aktif dengan jaringan berkembang.",
      sortOrder: 2,
      isActive: true,
    },
    {
      id: "rank-gold",
      name: "Gold",
      minReferrals: 50,
      color: "yellow",
      description: "Kontributor affiliate unggulan.",
      sortOrder: 3,
      isActive: true,
    },
    {
      id: "rank-platinum",
      name: "Platinum",
      minReferrals: 100,
      color: "blue",
      description: "Affiliate elite dengan performa tinggi.",
      sortOrder: 4,
      isActive: true,
    },
  ],
  commissionOn: "all_payments",
  commissionTargets: ["subscription"],
  partnerCommissionEnabled: true,
  maxTotalCommissionPercent: 15,
  attributionDays: 30,
  holdDays: 7,
  minPayout: 100000,
  programTitle: "Program Afiliasi Navalogi",
  programDescription:
    "Ajak guru lain bergabung dan dapatkan komisi berulang setiap kali mereka memperpanjang langganan berbayar.",
};

export function commissionOnLabel(mode: AffiliateConfig["commissionOn"]): string {
  return mode === "all_payments"
    ? "setiap pembayaran / perpanjangan"
    : "pembayaran pertama saja";
}

export function normalizeAffiliateConfig(config: Partial<AffiliateConfig>): AffiliateConfig {
  return {
    ...DEFAULT_AFFILIATE_CONFIG,
    ...config,
    commissionTiers:
      Array.isArray(config.commissionTiers) && config.commissionTiers.length
        ? config.commissionTiers
        : DEFAULT_AFFILIATE_CONFIG.commissionTiers,
    rankLevels:
      Array.isArray(config.rankLevels) && config.rankLevels.length
        ? config.rankLevels
        : DEFAULT_AFFILIATE_CONFIG.rankLevels,
    commissionTargets:
      Array.isArray(config.commissionTargets) && config.commissionTargets.length
        ? ["subscription"]
        : DEFAULT_AFFILIATE_CONFIG.commissionTargets,
    partnerCommissionEnabled:
      typeof config.partnerCommissionEnabled === "boolean"
        ? config.partnerCommissionEnabled
        : DEFAULT_AFFILIATE_CONFIG.partnerCommissionEnabled,
    maxTotalCommissionPercent:
      typeof config.maxTotalCommissionPercent === "number"
        ? config.maxTotalCommissionPercent
        : DEFAULT_AFFILIATE_CONFIG.maxTotalCommissionPercent,
  };
}

export function resolveCommissionTier(
  config: Pick<AffiliateConfig, "commissionPercent" | "commissionTiers">,
  referralCount: number
): AffiliateCommissionTier {
  const sorted = [...(config.commissionTiers || [])]
    .filter((tier) => tier.isActive)
    .sort((a, b) => a.minReferrals - b.minReferrals);

  const matched = sorted.find((tier) => {
    const upper = tier.maxReferrals ?? Number.POSITIVE_INFINITY;
    return referralCount >= tier.minReferrals && referralCount <= upper;
  });

  if (matched) return matched;

  const highestTier = sorted.at(-1);
  if (highestTier && referralCount > highestTier.minReferrals) {
    return highestTier;
  }

  return (
    {
      id: "flat-commission",
      name: "Komisi Flat",
      minReferrals: 0,
      maxReferrals: null,
      commissionPercent: config.commissionPercent,
      isActive: true,
    }
  );
}

export function resolveAffiliateRank(
  config: Pick<AffiliateConfig, "rankLevels">,
  referralCount: number
): AffiliateRankLevel {
  const sorted = [...(config.rankLevels || [])]
    .filter((rank) => rank.isActive)
    .sort((a, b) => a.minReferrals - b.minReferrals || a.sortOrder - b.sortOrder);

  return (
    sorted.filter((rank) => referralCount >= rank.minReferrals).at(-1) ||
    DEFAULT_AFFILIATE_CONFIG.rankLevels[0]
  );
}

export async function getAffiliateConfig(): Promise<AffiliateConfig> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: AFFILIATE_CONFIG_KEY },
    });
    if (!row?.value || typeof row.value !== "object") {
      return DEFAULT_AFFILIATE_CONFIG;
    }
    return normalizeAffiliateConfig(row.value as Partial<AffiliateConfig>);
  } catch {
    return DEFAULT_AFFILIATE_CONFIG;
  }
}

export async function saveAffiliateConfig(
  config: AffiliateConfig
): Promise<AffiliateConfig> {
  await prisma.platformSetting.upsert({
    where: { key: AFFILIATE_CONFIG_KEY },
    create: { key: AFFILIATE_CONFIG_KEY, value: config as object },
    update: { value: config as object },
  });
  return config;
}

export function generateReferralCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GS-${slug || "GURU"}-${rand}`;
}

export function buildReferralLink(code: string, origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/r/${code}`;
}

export function buildRegisterLink(code: string, origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/register?ref=${encodeURIComponent(code)}`;
}
