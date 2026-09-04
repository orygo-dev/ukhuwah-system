import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendNotificationPush } from "@/lib/push-notifications";

export function pjjRoomName(sessionId: string) {
  return `pjj-${sessionId}`;
}
export function normalizeDateOnly(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

export async function canManagePjjClass(userId: string, classRoomId: string) {
  const classRoom = await prisma.classRoom.findFirst({
    where: {
      id: classRoomId,
      deliveryMode: { in: ["PJJ", "HYBRID"] },
      OR: [
        { teacherId: userId },
        { teacherAssignments: { some: { teacherId: userId, isActive: true } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(classRoom);
}

/** Ensure a student in a PJJ/HYBRID class is enrolled on that class program. */
export async function ensureStudentPjjEnrollment(studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, isActive: true },
    select: {
      id: true,
      classRoomId: true,
      classRoom: {
        select: {
          id: true,
          name: true,
          deliveryMode: true,
          pjjProgramId: true,
          pjjProgram: { select: { id: true, name: true, province: true, schoolYear: true, status: true } },
        },
      },
    },
  });
  if (!student?.classRoom) return null;

  const room = student.classRoom;
  const isPjjRoom =
    Boolean(room.pjjProgramId) && ["PJJ", "HYBRID"].includes(room.deliveryMode);
  if (!isPjjRoom || !room.pjjProgramId || !room.pjjProgram) {
    return {
      student,
      isPjjRoom: false as const,
      enrollment: null,
      program: null,
    };
  }

  const existing = await prisma.pjjEnrollment.findUnique({
    where: {
      programId_studentId: { programId: room.pjjProgramId, studentId: student.id },
    },
  });

  if (existing && ["WITHDRAWN", "COMPLETED"].includes(existing.status)) {
    return {
      student,
      isPjjRoom: true as const,
      enrollment: existing,
      program: room.pjjProgram,
    };
  }

  const enrollment = existing
    ? existing
    : await prisma.pjjEnrollment.create({
        data: {
          programId: room.pjjProgramId,
          studentId: student.id,
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      });

  return {
    student,
    isPjjRoom: true as const,
    enrollment,
    program: room.pjjProgram,
  };
}

export function pjjHomeForRole(role?: string | null) {
  if (role === "STUDENT") return "/student/pjj";
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "SCHOOL_ADMIN") return "/school/pjj";
  if (role === "PROVINCE_ADMIN") return "/province/pjj";
  return "/dashboard/pjj";
}

export async function getLiveSessionAccess(
  session: Session,
  liveSessionId: string
): Promise<
  | {
      allowed: true;
      role: "TEACHER" | "STUDENT" | "TUTOR" | "MODERATOR";
      studentId?: string;
    }
  | { allowed: false }
> {
  const liveSession = await prisma.liveClassSession.findUnique({
    where: { id: liveSessionId },
    select: {
      classRoomId: true,
      classRoom: { select: { pjjProgramId: true, deliveryMode: true } },
    },
  });
  if (!liveSession) return { allowed: false };

  if (session.user.role === "SUPER_ADMIN") {
    return { allowed: true, role: "MODERATOR" };
  }
  if (session.user.role === "TEACHER") {
    const assignment = await prisma.classTeacherAssignment.findFirst({
      where: {
        classRoomId: liveSession.classRoomId,
        teacherId: session.user.id,
        isActive: true,
      },
      select: { role: true },
    });
    const isOwner = await prisma.classRoom.count({
      where: { id: liveSession.classRoomId, teacherId: session.user.id },
    });
    if (assignment || isOwner) {
      return {
        allowed: true,
        role: assignment?.role === "TUTOR" ? "TUTOR" : "TEACHER",
      };
    }
  }
  if (session.user.role === "STUDENT" && session.user.studentId) {
    const student = await prisma.student.findFirst({
      where: {
        id: session.user.studentId,
        classRoomId: liveSession.classRoomId,
        isActive: true,
        classRoom: { isActive: true },
      },
      select: { id: true },
    });
    if (!student) return { allowed: false };

    const access = await ensureStudentPjjEnrollment(student.id);
    if (!access?.isPjjRoom || !access.enrollment) return { allowed: false };
    if (!["PENDING", "ACTIVE", "AT_RISK"].includes(access.enrollment.status)) {
      return { allowed: false };
    }
    if (
      liveSession.classRoom.pjjProgramId &&
      access.enrollment.programId !== liveSession.classRoom.pjjProgramId
    ) {
      return { allowed: false };
    }
    return { allowed: true, role: "STUDENT", studentId: student.id };
  }
  return { allowed: false };
}

export function liveAttendanceFromDuration(input: {
  totalSeconds: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  firstJoinedAt: Date | null;
  minPercent: number;
}) {
  const plannedSeconds = Math.max(
    60,
    Math.round((input.scheduledEnd.getTime() - input.scheduledStart.getTime()) / 1000)
  );
  const percent = Math.min(100, Math.round((input.totalSeconds / plannedSeconds) * 100));
  const late = Boolean(
    input.firstJoinedAt &&
      input.firstJoinedAt.getTime() - input.scheduledStart.getTime() > 15 * 60 * 1000
  );
  if (percent >= input.minPercent) {
    return { status: late ? ("LATE" as const) : ("PRESENT" as const), percent };
  }
  if (percent > 0) return { status: "PARTIAL" as const, percent };
  return { status: "ABSENT" as const, percent };
}

export async function publishPjjClassNotice(input: {
  senderId: string;
  classRoomId: string;
  title: string;
  message: string;
  actionUrl?: string;
  priority?: "NORMAL" | "IMPORTANT" | "URGENT";
}): Promise<{ sent: number }> {
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: input.classRoomId },
    select: { id: true, name: true, schoolId: true },
  });
  if (!classRoom) return { sent: 0 };

  // Notify all logged-in students in the class (roster membership is enough).
  const students = await prisma.student.findMany({
    where: {
      classRoomId: classRoom.id,
      isActive: true,
      userId: { not: null },
    },
    select: { userId: true },
  });

  const recipientIds = [
    ...new Set(
      students
        .map((student) => student.userId)
        .filter((userId): userId is string => Boolean(userId) && userId !== input.senderId)
    ),
  ];

  if (recipientIds.length === 0) return { sent: 0 };

  const now = new Date();
  const notification = await prisma.notification.create({
    data: {
      senderId: input.senderId,
      title: input.title,
      message: input.message,
      category: "PJJ",
      priority: input.priority ?? "NORMAL",
      status: "PUBLISHED",
      targetType: "CLASS",
      targetRole: "STUDENT",
      schoolId: classRoom.schoolId,
      classRoomId: classRoom.id,
      targetLabel: `Siswa kelas ${classRoom.name}`,
      actionUrl: input.actionUrl ?? "/student/pjj",
      publishAt: now,
      publishedAt: now,
      recipients: { create: recipientIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });

  await sendNotificationPush(notification.id).catch((error) => {
    console.error("[pjj notification push]", error);
  });

  return { sent: recipientIds.length };
}
