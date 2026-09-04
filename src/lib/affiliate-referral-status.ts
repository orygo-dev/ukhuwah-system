export type ReferralMembershipStatus = "pending" | "active" | "inactive";

export const REFERRAL_MEMBERSHIP_LABEL: Record<ReferralMembershipStatus, string> = {
  pending: "Belum berlangganan",
  active: "Aktif",
  inactive: "Tidak aktif",
};

export function resolveReferralMembershipStatus(input: {
  planSlug: string | null | undefined;
  planExpiresAt: Date | null | undefined;
  hasPaidSubscription: boolean;
  now?: Date;
}): ReferralMembershipStatus {
  if (!input.hasPaidSubscription) {
    return "pending";
  }

  const now = input.now ?? new Date();
  const isPaidPlan = !!input.planSlug && input.planSlug !== "free";
  const notExpired =
    !!input.planExpiresAt && input.planExpiresAt.getTime() > now.getTime();

  if (isPaidPlan && notExpired) {
    return "active";
  }

  return "inactive";
}
