import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

const WALLET_LABELS: Record<string, string> = {
  AFFILIATE_COMMISSION: "Komisi afiliasi",
  CONVERT_TO_CREDIT: "Beli kredit",
  WITHDRAWAL: "Pencairan",
  ADMIN: "Admin",
  REVERSAL: "Koreksi",
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Dompet hanya tersedia untuk akun guru.");
  }

  const [user, ledger, payouts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletBalance: true, creditsRemaining: true },
    }),
    prisma.walletLedger.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.affiliatePayout.findMany({
      where: { affiliateId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    walletBalance: Number(user.walletBalance),
    creditsRemaining: user.creditsRemaining,
    ledger: ledger.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      balanceAfter: Number(row.balanceAfter),
      source: row.source,
      sourceLabel: WALLET_LABELS[row.source] || row.source,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      bankName: p.bankName,
      bankAccount: p.bankAccount,
      bankHolder: p.bankHolder,
      createdAt: p.createdAt.toISOString(),
      processedAt: p.processedAt?.toISOString() ?? null,
    })),
  });
}
