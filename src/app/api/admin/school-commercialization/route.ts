import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { grantSchoolCredits } from "@/lib/school-credit-ledger";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upsert-plan"),
    id: z.string().cuid().optional(),
    name: z.string().trim().min(2).max(100),
    slug: z.string().trim().regex(/^[a-z0-9-]+$/),
    description: z.string().max(2000).optional(),
    priceMonthly: z.number().nonnegative(),
    priceYearly: z.number().nonnegative(),
    maxTeacherSeats: z.number().int().min(1).max(10000),
    maxStudents: z.number().int().min(1).max(100000),
    monthlyAiCredits: z.number().int().nonnegative(),
    features: z.record(z.unknown()),
  }),
  z.object({
    action: z.literal("activate-subscription"),
    schoolId: z.string().cuid(),
    planId: z.string().cuid(),
    status: z.enum(["TRIAL", "ACTIVE", "GRACE", "READ_ONLY", "SUSPENDED", "EXPIRED"]),
    periodEnd: z.string().datetime().optional(),
    pjjAddOnEnabled: z.boolean().default(false),
  }),
  z.object({ action: z.literal("set-plan-active"), planId: z.string().cuid(), isActive: z.boolean() }),
  z.object({ action: z.literal("grant-credits"), schoolId: z.string().cuid(), amount: z.number().int().positive().max(1000000), note: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("issue-invoice"), schoolId: z.string().cuid(), amount: z.number().nonnegative(), dueAt: z.string().datetime().optional(), notes: z.string().max(2000).optional() }),
  z.object({ action: z.literal("mark-paid"), invoiceId: z.string().cuid() }),
]);

async function requireSuperAdmin() {
  const session = await auth();
  return session?.user?.role === "SUPER_ADMIN" ? session : null;
}

export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 });
  const [plans, subscriptions, schools, payments] = await Promise.all([
    prisma.schoolPlan.findMany({
      include: { _count: { select: { subscriptions: { where: { status: { not: "CANCELED" } } } } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.schoolSubscription.findMany({ include: { school: true, plan: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.school.findMany({ select: { id: true, name: true, npsn: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.schoolPaymentTransaction.findMany({
      include: { school: { select: { id: true, name: true, npsn: true } }, plan: { select: { id: true, name: true, slug: true } }, gateway: { select: { name: true, slug: true } }, invoice: { select: { number: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return Response.json({ plans, subscriptions, schools, payments });
}

export async function POST(request: Request) {
  const session = await requireSuperAdmin();
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    if (input.action === "upsert-plan") {
      const data = { name: input.name, slug: input.slug, description: input.description, priceMonthly: input.priceMonthly, priceYearly: input.priceYearly, maxTeacherSeats: input.maxTeacherSeats, maxStudents: input.maxStudents, monthlyAiCredits: input.monthlyAiCredits, features: input.features as Prisma.InputJsonValue };
      const plan = input.id ? await prisma.schoolPlan.update({ where: { id: input.id }, data }) : await prisma.schoolPlan.create({ data });
      return Response.json({ plan }, { status: input.id ? 200 : 201 });
    }
    if (input.action === "set-plan-active") {
      const plan = await prisma.schoolPlan.update({ where: { id: input.planId }, data: { isActive: input.isActive } });
      return Response.json({ plan });
    }
    if (input.action === "activate-subscription") {
      if (["TRIAL", "ACTIVE", "GRACE"].includes(input.status) && !input.periodEnd) {
        return Response.json({ error: "Tanggal akhir wajib diisi untuk status trial, active, atau grace." }, { status: 400 });
      }
      const activationKey = crypto.randomUUID();
      const subscription = await prisma.$transaction(async (tx) => {
        const plan = await tx.schoolPlan.findUniqueOrThrow({ where: { id: input.planId } });
        if (!plan.isActive) throw new Error("SCHOOL_PLAN_INACTIVE");
        const periodEnd = input.periodEnd ? new Date(input.periodEnd) : null;
        const current = await tx.schoolSubscription.findFirst({ where: { schoolId: input.schoolId, status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" } });
        const dates = { trialEndsAt: input.status === "TRIAL" ? periodEnd : null, currentPeriodEnd: input.status === "ACTIVE" ? periodEnd : null, graceEndsAt: input.status === "GRACE" ? periodEnd : null };
        const created = current
          ? await tx.schoolSubscription.update({ where: { id: current.id }, data: { planId: input.planId, status: input.status, ...dates, pjjAddOnEnabled: input.pjjAddOnEnabled, version: { increment: 1 } } })
          : await tx.schoolSubscription.create({ data: { schoolId: input.schoolId, planId: input.planId, status: input.status, ...dates, pjjAddOnEnabled: input.pjjAddOnEnabled } });
        const activeSeats = await tx.schoolSeat.findMany({ where: { subscriptionId: created.id, releasedAt: null }, orderBy: [{ assignedAt: "asc" }, { id: "asc" }], select: { id: true } });
        const excessSeats = activeSeats.slice(plan.maxTeacherSeats);
        if (excessSeats.length > 0) await tx.schoolSeat.updateMany({ where: { id: { in: excessSeats.map((seat) => seat.id) }, releasedAt: null }, data: { releasedAt: new Date() } });
        await tx.schoolSubscriptionAudit.create({ data: { subscriptionId: created.id, schoolId: input.schoolId, actorId: session.user.id, action: "SUBSCRIPTION_ACTIVATED", metadata: { planId: input.planId, status: input.status, activationKey, releasedSeatIds: excessSeats.map((seat) => seat.id) } } });
        if (plan.monthlyAiCredits > 0) {
          await grantSchoolCredits({ schoolId: input.schoolId, subscriptionId: created.id, amount: plan.monthlyAiCredits, source: "SUBSCRIPTION_GRANT", description: "Kredit aktivasi paket sekolah", idempotencyKey: `admin-activation:${activationKey}` }, tx);
        }
        return created;
      }, { isolationLevel: "Serializable" });
      return Response.json({ subscription }, { status: 201 });
    }
    if (input.action === "grant-credits") {
      const subscription = await prisma.schoolSubscription.findFirst({ where: { schoolId: input.schoolId, status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" } });
      if (!subscription) return Response.json({ error: "Subscription sekolah tidak ditemukan." }, { status: 404 });
      const credit = await grantSchoolCredits({ schoolId: input.schoolId, subscriptionId: subscription.id, amount: input.amount, source: "ADMIN_GRANT", description: input.note, idempotencyKey: `admin:${session.user.id}:${crypto.randomUUID()}` });
      return Response.json({ credit }, { status: 201 });
    }
    if (input.action === "issue-invoice") {
      const subscription = await prisma.schoolSubscription.findFirst({ where: { schoolId: input.schoolId, status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" } });
      const invoice = await prisma.schoolInvoice.create({ data: { schoolId: input.schoolId, subscriptionId: subscription?.id, number: `INV-SCH-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: "ISSUED", amount: input.amount, dueAt: input.dueAt ? new Date(input.dueAt) : undefined, notes: input.notes, createdById: session.user.id } });
      return Response.json({ invoice }, { status: 201 });
    }
    const invoice = await prisma.schoolInvoice.update({ where: { id: input.invoiceId }, data: { status: "PAID", paidAt: new Date() } });
    return Response.json({ invoice });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.errors[0].message }, { status: 400 });
    if (error instanceof Error && error.message === "SCHOOL_PLAN_INACTIVE") return Response.json({ error: "Paket sekolah sudah nonaktif dan tidak dapat digunakan untuk subscription baru." }, { status: 409 });
    if (error instanceof Error && "code" in error && error.code === "P2002") return Response.json({ error: "Slug atau identitas paket sudah digunakan." }, { status: 409 });
    console.error("[admin school commercialization]", error);
    return Response.json({ error: "Operasi paket sekolah gagal." }, { status: 500 });
  }
}
