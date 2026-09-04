import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { getClassRoomForUser } from "@/lib/attendance-access";

type AuthUser = {
  id: string;
  role: UserRole;
  schoolId?: string | null;
};

export async function getAssessmentForUser(assessmentId: string, user: AuthUser) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      classRoom: { select: { id: true, name: true, jenjang: true, tahunAjaran: true } },
      gradeRecords: {
        include: { student: true },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
  if (!assessment) return null;
  if (user.role === "SUPER_ADMIN") return assessment;
  if (assessment.teacherId !== user.id) {
    const room = await getClassRoomForUser(assessment.classRoomId, user);
    if (!room) return null;
  }
  return assessment;
}

export function assessmentWhereForUser(user: AuthUser, schoolId?: string | null) {
  if (user.role === "SUPER_ADMIN") return {};
  if ((user.role === "TEACHER" || user.role === "SCHOOL_ADMIN") && schoolId) {
    return {
      OR: [{ teacherId: user.id }, { classRoom: { schoolId } }],
    };
  }
  return { teacherId: user.id };
}
