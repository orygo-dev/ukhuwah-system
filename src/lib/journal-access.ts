import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { getClassRoomForUser } from "@/lib/attendance-access";

type AuthUser = {
  id: string;
  role: UserRole;
  schoolId?: string | null;
};

export async function getJournalForUser(journalId: string, user: AuthUser) {
  const journal = await prisma.dailyJournal.findUnique({
    where: { id: journalId },
    include: {
      classRoom: { select: { id: true, name: true, jenjang: true, tahunAjaran: true } },
      attendanceSession: {
        select: { id: true, date: true, mapel: true, jamKe: true },
      },
    },
  });
  if (!journal) return null;
  if (user.role === "SUPER_ADMIN") return journal;
  if (journal.teacherId !== user.id) {
    if (journal.classRoomId) {
      const room = await getClassRoomForUser(journal.classRoomId, user);
      if (!room) return null;
    } else {
      return null;
    }
  }
  return journal;
}

export function journalWhereForUser(user: AuthUser, schoolId?: string | null) {
  if (user.role === "SUPER_ADMIN") return {};
  if ((user.role === "TEACHER" || user.role === "SCHOOL_ADMIN") && schoolId) {
    return {
      OR: [
        { teacherId: user.id },
        { classRoom: { schoolId } },
      ],
    };
  }
  return { teacherId: user.id };
}
