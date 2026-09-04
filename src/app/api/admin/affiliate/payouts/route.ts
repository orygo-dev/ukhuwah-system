import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creditWallet } from "@/lib/wallet-ledger";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function GET() {
  try {
    await requireSuperAdmin();

    const [commissions, payouts] = await Promise.all([
      prisma.affiliateCommission.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          affiliate: { select: { name: true, email: true } },
          referral: {
            include: { referredUser: { select: { name: true } } },
          },
        },
      }),
      prisma.affiliatePayout.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: {
          affiliate: { select: { name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      commissions: commissions.map((c) => ({
        id: c.id,
        affiliateName: c.affiliate.name,
        referredName: c.referral.referredUser.name,
        amount: Number(c.commissionAmount),
        rate: Number(c.commissionRate),
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        affiliateName: p.affiliate.name,
        affiliateEmail: p.affiliate.email,
        amount: Number(p.amount),
        bankName: p.bankName,
        bankAccount: p.bankAccount,
        bankHolder: p.bankHolder,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

const payoutActionSchema = z.object({
  payoutId: z.string().trim().min(1),
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const body = payoutActionSchema.parse(await req.json().catch(() => ({})));

    const payout = await prisma.affiliatePayout.findUnique({
      where: { id: body.payoutId },
      include: { affiliate: { select: { id: true, name: true, phone: true } } },
    });

    if (!payout || payout.status !== "PENDING") {
      return NextResponse.json({ error: "Payout tidak ditemukan" }, { status: 404 });
    }

    if (body.action === "reject") {
      await prisma.$transaction(async (tx) => {
        const rejected = await tx.affiliatePayout.updateMany({
          where: { id: payout.id, status: "PENDING" },
          data: {
            status: "REJECTED",
            adminNote: body.adminNote || null,
            processedAt: new Date(),
          },
        });
        if (rejected.count !== 1) {
          throw new Error("PAYOUT_ALREADY_PROCESSED");
        }
        await creditWallet(
          payout.affiliateId,
          Number(payout.amount),
          "REVERSAL",
          payout.id,
          "Pengajuan pencairan ditolak, saldo dikembalikan",
          tx,
          { idempotencyKey: `wallet-payout-reversal:${payout.id}` }
        );
      });
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    await prisma.$transaction(async (tx) => {
      const paid = await tx.affiliatePayout.updateMany({
        where: { id: payout.id, status: "PENDING" },
        data: {
          status: "PAID",
          adminNote: body.adminNote || "Transfer manual",
          processedAt: new Date(),
        },
      });
      if (paid.count !== 1) {
        throw new Error("PAYOUT_ALREADY_PROCESSED");
      }
    });

    if (payout.affiliate.phone) {
      try {
        await sendWhatsAppMessage({
          target: payout.affiliate.phone,
          userId: payout.affiliateId,
          purpose: "AFFILIATE_PAYOUT_SUCCESS",
          variables: {
            name: payout.affiliate.name,
            amount: formatCurrency(Number(payout.amount)),
            bankName: payout.bankName,
            bankAccount: payout.bankAccount,
          },
        });
      } catch (err) {
        console.error("[whatsapp payout notification]", err);
      }
    }

    return NextResponse.json({ ok: true, status: "PAID" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    if (err instanceof Error && err.message === "PAYOUT_ALREADY_PROCESSED") {
      return NextResponse.json(
        { error: "Payout sudah diproses. Muat ulang data terbaru." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Gagal memproses" }, { status: 500 });
  }
}
