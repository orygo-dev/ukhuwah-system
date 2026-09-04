import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAffiliateConfig } from "@/lib/affiliate";
import {
  ensureAffiliateProfile,
  settleAvailableAffiliateCommissions,
} from "@/lib/affiliate-commission";
import { debitWallet } from "@/lib/wallet-ledger";
import { getUserPlanEntitlements } from "@/lib/plan-limits";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

const payoutSchema = z.object({
  bankName: z.string().trim().min(1).max(80),
  bankAccount: z.string().trim().min(1).max(60),
  bankHolder: z.string().trim().min(1).max(120),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Pencairan afiliasi hanya tersedia untuk akun guru.");
  }

  const config = await getAffiliateConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: "Program afiliasi tidak aktif" }, { status: 400 });
  }

  if (session.user.role !== "SUPER_ADMIN") {
    const { entitlements } = await getUserPlanEntitlements(session.user.id);
    if (!entitlements.canUseAffiliate) {
      return NextResponse.json(
        {
          error: "Paket langganan Anda belum mencakup fitur afiliasi.",
          code: "AFFILIATE_NOT_INCLUDED",
        },
        { status: 403 }
      );
    }
  }

  try {
    const body = payoutSchema.parse(await req.json().catch(() => null));

    await ensureAffiliateProfile(session.user.id, session.user.name);
    await settleAvailableAffiliateCommissions(session.user.id);

    const payout = await prisma.$transaction(async (tx) => {
      const pendingPayout = await tx.affiliatePayout.findFirst({
        where: { affiliateId: session.user.id, status: "PENDING" },
      });
      if (pendingPayout) {
        throw new Error("PAYOUT_PENDING");
      }

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { walletBalance: true },
      });
      const total = Number(user?.walletBalance ?? 0);

      if (total < config.minPayout) {
        throw new Error("MIN_PAYOUT");
      }

      const created = await tx.affiliatePayout.create({
        data: {
          affiliateId: session.user.id,
          amount: total,
          bankName: body.bankName.trim(),
          bankAccount: body.bankAccount.trim(),
          bankHolder: body.bankHolder.trim(),
        },
      });

      await debitWallet(
        session.user.id,
        total,
        "WITHDRAWAL",
        created.id,
        "Pengajuan pencairan saldo dompet",
        tx,
        { idempotencyKey: `wallet-withdrawal:${created.id}` }
      );

      await tx.affiliateProfile.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          bankName: body.bankName.trim(),
          bankAccount: body.bankAccount.trim(),
          bankHolder: body.bankHolder.trim(),
        },
        update: {
          bankName: body.bankName.trim(),
          bankAccount: body.bankAccount.trim(),
          bankHolder: body.bankHolder.trim(),
        },
      });

      return created;
    });

    return NextResponse.json({
      payout: {
        id: payout.id,
        amount: Number(payout.amount),
        status: payout.status,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data rekening tidak lengkap" }, { status: 400 });
    }
    if (err instanceof Error && err.message === "MIN_PAYOUT") {
      return NextResponse.json(
        {
          error: `Saldo komisi tersedia minimal ${config.minPayout.toLocaleString("id-ID")} untuk pencairan`,
        },
        { status: 400 }
      );
    }
    if (err instanceof Error && err.message === "PAYOUT_PENDING") {
      return NextResponse.json(
        { error: "Anda masih punya permintaan pencairan yang diproses" },
        { status: 400 }
      );
    }
    if (err instanceof Error && err.message === "INSUFFICIENT_WALLET_BALANCE") {
      return NextResponse.json(
        { error: "Saldo dompet tidak cukup atau sudah berubah. Muat ulang halaman lalu coba lagi." },
        { status: 409 }
      );
    }
    if (err instanceof Error && err.message === "WALLET_CONFLICT") {
      return NextResponse.json(
        { error: "Saldo dompet berubah. Muat ulang halaman lalu coba lagi." },
        { status: 409 }
      );
    }
    console.error("[affiliate payout]", err);
    return NextResponse.json({ error: "Gagal mengajukan pencairan" }, { status: 500 });
  }
}
