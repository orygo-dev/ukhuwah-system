import { AdminShell } from "@/components/layout/admin-shell";
import { TkaManagementClient } from "@/components/tka/tka-management-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminTkaPage() {
  const [subjects, questions, packages] = await Promise.all([
    prisma.tkaSubject.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.tkaQuestion.findMany({ where: { scope: "GLOBAL", status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, include: { subject: true, classRoom: { select: { id: true, name: true } }, author: { select: { name: true } } } }),
    prisma.tkaPackage.findMany({ where: { scope: "GLOBAL" }, orderBy: { updatedAt: "desc" }, include: { subject: { select: { id: true, name: true } }, classRoom: { select: { id: true, name: true } }, questions: { orderBy: { sortOrder: "asc" }, select: { questionId: true } }, attempts: { orderBy: { submittedAt: "desc" }, select: { id: true, status: true, score: true, correctCount: true, totalQuestions: true, submittedAt: true, student: { select: { id: true, name: true, nis: true } }, answers: { select: { questionId: true, isCorrect: true } } } }, _count: { select: { questions: true, attempts: true } } } }),
  ]);
  return <AdminShell activePath="/admin/tka"><TkaManagementClient role="SUPER_ADMIN" subjects={subjects} classes={[]} initialQuestions={questions} initialPackages={packages} /></AdminShell>;
}
