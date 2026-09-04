import { prisma } from "@/lib/prisma";
import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { SchoolTeachersClient } from "@/components/school/school-teachers-client";
import { getCurrentSchoolAdmin, schoolRegion } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolTeachersPage() {
  const { account } = await getCurrentSchoolAdmin("/school/teachers");
  const shellAccount = {
    accountName: account?.name,
    accountEmail: account?.email,
    schoolName: account?.school?.name,
  };

  if (!account?.schoolId) {
    return (
      <SchoolAdminShell activePath="/school/teachers" {...shellAccount}>
        <Card className="rounded-[24px] border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <h1 className="text-xl font-extrabold text-amber-950">
              Akun admin sekolah belum terhubung ke sekolah
            </h1>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Hubungkan akun ini ke master data sekolah melalui Super Admin.
            </p>
          </CardContent>
        </Card>
      </SchoolAdminShell>
    );
  }

  const schoolId = account.schoolId;
  const [teachers, classRooms, documentCount, journalCount, assessmentCount] =
    await Promise.all([
      prisma.user.findMany({
        where: { role: "TEACHER", schoolId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          teachingProfiles: {
            where: { schoolId },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              schoolName: true,
              jenjang: true,
              mapel: true,
              isPrimary: true,
            },
          },
          _count: {
            select: {
              classRooms: true,
              documents: true,
              dailyJournals: true,
              assessments: true,
            },
          },
        },
      }),
      prisma.classRoom.findMany({
        where: { schoolId, isActive: true },
        select: {
          id: true,
          name: true,
          jenjang: true,
          teacherId: true,
          tahunAjaran: true,
          _count: {
            select: {
              students: { where: { isActive: true } },
              sessions: true,
              journals: true,
              assessments: true,
              assignments: true,
              quizzes: true,
              exams: true,
            },
          },
        },
        orderBy: [{ teacher: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.document.count({ where: { user: { schoolId, role: "TEACHER" } } }),
      prisma.dailyJournal.count({ where: { classRoom: { schoolId } } }),
      prisma.assessment.count({ where: { classRoom: { schoolId } } }),
    ]);

  const teacherRows = teachers.map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    createdAt: teacher.createdAt.toISOString(),
    profiles: teacher.teachingProfiles,
    counts: {
      documents: teacher._count.documents,
      dailyJournals: teacher._count.dailyJournals,
      assessments: teacher._count.assessments,
      classes: teacher._count.classRooms,
    },
  }));

  const classRows = classRooms.map((room) => ({
    id: room.id,
    name: room.name,
    jenjang: room.jenjang,
    tahunAjaran: room.tahunAjaran,
    teacherId: room.teacherId,
    counts: {
      students: room._count.students,
      sessions: room._count.sessions,
      journals: room._count.journals,
      assessments: room._count.assessments,
      assignments: room._count.assignments,
      quizzes: room._count.quizzes,
      exams: room._count.exams,
    },
  }));

  return (
    <SchoolAdminShell activePath="/school/teachers" {...shellAccount}>
      <SchoolTeachersClient
        schoolName={account.school?.name || "Sekolah"}
        region={schoolRegion(account.school)}
        teachers={teacherRows}
        classRooms={classRows}
        documentCount={documentCount}
        journalCount={journalCount}
        assessmentCount={assessmentCount}
      />
    </SchoolAdminShell>
  );
}
