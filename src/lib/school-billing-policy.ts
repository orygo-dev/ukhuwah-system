export type SchoolBillingCycleValue = "MONTHLY" | "YEARLY";

export function addSchoolBillingPeriod(from: Date, cycle: SchoolBillingCycleValue) {
  const result = new Date(from);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  if (cycle === "YEARLY") result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export function schoolPlanPrice(
  plan: { priceMonthly: unknown; priceYearly: unknown },
  cycle: SchoolBillingCycleValue
) {
  const value = Number(cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly);
  return Number.isFinite(value) ? Math.round(value) : 0;
}
