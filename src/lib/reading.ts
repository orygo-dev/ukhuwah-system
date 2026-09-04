import type { Prisma, ReadingReviewStatus, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export { READING_CATEGORIES, readingStatusLabel } from "@/lib/reading-shared";

export type ReadingActor = {
  id: string;
  role: UserRole;
  schoolId: string | null;
  studentId: string | null;
  classRoomId: string | null;
};

export async function getReadingActor(): Promise<ReadingActor | null> {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role !== "STUDENT") {
    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, school: { select: { id: true } } },
    });
    if (!account) return null;
    return {
      id: account.id,
      role: account.role,
      schoolId: account.school?.id ?? null,
      studentId: null,
      classRoomId: null,
    };
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: { id: true, classRoomId: true, classRoom: { select: { schoolId: true } } },
  });
  return {
    id: session.user.id,
    role: session.user.role,
    schoolId: student?.classRoom.schoolId ?? null,
    studentId: student?.id ?? null,
    classRoomId: student?.classRoomId ?? null,
  };
}

export function publishedReadingWhere(actor: ReadingActor): Prisma.ReadingBookWhereInput {
  const access: Prisma.ReadingBookWhereInput[] = [{ scope: "GLOBAL" }];
  if (actor.schoolId) access.push({ scope: "SCHOOL", schoolId: actor.schoolId });
  if (actor.classRoomId) access.push({ scope: "CLASS", classRoomId: actor.classRoomId });
  return { status: "PUBLISHED", OR: access };
}

export function canManageReadingBook(
  actor: ReadingActor,
  book: { createdById: string; schoolId: string | null; scope: string }
) {
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role === "SCHOOL_ADMIN") {
    return Boolean(actor.schoolId && book.schoolId === actor.schoolId && book.scope !== "GLOBAL");
  }
  return actor.role === "TEACHER" && book.createdById === actor.id;
}

export function allowedReadingStatus(
  actor: ReadingActor,
  requested: ReadingReviewStatus,
  scope: string
): ReadingReviewStatus {
  if (actor.role === "SUPER_ADMIN") return requested;
  if (actor.role === "SCHOOL_ADMIN" && scope === "SCHOOL") {
    return requested === "PUBLISHED" || requested === "REJECTED" || requested === "ARCHIVED"
      ? requested
      : "DRAFT";
  }
  return requested === "PENDING_REVIEW" || requested === "ARCHIVED" ? requested : "DRAFT";
}

export function createReadingSlug(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 70);
  return `${base || "bacaan"}-${Date.now().toString(36)}`;
}
