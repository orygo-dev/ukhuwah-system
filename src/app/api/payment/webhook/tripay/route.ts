import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTripayCallback } from "@/lib/payment/tripay";
import { activateTransaction } from "@/lib/payment/activate";
import { activateSchoolPayment, refundSchoolPayment } from "@/lib/payment/activate-school";
import { activateMarketplaceOrder, failMarketplaceOrder } from "@/lib/payment/activate-market";

export const runtime = "nodejs";

function parseAmountCents(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-callback-signature") || "";
    const body = JSON.parse(rawBody);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const reference = body.reference || body.merchant_ref;
    if (!reference) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [{ gatewayRef: reference }, { gatewayRef: body.merchant_ref }],
      },
      include: { gateway: true },
    });

    const schoolTransaction = transaction
      ? null
      : await prisma.schoolPaymentTransaction.findFirst({
          where: {
            OR: [
              { gatewayRef: reference },
              { gatewayRef: body.merchant_ref },
              { providerRef: reference },
            ],
          },
          include: { gateway: true },
        });

    const marketOrder =
      transaction || schoolTransaction
        ? null
        : await prisma.marketplaceOrder.findFirst({
            where: {
              OR: [{ gatewayRef: reference }, { gatewayRef: body.merchant_ref }],
            },
            include: { gateway: true },
          });

    if (!transaction && !schoolTransaction && !marketOrder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payment = transaction || schoolTransaction || marketOrder!;

    if (payment.gateway.slug !== "tripay") {
      return NextResponse.json({ error: "Gateway mismatch" }, { status: 400 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }
    const valid = verifyTripayCallback(payment.gateway, signature, rawBody);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const callbackAmount = parseAmountCents(body.amount || body.total_amount);
    const expectedAmount = parseAmountCents(payment.amount);
    if (callbackAmount === null || callbackAmount !== expectedAmount) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const status = String(body.status || "").toUpperCase();

    if (status === "PAID") {
      if (transaction) await activateTransaction(transaction.id, body.payment_method || "tripay");
      else if (schoolTransaction) {
        await activateSchoolPayment(schoolTransaction.id, body.payment_method || "tripay");
      } else {
        await activateMarketplaceOrder(marketOrder!.id, body.payment_method || "tripay");
      }
    } else if (status === "REFUND" && schoolTransaction) {
      await refundSchoolPayment(schoolTransaction.id);
    } else if (["FAILED", "EXPIRED", "REFUND"].includes(status)) {
      const nextStatus = status === "EXPIRED" ? "EXPIRED" : status === "REFUND" ? "REFUNDED" : "FAILED";
      if (transaction) {
        await prisma.transaction.updateMany({
          where: { id: transaction.id, status: "PENDING" },
          data: { status: nextStatus },
        });
      } else if (schoolTransaction) {
        await prisma.$transaction([
          prisma.schoolPaymentTransaction.updateMany({
            where: { id: schoolTransaction.id, status: "PENDING" },
            data: { status: nextStatus, activeCheckoutKey: null },
          }),
          prisma.schoolInvoice.updateMany({
            where: { id: schoolTransaction.invoiceId, status: "ISSUED" },
            data: { status: "VOID" },
          }),
        ]);
      } else if (status === "FAILED" || status === "EXPIRED") {
        await failMarketplaceOrder(marketOrder!.id, status === "EXPIRED" ? "EXPIRED" : "FAILED");
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    console.error("Tripay webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
