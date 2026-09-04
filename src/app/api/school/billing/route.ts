import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSchoolBillingAccount } from "@/lib/school-billing-auth";
import { schoolCommercializationErrorResponse } from "@/lib/school-commercialization-auth";
import { getCurrentSchoolSubscription, schoolPlanSnapshot } from "@/lib/school-commercialization";
import { schoolPlanPrice } from "@/lib/school-billing-policy";
import { createMidtransTransaction, getMidtransConfig } from "@/lib/payment/midtrans";
import { createTripayTransaction } from "@/lib/payment/tripay";

export const runtime = "nodejs";

const CHECKOUT_READY_GATEWAYS = new Set(["midtrans", "tripay"]);
const checkoutSchema = z.object({
  planId: z.string().cuid(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  idempotencyKey: z.string().uuid(),
});

function metadataObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Prisma.JsonObject : {};
}

function checkoutPayload(transaction: { id: string; gateway: { slug: string }; metadata: Prisma.JsonValue | null }) {
  const metadata = metadataObject(transaction.metadata);
  return {
    transactionId: transaction.id,
    gateway: transaction.gateway.slug,
    snapToken: typeof metadata.snapToken === "string" ? metadata.snapToken : undefined,
    redirectUrl: typeof metadata.redirectUrl === "string" ? metadata.redirectUrl : undefined,
    checkoutUrl: typeof metadata.checkoutUrl === "string" ? metadata.checkoutUrl : undefined,
    qrUrl: typeof metadata.qrUrl === "string" ? metadata.qrUrl : undefined,
  };
}

async function expirePendingPayments(schoolId: string) {
  const now = new Date();
  const expired = await prisma.schoolPaymentTransaction.findMany({
    where: { schoolId, status: "PENDING", expiresAt: { lte: now } },
    select: { id: true, invoiceId: true },
    take: 10,
  });
  for (const payment of expired) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.schoolPaymentTransaction.updateMany({
        where: { id: payment.id, status: "PENDING", expiresAt: { lte: now } },
        data: { status: "EXPIRED", activeCheckoutKey: null },
      });
      if (changed.count === 1) await tx.schoolInvoice.updateMany({ where: { id: payment.invoiceId, status: "ISSUED" }, data: { status: "VOID" } });
    });
  }
}

export async function GET() {
  try {
    const access = await requireSchoolBillingAccount();
    await expirePendingPayments(access.schoolId);
    const [plans, subscription, transactions, invoices, defaultGateway] = await Promise.all([
      prisma.schoolPlan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      getCurrentSchoolSubscription(access.schoolId),
      prisma.schoolPaymentTransaction.findMany({
        where: { schoolId: access.schoolId },
        include: { plan: { select: { id: true, name: true, slug: true } }, gateway: { select: { slug: true, name: true } }, invoice: { select: { id: true, number: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.schoolInvoice.findMany({ where: { schoolId: access.schoolId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.paymentGateway.findFirst({ where: { isActive: true, isDefault: true } }),
    ]);

    let midtrans: { clientKey: string; isSandbox: boolean } | null = null;
    if (defaultGateway?.slug === "midtrans") {
      const config = getMidtransConfig(defaultGateway);
      if (config.clientKey) midtrans = { clientKey: config.clientKey, isSandbox: !config.isProduction };
    }

    return Response.json({
      plans: plans.map(schoolPlanSnapshot),
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        creditBalance: subscription.creditBalance,
        currentPeriodEnd: subscription.currentPeriodEnd,
        pjjAddOnEnabled: subscription.pjjAddOnEnabled,
        plan: schoolPlanSnapshot(subscription.plan),
      } : null,
      transactions,
      invoices,
      payment: {
        available: !!defaultGateway && CHECKOUT_READY_GATEWAYS.has(defaultGateway.slug),
        gateway: defaultGateway ? { name: defaultGateway.name, slug: defaultGateway.slug, isSandbox: defaultGateway.isSandbox } : null,
        midtrans,
      },
    });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let createdId: string | null = null;
  try {
    const access = await requireSchoolBillingAccount();
    const input = checkoutSchema.parse(await request.json().catch(() => null));
    await expirePendingPayments(access.schoolId);
    const [plan, gateway] = await Promise.all([
      prisma.schoolPlan.findFirst({ where: { id: input.planId, isActive: true } }),
      prisma.paymentGateway.findFirst({ where: { isActive: true, isDefault: true } }),
    ]);
    if (!plan) return Response.json({ error: "Paket sekolah tidak tersedia." }, { status: 404 });
    if (!gateway) return Response.json({ error: "Payment gateway belum dikonfigurasi di Super Admin." }, { status: 503 });
    if (!CHECKOUT_READY_GATEWAYS.has(gateway.slug)) {
      return Response.json({ error: `${gateway.name} belum mendukung checkout otomatis. Gunakan Midtrans atau Tripay.` }, { status: 501 });
    }
    const amount = schoolPlanPrice(plan, input.billingCycle);
    if (amount <= 0) return Response.json({ error: "Harga paket untuk periode ini belum valid." }, { status: 400 });

    const scopedKey = `school:${access.schoolId}:${input.idempotencyKey}`;
    const existing = await prisma.schoolPaymentTransaction.findUnique({
      where: { idempotencyKey: scopedKey }, include: { gateway: true },
    });
    if (existing) {
      const payload = checkoutPayload(existing);
      if (!payload.snapToken && !payload.checkoutUrl && existing.status === "PENDING") {
        return Response.json({ error: "Checkout yang sama sedang diproses. Muat ulang status transaksi." }, { status: 409 });
      }
      return Response.json(payload);
    }

    const orderId = `GSS-${Date.now()}-${access.userId.slice(-6)}`;
    const invoiceNumber = `INV-SCH-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await prisma.$transaction(async (tx) => {
      const invoice = await tx.schoolInvoice.create({
        data: { schoolId: access.schoolId, number: invoiceNumber, status: "ISSUED", amount, dueAt: expiresAt, createdById: access.userId, notes: `${plan.name} · ${input.billingCycle === "YEARLY" ? "Tahunan" : "Bulanan"}` },
      });
      return tx.schoolPaymentTransaction.create({
        data: {
          schoolId: access.schoolId,
          planId: plan.id,
          invoiceId: invoice.id,
          gatewayId: gateway.id,
          createdById: access.userId,
          billingCycle: input.billingCycle,
          gatewayRef: orderId,
          idempotencyKey: scopedKey,
          activeCheckoutKey: access.schoolId,
          amount,
          expiresAt,
          metadata: { planName: plan.name, planSlug: plan.slug, billingCycle: input.billingCycle, quotedAmount: amount },
        },
        include: { gateway: true },
      });
    }, { isolationLevel: "Serializable" });
    createdId = created.id;

    const common = {
      orderId,
      amount,
      customerName: access.account.name || access.account.school!.name,
      customerEmail: access.account.email || "admin-sekolah@example.com",
      itemName: `Paket Sekolah ${plan.name} (${input.billingCycle === "YEARLY" ? "Tahunan" : "Bulanan"})`,
    };
    if (gateway.slug === "midtrans") {
      const snap = await createMidtransTransaction(gateway, common);
      const updated = await prisma.schoolPaymentTransaction.update({
        where: { id: created.id },
        data: { metadata: { ...metadataObject(created.metadata), snapToken: snap.token, redirectUrl: snap.redirect_url } },
        include: { gateway: true },
      });
      return Response.json(checkoutPayload(updated), { status: 201 });
    }

    const tripay = await createTripayTransaction(gateway, common);
    const updated = await prisma.schoolPaymentTransaction.update({
      where: { id: created.id },
      data: { providerRef: tripay.reference || null, metadata: { ...metadataObject(created.metadata), checkoutUrl: tripay.checkoutUrl, qrUrl: tripay.qrUrl || null } },
      include: { gateway: true },
    });
    return Response.json(checkoutPayload(updated), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data checkout sekolah tidak valid." }, { status: 400 });
    if (createdId) {
      try {
        const payment = await prisma.schoolPaymentTransaction.findUnique({ where: { id: createdId }, select: { metadata: true, invoiceId: true } });
        const message = error instanceof Error ? error.message.slice(0, 500) : "Gateway tidak merespons";
        const ambiguous = error instanceof TypeError || (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name));
        if (payment && !ambiguous) {
          await prisma.$transaction(async (tx) => {
            const failed = await tx.schoolPaymentTransaction.updateMany({
              where: { id: createdId!, status: "PENDING" },
              data: { status: "FAILED", activeCheckoutKey: null, metadata: { ...metadataObject(payment.metadata), checkoutError: message } },
            });
            if (failed.count === 1) await tx.schoolInvoice.updateMany({ where: { id: payment.invoiceId, status: "ISSUED" }, data: { status: "VOID" } });
          });
        } else {
          await prisma.schoolPaymentTransaction.updateMany({
            where: { id: createdId, status: "PENDING" },
            data: { metadata: { ...metadataObject(payment?.metadata || null), checkoutError: message } },
          });
        }
      } catch (cleanupError) {
        console.error("[school billing cleanup]", cleanupError);
      }
    }
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return Response.json({ error: "Checkout duplikat sedang diproses. Muat ulang status transaksi." }, { status: 409 });
    }
    console.error("[school billing checkout]", error);
    return schoolCommercializationErrorResponse(error);
  }
}
