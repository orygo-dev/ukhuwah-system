import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credit-ledger";
import { debitWallet } from "@/lib/wallet-ledger";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

const schema = z.object({
  creditPackageSlug: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Konversi dompet ke kredit hanya tersedia untuk akun guru.");
  }

  try {
    const { creditPackageSlug } = schema.parse(await req.json().catch(() => null));
    const pkg = await prisma.creditPackage.findFirst({
      where: { slug: creditPackageSlug, isActive: true },
    });
    if (!pkg) {
      return NextResponse.json({ error: "Paket kredit tidak valid" }, { status: 400 });
    }

    const totalCredits = pkg.credits + pkg.bonusCredits;
    const price = Number(pkg.price);

    const result = await prisma.$transaction(async (tx) => {
      const conversionRef = `wallet-convert:${session.user.id}:${pkg.id}:${Date.now()}`;
      await debitWallet(
        session.user.id,
        price,
        "CONVERT_TO_CREDIT",
        pkg.id,
        `Beli kredit dari dompet: ${pkg.name}`,
        tx,
        {
          idempotencyKey: conversionRef,
          metadata: { packageId: pkg.id, credits: totalCredits },
        }
      );

      const credit = await grantCredits(
        session.user.id,
        totalCredits,
        "WALLET_CONVERSION",
        pkg.id,
        `Konversi dompet ke kredit: ${pkg.name}`,
        tx,
        {
          creditType: "PAID_TOPUP",
          idempotencyKey: `${conversionRef}:credits`,
          metadata: { packageId: pkg.id, walletAmount: price },
        }
      );

      return credit;
    });

    return NextResponse.json({
      message: `${totalCredits} kredit berhasil dibeli dari saldo dompet`,
      creditsAwarded: totalCredits,
      creditsRemaining: result.balanceAfter,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Gagal konversi";
    if (msg === "INSUFFICIENT_WALLET_BALANCE") {
      return NextResponse.json({ error: "Saldo dompet tidak cukup" }, { status: 400 });
    }
    if (msg === "WALLET_CONFLICT") {
      return NextResponse.json(
        { error: "Saldo dompet berubah. Muat ulang halaman lalu coba lagi." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
