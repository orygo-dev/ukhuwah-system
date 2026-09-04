import { notFound } from "next/navigation";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { TkaAttemptClient } from "@/components/tka/tka-attempt-client";
import { getCurrentStudent } from "@/lib/student-portal";
import { prisma } from "@/lib/prisma";
import { studentPackageWhere } from "@/lib/tka";
import { parseNumberArray } from "@/lib/tka.shared";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function StudentTkaDetailPage({ params }: Props) {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;
  const { id } = await params;
  const item = await prisma.tkaPackage.findFirst({
    where: { id, ...studentPackageWhere(student) },
    include: {
      questions: { orderBy: { sortOrder: "asc" }, include: { question: { select: { id: true, type: true, stimulus: true, prompt: true, options: true, correctAnswers: true, explanation: true } } } },
      attempts: { where: { studentId: student.id }, include: { answers: true } },
    },
  });
  if (!item) notFound();
  const attempt = item.attempts[0] ?? null;
  const answers = Object.fromEntries((attempt?.answers ?? []).map((answer) => [answer.questionId, parseNumberArray(answer.selectedAnswers)]));
  const publicQuestions = item.questions.map(({ question }) => ({ id: question.id, type: question.type, stimulus: question.stimulus, prompt: question.prompt, options: Array.isArray(question.options) ? question.options.map(String) : [] }));
  const review = attempt && attempt.status !== "IN_PROGRESS" && item.showDiscussion ? item.questions.map(({ question }) => ({ questionId: question.id, prompt: question.prompt, options: Array.isArray(question.options) ? question.options.map(String) : [], correctAnswers: parseNumberArray(question.correctAnswers), selectedAnswers: answers[question.id] ?? [], explanation: question.explanation })) : [];
  return <StudentShell><TkaAttemptClient packageId={item.id} title={item.title} durationMinutes={item.durationMinutes} questions={publicQuestions} initialAttempt={attempt?.status === "IN_PROGRESS" ? { id: attempt.id, expiresAt: attempt.expiresAt.toISOString() } : null} initialAnswers={answers} completedResult={attempt && attempt.status !== "IN_PROGRESS" ? { status: attempt.status, score: attempt.score ?? 0, correctCount: attempt.correctCount, totalQuestions: attempt.totalQuestions, review } : null} /></StudentShell>;
}
