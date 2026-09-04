import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireSchoolCommercialization,
  schoolCommercializationErrorResponse,
} from "@/lib/school-commercialization-auth";
import { schoolPlanSnapshot } from "@/lib/school-commercialization";

const seatSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign-seat"), userId: z.string().cuid() }),
  z.object({ action: z.literal("release-seat"), userId: z.string().cuid() }),
]);

export async function GET() {
  try {
    const access = await requireSchoolCommercialization();
    const [seats, teachers, invoices, recentCredits] = await Promise.all([
      prisma.schoolSeat.findMany({
        where: { subscriptionId: access.subscription.id, releasedAt: null },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { assignedAt: "desc" },
      }),
      prisma.user.findMany({
        where: { schoolId: access.schoolId, role: "TEACHER" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.schoolInvoice.findMany({
        where: { schoolId: access.schoolId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.schoolCreditLedger.findMany({
        where: { schoolId: access.schoolId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return Response.json({
      subscription: {
        id: access.subscription.id,
        status: access.subscription.status,
        startsAt: access.subscription.startsAt,
        trialEndsAt: access.subscription.trialEndsAt,
        currentPeriodEnd: access.subscription.currentPeriodEnd,
        graceEndsAt: access.subscription.graceEndsAt,
        pjjAddOnEnabled: access.subscription.pjjAddOnEnabled,
        creditBalance: access.subscription.creditBalance,
        plan: schoolPlanSnapshot(access.subscription.plan),
      },
      seats: seats.map((seat) => ({ ...seat.user, assignedAt: seat.assignedAt })),
      teachers,
      invoices,
      recentCredits,
    });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireSchoolCommercialization({ write: true });
    const input = seatSchema.parse(await request.json());
    const teacher = await prisma.user.findFirst({
      where: { id: input.userId, schoolId: access.schoolId, role: "TEACHER" },
      select: { id: true },
    });
    if (!teacher) return Response.json({ error: "Guru tidak ditemukan di sekolah ini." }, { status: 404 });

    if (input.action === "assign-seat") {
      const result = await prisma.$transaction(async (tx) => {
        const activeCount = await tx.schoolSeat.count({
          where: { subscriptionId: access.subscription.id, releasedAt: null },
        });
        if (activeCount >= access.subscription.plan.maxTeacherSeats) throw new Error("SEAT_LIMIT_REACHED");
        const existing = await tx.schoolSeat.findUnique({
          where: { subscriptionId_userId: { subscriptionId: access.subscription.id, userId: input.userId } },
        });
        const seat = existing
          ? await tx.schoolSeat.update({ where: { id: existing.id }, data: { releasedAt: null, assignedById: access.userId, assignedAt: new Date() } })
          : await tx.schoolSeat.create({ data: { subscriptionId: access.subscription.id, schoolId: access.schoolId, userId: input.userId, assignedById: access.userId } });
        await tx.schoolSubscriptionAudit.create({
          data: { subscriptionId: access.subscription.id, schoolId: access.schoolId, actorId: access.userId, action: "SEAT_ASSIGNED", metadata: { userId: input.userId } },
        });
        return seat;
      }, { isolationLevel: "Serializable" });
      return Response.json({ seat: result }, { status: 201 });
    }

    const released = await prisma.schoolSeat.updateMany({
      where: { subscriptionId: access.subscription.id, userId: input.userId, releasedAt: null },
      data: { releasedAt: new Date() },
    });
    if (released.count === 0) return Response.json({ error: "Seat aktif tidak ditemukan." }, { status: 404 });
    await prisma.schoolSubscriptionAudit.create({
      data: { subscriptionId: access.subscription.id, schoolId: access.schoolId, actorId: access.userId, action: "SEAT_RELEASED", metadata: { userId: input.userId } },
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.errors[0].message }, { status: 400 });
    if (error instanceof Error && error.message === "SEAT_LIMIT_REACHED") {
      return Response.json({ error: "Jumlah seat guru sudah mencapai batas paket.", code: error.message }, { status: 409 });
    }
    return schoolCommercializationErrorResponse(error);
  }
}
