import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TkaManagementClient } from "@/components/tka/tka-management-client";

export const dynamic = "force-dynamic";

export default async function TeacherTkaPage() {
  const session = await auth();
  const userId = session!.user.id;
  const [subjects, classes, questions, packages] = await Promise.all([
    prisma.tkaSubject.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.classRoom.findMany({ where: { teacherId: userId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tkaQuestion.findMany({ where: { authorId: userId, status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, include: { subject: true, classRoom: { select: { id: true, name: true } }, author: { select: { name: true } } } }),
    prisma.tkaPackage.findMany({ where: { authorId: userId, scope: "CLASS" }, orderBy: { updatedAt: "desc" }, include: { subject: { select: { id: true, name: true } }, classRoom: { select: { id: true, name: true } }, questions: { orderBy: { sortOrder: "asc" }, select: { questionId: true } }, attempts: { orderBy: { submittedAt: "desc" }, select: { id: true, status: true, score: true, correctCount: true, totalQuestions: true, submittedAt: true, student: { select: { id: true, name: true, nis: true } }, answers: { select: { questionId: true, isCorrect: true } } } }, _count: { select: { questions: true, attempts: true } } } }),
  ]);
  return <TkaManagementClient role="TEACHER" subjects={subjects} classes={classes} initialQuestions={questions} initialPackages={packages} />;
}
