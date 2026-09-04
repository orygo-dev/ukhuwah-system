import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";
import { reportPjjApiError } from "@/lib/pjj-api-errors";
import {
  isQuizTimerExpired,
  scoreLiveQuizPercent,
} from "@/lib/pjj-live-quiz";

type Params = { params: Promise<{ id: string; quizId: string }> };

const startSchema = z.object({
  action: z.literal("start").optional().default("start"),
});

const submitSchema = z.object({
  action: z.literal("submit"),
  answers: z
    .array(
      z.object({
        questionId: z.string().cuid(),
        selectedIndex: z.number().int().min(0),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id, quizId } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed || !access.studentId) {
    return NextResponse.json(
      { error: "Hanya siswa peserta yang dapat menjawab kuis." },
      { status: 403 }
    );
  }

  try {
    const raw = await request.json();
    const quiz = await prisma.liveClassQuiz.findFirst({
      where: { id: quizId, sessionId: id },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quiz) {
      return NextResponse.json({ error: "Kuis tidak ditemukan." }, { status: 404 });
    }
    if (quiz.status !== "LIVE") {
      return NextResponse.json({ error: "Kuis tidak sedang berlangsung." }, { status: 409 });
    }
    if (isQuizTimerExpired(quiz.launchedAt, quiz.durationSec)) {
      return NextResponse.json({ error: "Waktu kuis sudah habis." }, { status: 409 });
    }

    if (raw?.action === "submit") {
      const input = submitSchema.parse(raw);
      const existing = await prisma.liveClassQuizAttempt.findUnique({
        where: {
          quizId_studentId: { quizId: quiz.id, studentId: access.studentId },
        },
      });
      if (existing?.status === "SUBMITTED") {
        return NextResponse.json(
          { error: "Jawaban sudah dikirim sebelumnya." },
          { status: 409 }
        );
      }

      const questionMap = new Map(quiz.questions.map((item) => [item.id, item]));
      const graded = input.answers.map((answer) => {
        const question = questionMap.get(answer.questionId);
        if (!question) {
          throw new Error(`Soal ${answer.questionId} tidak valid.`);
        }
        if (answer.selectedIndex >= (question.options as string[]).length) {
          throw new Error("Pilihan jawaban di luar opsi.");
        }
        const isCorrect = answer.selectedIndex === question.correctOptionIndex;
        return {
          questionId: question.id,
          selectedIndex: answer.selectedIndex,
          isCorrect,
          points: question.points,
        };
      });
      const totalPoints = quiz.questions.reduce((sum, item) => sum + item.points, 0);
      const score = scoreLiveQuizPercent(graded, totalPoints);

      const attempt = await prisma.$transaction(async (tx) => {
        const row = existing
          ? await tx.liveClassQuizAttempt.update({
              where: { id: existing.id },
              data: {
                status: "SUBMITTED",
                score,
                submittedAt: new Date(),
              },
            })
          : await tx.liveClassQuizAttempt.create({
              data: {
                quizId: quiz.id,
                studentId: access.studentId!,
                status: "SUBMITTED",
                score,
                submittedAt: new Date(),
              },
            });

        await tx.liveClassQuizAnswer.deleteMany({ where: { attemptId: row.id } });
        await tx.liveClassQuizAnswer.createMany({
          data: graded.map((item) => ({
            attemptId: row.id,
            questionId: item.questionId,
            selectedIndex: item.selectedIndex,
            isCorrect: item.isCorrect,
          })),
        });
        return row;
      });

      return NextResponse.json({
        success: true,
        attempt: {
          id: attempt.id,
          score: attempt.score,
          status: attempt.status,
          submittedAt: attempt.submittedAt,
        },
      });
    }

    startSchema.parse(raw);
    const attempt = await prisma.liveClassQuizAttempt.upsert({
      where: {
        quizId_studentId: { quizId: quiz.id, studentId: access.studentId },
      },
      create: {
        quizId: quiz.id,
        studentId: access.studentId,
        status: "IN_PROGRESS",
      },
      update: {},
      include: { answers: true },
    });
    if (attempt.status === "SUBMITTED") {
      return NextResponse.json({
        success: true,
        attempt,
        alreadySubmitted: true,
      });
    }
    return NextResponse.json({ success: true, attempt });
  } catch (error) {
    const failure = reportPjjApiError("pjj.quizzes.attempt", error, {
      validationMessage: "Jawaban kuis tidak valid.",
      fallbackMessage: "Gagal memproses percobaan kuis.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
