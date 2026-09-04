import assert from "node:assert/strict";
import test from "node:test";
import {
  isSchoolSubscriptionReadable,
  isSchoolSubscriptionWritable,
  mergeSchoolFeatures,
  SCHOOL_PJJ_HARD_CAP,
} from "../../src/lib/school-commercialization";
import { addSchoolBillingPeriod, schoolPlanPrice } from "../../src/lib/school-billing-policy";

test("school commercialization is fail-closed when feature flag is off", () => {
  const previous = process.env.SCHOOL_COMMERCIALIZATION_ENABLED;
  delete process.env.SCHOOL_COMMERCIALIZATION_ENABLED;
  assert.equal(isSchoolSubscriptionReadable("ACTIVE"), false);
  assert.equal(isSchoolSubscriptionWritable("ACTIVE"), false);
  process.env.SCHOOL_COMMERCIALIZATION_ENABLED = previous;
});

test("expired, suspended, read-only, and canceled subscriptions cannot write", () => {
  const previous = process.env.SCHOOL_COMMERCIALIZATION_ENABLED;
  process.env.SCHOOL_COMMERCIALIZATION_ENABLED = "true";
  for (const status of ["EXPIRED", "SUSPENDED", "READ_ONLY", "CANCELED"] as const) {
    assert.equal(isSchoolSubscriptionWritable(status), false);
  }
  assert.equal(isSchoolSubscriptionReadable("READ_ONLY"), true);
  process.env.SCHOOL_COMMERCIALIZATION_ENABLED = previous;
});

test("trial and grace deadlines are enforced", () => {
  const previous = process.env.SCHOOL_COMMERCIALIZATION_ENABLED;
  process.env.SCHOOL_COMMERCIALIZATION_ENABLED = "true";
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  assert.equal(isSchoolSubscriptionWritable("TRIAL", new Date(), { trialEndsAt: future, currentPeriodEnd: null, graceEndsAt: null }), true);
  assert.equal(isSchoolSubscriptionWritable("TRIAL", new Date(), { trialEndsAt: past, currentPeriodEnd: null, graceEndsAt: null }), false);
  assert.equal(isSchoolSubscriptionWritable("GRACE", new Date(), { trialEndsAt: null, currentPeriodEnd: null, graceEndsAt: future }), true);
  process.env.SCHOOL_COMMERCIALIZATION_ENABLED = previous;
});

test("feature overrides are additive and PJJ commercial cap stays 25", () => {
  assert.deepEqual(mergeSchoolFeatures({ administration: true, ai_drafts: false }, { ai_drafts: true }), { administration: true, ai_drafts: true });
  assert.equal(SCHOOL_PJJ_HARD_CAP, 25);
});

test("school billing periods handle month ends and leap years without date overflow", () => {
  assert.equal(addSchoolBillingPeriod(new Date("2026-01-31T12:00:00.000Z"), "MONTHLY").toISOString(), "2026-02-28T12:00:00.000Z");
  assert.equal(addSchoolBillingPeriod(new Date("2024-02-29T12:00:00.000Z"), "YEARLY").toISOString(), "2025-02-28T12:00:00.000Z");
});

test("school checkout uses the selected billing price and rejects non-finite prices", () => {
  const plan = { priceMonthly: "150000", priceYearly: "1500000" };
  assert.equal(schoolPlanPrice(plan, "MONTHLY"), 150000);
  assert.equal(schoolPlanPrice(plan, "YEARLY"), 1500000);
  assert.equal(schoolPlanPrice({ priceMonthly: "invalid", priceYearly: 0 }, "MONTHLY"), 0);
});
