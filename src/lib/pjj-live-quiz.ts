import { prisma } from "@/lib/prisma";

export type LiveQuizQuestionInput = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  points?: number;
  sortOrder?: number;
};

export function scoreLiveQuizPercent(
  answers: Array<{ isCorrect: boolean; points: number }>,
  totalPoints: number
) {
  if (totalPoints <= 0) return 0;
  const earned = answers.reduce(
    (sum, item) => sum + (item.isCorrect ? item.points : 0),
    0
  );
  return Math.round((earned / totalPoints) * 1000) / 10;
}

export function serializeQuizForViewer(
  quiz: {
    id: string;
    title: string;
    status: string;
    durationSec: number;
    launchedAt: Date | null;
    closedAt: Date | null;
    questions: Array<{
      id: string;
      prompt: string;
      options: unknown;
      correctOptionIndex: number;
      points: number;
      sortOrder: number;
    }>;
  },
  options: { includeAnswerKey: boolean }
) {
  return {
    id: quiz.id,
    title: quiz.title,
    status: quiz.status,
    durationSec: quiz.durationSec,
    launchedAt: quiz.launchedAt,
    closedAt: quiz.closedAt,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      points: question.points,
      sortOrder: question.sortOrder,
      ...(options.includeAnswerKey
        ? { correctOptionIndex: question.correctOptionIndex }
        : {}),
    })),
  };
}

export async function findActiveLiveQuiz(sessionId: string) {
  return prisma.liveClassQuiz.findFirst({
    where: { sessionId, status: "LIVE" },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      _count: { select: { attempts: true } },
    },
  });
}

export function quizEndsAt(launchedAt: Date | null, durationSec: number) {
  if (!launchedAt) return null;
  return new Date(launchedAt.getTime() + durationSec * 1000);
}

export function isQuizTimerExpired(launchedAt: Date | null, durationSec: number) {
  const endsAt = quizEndsAt(launchedAt, durationSec);
  if (!endsAt) return false;
  return Date.now() > endsAt.getTime();
}
