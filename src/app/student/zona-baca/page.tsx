import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { StudentReadingLibraryClient } from "@/components/reading/student-reading-library-client";
import { getCurrentStudent } from "@/lib/student-portal";
import { prisma } from "@/lib/prisma";
import { publishedReadingWhere } from "@/lib/reading";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

export const dynamic = "force-dynamic";

export default async function StudentReadingPage() {
  const { session, student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;
  const actor = { id: session.user.id, role: session.user.role, schoolId: student.classRoom.schoolId, studentId: student.id, classRoomId: student.classRoomId };
  const [books, assignments] = await Promise.all([
    prisma.readingBook.findMany({
      where: publishedReadingWhere(actor),
      orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
      include: { progress: { where: { studentId: student.id }, select: { progressPercent: true } }, favorites: { where: { studentId: student.id }, select: { id: true } } },
    }),
    prisma.readingAssignment.findMany({
      where: { classRoomId: student.classRoomId, status: "PUBLISHED" },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: { book: { select: { id: true, slug: true, title: true } }, submissions: { where: { studentId: student.id }, select: { id: true } } },
    }),
  ]);
  const rows = books.map((book) => ({ id: book.id, slug: book.slug, title: book.title, authorName: book.authorName, description: book.description, category: book.category, contentType: book.contentType, coverUrl: book.coverUrl ? toSameOriginUploadUrl(book.coverUrl) : book.coverUrl, estimatedMinutes: book.estimatedMinutes, pageCount: book.pageCount, scope: book.scope, progressPercent: book.progress[0]?.progressPercent ?? 0, favorite: book.favorites.length > 0 }));
  const assignmentRows = assignments.map((item) => ({ id: item.id, title: item.title, dueAt: item.dueAt?.toISOString() ?? null, book: item.book, submitted: item.submissions.length > 0 }));
  return <StudentShell><StudentReadingLibraryClient initialBooks={rows} assignments={assignmentRows} /></StudentShell>;
}
