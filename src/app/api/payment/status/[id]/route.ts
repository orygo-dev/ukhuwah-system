import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activateTransaction } from "@/lib/payment/activate";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Status pembayaran hanya tersedia untuk akun guru.");
  }

  const { id } = await params;
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
    include: { plan: true, creditPackage: true },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    transaction: {
      id: transaction.id,
      status: transaction.status,
      amount: Number(transaction.amount),
      planName: transaction.plan?.name ?? transaction.creditPackage?.name,
      type: transaction.type,
      paidAt: transaction.paidAt,
    },
  });
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Status pembayaran hanya tersedia untuk akun guru.");
  }

  const { id } = await params;
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id, status: "PENDING" },
    include: { plan: true, creditPackage: true, gateway: true },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  // Manual check for sandbox/demo — in production rely on webhook
  if (transaction.gateway.isSandbox && process.env.PAYMENT_AUTO_ACTIVATE_SANDBOX === "true") {
    await activateTransaction(transaction.id, "sandbox_manual");
    return NextResponse.json({
      status: "PAID",
      message:
        transaction.type === "CREDIT_TOPUP"
          ? "Sandbox: kredit top up ditambahkan"
          : "Sandbox: paket diaktifkan",
    });
  }

  return NextResponse.json({ status: transaction.status });
}
