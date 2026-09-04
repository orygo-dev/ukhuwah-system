import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  effectiveLiveKitRoomCapacity,
  pjjCapacityDecision,
  PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
  pjjSafeMaxForRoomMode,
  type PjjRoomMode,
} from "@/lib/livekit-policy";
import { getSchoolAccessForUser, SCHOOL_PJJ_HARD_CAP } from "@/lib/school-commercialization";
import { canManagePjjClass, normalizeDateOnly, publishPjjClassNotice } from "@/lib/pjj";
import { getLiveKitPublicConfig } from "@/lib/livekit";
import crypto from "crypto";

const scheduleSchema = z
  .object({
    classRoomId: z.string().cuid(),
    title: z.string().trim().min(3).max(160),
    subject: z.string().trim().min(2).max(100),
    description: z.string().trim().max(3000).optional().default(""),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    roomMode: z.enum(["MEETING", "CLASSROOM"]).optional().default("MEETING"),
    maxParticipants: z.number().int().min(2).optional(),
    minAttendancePercent: z.number().int().min(1).max(100).optional().default(70),
  })
  .superRefine((data, context) => {
    const modeMax = pjjSafeMaxForRoomMode(data.roomMode as PjjRoomMode);
    const maxParticipants = data.maxParticipants ?? modeMax;
    if (maxParticipants > modeMax) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxParticipants"],
        message: `Kapasitas mode ${data.roomMode} maksimal ${modeMax} peserta.`,
      });
    }
  });

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const classes = await prisma.classRoom.findMany({
      where: {
        deliveryMode: { in: ["PJJ", "HYBRID"] },
        isActive: true,
        OR: [
          { teacherId: session.user.id },
          { teacherAssignments: { some: { teacherId: session.user.id, isActive: true } } },
        ],
      },
      orderBy: { name: "asc" },
      include: {
        school: { select: { name: true } },
        pjjProgram: { select: { name: true, status: true } },
        teacherAssignments: {
          where: { teacherId: session.user.id, isActive: true },
          select: { subject: true, role: true },
        },
        students: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            nis: true,
            pjjEnrollments: {
              select: {
                id: true,
                status: true,
                programId: true,
                accessBarrier: true,
              },
            },
          },
        },
        liveClassSessions: {
          orderBy: { scheduledStart: "desc" },
          take: 30,
          include: {
            _count: { select: { participants: true } },
            participants: {
              where: { role: "STUDENT" },
              select: { attendanceStatus: true, totalSeconds: true },
            },
          },
        },
      },
    });
    const sessions = classes.flatMap((room) =>
      room.liveClassSessions.map((liveSession) => ({
        ...liveSession,
        classRoomId: room.id,
        className: room.name,
        schoolName: room.school?.name ?? null,
        programName: room.pjjProgram?.name ?? null,
      }))
    );
    const liveKit = await getLiveKitPublicConfig();
    const meetingMaximum = effectiveLiveKitRoomCapacity(
      liveKit.maxParticipants,
      liveKit.maxParticipants,
      "MEETING"
    );
    const classroomMaximum = effectiveLiveKitRoomCapacity(
      liveKit.maxParticipants,
      liveKit.maxParticipants,
      "CLASSROOM"
    );
    return NextResponse.json({
      classes,
      sessions,
      liveKit: {
        enabled: liveKit.enabled,
        configured: liveKit.configured,
        maxParticipants: meetingMaximum,
        meetingMaxParticipants: meetingMaximum,
        classroomMaxParticipants: classroomMaximum,
        platformMaxParticipants: Math.min(
          liveKit.maxParticipants,
          PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS
        ),
      },
    });
  } catch (error) {
    console.error("[pjj sessions GET]", error);
    const message =
      error instanceof Error ? error.message : "Gagal memuat sesi PJJ.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const parsed = scheduleSchema.parse(await request.json());
    const roomMode = parsed.roomMode as PjjRoomMode;
    let maxParticipants =
      parsed.maxParticipants ?? pjjSafeMaxForRoomMode(roomMode);
    const schoolAccess = await getSchoolAccessForUser(session.user.id);
    if (schoolAccess?.pjjAddOnEnabled) {
      maxParticipants = Math.min(maxParticipants, SCHOOL_PJJ_HARD_CAP);
      if (parsed.maxParticipants && parsed.maxParticipants > SCHOOL_PJJ_HARD_CAP) {
        return NextResponse.json(
          { error: `PJJ paket sekolah dibatasi maksimal ${SCHOOL_PJJ_HARD_CAP} peserta.` },
          { status: 400 }
        );
      }
    }
    const liveKit = await getLiveKitPublicConfig();
    if (!liveKit.enabled || !liveKit.configured) {
      return NextResponse.json(
        { error: "LiveKit belum aktif atau belum lengkap. Hubungi administrator." },
        { status: 409 }
      );
    }
    const capacity = pjjCapacityDecision(
      maxParticipants,
      liveKit.maxParticipants,
      roomMode
    );
    if (!capacity.allowed) {
      return NextResponse.json(
        {
          error: `Kapasitas aman mode ${roomMode} saat ini ${capacity.maximum} peserta.`,
        },
        { status: 400 }
      );
    }
    const start = new Date(parsed.scheduledStart);
    const end = new Date(parsed.scheduledEnd);
    if (end <= start) {
      return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
    }
    if (!(await canManagePjjClass(session.user.id, parsed.classRoomId))) {
      return NextResponse.json({ error: "Anda tidak ditugaskan pada kelas ini." }, { status: 403 });
    }

    const date = normalizeDateOnly(start);
    const maxJamKe = await prisma.attendanceSession.aggregate({
      where: { classRoomId: parsed.classRoomId, date, mapel: parsed.subject },
      _max: { jamKe: true },
    });
    const roomName = `pjj-${parsed.classRoomId.slice(-8)}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const liveSession = await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendanceSession.create({
        data: {
          classRoomId: parsed.classRoomId,
          teacherId: session.user.id,
          date,
          mapel: parsed.subject,
          jamKe: (maxJamKe._max.jamKe ?? 0) + 1,
          note: `Sesi PJJ: ${parsed.title}`,
        },
      });
      return tx.liveClassSession.create({
        data: {
          classRoomId: parsed.classRoomId,
          createdById: session.user.id,
          attendanceSessionId: attendance.id,
          roomName,
          title: parsed.title,
          subject: parsed.subject,
          description: parsed.description || null,
          scheduledStart: start,
          scheduledEnd: end,
          roomMode,
          maxParticipants,
          minAttendancePercent: parsed.minAttendancePercent,
        },
      });
    });

    try {
      const when = start.toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      await publishPjjClassNotice({
        senderId: session.user.id,
        classRoomId: parsed.classRoomId,
        title: `Sesi PJJ: ${liveSession.title}`,
        message: `Kelas langsung "${liveSession.title}" (${liveSession.subject}) dijadwalkan pada ${when}.`,
        actionUrl: `/student/pjj`,
        priority: "IMPORTANT",
      });
    } catch (notifyError) {
      console.error("[pjj schedule notify]", notifyError);
    }

    return NextResponse.json({ success: true, session: liveSession });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors[0]?.message || "Jadwal tidak valid."
        : error instanceof Error
          ? error.message
          : "Gagal menjadwalkan kelas.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
