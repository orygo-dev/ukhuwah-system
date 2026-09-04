import { StudentDailyQuizClient } from "@/components/student/student-daily-quiz-client";
import { StudentUnlinkedState } from "@/components/layout/student-shell";
import {
  countStudentDailyStreak,
  formatJakartaDateLabel,
  getPublishedDailyQuizByDate,
  jakartaDateKey,
} from "@/lib/daily-quiz";
import { prisma } from "@/lib/prisma";
import { getCurrentStudent } from "@/lib/student-portal";

export const dynamic = "force-dynamic";

export default async function StudentQuizListPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const dateKey = jakartaDateKey();
  const [quiz, attempt, streak] = await Promise.all([
    getPublishedDailyQuizByDate(dateKey),
    prisma.dailyQuizAttempt.findFirst({
      where: {
        studentId: student.id,
        dailyQuiz: { dateKey },
      },
      include: { answers: true },
    }),
    countStudentDailyStreak(student.id),
  ]);

  return (
    <StudentDailyQuizClient
      dateKey={dateKey}
      dateLabel={formatJakartaDateLabel(dateKey)}
      streak={streak}
      quiz={
        quiz
          ? {
              id: quiz.id,
              title: quiz.title,
              theme: quiz.theme,
              description: quiz.description,
              questionCount: quiz.questionCount,
              questions: quiz.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                options: Array.isArray(question.options)
                  ? question.options.map((option) => String(option))
                  : [],
                correctOptionIndex: attempt ? question.correctOptionIndex : null,
                explanation: attempt ? question.explanation : null,
              })),
            }
          : null
      }
      attempt={
        attempt
          ? {
              id: attempt.id,
              score: attempt.score,
              correctCount: attempt.correctCount,
              totalQuestions: attempt.totalQuestions,
              xpEarned: attempt.xpEarned,
              submittedAt: attempt.submittedAt.toISOString(),
              answers: attempt.answers.map((answer) => ({
                questionId: answer.questionId,
                selectedOptionIndex: answer.selectedOptionIndex,
                isCorrect: answer.isCorrect,
              })),
            }
          : null
      }
    />
  );
}
