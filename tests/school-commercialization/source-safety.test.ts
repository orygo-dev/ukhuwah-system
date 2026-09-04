import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("migration is additive and does not alter legacy billing/document tables", () => {
  const sql = read("prisma/migrations/202608270001_school_commercialization/migration.sql");
  assert.doesNotMatch(sql, /ALTER TABLE `(users|transactions|documents|credit_ledger|live_class_sessions)`/i);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN|INDEX)/i);
  assert.match(sql, /CREATE TABLE `school_subscriptions`/);
  assert.match(sql, /CREATE TABLE `school_document_templates`/);
  const identifiers = [...sql.matchAll(/(?:INDEX|CONSTRAINT) `([^`]+)`/g)].map((match) => match[1]);
  assert.equal(identifiers.filter((name) => name.length > 64).length, 0);
});

test("approved school exports include official school identity", () => {
  const source = read("src/app/api/school/administration/documents/[id]/export/route.ts");
  assert.match(source, /document\.school\.name/);
  assert.match(source, /document\.school\.npsn/);
  assert.match(source, /brandedContent/);
});

test("school credit ledger uses idempotency and optimistic balance compare-and-swap", () => {
  const source = read("src/lib/school-credit-ledger.ts");
  assert.match(source, /idempotencyKey/);
  assert.match(source, /creditBalance: subscription\.creditBalance/);
  assert.match(source, /changed\.count !== 1/);
  assert.match(source, /balanceAfter < 0/);
});

test("document and schedule mutations use optimistic version guards", () => {
  const documentRoute = read("src/app/api/school/administration/documents/[id]/route.ts");
  const scheduleRoute = read("src/app/api/school/administration/schedules/route.ts");
  assert.match(documentRoute, /version: input\.expectedVersion/);
  assert.match(scheduleRoute, /version: input\.expectedVersion/);
  assert.match(scheduleRoute, /isolationLevel: "Serializable"/);
});

test("personal billing remains available and school generation is isolated", () => {
  const generate = read("src/app/api/generate/route.ts");
  assert.match(generate, /spendSchoolCredits/);
  assert.match(generate, /spendCredits/);
  assert.match(generate, /creditSource: useSchoolCredits \? "school" : "personal"/);
});

test("super admin renders and manages persisted school plans", () => {
  const client = read("src/components/admin/school-commercialization-admin-client.tsx");
  const route = read("src/app/api/admin/school-commercialization/route.ts");
  assert.match(client, /Daftar paket tersedia/);
  assert.match(client, /plans\.map/);
  assert.match(client, /setEditingPlan\(plan\)/);
  assert.match(client, /set-plan-active/);
  assert.match(route, /subscriptions: \{ where: \{ status: \{ not: "CANCELED" \}/);
  assert.match(route, /SCHOOL_PLAN_INACTIVE/);
  assert.match(route, /admin-activation:\$\{activationKey\}/);
  assert.doesNotMatch(route, /updateMany\(\{ where: \{ schoolId: input\.schoolId, status: \{ not: "CANCELED" \} \}, data: \{ status: "CANCELED" \}/);
});

test("school self-service billing is isolated from personal transactions", () => {
  const sql = read("prisma/migrations/202608270002_school_self_service_billing/migration.sql");
  const route = read("src/app/api/school/billing/route.ts");
  assert.match(sql, /CREATE TABLE `school_payment_transactions`/);
  assert.doesNotMatch(sql, /ALTER TABLE `(transactions|subscription_plans|users)`/i);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN|INDEX)/i);
  assert.match(sql, /UNIQUE INDEX `school_payment_transactions_idempotency_key_key`/);
  assert.match(sql, /UNIQUE INDEX `school_payment_transactions_active_checkout_key_key`/);
  const identifiers = [...sql.matchAll(/(?:INDEX|CONSTRAINT) `([^`]+)`/g)].map((match) => match[1]);
  assert.equal(identifiers.filter((name) => name.length > 64).length, 0);
  assert.match(route, /requireSchoolBillingAccount/);
  assert.match(route, /idempotencyKey/);
  assert.match(route, /schoolPlanPrice/);
  assert.match(read("src/lib/school-commercialization.ts"), /priceMonthly: plan\.priceMonthly/);
  assert.doesNotMatch(route, /prisma\.transaction\.create/);
});

test("verified payment callbacks activate both personal and school transactions", () => {
  for (const gateway of ["midtrans", "tripay"]) {
    const webhook = read(`src/app/api/payment/webhook/${gateway}/route.ts`);
    assert.match(webhook, /activateTransaction/);
    assert.match(webhook, /activateSchoolPayment/);
    assert.match(webhook, /Amount mismatch/);
    assert.match(webhook, /Invalid signature/);
  }
  const activation = read("src/lib/payment/activate-school.ts");
  assert.match(activation, /status: "PENDING"/);
  assert.match(activation, /isolationLevel: "Serializable"/);
  assert.match(activation, /school-payment:\$\{payment\.id\}:initial/);
  assert.match(activation, /PAYMENT_ACTIVATED/);
  assert.match(activation, /SEATS_RELEASED_FOR_PLAN_LIMIT/);
  assert.match(activation, /refundSchoolPayment/);
  assert.match(activation, /PAYMENT_REFUNDED/);
});

test("admin sekolah sees plan catalog before having an active subscription", () => {
  const billingAuth = read("src/lib/school-billing-auth.ts");
  const billingUi = read("src/components/school/school-subscription-client.tsx");
  assert.doesNotMatch(billingAuth, /getCurrentSchoolSubscription/);
  assert.match(billingUi, /Pilih paket/);
  assert.match(billingUi, /Berlangganan/);
  assert.match(billingUi, /Perbarui status/);
  assert.match(billingUi, /Unduh invoice PDF/);
  const invoiceRoute = read("src/app/api/school/billing/invoices/[id]/route.ts");
  assert.match(invoiceRoute, /schoolId: access\.schoolId/);
  assert.match(invoiceRoute, /Cache-Control.*private, no-store/);
});
