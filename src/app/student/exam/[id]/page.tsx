import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StudentExamDetailClient } from "@/components/student/student-exam-detail-client";
import { StudentUnlinkedState } from "@/components/layout/student-shell";
import { getCurrentStudent } from "@/lib/student-portal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StudentExamPage({ params }: Props) {
  const { id } = await params;
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const exam = await prisma.exam.findFirst({
    where: { id, classRoomId: student.classRoomId, status: "PUBLISHED" },
    include: {
      teacher: { select: { name: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          prompt: true,
          options: true,
          correctOptionIndex: true,
          explanation: true,
        },
      },
      attempts: {
        where: { studentId: student.id },
        take: 1,
        include: { answers: true },
      },
    },
  });
  if (!exam) {
    redirect("/student");
  }

  const attempt = exam.attempts[0] ?? null;

  return (
    <StudentExamDetailClient
      student={{
        name: student.name,
        className: student.classRoom.name,
        jenjang: student.classRoom.jenjang,
        tahunAjaran: student.classRoom.tahunAjaran,
      }}
      exam={{
        id: exam.id,
        title: exam.title,
        mapel: exam.mapel,
        instructions: exam.instructions,
        startAt: exam.startAt.toISOString(),
        endAt: exam.endAt.toISOString(),
        durationMinutes: exam.durationMinutes,
        teacherName: exam.teacher.name || "Guru",
        questions: exam.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          options: Array.isArray(question.options)
            ? question.options.map((option) => String(option))
            : [],
          correctOptionIndex: attempt ? question.correctOptionIndex : null,
          explanation: attempt ? question.explanation : null,
        })),
      }}
      attempt={
        attempt
          ? {
              id: attempt.id,
              score: attempt.score,
              correctCount: attempt.correctCount,
              totalQuestions: attempt.totalQuestions,
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

