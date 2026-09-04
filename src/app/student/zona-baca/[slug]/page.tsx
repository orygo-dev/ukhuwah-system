import { notFound } from "next/navigation";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { ReadingReaderClient } from "@/components/reading/reading-reader-client";
import { getCurrentStudent } from "@/lib/student-portal";
import { prisma } from "@/lib/prisma";
import { publishedReadingWhere } from "@/lib/reading";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

export const dynamic = "force-dynamic";

export default async function StudentReadingDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ assignment?: string }> }) {
  const [{ slug }, query, current] = await Promise.all([params, searchParams, getCurrentStudent()]);
  if (!current.student) return <StudentUnlinkedState />;
  const student = current.student;
  const actor = { id: current.session.user.id, role: current.session.user.role, schoolId: student.classRoom.schoolId, studentId: student.id, classRoomId: student.classRoomId };
  const book = await prisma.readingBook.findFirst({
    where: { slug, ...publishedReadingWhere(actor) },
    include: { progress: { where: { studentId: student.id }, select: { progressPercent: true } } },
  });
  if (!book) notFound();
  const assignment = query.assignment ? await prisma.readingAssignment.findFirst({
    where: { id: query.assignment, bookId: book.id, classRoomId: student.classRoomId, status: "PUBLISHED" },
    include: { submissions: { where: { studentId: student.id }, select: { reflection: true } } },
  }) : null;
  const readerBook = { id: book.id, title: book.title, authorName: book.authorName, description: book.description, category: book.category, contentType: book.contentType, contentUrl: book.contentUrl ? toSameOriginUploadUrl(book.contentUrl) : book.contentUrl, contentText: book.contentText, pageCount: book.pageCount, estimatedMinutes: book.estimatedMinutes, licenseName: book.licenseName, rightsHolder: book.rightsHolder, sourceUrl: book.sourceUrl };
  const assignmentRow = assignment ? { id: assignment.id, title: assignment.title, instructions: assignment.instructions, submittedReflection: assignment.submissions[0]?.reflection ?? null } : null;
  return <StudentShell><ReadingReaderClient book={readerBook} initialProgress={book.progress[0]?.progressPercent ?? 0} assignment={assignmentRow} /></StudentShell>;
}
