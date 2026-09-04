import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMidtransSignature } from "@/lib/payment/midtrans";
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
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const {
      order_id,
      transaction_status,
      status_code,
      gross_amount,
      signature_key,
      payment_type,
    } = body;

    if (!order_id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { gatewayRef: order_id },
      include: { gateway: true, plan: true },
    });

    const schoolTransaction = transaction
      ? null
      : await prisma.schoolPaymentTransaction.findUnique({
          where: { gatewayRef: order_id },
          include: { gateway: true },
        });

    const marketOrder =
      transaction || schoolTransaction
        ? null
        : await prisma.marketplaceOrder.findUnique({
            where: { gatewayRef: order_id },
            include: { gateway: true },
          });

    if (!transaction && !schoolTransaction && !marketOrder) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const payment = transaction || schoolTransaction || marketOrder!;

    if (payment.gateway.slug !== "midtrans") {
      return NextResponse.json({ error: "Gateway mismatch" }, { status: 400 });
    }

    if (!signature_key || !status_code || !gross_amount) {
      return NextResponse.json({ error: "Missing signature payload" }, { status: 400 });
    }
    const valid = verifyMidtransSignature(
      payment.gateway,
      order_id,
      status_code,
      gross_amount,
      signature_key
    );
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const callbackAmount = parseAmountCents(gross_amount);
    const expectedAmount = parseAmountCents(payment.amount);
    if (callbackAmount === null || callbackAmount !== expectedAmount) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const successStatuses = ["capture", "settlement"];
    const isCaptureApproved =
      transaction_status === "capture" && body.fraud_status !== "challenge";
    const isPaid =
      transaction_status === "settlement" ||
      (successStatuses.includes(transaction_status) && isCaptureApproved);

    if (isPaid) {
      if (transaction) await activateTransaction(transaction.id, payment_type);
      else if (schoolTransaction) await activateSchoolPayment(schoolTransaction.id, payment_type);
      else await activateMarketplaceOrder(marketOrder!.id, payment_type);
    } else if (transaction_status === "refund" && schoolTransaction) {
      await refundSchoolPayment(schoolTransaction.id);
    } else if (["deny", "cancel", "expire", "failure"].includes(transaction_status)) {
      const status = transaction_status === "expire" ? "EXPIRED" : "FAILED";
      if (transaction) {
        await prisma.transaction.updateMany({
          where: { id: transaction.id, status: "PENDING" },
          data: { status },
        });
      } else if (schoolTransaction) {
        await prisma.$transaction([
          prisma.schoolPaymentTransaction.updateMany({
            where: { id: schoolTransaction.id, status: "PENDING" },
            data: { status, activeCheckoutKey: null },
          }),
          prisma.schoolInvoice.updateMany({
            where: { id: schoolTransaction.invoiceId, status: "ISSUED" },
            data: { status: "VOID" },
          }),
        ]);
      } else {
        await failMarketplaceOrder(marketOrder!.id, status);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Midtrans webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
