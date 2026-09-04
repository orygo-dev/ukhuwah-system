import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { TkaManagementClient } from "@/components/tka/tka-management-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SchoolTkaPage() {
  const { account } = await getCurrentSchoolAdmin("/school/tka");
  const schoolId = account?.schoolId ?? "__none__";
  const [subjects, questions, packages] = await Promise.all([
    prisma.tkaSubject.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.tkaQuestion.findMany({ where: { schoolId, scope: "SCHOOL", status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, include: { subject: true, classRoom: { select: { id: true, name: true } }, author: { select: { name: true } } } }),
    prisma.tkaPackage.findMany({ where: { schoolId, scope: "SCHOOL" }, orderBy: { updatedAt: "desc" }, include: { subject: { select: { id: true, name: true } }, classRoom: { select: { id: true, name: true } }, questions: { orderBy: { sortOrder: "asc" }, select: { questionId: true } }, attempts: { orderBy: { submittedAt: "desc" }, select: { id: true, status: true, score: true, correctCount: true, totalQuestions: true, submittedAt: true, student: { select: { id: true, name: true, nis: true } }, answers: { select: { questionId: true, isCorrect: true } } } }, _count: { select: { questions: true, attempts: true } } } }),
  ]);
  return <SchoolAdminShell activePath="/school/tka" accountName={account?.name} accountEmail={account?.email} schoolName={account?.school?.name}><TkaManagementClient role="SCHOOL_ADMIN" subjects={subjects} classes={[]} initialQuestions={questions} initialPackages={packages} /></SchoolAdminShell>;
}
