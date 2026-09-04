import { NextResponse } from "next/server";
import { Prisma, TkaScope } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTka, defaultScopeForRole, getTkaActor, teacherOwnsClass } from "@/lib/tka";

const schema = z.object({
  classRoomId: z.string().min(1).nullable().optional(), subjectId: z.string().min(1),
  title: z.string().trim().min(3).max(180), description: z.string().trim().max(3000).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(180), questionIds: z.array(z.string().min(1)).min(1).max(100),
  startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional(), showDiscussion: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actor = await getTkaActor(session);
  const where = actor.role === "SUPER_ADMIN" ? { scope: TkaScope.GLOBAL } : actor.role === "SCHOOL_ADMIN" ? { scope: TkaScope.SCHOOL, schoolId: actor.schoolId ?? "__none__" } : { scope: TkaScope.CLASS, authorId: actor.id };
  const packages = await prisma.tkaPackage.findMany({
    where, orderBy: { updatedAt: "desc" },
    include: {
      subject: { select: { id: true, name: true } }, classRoom: { select: { id: true, name: true } },
      questions: { orderBy: { sortOrder: "asc" }, select: { questionId: true } },
      attempts: { orderBy: { submittedAt: "desc" }, select: { id: true, status: true, score: true, correctCount: true, totalQuestions: true, submittedAt: true, student: { select: { id: true, name: true, nis: true } }, answers: { select: { questionId: true, isCorrect: true } } } },
      _count: { select: { questions: true, attempts: true } },
    },
  });
  return NextResponse.json({ packages });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const actor = await getTkaActor(session);
    const body = schema.parse(await req.json().catch(() => null));
    const scope = defaultScopeForRole(actor.role);
    if (scope === TkaScope.CLASS && (!body.classRoomId || !(await teacherOwnsClass(actor.id, body.classRoomId)))) return NextResponse.json({ error: "Kelas tidak ditemukan atau bukan kelas Anda." }, { status: 403 });
    if (scope === TkaScope.SCHOOL && !actor.schoolId) return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 400 });
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (startsAt && endsAt && startsAt >= endsAt) return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
    const ids = [...new Set(body.questionIds)];
    const questionWhere: Prisma.TkaQuestionWhereInput = { id: { in: ids }, subjectId: body.subjectId, scope, status: "PUBLISHED", ...(scope === TkaScope.CLASS ? { authorId: actor.id, classRoomId: body.classRoomId } : {}), ...(scope === TkaScope.SCHOOL ? { schoolId: actor.schoolId } : {}) };
    const questions = await prisma.tkaQuestion.findMany({ where: questionWhere, select: { id: true } });
    if (questions.length !== ids.length) return NextResponse.json({ error: "Semua soal harus sudah terbit serta berasal dari mapel dan cakupan yang dipilih." }, { status: 400 });
    const room = body.classRoomId ? await prisma.classRoom.findUnique({ where: { id: body.classRoomId }, select: { schoolId: true } }) : null;
    const item = await prisma.tkaPackage.create({
      data: { subjectId: body.subjectId, authorId: actor.id, classRoomId: scope === TkaScope.CLASS ? body.classRoomId : null, schoolId: scope === TkaScope.SCHOOL ? actor.schoolId : room?.schoolId ?? null, title: body.title, description: body.description || null, durationMinutes: body.durationMinutes, scope, status: "PUBLISHED", startsAt, endsAt, showDiscussion: body.showDiscussion ?? true, publishedAt: new Date(), questions: { create: ids.map((questionId, sortOrder) => ({ questionId, sortOrder })) } },
    });
    return NextResponse.json({ package: item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0]?.message ?? "Data tidak valid" }, { status: 400 });
    console.error("[tka packages POST]", error);
    return NextResponse.json({ error: "Gagal membuat simulasi TKA." }, { status: 500 });
  }
}
