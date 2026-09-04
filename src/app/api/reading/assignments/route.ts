import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getReadingActor } from "@/lib/reading";

const createSchema = z.object({
  bookId: z.string().min(1),
  classRoomId: z.string().min(1),
  title: z.string().trim().min(3).max(180),
  instructions: z.string().trim().max(5000).optional().default(""),
  dueAt: z.string().datetime().optional().nullable(),
});

const submitSchema = z.object({
  assignmentId: z.string().min(1),
  reflection: z.string().trim().min(20).max(5000),
});

export async function POST(req: Request) {
  try {
    const actor = await getReadingActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    if (actor.role === "STUDENT") {
      if (!actor.studentId || !actor.classRoomId) return NextResponse.json({ error: "Profil siswa belum terhubung" }, { status: 400 });
      const input = submitSchema.parse(body);
      const assignment = await prisma.readingAssignment.findFirst({
        where: { id: input.assignmentId, classRoomId: actor.classRoomId, status: "PUBLISHED" },
        select: { id: true },
      });
      if (!assignment) return NextResponse.json({ error: "Tugas baca tidak tersedia" }, { status: 404 });
      const submission = await prisma.readingSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: actor.studentId } },
        create: { assignmentId: assignment.id, studentId: actor.studentId, reflection: input.reflection },
        update: { reflection: input.reflection, submittedAt: new Date() },
      });
      return NextResponse.json({ submission });
    }

    if (!['TEACHER', 'SCHOOL_ADMIN'].includes(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const input = createSchema.parse(body);
    const room = await prisma.classRoom.findFirst({
      where:
        actor.role === "SCHOOL_ADMIN"
          ? { id: input.classRoomId, schoolId: actor.schoolId }
          : { id: input.classRoomId, OR: [{ teacherId: actor.id }, { teacherAssignments: { some: { teacherId: actor.id, isActive: true } } }] },
      select: { id: true, schoolId: true },
    });
    if (!room) return NextResponse.json({ error: "Kelas tidak tersedia" }, { status: 403 });
    const book = await prisma.readingBook.findFirst({
      where: {
        id: input.bookId,
        status: "PUBLISHED",
        OR: [
          { scope: "GLOBAL" },
          ...(room.schoolId ? [{ scope: "SCHOOL" as const, schoolId: room.schoolId }] : []),
          { scope: "CLASS", classRoomId: room.id },
        ],
      },
      select: { id: true },
    });
    if (!book) return NextResponse.json({ error: "Bacaan belum terbit untuk kelas ini" }, { status: 400 });
    const assignment = await prisma.readingAssignment.create({
      data: {
        bookId: book.id,
        classRoomId: room.id,
        teacherId: actor.id,
        title: input.title,
        instructions: input.instructions || null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        status: "PUBLISHED",
      },
    });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    return NextResponse.json({ error: "Gagal memproses tugas baca" }, { status: 500 });
  }
}
