import type { Prisma } from "@prisma/client";
import { liveAttendanceFromDuration } from "@/lib/pjj";
import { isSchoolCommercializationEnabled } from "@/lib/school-commercialization";

export type PjjWebhookEvent = {
  id: string;
  event: string;
  createdAt: number | string | bigint;
  room?: { name?: string };
  participant?: { identity?: string; sid?: string };
};

type TransactionRunner = <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

function userIdFromIdentity(identity?: string) {
  return identity?.startsWith("user:") ? identity.slice(5) : null;
}

function eventDate(createdAt: PjjWebhookEvent["createdAt"]) {
  const seconds = Number(createdAt);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("LiveKit webhook createdAt tidak valid.");
  }
  return new Date(seconds * 1000);
}

async function applyPjjWebhookEvent(tx: Prisma.TransactionClient, event: PjjWebhookEvent) {
  const roomName = event.room?.name || null;
  await tx.liveKitWebhookEvent.create({
    data: { id: event.id, event: event.event, roomName },
  });

  if (!roomName) return;
  const liveSession = await tx.liveClassSession.findUnique({ where: { roomName } });
  if (!liveSession) return;
  const occurredAt = eventDate(event.createdAt);

  if (event.event === "room_started") {
    if (liveSession.status === "CANCELLED" || liveSession.status === "ENDED") return;
    await tx.liveClassSession.update({
      where: { id: liveSession.id },
      data: {
        status: "LIVE",
        actualStart:
          liveSession.actualStart && liveSession.actualStart <= occurredAt
            ? liveSession.actualStart
            : occurredAt,
      },
    });
    return;
  }

  if (event.event === "room_finished") {
    await tx.liveClassSession.update({
      where: { id: liveSession.id },
      data: {
        status: liveSession.status === "CANCELLED" ? "CANCELLED" : "ENDED",
        actualEnd:
          liveSession.actualEnd && liveSession.actualEnd >= occurredAt
            ? liveSession.actualEnd
            : occurredAt,
      },
    });
    return;
  }

  if (event.event === "participant_connection_aborted") {
    // Token issuance only creates a roster row. An aborted connection never
    // became media-active and therefore must not create or close attendance.
    return;
  }

  const userId = userIdFromIdentity(event.participant?.identity);
  if (!userId) return;
  const participantSid = event.participant?.sid || null;
  const participant = await tx.liveClassParticipant.findUnique({
    where: { sessionId_userId: { sessionId: liveSession.id, userId } },
  });
  if (!participant) return;

  if (event.event === "participant_joined") {
    if (participant.lastJoinedAt) {
      // Same active SID is a replay. Without a SID, fail closed rather than
      // double-counting an interval that cannot be correlated safely.
      if (!participantSid || participant.liveKitParticipantSid === participantSid) return;
      // An older different-SID join can arrive after the replacement join.
      // Never let it rewind the active interval and steal its association.
      if (occurredAt <= participant.lastJoinedAt) return;

      // A deterministic identity can be replaced by a newer connection. Rotate
      // the active interval with compare-and-swap so the old SID cannot later
      // close the new interval and concurrent join events cannot both win.
      const additionalSeconds = Math.max(
        0,
        Math.round((occurredAt.getTime() - participant.lastJoinedAt.getTime()) / 1000)
      );
      await tx.liveClassParticipant.updateMany({
        where: {
          id: participant.id,
          lastJoinedAt: participant.lastJoinedAt,
          liveKitParticipantSid: participant.liveKitParticipantSid,
        },
        data: {
          firstJoinedAt: participant.firstJoinedAt || participant.lastJoinedAt,
          lastJoinedAt: occurredAt,
          lastLeftAt: null,
          liveKitParticipantSid: participantSid,
          totalSeconds: { increment: additionalSeconds },
          joinCount: { increment: 1 },
        },
      });
      await updateSchoolPjjPeak(tx, liveSession.id, liveSession.classRoomId);
      return;
    }

    if (participant.lastLeftAt && occurredAt <= participant.lastLeftAt) return;
    await tx.liveClassParticipant.updateMany({
      where: {
        id: participant.id,
        lastJoinedAt: null,
        OR: [{ lastLeftAt: null }, { lastLeftAt: { lt: occurredAt } }],
      },
      data: {
        firstJoinedAt: participant.firstJoinedAt || occurredAt,
        lastJoinedAt: occurredAt,
        lastLeftAt: null,
        liveKitParticipantSid: participantSid,
        joinCount: { increment: 1 },
      },
    });
    await updateSchoolPjjPeak(tx, liveSession.id, liveSession.classRoomId);
    return;
  }

  if (event.event !== "participant_left" || !participant.lastJoinedAt) return;
  if (
    participant.liveKitParticipantSid &&
    participantSid !== participant.liveKitParticipantSid
  ) {
    return;
  }
  if (occurredAt < participant.lastJoinedAt) return;

  const additionalSeconds = Math.max(
    0,
    Math.round((occurredAt.getTime() - participant.lastJoinedAt.getTime()) / 1000)
  );
  const totalSeconds = participant.totalSeconds + additionalSeconds;
  const attendance = liveAttendanceFromDuration({
    totalSeconds,
    scheduledStart: liveSession.scheduledStart,
    scheduledEnd: liveSession.scheduledEnd,
    firstJoinedAt: participant.firstJoinedAt,
    minPercent: liveSession.minAttendancePercent,
  });
  const nextStatus =
    participant.attendanceStatus === "NEEDS_REVIEW"
      ? attendance.status
      : participant.attendanceStatus;
  const updated = await tx.liveClassParticipant.updateMany({
    where: {
      id: participant.id,
      lastJoinedAt: participant.lastJoinedAt,
      ...(participant.liveKitParticipantSid
        ? { liveKitParticipantSid: participant.liveKitParticipantSid }
        : {}),
    },
    data: {
      lastLeftAt: occurredAt,
      lastJoinedAt: null,
      liveKitParticipantSid: null,
      totalSeconds,
      attendanceStatus: nextStatus,
    },
  });
  if (updated.count !== 1) return;

  await addSchoolPjjUsage(tx, liveSession.id, liveSession.classRoomId, additionalSeconds);

  if (participant.studentId && liveSession.attendanceSessionId) {
    await tx.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: liveSession.attendanceSessionId,
          studentId: participant.studentId,
        },
      },
      create: {
        sessionId: liveSession.attendanceSessionId,
        studentId: participant.studentId,
        status: nextStatus === "ABSENT" ? "ABSENT" : "PRESENT",
        note: `PJJ ${attendance.percent}% (${Math.round(totalSeconds / 60)} menit)`,
      },
      update: {
        status: nextStatus === "ABSENT" ? "ABSENT" : "PRESENT",
        note: `PJJ ${attendance.percent}% (${Math.round(totalSeconds / 60)} menit)`,
      },
    });
  }
}

async function schoolIdForMetering(tx: Prisma.TransactionClient, classRoomId: string) {
  if (!isSchoolCommercializationEnabled()) return null;
  const classroom = await tx.classRoom.findUnique({ where: { id: classRoomId }, select: { schoolId: true } });
  if (!classroom?.schoolId) return null;
  const subscription = await tx.schoolSubscription.findFirst({
    where: { schoolId: classroom.schoolId, pjjAddOnEnabled: true, status: { in: ["TRIAL", "ACTIVE", "GRACE"] } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return subscription ? classroom.schoolId : null;
}

async function updateSchoolPjjPeak(tx: Prisma.TransactionClient, liveSessionId: string, classRoomId: string) {
  const schoolId = await schoolIdForMetering(tx, classRoomId);
  if (!schoolId) return;
  const active = await tx.liveClassParticipant.count({ where: { sessionId: liveSessionId, lastJoinedAt: { not: null } } });
  const current = await tx.schoolPjjUsage.findUnique({ where: { liveSessionId } });
  if (!current) {
    await tx.schoolPjjUsage.create({ data: { schoolId, liveSessionId, peakParticipants: active } });
  } else if (active > current.peakParticipants) {
    await tx.schoolPjjUsage.update({ where: { id: current.id }, data: { peakParticipants: active } });
  }
}

async function addSchoolPjjUsage(tx: Prisma.TransactionClient, liveSessionId: string, classRoomId: string, seconds: number) {
  const schoolId = await schoolIdForMetering(tx, classRoomId);
  if (!schoolId || seconds <= 0) return;
  const usage = await tx.schoolPjjUsage.upsert({
    where: { liveSessionId },
    create: { schoolId, liveSessionId, participantSeconds: seconds, participantMinutes: Math.ceil(seconds / 60) },
    update: { participantSeconds: { increment: seconds } },
  });
  const minutes = Math.ceil(usage.participantSeconds / 60);
  if (minutes !== usage.participantMinutes) {
    await tx.schoolPjjUsage.update({ where: { id: usage.id }, data: { participantMinutes: minutes } });
  }
}

export function processPjjWebhookEvent(event: PjjWebhookEvent, transaction: TransactionRunner) {
  return transaction((tx) => applyPjjWebhookEvent(tx, event));
}
