import { AdminShell } from "@/components/layout/admin-shell";
import { ReadingManagementClient } from "@/components/reading/reading-management-client";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminReadingPage() {
  const session = await requireSuperAdmin();
  const books = await prisma.readingBook.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { createdBy: { select: { name: true } }, school: { select: { name: true } }, classRoom: { select: { name: true } }, _count: { select: { progress: true, assignments: true } } },
  });
  return <AdminShell activePath="/admin/zona-baca"><ReadingManagementClient role="SUPER_ADMIN" actorId={session.user.id} initialBooks={books} classes={[]} /></AdminShell>;
}
