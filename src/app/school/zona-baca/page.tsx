import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { ReadingManagementClient } from "@/components/reading/reading-management-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SchoolReadingPage() {
  const { account } = await getCurrentSchoolAdmin("/school/zona-baca");
  const schoolId = account?.schoolId ?? "__none__";
  const [classes, books] = await Promise.all([
    prisma.classRoom.findMany({ where: { schoolId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.readingBook.findMany({
      where: { schoolId, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      include: { createdBy: { select: { name: true } }, school: { select: { name: true } }, classRoom: { select: { name: true } }, _count: { select: { progress: true, assignments: true } } },
    }),
  ]);
  return <SchoolAdminShell activePath="/school/zona-baca" accountName={account?.name} accountEmail={account?.email} schoolName={account?.school?.name}><ReadingManagementClient role="SCHOOL_ADMIN" actorId={account?.id ?? ""} initialBooks={books} classes={classes} /></SchoolAdminShell>;
}
