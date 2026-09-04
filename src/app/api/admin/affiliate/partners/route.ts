import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleAvailablePartnerCommissions } from "@/lib/affiliate-commission";

const partnerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nama mitra wajib diisi"),
  type: z.string().trim().min(1).default("REGION"),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email tidak valid").optional().nullable().or(z.literal("")),
  code: z.string().trim().min(2, "Kode mitra wajib diisi"),
  portalPassword: z.string().optional().nullable(),
  regencyId: z.string().optional().nullable(),
  schoolId: z.string().optional().nullable(),
  commissionPercent: z.coerce.number().min(0).max(100),
  bankName: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  bankHolder: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean(),
});

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function serializePartner(partner: Awaited<ReturnType<typeof prisma.affiliatePartner.findMany>>[number]) {
  return {
    ...partner,
    commissionPercent: Number(partner.commissionPercent),
    walletBalance: Number(partner.walletBalance),
  };
}

export async function GET() {
  try {
    await requireSuperAdmin();
    await settleAvailablePartnerCommissions();

    const [partners, commissions, payouts, regencies, schools] = await Promise.all([
      prisma.affiliatePartner.findMany({
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        include: {
          regency: { select: { id: true, name: true, code: true, province: { select: { name: true } } } },
          school: { select: { id: true, name: true, npsn: true } },
          _count: { select: { commissions: true } },
        },
      }),
      prisma.partnerCommission.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          partner: { select: { name: true, code: true } },
          referredUser: { select: { name: true, email: true } },
          transaction: { select: { amount: true, paidAt: true } },
        },
      }),
      prisma.partnerPayout.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: { partner: { select: { name: true, code: true } } },
      }),
      prisma.regency.findMany({
        orderBy: [{ province: { name: "asc" } }, { name: "asc" }],
        include: { province: { select: { name: true } } },
      }),
      prisma.school.findMany({
        orderBy: { name: "asc" },
        take: 500,
        select: { id: true, name: true, npsn: true, regencyId: true },
      }),
    ]);

    return NextResponse.json({
      partners: partners.map((partner) => ({
        ...serializePartner(partner),
        totalCommissions: partner._count.commissions,
      })),
      commissions: commissions.map((commission) => ({
        id: commission.id,
        partnerName: commission.partner.name,
        partnerCode: commission.partner.code,
        teacherName: commission.referredUser.name,
        teacherEmail: commission.referredUser.email,
        orderAmount: Number(commission.orderAmount),
        amount: Number(commission.commissionAmount),
        rate: Number(commission.commissionRate),
        status: commission.status,
        availableAt: commission.availableAt.toISOString(),
        createdAt: commission.createdAt.toISOString(),
        paidAt: commission.transaction.paidAt?.toISOString() ?? null,
      })),
      payouts: payouts.map((payout) => ({
        id: payout.id,
        partnerName: payout.partner.name,
        partnerCode: payout.partner.code,
        amount: Number(payout.amount),
        bankName: payout.bankName,
        bankAccount: payout.bankAccount,
        bankHolder: payout.bankHolder,
        createdAt: payout.createdAt.toISOString(),
      })),
      regencies: regencies.map((regency) => ({
        id: regency.id,
        name: regency.name,
        code: regency.code,
        provinceName: regency.province.name,
      })),
      schools,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal memuat mitra" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json().catch(() => ({}));

    if (body.action === "delete") {
      const id = z.string().min(1).parse(body.id);
      await prisma.affiliatePartner.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (body.action === "settle") {
      const partnerId = body.partnerId ? z.string().min(1).parse(body.partnerId) : undefined;
      await settleAvailablePartnerCommissions(partnerId);
      return NextResponse.json({ success: true });
    }

    if (body.action === "approve_payout" || body.action === "reject_payout") {
      const payoutId = z.string().min(1).parse(body.payoutId);
      const payout = await prisma.partnerPayout.findUnique({
        where: { id: payoutId },
        include: { commissions: true },
      });
      if (!payout || payout.status !== "PENDING") {
        return NextResponse.json({ error: "Payout tidak ditemukan" }, { status: 404 });
      }

      if (body.action === "reject_payout") {
        await prisma.$transaction(async (tx) => {
          const rejected = await tx.partnerPayout.updateMany({
            where: { id: payout.id, status: "PENDING" },
            data: { status: "REJECTED", processedAt: new Date() },
          });
          if (rejected.count !== 1) {
            throw new Error("PAYOUT_ALREADY_PROCESSED");
          }
          await tx.partnerCommission.updateMany({
            where: { payoutId: payout.id },
            data: { payoutId: null },
          });
          await tx.affiliatePartner.update({
            where: { id: payout.partnerId },
            data: { walletBalance: { increment: payout.amount } },
          });
        });
        return NextResponse.json({ success: true });
      }

      await prisma.$transaction(async (tx) => {
        const paid = await tx.partnerPayout.updateMany({
          where: { id: payout.id, status: "PENDING" },
          data: { status: "PAID", processedAt: new Date() },
        });
        if (paid.count !== 1) {
          throw new Error("PAYOUT_ALREADY_PROCESSED");
        }
        await tx.partnerCommission.updateMany({
          where: { payoutId: payout.id },
          data: { status: "PAID", paidAt: new Date() },
        });
      });
      return NextResponse.json({ success: true });
    }

    const input = partnerSchema.parse(body);
    const data = {
      name: input.name.trim(),
      type: input.type,
      contactName: cleanNullable(input.contactName),
      phone: cleanNullable(input.phone),
      email: cleanNullable(input.email),
      code: input.code.trim().toUpperCase(),
      regencyId: cleanNullable(input.regencyId),
      schoolId: cleanNullable(input.schoolId),
      commissionPercent: input.commissionPercent,
      bankName: cleanNullable(input.bankName),
      bankAccount: cleanNullable(input.bankAccount),
      bankHolder: cleanNullable(input.bankHolder),
      notes: cleanNullable(input.notes),
      isActive: input.isActive,
    };

    const portalPassword = cleanNullable(input.portalPassword);
    const passwordPatch = portalPassword
      ? { passwordHash: await bcrypt.hash(portalPassword, 10) }
      : {};

    const partner = input.id
      ? await prisma.affiliatePartner.update({
          where: { id: input.id },
          data: { ...data, ...passwordPatch },
        })
      : await prisma.affiliatePartner.create({ data: { ...data, ...passwordPatch } });

    return NextResponse.json({ success: true, partner: serializePartner(partner) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (msg === "PAYOUT_ALREADY_PROCESSED") {
      return NextResponse.json(
        { error: "Payout sudah diproses. Muat ulang data terbaru." },
        { status: 409 }
      );
    }
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        { error: "Kode atau email mitra sudah digunakan. Gunakan data lain." },
        { status: 400 }
      );
    }
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2025") {
      return NextResponse.json({ error: "Mitra tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Gagal menyimpan mitra" }, { status: 500 });
  }
}
