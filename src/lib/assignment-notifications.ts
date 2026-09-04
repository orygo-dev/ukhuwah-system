import "server-only";

import { prisma } from "@/lib/prisma";
import { sendNotificationPush } from "@/lib/push-notifications";

export async function notifyAssignmentPublished(input: { senderId: string; classRoomId: string; assignmentId: string; title: string }) {
  const room = await prisma.classRoom.findUnique({
    where: { id: input.classRoomId },
    select: {
      name: true,
      schoolId: true,
      students: { where: { isActive: true, userId: { not: null } }, select: { userId: true } },
    },
  });
  if (!room) return;
  const recipientIds = [...new Set(room.students.map((student) => student.userId).filter((id): id is string => Boolean(id)))];
  if (!recipientIds.length) return;
  const now = new Date();
  const notification = await prisma.notification.create({
    data: {
      senderId: input.senderId,
      title: "Tugas baru",
      message: `${input.title} telah diterbitkan untuk kelas ${room.name}.`,
      category: "ASSIGNMENT",
      priority: "NORMAL",
      status: "PUBLISHED",
      targetType: "CLASS",
      targetRole: "STUDENT",
      schoolId: room.schoolId,
      classRoomId: input.classRoomId,
      targetLabel: `Siswa kelas ${room.name}`,
      actionUrl: `/student/tugas/${input.assignmentId}`,
      publishAt: now,
      publishedAt: now,
      recipients: { create: recipientIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });
  await sendNotificationPush(notification.id);
}

export async function notifyAssignmentResult(input: { senderId: string; recipientId: string; assignmentId: string; title: string; returned: boolean }) {
  const now = new Date();
  const notification = await prisma.notification.create({
    data: {
      senderId: input.senderId,
      title: input.returned ? "Tugas perlu direvisi" : "Nilai tugas tersedia",
      message: input.returned ? `${input.title} dikembalikan oleh guru. Buka tugas untuk melihat catatan revisi.` : `Nilai dan feedback untuk ${input.title} sudah tersedia.`,
      category: "ASSIGNMENT",
      priority: "NORMAL",
      status: "PUBLISHED",
      targetType: "ROLE",
      targetRole: "STUDENT",
      targetLabel: "Aktivitas tugas siswa",
      actionUrl: `/student/tugas/${input.assignmentId}`,
      publishAt: now,
      publishedAt: now,
      recipients: { create: [{ userId: input.recipientId }] },
    },
    select: { id: true },
  });
  await sendNotificationPush(notification.id);
}
