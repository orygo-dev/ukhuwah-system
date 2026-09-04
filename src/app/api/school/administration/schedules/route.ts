import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findScheduleConflicts } from "@/lib/school-schedule";
import {
  requireSchoolCommercialization,
  schoolCommercializationErrorResponse,
} from "@/lib/school-commercialization-auth";

const slotSchema = z.object({
  classRoomId: z.string().cuid(),
  teacherId: z.string().cuid(),
  subject: z.string().trim().min(1).max(100),
  dayOfWeek: z.number().int().min(1).max(7),
  periodStart: z.number().int().min(1).max(30),
  periodEnd: z.number().int().min(1).max(30),
  room: z.string().trim().max(100).optional(),
});
const saveSchema = z.object({
  action: z.literal("save"),
  id: z.string().cuid().optional(),
  expectedVersion: z.number().int().positive().optional(),
  name: z.string().trim().min(3).max(120),
  schoolYear: z.string().trim().min(4).max(20),
  term: z.string().trim().min(1).max(30),
  slots: z.array(slotSchema).max(2000),
});
const publishSchema = z.object({ action: z.literal("publish"), id: z.string().cuid(), expectedVersion: z.number().int().positive() });
const schema = z.discriminatedUnion("action", [saveSchema, publishSchema]);

export async function GET() {
  try {
    const access = await requireSchoolCommercialization();
    const [schedules, classes, teachers] = await Promise.all([
      prisma.schoolSchedule.findMany({ where: { schoolId: access.schoolId }, include: { slots: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
      prisma.classRoom.findMany({ where: { schoolId: access.schoolId, isActive: true }, select: { id: true, name: true, tahunAjaran: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { schoolId: access.schoolId, role: "TEACHER" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return Response.json({ schedules, classes, teachers });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireSchoolCommercialization({ write: true });
    if (access.features.scheduling !== true) return Response.json({ error: "Paket belum mencakup pengaturan jadwal." }, { status: 403 });
    const input = schema.parse(await request.json());
    if (input.action === "publish") {
      const schedule = await prisma.schoolSchedule.findFirst({ where: { id: input.id, schoolId: access.schoolId }, include: { slots: true } });
      if (!schedule) return Response.json({ error: "Jadwal tidak ditemukan." }, { status: 404 });
      const conflicts = findScheduleConflicts(schedule.slots);
      if (conflicts.length) return Response.json({ error: "Jadwal masih memiliki konflik.", conflicts }, { status: 409 });
      const changed = await prisma.schoolSchedule.updateMany({ where: { id: input.id, schoolId: access.schoolId, status: "DRAFT", version: input.expectedVersion }, data: { status: "PUBLISHED", publishedAt: new Date(), version: { increment: 1 } } });
      if (changed.count !== 1) return Response.json({ error: "Jadwal berubah atau bukan draft. Muat ulang.", code: "SCHEDULE_VERSION_CONFLICT" }, { status: 409 });
      return Response.json({ ok: true });
    }

    const conflicts = findScheduleConflicts(input.slots);
    if (conflicts.length) return Response.json({ error: "Jadwal memiliki konflik.", conflicts }, { status: 409 });
    const classIds = [...new Set(input.slots.map((slot) => slot.classRoomId))];
    const teacherIds = [...new Set(input.slots.map((slot) => slot.teacherId))];
    const [classCount, teacherCount] = await Promise.all([
      prisma.classRoom.count({ where: { id: { in: classIds }, schoolId: access.schoolId } }),
      prisma.user.count({ where: { id: { in: teacherIds }, schoolId: access.schoolId, role: "TEACHER" } }),
    ]);
    if (classCount !== classIds.length || teacherCount !== teacherIds.length) return Response.json({ error: "Kelas atau guru berada di luar sekolah ini." }, { status: 403 });

    const schedule = await prisma.$transaction(async (tx) => {
      let scheduleId = input.id;
      if (scheduleId) {
        if (!input.expectedVersion) throw new Error("EXPECTED_VERSION_REQUIRED");
        const changed = await tx.schoolSchedule.updateMany({ where: { id: scheduleId, schoolId: access.schoolId, status: "DRAFT", version: input.expectedVersion }, data: { name: input.name, schoolYear: input.schoolYear, term: input.term, version: { increment: 1 } } });
        if (changed.count !== 1) throw new Error("SCHEDULE_VERSION_CONFLICT");
        await tx.schoolScheduleSlot.deleteMany({ where: { scheduleId } });
      } else {
        const created = await tx.schoolSchedule.create({ data: { schoolId: access.schoolId, name: input.name, schoolYear: input.schoolYear, term: input.term, createdById: access.userId } });
        scheduleId = created.id;
      }
      if (input.slots.length) await tx.schoolScheduleSlot.createMany({ data: input.slots.map((slot) => ({ ...slot, room: slot.room || null, scheduleId: scheduleId! })) });
      return tx.schoolSchedule.findUniqueOrThrow({ where: { id: scheduleId }, include: { slots: true } });
    }, { isolationLevel: "Serializable" });
    return Response.json({ schedule }, { status: input.id ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.errors[0].message }, { status: 400 });
    if (error instanceof Error && ["EXPECTED_VERSION_REQUIRED", "SCHEDULE_VERSION_CONFLICT"].includes(error.message)) return Response.json({ error: "Jadwal berubah di perangkat lain. Muat ulang sebelum menyimpan.", code: error.message }, { status: 409 });
    return schoolCommercializationErrorResponse(error);
  }
}
