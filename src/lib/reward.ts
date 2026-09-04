import { prisma } from "@/lib/prisma";

export const REWARD_CONFIG_KEY = "reward_config";

export type RewardConfig = {
  enabled: boolean;
  pageTitle: string;
  pageDescription: string;
  lowCreditThreshold: number;
};

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  enabled: true,
  pageTitle: "Dapatkan Kredit",
  pageDescription:
    "Selesaikan misi untuk mendapatkan kredit gratis yang bisa dipakai di generator AI.",
  lowCreditThreshold: 3,
};

export async function getRewardConfig(): Promise<RewardConfig> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: REWARD_CONFIG_KEY },
    });
    if (!row?.value || typeof row.value !== "object") {
      return DEFAULT_REWARD_CONFIG;
    }
    return { ...DEFAULT_REWARD_CONFIG, ...(row.value as RewardConfig) };
  } catch {
    return DEFAULT_REWARD_CONFIG;
  }
}

export async function saveRewardConfig(config: RewardConfig): Promise<RewardConfig> {
  await prisma.platformSetting.upsert({
    where: { key: REWARD_CONFIG_KEY },
    create: { key: REWARD_CONFIG_KEY, value: config as object },
    update: { value: config as object },
  });
  return config;
}

export const CREDIT_LEDGER_LABELS: Record<string, string> = {
  REWARD_MISSION: "Misi reward",
  REWARDED_AD: "Iklan reward",
  SUBSCRIPTION: "Langganan",
  TOPUP: "Top up kredit",
  AFFILIATE: "Afiliasi",
  WALLET_CONVERSION: "Beli dari dompet",
  REFERRAL_BONUS: "Bonus referral",
  ADMIN: "Admin",
  REGISTRATION: "Pendaftar baru",
  SPEND_GENERATE: "Generate dokumen",
};
