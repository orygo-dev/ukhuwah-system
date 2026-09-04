import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";
import { reportPjjApiError } from "@/lib/pjj-api-errors";
import {
  findActiveLiveQuiz,
  serializeQuizForViewer,
} from "@/lib/pjj-live-quiz";

type Params = { params: Promise<{ id: string }> };

const questionSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(400)).min(2).max(6),
  correctOptionIndex: z.number().int().min(0),
  points: z.number().int().min(1).max(100).optional().default(1),
  sortOrder: z.number().int().min(0).optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  durationSec: z.number().int().min(15).max(3600).optional().default(120),
  questions: z.array(questionSchema).min(1).max(20),
});

export async function GET(_request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
  }

  const isModerator = access.role !== "STUDENT";
  const [quizzes, active] = await Promise.all([
    isModerator
      ? prisma.liveClassQuiz.findMany({
          where: { sessionId: id },
          orderBy: { createdAt: "desc" },
          include: {
            questions: { orderBy: { sortOrder: "asc" } },
            _count: { select: { attempts: true } },
          },
          take: 20,
        })
      : Promise.resolve([]),
    findActiveLiveQuiz(id),
  ]);

  let myAttempt = null;
  if (active && access.studentId) {
    myAttempt = await prisma.liveClassQuizAttempt.findUnique({
      where: {
        quizId_studentId: { quizId: active.id, studentId: access.studentId },
      },
      include: { answers: true },
    });
  }

  const includeAnswerKey = isModerator || active?.status === "CLOSED";

  return NextResponse.json({
    quizzes: quizzes.map((quiz) =>
      serializeQuizForViewer(quiz, { includeAnswerKey: true })
    ),
    activeQuiz: active
      ? {
          ...serializeQuizForViewer(active, {
            includeAnswerKey: Boolean(includeAnswerKey && active.status === "CLOSED"),
          }),
          submittedCount: active._count.attempts,
          myAttempt,
        }
      : null,
    viewer: { role: access.role, studentId: access.studentId ?? null, isModerator },
  });
}

export async function POST(request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed || access.role === "STUDENT") {
    return NextResponse.json(
      { error: "Hanya guru/moderator yang dapat membuat kuis live." },
      { status: 403 }
    );
  }

  try {
    const input = createSchema.parse(await request.json());
    for (const question of input.questions) {
      if (question.correctOptionIndex >= question.options.length) {
        return NextResponse.json(
          { error: "Index jawaban benar di luar opsi." },
          { status: 400 }
        );
      }
    }

    const quiz = await prisma.liveClassQuiz.create({
      data: {
        sessionId: id,
        createdById: userSession.user.id,
        title: input.title,
        durationSec: input.durationSec,
        status: "DRAFT",
        questions: {
          create: input.questions.map((question, index) => ({
            prompt: question.prompt,
            options: question.options,
            correctOptionIndex: question.correctOptionIndex,
            points: question.points,
            sortOrder: question.sortOrder ?? index,
          })),
        },
      },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({
      success: true,
      quiz: serializeQuizForViewer(quiz, { includeAnswerKey: true }),
    });
  } catch (error) {
    const failure = reportPjjApiError("pjj.quizzes.create", error, {
      validationMessage: "Kuis tidak valid.",
      fallbackMessage: "Kuis tidak dapat dibuat.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
