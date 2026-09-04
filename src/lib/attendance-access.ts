import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { isMapelForJenjang } from "@/lib/curriculum";

type AuthUser = {
  id: string;
  role: UserRole;
  schoolId?: string | null;
};

async function resolveUserSchoolId(user: AuthUser) {
  if (user.schoolId) return user.schoolId;
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { schoolId: true },
  });
  return account?.schoolId ?? null;
}

async function canAccessClassRoom(
  room: { id: string; teacherId: string; schoolId?: string | null },
  user: AuthUser
) {
  if (user.role === "SUPER_ADMIN") return true;
  if (room.teacherId === user.id) return true;
  if (user.role === "SCHOOL_ADMIN") {
    const schoolId = await resolveUserSchoolId(user);
    return Boolean(schoolId && room.schoolId === schoolId);
  }
  if (user.role === "TEACHER") {
    const assigned = await prisma.classTeacherAssignment.count({
      where: { classRoomId: room.id, teacherId: user.id, isActive: true },
    });
    return assigned > 0;
  }
  return false;
}

export async function getClassRoomForUser(classRoomId: string, user: AuthUser) {
  const room = await prisma.classRoom.findUnique({
    where: { id: classRoomId },
    include: {
      _count: { select: { students: true, sessions: true } },
    },
  });
  if (!room) return null;
  return (await canAccessClassRoom(room, user)) ? room : null;
}

async function canAccessManagedClass(
  room: { id: string; teacherId: string; schoolId?: string | null },
  user: AuthUser
) {
  if (user.role === "SUPER_ADMIN") return true;
  if (room.teacherId === user.id) return true;
  // Assigned teachers may teach/view the class, but roster and class ownership
  // remain with the owner (or school administrators).
  if (user.role === "TEACHER") return false;
  if (user.role !== "SCHOOL_ADMIN") return false;
  const schoolId = await resolveUserSchoolId(user);
  return Boolean(schoolId && room.schoolId === schoolId);
}

export async function getAllowedSubjectsForClass(
  room: { id: string; teacherId: string; jenjang: string },
  user: AuthUser
) {
  if (room.teacherId === user.id) return null;
  if (user.role !== "TEACHER") return [];
  const assignments = await prisma.classTeacherAssignment.findMany({
    where: { classRoomId: room.id, teacherId: user.id, isActive: true },
    select: { subject: true },
    distinct: ["subject"],
  });
  return assignments.map((item) => item.subject.trim()).filter(Boolean);
}

export async function canUseSubjectForClass(
  room: { id: string; teacherId: string; jenjang: string },
  user: AuthUser,
  subject: string
) {
  const allowedSubjects = await getAllowedSubjectsForClass(room, user);
  if (allowedSubjects === null) return isMapelForJenjang(room.jenjang, subject);
  return allowedSubjects.some((allowed) => allowed.toLocaleLowerCase("id-ID") === subject.toLocaleLowerCase("id-ID"));
}

export function canManageClassRoster(
  room: { teacherId: string; schoolId?: string | null },
  user: AuthUser
) {
  if (user.role === "SUPER_ADMIN") return true;
  if (room.teacherId === user.id) return true;
  return user.role === "SCHOOL_ADMIN" && Boolean(user.schoolId && room.schoolId === user.schoolId);
}

export async function canManageClassRosterForUser(
  room: { id: string; teacherId: string; schoolId?: string | null },
  user: AuthUser
) {
  return canAccessManagedClass(room, user);
}

export function canArchiveClass(
  room: { teacherId: string; schoolId?: string | null },
  user: AuthUser
) {
  if (user.role === "SUPER_ADMIN") return true;
  if (room.teacherId === user.id) return true;
  return user.role === "SCHOOL_ADMIN" && Boolean(user.schoolId && room.schoolId === user.schoolId);
}

export async function canArchiveClassForUser(
  room: { id: string; teacherId: string; schoolId?: string | null },
  user: AuthUser
) {
  return canAccessManagedClass(room, user);
}

export function canEditClassMeta(
  room: { teacherId: string; schoolId?: string | null },
  user: AuthUser
) {
  if (user.role === "SUPER_ADMIN") return true;
  if (room.teacherId === user.id) return true;
  return user.role === "SCHOOL_ADMIN" && Boolean(user.schoolId && room.schoolId === user.schoolId);
}

export async function canEditClassMetaForUser(
  room: { id: string; teacherId: string; schoolId?: string | null },
  user: AuthUser
) {
  return canAccessManagedClass(room, user);
}

export async function getSessionForUser(sessionId: string, user: AuthUser) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      classRoom: true,
      dailyJournal: { select: { id: true } },
      records: {
        include: { student: true },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
  if (!session) return null;
  if (user.role === "SUPER_ADMIN") return session;
  if (session.teacherId === user.id) return session;
  return (await canAccessClassRoom(session.classRoom, user)) ? session : null;
}

export async function getStudentForUser(studentId: string, user: AuthUser) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { classRoom: true },
  });
  if (!student) return null;
  const room = await getClassRoomForUser(student.classRoomId, user);
  if (!room) return null;
  return student;
}
