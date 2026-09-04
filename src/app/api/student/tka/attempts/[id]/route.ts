import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { answersMatch } from "@/lib/tka.shared";

type Params = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SAVE"), questionId: z.string().min(1), selectedAnswers: z.array(z.coerce.number().int().min(0)).max(6) }),
  z.object({ action: z.literal("SUBMIT") }),
]);

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const attempt = await prisma.tkaAttempt.findFirst({
    where: { id, student: { userId: session.user.id } },
    select: {
      id: true,
      status: true,
      startedAt: true,
      expiresAt: true,
      submittedAt: true,
      score: true,
      correctCount: true,
      totalQuestions: true,
      package: {
        select: {
          id: true,
          title: true,
          description: true,
          durationMinutes: true,
          subject: { select: { name: true } },
          questions: {
            orderBy: { sortOrder: "asc" },
            select: {
              sortOrder: true,
              question: {
                select: { id: true, type: true, stimulus: true, prompt: true, options: true },
              },
            },
          },
        },
      },
      answers: { select: { questionId: true, selectedAnswers: true } },
    },
  });
  if (!attempt) return NextResponse.json({ error: "Sesi simulasi tidak ditemukan." }, { status: 404 });

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      correctCount: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
    },
    package: {
      id: attempt.package.id,
      title: attempt.package.title,
      description: attempt.package.description,
      durationMinutes: attempt.package.durationMinutes,
      subject: attempt.package.subject.name,
    },
    questions: attempt.package.questions.map(({ question, sortOrder }) => ({ ...question, sortOrder })),
    answers: attempt.answers,
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => null));
    if (body.action === "SAVE") {
      const answer = await prisma.$transaction(async (tx) => {
        const current = await tx.tkaAttempt.findFirst({
          where: { id, student: { userId: session.user.id } },
          select: {
            id: true, status: true, expiresAt: true,
            package: { select: { questions: { where: { questionId: body.questionId }, select: { question: { select: { type: true, options: true } } } } } },
          },
        });
        if (!current) throw new Error("TKA_ATTEMPT_NOT_FOUND");
        if (current.status !== "IN_PROGRESS") throw new Error("TKA_ATTEMPT_FINISHED");
        if (current.expiresAt.getTime() <= Date.now()) throw new Error("TKA_ATTEMPT_EXPIRED");
        const link = current.package.questions[0];
        if (!link) throw new Error("TKA_QUESTION_NOT_IN_PACKAGE");
        const options = Array.isArray(link.question.options) ? link.question.options : [];
        const selected = [...new Set(body.selectedAnswers)].sort((a, b) => a - b);
        if (selected.some((value) => value >= options.length) || (link.question.type === "SINGLE_CHOICE" && selected.length > 1)) {
          throw new Error("TKA_INVALID_ANSWER");
        }
        return tx.tkaAnswer.upsert({
          where: { attemptId_questionId: { attemptId: current.id, questionId: body.questionId } },
          create: { attemptId: current.id, questionId: body.questionId, selectedAnswers: selected },
          update: { selectedAnswers: selected, answeredAt: new Date(), isCorrect: null },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return NextResponse.json({ answer: { questionId: answer.questionId, selectedAnswers: answer.selectedAnswers } });
    }

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.tkaAttempt.findFirst({
        where: { id, student: { userId: session.user.id } },
        include: { package: { include: { questions: { orderBy: { sortOrder: "asc" }, include: { question: true } } } }, answers: true },
      });
      if (!attempt) throw new Error("TKA_ATTEMPT_NOT_FOUND");
      if (attempt.status !== "IN_PROGRESS") throw new Error("TKA_ATTEMPT_FINISHED");
      const expired = attempt.expiresAt.getTime() <= Date.now();
      const claimed = await tx.tkaAttempt.updateMany({
        where: { id: attempt.id, status: "IN_PROGRESS" },
        data: { status: expired ? "EXPIRED" : "SUBMITTED", submittedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("TKA_ATTEMPT_FINISHED");
      const answerMap = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
      let correctCount = 0;
      const scored = attempt.package.questions.map(({ question }) => {
        const answer = answerMap.get(question.id);
        const isCorrect = answersMatch(answer?.selectedAnswers ?? [], question.correctAnswers);
        if (isCorrect) correctCount += 1;
        return { questionId: question.id, isCorrect };
      });
      const totalQuestions = attempt.package.questions.length;
      const score = totalQuestions ? (correctCount / totalQuestions) * 100 : 0;
      for (const { questionId, isCorrect } of scored) {
        if (answerMap.has(questionId)) await tx.tkaAnswer.update({ where: { attemptId_questionId: { attemptId: attempt.id, questionId } }, data: { isCorrect } });
      }
      await tx.tkaAttempt.update({ where: { id: attempt.id }, data: { score, correctCount, totalQuestions } });
      const review = attempt.package.showDiscussion ? attempt.package.questions.map(({ question }) => ({ questionId: question.id, prompt: question.prompt, options: Array.isArray(question.options) ? question.options.map(String) : [], correctAnswers: question.correctAnswers, selectedAnswers: answerMap.get(question.id)?.selectedAnswers ?? [], explanation: question.explanation })) : [];
      return { status: expired ? "EXPIRED" as const : "SUBMITTED" as const, score, correctCount, totalQuestions, review };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Jawaban tidak valid." }, { status: 400 });
    if (error instanceof Error && error.message === "TKA_ATTEMPT_NOT_FOUND") return NextResponse.json({ error: "Sesi simulasi tidak ditemukan." }, { status: 404 });
    if (error instanceof Error && error.message === "TKA_ATTEMPT_FINISHED") return NextResponse.json({ error: "Simulasi sudah selesai. Muat ulang untuk melihat hasil." }, { status: 409 });
    if (error instanceof Error && error.message === "TKA_ATTEMPT_EXPIRED") return NextResponse.json({ error: "Waktu simulasi telah habis.", expired: true }, { status: 409 });
    if (error instanceof Error && error.message === "TKA_QUESTION_NOT_IN_PACKAGE") return NextResponse.json({ error: "Soal tidak termasuk paket." }, { status: 400 });
    if (error instanceof Error && error.message === "TKA_INVALID_ANSWER") return NextResponse.json({ error: "Pilihan jawaban tidak valid." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Jawaban sedang diproses di perangkat lain. Coba kembali." }, { status: 409 });
    console.error("[tka attempt PATCH]", error);
    return NextResponse.json({ error: "Gagal menyimpan simulasi." }, { status: 500 });
  }
}
