import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StudentAssignmentDetailClient } from "@/components/student/student-assignment-detail-client";
import { StudentUnlinkedState } from "@/components/layout/student-shell";
import { getCurrentStudent } from "@/lib/student-portal";
import { canRevealAssignmentSolutions, publicAssignmentQuestion } from "@/lib/assignment-engine";
import { assignmentDeadlineState, effectiveAssignmentDueAt } from "@/lib/assignment-time";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StudentAssignmentPage({ params }: Props) {
  const { id } = await params;
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const assignment = await prisma.assignment.findFirst({
    where: {
      id,
      classRoomId: student.classRoomId,
      status: "PUBLISHED",
    },
    include: {
      teacher: { select: { name: true } },
      questions: { orderBy: { sortOrder: "asc" } },
      submissions: {
        where: { studentId: student.id },
        take: 1,
        include: { answers: true },
      },
    },
  });
  if (!assignment) {
    redirect("/student");
  }

  const submission = assignment.submissions[0] ?? null;
  const canRevealSolutions = canRevealAssignmentSolutions({ status: submission?.status, allowResubmit: assignment.allowResubmit, answers: submission?.answers ?? [] });
  const deadlineState = assignmentDeadlineState(assignment);

  return (
    <StudentAssignmentDetailClient
      student={{
        name: student.name,
        className: student.classRoom.name,
        jenjang: student.classRoom.jenjang,
        tahunAjaran: student.classRoom.tahunAjaran,
      }}
      assignment={{
        id: assignment.id,
        title: assignment.title,
        mapel: assignment.mapel,
        description: assignment.description,
        dueAt: effectiveAssignmentDueAt(assignment)?.toISOString() ?? null,
        submissionClosedAt: assignment.submissionClosedAt?.toISOString() ?? null,
        acceptsSubmission: deadlineState.acceptsSubmission,
        isLate: deadlineState.isLate,
        teacherName: assignment.teacher.name || "Guru",
        mode: assignment.mode,
        maxScore: assignment.maxScore,
        allowLate: assignment.allowLate,
        allowResubmit: assignment.allowResubmit,
        questions: assignment.questions.map((question) => ({
          ...publicAssignmentQuestion(question),
          explanation: canRevealSolutions ? question.explanation : null,
          correctAnswer: canRevealSolutions ? question.correctAnswer : null,
        })),
      }}
      submission={
        submission
          ? {
              id: submission.id,
              answer: submission.answer,
              status: submission.status,
              submittedAt: submission.submittedAt.toISOString(),
              score: submission.score,
              feedback: submission.feedback,
              gradedAt: submission.gradedAt?.toISOString() ?? null,
              version: submission.version,
              answers: submission.answers.map((answer) => ({
                questionId: answer.questionId,
                response: answer.response,
                score: answer.score,
                feedback: answer.feedback,
                autoGraded: answer.autoGraded,
              })),
            }
          : null
      }
    />
  );
}
