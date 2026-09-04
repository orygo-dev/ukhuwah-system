import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ReadingManagementClient } from "@/components/reading/reading-management-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeacherReadingPage() {
  const session = await auth();
  const userId = session!.user.id;
  const schoolId = session!.user.schoolId;
  const [classes, books] = await Promise.all([
    prisma.classRoom.findMany({
      where: { isActive: true, OR: [{ teacherId: userId }, { teacherAssignments: { some: { teacherId: userId, isActive: true } } }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.readingBook.findMany({
      where: {
        status: { not: "ARCHIVED" },
        OR: [
          { createdById: userId },
          { scope: "GLOBAL", status: "PUBLISHED" },
          ...(schoolId ? [{ scope: "SCHOOL" as const, schoolId, status: "PUBLISHED" as const }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        school: { select: { name: true } },
        classRoom: { select: { name: true } },
        _count: { select: { progress: true, assignments: true } },
      },
    }),
  ]);
  return <DashboardShell activePath="/dashboard/zona-baca"><ReadingManagementClient role="TEACHER" actorId={userId} initialBooks={books} classes={classes} /></DashboardShell>;
}
