import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMidtransTransaction } from "@/lib/payment/midtrans";
import { createTripayTransaction } from "@/lib/payment/tripay";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export const runtime = "nodejs";

const CHECKOUT_READY_GATEWAYS = new Set(["midtrans", "tripay"]);

const schema = z.object({
  planSlug: z.string().trim().min(1).optional(),
  creditPackageSlug: z.string().trim().min(1).optional(),
});

export async function POST(req: Request) {
  let createdTransactionId: string | null = null;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isTeacherWorkspaceRole(session.user.role)) {
      return forbiddenRoleResponse("Pembelian paket dan kredit hanya tersedia untuk akun guru.");
    }

    const { planSlug, creditPackageSlug } = schema.parse(
      await req.json().catch(() => null)
    );
    if (!planSlug && !creditPackageSlug) {
      return NextResponse.json({ error: "Produk tidak valid" }, { status: 400 });
    }
    if (planSlug && creditPackageSlug) {
      return NextResponse.json(
        { error: "Pilih salah satu produk: paket langganan atau paket kredit." },
        { status: 400 }
      );
    }

    const plan = planSlug
      ? await prisma.subscriptionPlan.findFirst({
          where: { slug: planSlug, isActive: true },
        })
      : null;
    const creditPackage = creditPackageSlug
      ? await prisma.creditPackage.findFirst({
          where: { slug: creditPackageSlug, isActive: true },
        })
      : null;

    if (planSlug && (!plan || Number(plan.priceMonthly) <= 0)) {
      return NextResponse.json({ error: "Paket langganan tidak valid" }, { status: 400 });
    }
    if (creditPackageSlug && (!creditPackage || Number(creditPackage.price) <= 0)) {
      return NextResponse.json({ error: "Paket kredit tidak valid" }, { status: 400 });
    }

    const gateway = await prisma.paymentGateway.findFirst({
      where: { isActive: true, isDefault: true },
    });
    if (!gateway) {
      return NextResponse.json(
        { error: "Payment gateway belum dikonfigurasi di Super Admin" },
        { status: 503 }
      );
    }

    if (!CHECKOUT_READY_GATEWAYS.has(gateway.slug)) {
      return NextResponse.json(
        {
          error: `${gateway.name} sudah dapat dikonfigurasi, tetapi checkout otomatis belum diaktifkan. Gunakan Midtrans atau Tripay untuk transaksi aktif saat ini.`,
        },
        { status: 501 }
      );
    }

    const isTopup = !!creditPackage;
    const amount = Math.round(
      Number(isTopup ? creditPackage!.price : plan!.priceMonthly)
    );
    const orderId = `GS-${Date.now()}-${session.user.id.slice(-6)}`;
    const itemName = isTopup
      ? `Top Up ${creditPackage!.name}`
      : `Langganan ${plan!.name}`;

    const transaction = await prisma.transaction.create({
      data: {
        type: isTopup ? "CREDIT_TOPUP" : "SUBSCRIPTION",
        userId: session.user.id,
        planId: plan?.id,
        creditPackageId: creditPackage?.id,
        gatewayId: gateway.id,
        gatewayRef: orderId,
        amount,
        status: "PENDING",
        metadata: isTopup
          ? {
              creditPackageSlug,
              creditPackageName: creditPackage!.name,
              credits: creditPackage!.credits,
              bonusCredits: creditPackage!.bonusCredits,
            }
          : { planSlug, planName: plan!.name },
      },
    });
    createdTransactionId = transaction.id;

    if (gateway.slug === "midtrans") {
      const snap = await createMidtransTransaction(gateway, {
        orderId,
        amount,
        customerName: session.user.name || "Guru",
        customerEmail: session.user.email || "guru@example.com",
        itemName,
      });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          metadata: {
            ...(isTopup
              ? {
                  creditPackageSlug,
                  creditPackageName: creditPackage!.name,
                  credits: creditPackage!.credits,
                  bonusCredits: creditPackage!.bonusCredits,
                }
              : { planSlug, planName: plan!.name }),
            snapToken: snap.token,
            redirectUrl: snap.redirect_url,
          },
        },
      });

      return NextResponse.json({
        transactionId: transaction.id,
        gateway: "midtrans",
        snapToken: snap.token,
        redirectUrl: snap.redirect_url,
      });
    }

    if (gateway.slug === "tripay") {
      const tripay = await createTripayTransaction(gateway, {
        orderId,
        amount,
        customerName: session.user.name || "Guru",
        customerEmail: session.user.email || "guru@example.com",
        itemName,
      });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          gatewayRef: tripay.reference || orderId,
          metadata: {
            ...(isTopup
              ? {
                  creditPackageSlug,
                  creditPackageName: creditPackage!.name,
                  credits: creditPackage!.credits,
                  bonusCredits: creditPackage!.bonusCredits,
                }
              : { planSlug, planName: plan!.name }),
            checkoutUrl: tripay.checkoutUrl,
            qrUrl: tripay.qrUrl,
          },
        },
      });

      return NextResponse.json({
        transactionId: transaction.id,
        gateway: "tripay",
        checkoutUrl: tripay.checkoutUrl,
        qrUrl: tripay.qrUrl,
      });
    }

    return NextResponse.json(
      { error: `Gateway ${gateway.slug} belum didukung` },
      { status: 501 }
    );
  } catch (err) {
    console.error("Payment create error:", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data pembayaran tidak valid" }, { status: 400 });
    }
    if (createdTransactionId) {
      try {
        const failedTransaction = await prisma.transaction.findUnique({
          where: { id: createdTransactionId },
          select: { metadata: true },
        });
        const existingMetadata =
          failedTransaction?.metadata &&
          typeof failedTransaction.metadata === "object" &&
          !Array.isArray(failedTransaction.metadata)
            ? failedTransaction.metadata
            : {};
        await prisma.transaction.updateMany({
          where: { id: createdTransactionId, status: "PENDING" },
          data: {
            status: "FAILED",
            metadata: {
              ...existingMetadata,
              checkoutError:
                err instanceof Error ? err.message.slice(0, 500) : "Gagal membuat pembayaran",
            },
          },
        });
      } catch (updateErr) {
        console.error("Payment create failure status update error:", updateErr);
      }
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat pembayaran" },
      { status: 500 }
    );
  }
}
