import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePartnerSession } from "@/lib/partner-auth";
import { prisma } from "@/lib/prisma";
import { settleAvailablePartnerCommissions } from "@/lib/affiliate-commission";

const profileSchema = z.object({
  contactName: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email("Email tidak valid").optional().nullable().or(z.literal("")),
  bankName: z.string().trim().optional().nullable(),
  bankAccount: z.string().trim().optional().nullable(),
  bankHolder: z.string().trim().optional().nullable(),
});

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatCommission(row: {
  id: string;
  orderAmount: unknown;
  commissionRate: unknown;
  commissionAmount: unknown;
  status: string;
  availableAt: Date;
  createdAt: Date;
  referredUser: { name: string; email: string };
  transaction: { paidAt: Date | null; plan: { name: string } | null };
}) {
  return {
    id: row.id,
    teacherName: row.referredUser.name,
    teacherEmail: row.referredUser.email.replace(/(.{2}).*(@.*)/, "$1***$2"),
    planName: row.transaction.plan?.name ?? "Paket premium",
    orderAmount: Number(row.orderAmount),
    rate: Number(row.commissionRate),
    amount: Number(row.commissionAmount),
    status: row.status,
    availableAt: row.availableAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    paidAt: row.transaction.paidAt?.toISOString() ?? null,
  };
}

export async function GET() {
  try {
    const sessionPartner = await requirePartnerSession();
    await settleAvailablePartnerCommissions(sessionPartner.id);

    const partner = await prisma.affiliatePartner.findUnique({
      where: { id: sessionPartner.id },
      include: {
        regency: { select: { name: true, code: true, province: { select: { name: true } } } },
        school: { select: { name: true, npsn: true } },
        commissions: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            referredUser: { select: { name: true, email: true } },
            transaction: { select: { paidAt: true, plan: { select: { name: true } } } },
          },
        },
        payouts: { orderBy: { createdAt: "desc" }, take: 12 },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [summary, teacherCount] = await Promise.all([
      prisma.partnerCommission.groupBy({
        by: ["status"],
        where: { partnerId: partner.id },
        _sum: { commissionAmount: true },
        _count: { _all: true },
      }),
      prisma.partnerCommission.groupBy({
        by: ["referredUserId"],
        where: { partnerId: partner.id },
      }),
    ]);

    const totals = summary.reduce(
      (acc, row) => {
        const amount = Number(row._sum.commissionAmount || 0);
        acc.total += amount;
        acc.count += row._count._all;
        if (row.status === "PENDING") acc.pending += amount;
        if (row.status === "APPROVED") acc.approved += amount;
        if (row.status === "PAID") acc.paid += amount;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, paid: 0, count: 0 }
    );

    return NextResponse.json({
      partner: {
        id: partner.id,
        name: partner.name,
        code: partner.code,
        type: partner.type,
        contactName: partner.contactName,
        phone: partner.phone,
        email: partner.email,
        commissionPercent: Number(partner.commissionPercent),
        walletBalance: Number(partner.walletBalance),
        bankName: partner.bankName,
        bankAccount: partner.bankAccount,
        bankHolder: partner.bankHolder,
        regency: partner.regency,
        school: partner.school,
      },
      stats: {
        ...totals,
        teacherCount: teacherCount.length,
      },
      commissions: partner.commissions.map(formatCommission),
      payouts: partner.payouts.map((payout) => ({
        id: payout.id,
        amount: Number(payout.amount),
        status: payout.status,
        bankName: payout.bankName,
        bankAccount: payout.bankAccount,
        bankHolder: payout.bankHolder,
        adminNote: payout.adminNote,
        processedAt: payout.processedAt?.toISOString() ?? null,
        createdAt: payout.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    const partner = await requirePartnerSession();
    const input = profileSchema.parse(await req.json().catch(() => ({})));
    const updated = await prisma.affiliatePartner.update({
      where: { id: partner.id },
      data: {
        contactName: cleanNullable(input.contactName),
        phone: cleanNullable(input.phone),
        email: cleanNullable(input.email),
        bankName: cleanNullable(input.bankName),
        bankAccount: cleanNullable(input.bankAccount),
        bankHolder: cleanNullable(input.bankHolder),
      },
    });

    return NextResponse.json({
      success: true,
      partner: {
        contactName: updated.contactName,
        phone: updated.phone,
        email: updated.email,
        bankName: updated.bankName,
        bankAccount: updated.bankAccount,
        bankHolder: updated.bankHolder,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
