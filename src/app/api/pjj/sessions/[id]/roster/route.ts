import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
  }

  const liveSession = await prisma.liveClassSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      subject: true,
      status: true,
      roomMode: true,
      classRoomId: true,
      attendanceSessionId: true,
      minAttendancePercent: true,
      scheduledStart: true,
      scheduledEnd: true,
      classRoom: {
        select: {
          name: true,
          students: {
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, nis: true, userId: true },
          },
        },
      },
      participants: {
        include: {
          user: { select: { id: true, name: true, role: true } },
          student: { select: { id: true, name: true, nis: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!liveSession) {
    return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
  }

  const isModerator = access.role !== "STUDENT";
  const students = liveSession.classRoom.students.map((student) => {
    const participant = liveSession.participants.find((item) => item.studentId === student.id);
    return {
      studentId: student.id,
      name: student.name,
      nis: student.nis,
      userId: student.userId,
      participantId: participant?.id ?? null,
      role: participant?.role ?? "STUDENT",
      canPublishMedia: participant?.canPublishMedia ?? false,
      attendanceStatus: participant?.attendanceStatus ?? "ABSENT",
      totalSeconds: participant?.totalSeconds ?? 0,
      joinCount: participant?.joinCount ?? 0,
      firstJoinedAt: participant?.firstJoinedAt ?? null,
      lastJoinedAt: participant?.lastJoinedAt ?? null,
      liveKitParticipantSid: participant?.liveKitParticipantSid ?? null,
      online: Boolean(participant?.lastJoinedAt && !participant?.lastLeftAt),
    };
  });

  const staff = liveSession.participants
    .filter((item) => item.role !== "STUDENT")
    .map((item) => ({
      participantId: item.id,
      userId: item.userId,
      name: item.user.name,
      role: item.role,
      online: Boolean(item.lastJoinedAt && !item.lastLeftAt),
    }));

  return NextResponse.json({
    session: {
      id: liveSession.id,
      title: liveSession.title,
      subject: liveSession.subject,
      status: liveSession.status,
      roomMode: liveSession.roomMode,
      className: liveSession.classRoom.name,
      minAttendancePercent: liveSession.minAttendancePercent,
      scheduledStart: liveSession.scheduledStart,
      scheduledEnd: liveSession.scheduledEnd,
    },
    students: isModerator
      ? students
      : students.filter((item) => item.studentId === access.studentId),
    staff: isModerator ? staff : [],
    viewer: {
      role: access.role,
      studentId: access.studentId ?? null,
      isModerator,
    },
    summary: {
      totalStudents: liveSession.classRoom.students.length,
      present: students.filter((item) =>
        ["PRESENT", "LATE", "PARTIAL"].includes(item.attendanceStatus)
      ).length,
      online: students.filter((item) => item.online).length,
    },
  });
}
