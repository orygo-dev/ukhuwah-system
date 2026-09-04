import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";
import { reportPjjApiError } from "@/lib/pjj-api-errors";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  studentId: z.string().cuid(),
  attendanceStatus: z.enum(["PRESENT", "PARTIAL", "LATE", "ABSENT", "NEEDS_REVIEW"]),
});

export async function PATCH(request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed || access.role === "STUDENT") {
    return NextResponse.json({ error: "Hanya guru/moderator yang dapat mengubah absensi." }, { status: 403 });
  }

  try {
    const input = bodySchema.parse(await request.json());
    const liveSession = await prisma.liveClassSession.findUnique({
      where: { id },
      select: {
        id: true,
        classRoomId: true,
        attendanceSessionId: true,
      },
    });
    if (!liveSession) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    const student = await prisma.student.findFirst({
      where: {
        id: input.studentId,
        classRoomId: liveSession.classRoomId,
        isActive: true,
      },
      select: { id: true, userId: true, name: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Siswa tidak ada di kelas sesi ini." }, { status: 404 });
    }

    let participant = await prisma.liveClassParticipant.findFirst({
      where: { sessionId: id, studentId: student.id },
    });

    if (!participant && student.userId) {
      participant = await prisma.liveClassParticipant.upsert({
        where: {
          sessionId_userId: { sessionId: id, userId: student.userId },
        },
        create: {
          sessionId: id,
          userId: student.userId,
          studentId: student.id,
          role: "STUDENT",
          attendanceStatus: input.attendanceStatus,
        },
        update: {
          studentId: student.id,
          attendanceStatus: input.attendanceStatus,
        },
      });
    } else if (participant) {
      participant = await prisma.liveClassParticipant.update({
        where: { id: participant.id },
        data: { attendanceStatus: input.attendanceStatus },
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Siswa belum punya akun login. Aktifkan akun siswa terlebih dahulu agar absensi live tercatat.",
        },
        { status: 400 }
      );
    }

    if (liveSession.attendanceSessionId) {
      const recordStatus =
        input.attendanceStatus === "ABSENT"
          ? "ABSENT"
          : input.attendanceStatus === "NEEDS_REVIEW"
            ? "PRESENT"
            : "PRESENT";
      await prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId: liveSession.attendanceSessionId,
            studentId: student.id,
          },
        },
        create: {
          sessionId: liveSession.attendanceSessionId,
          studentId: student.id,
          status: recordStatus,
          note: `PJJ manual: ${input.attendanceStatus}`,
        },
        update: {
          status: recordStatus,
          note: `PJJ manual: ${input.attendanceStatus}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      participant: {
        id: participant.id,
        studentId: student.id,
        attendanceStatus: participant.attendanceStatus,
        totalSeconds: participant.totalSeconds,
      },
    });
  } catch (error) {
    const failure = reportPjjApiError("pjj.attendance", error, {
      validationMessage: "Data absensi tidak valid.",
      fallbackMessage: "Absensi tidak dapat diperbarui.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
