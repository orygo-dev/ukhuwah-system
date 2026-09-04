import { NextResponse } from "next/server";
import { z } from "zod";
import { TkaQuestionType, TkaScope } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTka, defaultScopeForRole, getTkaActor, teacherOwnsClass } from "@/lib/tka";
import { assessTkaQuestionQuality } from "@/lib/tka-question-quality";

const createSchema = z.object({
  subjectId: z.string().min(1),
  classRoomId: z.string().nullable().optional(),
  scope: z.nativeEnum(TkaScope).optional(),
  type: z.nativeEnum(TkaQuestionType),
  stimulus: z.string().trim().max(10000).optional(),
  prompt: z.string().trim().min(5).max(5000),
  options: z.array(z.string().trim().min(1).max(1000)).min(2).max(6),
  correctAnswers: z.array(z.coerce.number().int().min(0)).min(1).max(6),
  explanation: z.string().trim().max(5000).optional(),
  competency: z.string().trim().max(200).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actor = await getTkaActor(session);
  const where = actor.role === "SUPER_ADMIN"
    ? { scope: "GLOBAL" as const, status: { not: "ARCHIVED" as const } }
    : actor.role === "SCHOOL_ADMIN"
      ? { schoolId: actor.schoolId ?? "__none__", scope: "SCHOOL" as const, status: { not: "ARCHIVED" as const } }
      : { authorId: actor.id, status: { not: "ARCHIVED" as const } };
  const questions = await prisma.tkaQuestion.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { subject: true, classRoom: { select: { id: true, name: true } }, author: { select: { name: true } } },
  });
  return NextResponse.json({ questions });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const actor = await getTkaActor(session);
    const body = createSchema.parse(await req.json().catch(() => null));
    const scope = body.scope ?? defaultScopeForRole(actor.role);
    if (actor.role === "TEACHER" && scope !== "CLASS") {
      return NextResponse.json({ error: "Guru mempublikasikan soal melalui bank kelas." }, { status: 403 });
    }
    if (actor.role === "SCHOOL_ADMIN" && scope !== "SCHOOL") {
      return NextResponse.json({ error: "Admin sekolah hanya mengelola bank sekolah." }, { status: 403 });
    }
    if (actor.role === "SUPER_ADMIN" && scope !== "GLOBAL") {
      return NextResponse.json({ error: "Super Admin mengelola bank global." }, { status: 403 });
    }
    if (scope === "CLASS" && (!body.classRoomId || !(await teacherOwnsClass(actor.id, body.classRoomId)))) {
      return NextResponse.json({ error: "Kelas tidak ditemukan atau bukan kelas Anda." }, { status: 403 });
    }
    if (scope === "SCHOOL" && !actor.schoolId) {
      return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 400 });
    }
    const answers = [...new Set(body.correctAnswers)].sort((a, b) => a - b);
    const quality = assessTkaQuestionQuality({ ...body, correctAnswers: answers }, false);
    if (quality.errors.length) {
      return NextResponse.json({ error: quality.errors[0], errors: quality.errors, warnings: quality.warnings }, { status: 400 });
    }
    const question = await prisma.tkaQuestion.create({
      data: {
        subjectId: body.subjectId,
        authorId: actor.id,
        classRoomId: scope === "CLASS" ? body.classRoomId : null,
        schoolId: scope === "SCHOOL" ? actor.schoolId : null,
        scope,
        status: "DRAFT",
        type: body.type,
        stimulus: body.stimulus || null,
        prompt: body.prompt,
        options: body.options,
        correctAnswers: answers,
        explanation: body.explanation || null,
        competency: body.competency || null,
        difficulty: body.difficulty,
      },
      include: { subject: true, classRoom: { select: { id: true, name: true } }, author: { select: { name: true } } },
    });
    return NextResponse.json({ question, warnings: quality.warnings }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0]?.message ?? "Data tidak valid" }, { status: 400 });
    console.error("[tka questions POST]", error);
    return NextResponse.json({ error: "Gagal menyimpan soal TKA." }, { status: 500 });
  }
}
