import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  DEFAULT_AFFILIATE_CONFIG,
  getAffiliateConfig,
  normalizeAffiliateConfig,
  saveAffiliateConfig,
  type AffiliateConfig,
} from "@/lib/affiliate";

const commissionTierSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  minReferrals: z.coerce.number().int().min(0),
  maxReferrals: z.coerce.number().int().min(0).nullable(),
  commissionPercent: z.coerce.number().min(0).max(100),
  isActive: z.boolean(),
});

const rankLevelSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  minReferrals: z.coerce.number().int().min(0),
  color: z.string().trim().min(1),
  description: z.string(),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

const configSchema = z
  .object({
    enabled: z.boolean(),
    commissionPercent: z.coerce.number().min(0).max(100),
    commissionTiers: z.array(commissionTierSchema).min(1),
    rankLevels: z.array(rankLevelSchema).min(1),
    commissionOn: z.enum(["first_payment", "all_payments"]),
    commissionTargets: z.array(z.literal("subscription")).min(1),
    partnerCommissionEnabled: z.boolean(),
    maxTotalCommissionPercent: z.coerce.number().min(0).max(100),
    attributionDays: z.coerce.number().int().min(1).max(365),
    holdDays: z.coerce.number().int().min(0).max(90),
    minPayout: z.coerce.number().min(0),
    programTitle: z.string().trim().min(1),
    programDescription: z.string(),
  })
  .superRefine((value, ctx) => {
    value.commissionTiers.forEach((tier, index) => {
      if (tier.maxReferrals !== null && tier.maxReferrals < tier.minReferrals) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["commissionTiers", index, "maxReferrals"],
          message: "Maksimal referral tidak boleh lebih kecil dari minimal referral",
        });
      }
    });
  });

export async function GET() {
  try {
    await requireSuperAdmin();
    const config = await getAffiliateConfig();
    return NextResponse.json({ config, defaults: DEFAULT_AFFILIATE_CONFIG });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireSuperAdmin();
    const body = configSchema.parse(await req.json().catch(() => ({}))) as AffiliateConfig;
    const config = await saveAffiliateConfig(normalizeAffiliateConfig(body));
    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
