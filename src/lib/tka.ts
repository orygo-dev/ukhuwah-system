import type { Session } from "next-auth";
import type { TkaScope, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TkaActor = {
  id: string;
  role: UserRole;
  schoolId: string | null;
};

export async function getTkaActor(session: Session): Promise<TkaActor> {
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, schoolId: true },
  });
  return {
    id: session.user.id,
    role: session.user.role,
    schoolId: account?.schoolId ?? session.user.schoolId ?? null,
  };
}

export function defaultScopeForRole(role: UserRole): TkaScope {
  if (role === "SUPER_ADMIN") return "GLOBAL";
  if (role === "SCHOOL_ADMIN") return "SCHOOL";
  return "CLASS";
}

export function canManageTka(role: UserRole) {
  return role === "TEACHER" || role === "SCHOOL_ADMIN" || role === "SUPER_ADMIN";
}

export async function teacherOwnsClass(userId: string, classRoomId: string) {
  return Boolean(
    await prisma.classRoom.findFirst({
      where: { id: classRoomId, teacherId: userId, isActive: true },
      select: { id: true },
    })
  );
}

export function studentPackageWhere(student: {
  classRoomId: string;
  classRoom: { schoolId: string | null };
}) {
  const now = new Date();
  return {
    status: "PUBLISHED" as const,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      {
        OR: [
          { scope: "GLOBAL" as const },
          { scope: "CLASS" as const, classRoomId: student.classRoomId },
          ...(student.classRoom.schoolId
            ? [{ scope: "SCHOOL" as const, schoolId: student.classRoom.schoolId }]
            : []),
        ],
      },
    ],
  };
}
