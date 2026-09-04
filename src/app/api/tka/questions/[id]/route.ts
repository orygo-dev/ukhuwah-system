import { NextResponse } from "next/server";
import { Prisma, TkaQuestionType } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTka, getTkaActor } from "@/lib/tka";
import { assessTkaQuestionQuality } from "@/lib/tka-question-quality";

type Params = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["SUBMIT", "APPROVE", "PUBLISH", "REJECT", "ARCHIVE"]), reviewNote: z.string().trim().max(3000).optional() }),
  z.object({ action: z.literal("DUPLICATE") }),
  z.object({ action: z.literal("UPDATE"), version: z.number().int().positive(), type: z.nativeEnum(TkaQuestionType), stimulus: z.string().trim().max(10000).nullable().optional(), prompt: z.string().trim().min(5).max(5000), options: z.array(z.string().trim().min(1).max(1000)).min(3).max(6), correctAnswers: z.array(z.number().int().min(0)).min(1).max(6), explanation: z.string().trim().max(5000).nullable().optional(), competency: z.string().trim().max(200).nullable().optional(), difficulty: z.enum(["EASY", "MEDIUM", "HARD"]) }),
]);

function ownsQuestion(actor: Awaited<ReturnType<typeof getTkaActor>>, question: { authorId: string; schoolId: string | null; scope: string }) {
  return (actor.role === "TEACHER" && question.authorId === actor.id && question.scope === "CLASS") ||
    (actor.role === "SCHOOL_ADMIN" && Boolean(actor.schoolId) && question.schoolId === actor.schoolId && question.scope === "SCHOOL") ||
    (actor.role === "SUPER_ADMIN" && question.scope === "GLOBAL");
}

const include = { subject: true, classRoom: { select: { id: true, name: true } }, author: { select: { name: true } } } as const;

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth(); if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const actor = await getTkaActor(session); const { id } = await params; const body = schema.parse(await req.json().catch(() => null));
    const question = await prisma.tkaQuestion.findUnique({ where: { id }, include: { _count: { select: { packageLinks: true, answers: true } } } });
    if (!question) return NextResponse.json({ error: "Soal tidak ditemukan." }, { status: 404 });
    if (!ownsQuestion(actor, question)) return NextResponse.json({ error: "Anda tidak berwenang mengelola soal ini." }, { status: 403 });

    if (body.action === "DUPLICATE") {
      if (!Array.isArray(question.options) || !Array.isArray(question.correctAnswers)) {
        return NextResponse.json({ error: "Data soal lama tidak valid dan tidak dapat diduplikasi." }, { status: 409 });
      }
      const duplicate = await prisma.tkaQuestion.create({ data: { subjectId: question.subjectId, authorId: actor.id, schoolId: question.schoolId, classRoomId: question.classRoomId, scope: question.scope, status: "DRAFT", type: question.type, stimulus: question.stimulus, prompt: `${question.prompt} (Salinan)`, options: question.options as Prisma.InputJsonArray, correctAnswers: question.correctAnswers as Prisma.InputJsonArray, explanation: question.explanation, competency: question.competency, difficulty: question.difficulty }, include });
      return NextResponse.json({ question: duplicate });
    }
    if (body.action === "UPDATE") {
      if (!["DRAFT", "REJECTED"].includes(question.status) || question._count.answers > 0) return NextResponse.json({ error: "Soal yang sudah terbit/dikerjakan tidak dapat diubah. Gunakan Duplikasi untuk membuat revisi." }, { status: 409 });
      const quality = assessTkaQuestionQuality(body, false);
      if (quality.errors.length) return NextResponse.json({ error: quality.errors[0], errors: quality.errors }, { status: 400 });
      const changed = await prisma.tkaQuestion.updateMany({ where: { id, version: body.version, status: { in: ["DRAFT", "REJECTED"] } }, data: { type: body.type, stimulus: body.stimulus || null, prompt: body.prompt, options: body.options, correctAnswers: [...new Set(body.correctAnswers)].sort((a, b) => a - b), explanation: body.explanation || null, competency: body.competency || null, difficulty: body.difficulty, status: "DRAFT", reviewNote: null, version: { increment: 1 } } });
      if (changed.count !== 1) return NextResponse.json({ error: "Soal berubah di perangkat lain. Muat ulang sebelum menyimpan kembali." }, { status: 409 });
      return NextResponse.json({ question: await prisma.tkaQuestion.findUniqueOrThrow({ where: { id }, include }) });
    }

    if (["SUBMIT", "APPROVE", "PUBLISH"].includes(body.action)) {
      const quality = assessTkaQuestionQuality(question);
      if (quality.errors.length) return NextResponse.json({ error: `Soal belum layak dipublikasikan: ${quality.errors[0]}`, errors: quality.errors, warnings: quality.warnings }, { status: 422 });
    }
    const ownsClass = actor.role === "TEACHER" && question.scope === "CLASS";
    let status = question.status;
    if (body.action === "SUBMIT" && ["DRAFT", "REJECTED"].includes(status)) status = ownsClass ? "APPROVED" : "PENDING_REVIEW";
    else if (body.action === "APPROVE" && !ownsClass && status === "PENDING_REVIEW") status = "APPROVED";
    else if (body.action === "PUBLISH" && status === "APPROVED") status = "PUBLISHED";
    else if (body.action === "REJECT" && !ownsClass && ["PENDING_REVIEW", "APPROVED"].includes(status)) status = "REJECTED";
    else if (body.action === "ARCHIVE" && status !== "ARCHIVED") status = "ARCHIVED";
    else return NextResponse.json({ error: "Transisi status tidak diizinkan." }, { status: 409 });
    const changed = await prisma.tkaQuestion.updateMany({ where: { id, status: question.status, version: question.version }, data: { status, reviewNote: body.reviewNote || null, reviewerId: ownsClass ? null : actor.id, reviewedAt: ["APPROVED", "REJECTED"].includes(status) ? new Date() : undefined, publishedAt: status === "PUBLISHED" ? new Date() : undefined, version: { increment: 1 } } });
    if (changed.count !== 1) return NextResponse.json({ error: "Status soal berubah saat diproses. Muat ulang lalu coba lagi." }, { status: 409 });
    return NextResponse.json({ question: await prisma.tkaQuestion.findUniqueOrThrow({ where: { id }, include }) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0]?.message ?? "Data tidak valid" }, { status: 400 });
    console.error("[tka question PATCH]", error); return NextResponse.json({ error: "Gagal memperbarui soal." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth(); if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actor = await getTkaActor(session); const { id } = await params;
  const result = await prisma.$transaction(async (tx) => {
    const question = await tx.tkaQuestion.findUnique({ where: { id }, include: { _count: { select: { packageLinks: true, answers: true } } } });
    if (!question || !ownsQuestion(actor, question)) return null;
    if (question._count.packageLinks > 0 || question._count.answers > 0 || question.status === "PUBLISHED") {
      await tx.tkaQuestion.update({ where: { id }, data: { status: "ARCHIVED", version: { increment: 1 } } });
      return "archived" as const;
    }
    await tx.tkaQuestion.delete({ where: { id } });
    return "deleted" as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!result) return NextResponse.json({ error: "Soal tidak ditemukan." }, { status: 404 });
  return NextResponse.json(result === "archived" ? { archived: true } : { deleted: true });
}
