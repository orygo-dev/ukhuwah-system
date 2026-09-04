import "server-only";

import { prisma } from "@/lib/prisma";
import { sendNotificationPush, sendUserPush } from "@/lib/push-notifications";
import { STUDENT_APP_ID } from "@/lib/student-social";

export async function notifyStudentFollow(senderId: string, recipientId: string, senderName: string) {
  const notification = await prisma.notification.create({
    data: {
      senderId,
      title: "Pengikut baru",
      message: `${senderName} mulai mengikuti Anda.`,
      category: "GENERAL",
      priority: "NORMAL",
      status: "PUBLISHED",
      targetType: "ROLE",
      targetRole: "STUDENT",
      targetLabel: "Aktivitas sosial siswa",
      actionUrl: "/student/notifications",
      publishedAt: new Date(),
      recipients: { create: [{ userId: recipientId }] },
    },
    select: { id: true },
  });
  await sendNotificationPush(notification.id, { appId: STUDENT_APP_ID });
}

export async function notifyStudentMessage(
  recipientId: string,
  senderName: string,
  conversationId: string,
  body: string,
) {
  await sendUserPush(recipientId, {
    appId: STUDENT_APP_ID,
    title: senderName,
    body,
    data: {
      type: "student_message",
      conversationId,
    },
  });
}

export async function notifyStudentMessageRequest(
  recipientId: string,
  senderName: string,
  requestId: string,
) {
  await sendUserPush(recipientId, {
    appId: STUDENT_APP_ID,
    title: "Permintaan pesan baru",
    body: `${senderName} ingin mengirim pesan kepada Anda.`,
    data: {
      type: "student_message_request",
      requestId,
    },
  });
}
