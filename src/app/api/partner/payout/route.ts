import { NextResponse } from "next/server";
import { requirePartnerSession } from "@/lib/partner-auth";
import { prisma } from "@/lib/prisma";
import { settleAvailablePartnerCommissions } from "@/lib/affiliate-commission";

export async function POST() {
  try {
    const partner = await requirePartnerSession();
    await settleAvailablePartnerCommissions(partner.id);

    const payout = await prisma.$transaction(async (tx) => {
      const pendingPayout = await tx.partnerPayout.findFirst({
        where: { partnerId: partner.id, status: "PENDING" },
        select: { id: true },
      });
      if (pendingPayout) {
        throw new Error("PAYOUT_PENDING");
      }

      const fresh = await tx.affiliatePartner.findUnique({
        where: { id: partner.id },
        select: {
          walletBalance: true,
          bankName: true,
          bankAccount: true,
          bankHolder: true,
        },
      });
      if (!fresh) {
        throw new Error("UNAUTHORIZED");
      }

      const amount = Number(fresh.walletBalance);
      if (amount <= 0) {
        throw new Error("NO_PARTNER_BALANCE");
      }
      if (!fresh.bankName || !fresh.bankAccount || !fresh.bankHolder) {
        throw new Error("PARTNER_BANK_INCOMPLETE");
      }

      const lockedWallet = await tx.affiliatePartner.updateMany({
        where: { id: partner.id, walletBalance: fresh.walletBalance },
        data: { walletBalance: 0 },
      });
      if (lockedWallet.count !== 1) {
        throw new Error("PARTNER_WALLET_CONFLICT");
      }

      const created = await tx.partnerPayout.create({
        data: {
          partnerId: partner.id,
          amount,
          status: "PENDING",
          bankName: fresh.bankName,
          bankAccount: fresh.bankAccount,
          bankHolder: fresh.bankHolder,
        },
      });

      await tx.partnerCommission.updateMany({
        where: { partnerId: partner.id, status: "APPROVED", payoutId: null },
        data: { payoutId: created.id },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount: Number(payout.amount),
        status: payout.status,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal mengajukan pencairan";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "PAYOUT_PENDING") {
      return NextResponse.json(
        { error: "Masih ada permintaan pencairan yang sedang diproses" },
        { status: 400 }
      );
    }
    if (msg === "NO_PARTNER_BALANCE") {
      return NextResponse.json({ error: "Belum ada saldo yang bisa dicairkan" }, { status: 400 });
    }
    if (msg === "PARTNER_BANK_INCOMPLETE") {
      return NextResponse.json(
        { error: "Lengkapi data rekening sebelum mengajukan pencairan" },
        { status: 400 }
      );
    }
    if (msg === "PARTNER_WALLET_CONFLICT") {
      return NextResponse.json(
        { error: "Saldo mitra berubah. Muat ulang halaman lalu coba lagi." },
        { status: 409 }
      );
    }
    console.error("[partner payout]", err);
    return NextResponse.json({ error: "Gagal mengajukan pencairan" }, { status: 500 });
  }
}
