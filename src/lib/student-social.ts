import "server-only";

import { prisma } from "@/lib/prisma";
import { directConversationKey } from "@/lib/chat";

export const STUDENT_APP_ID = "com.genpro.app";

export function normalizeSocialText(value: unknown, max = 1000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > max) throw new Error("INVALID_MESSAGE");
  if (/https?:\/\/|www\./i.test(text)) throw new Error("EXTERNAL_LINK");
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(text)) throw new Error("PRIVATE_CONTACT");
  if (/(?:\+?62|0)[\s.-]?(?:\d[\s.-]?){8,13}/.test(text)) {
    throw new Error("PRIVATE_CONTACT");
  }
  return text;
}

export async function activeStudentAccount(userId: string) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      role: "STUDENT",
      studentProfile: { is: { isActive: true, classRoom: { isActive: true } } },
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      studentProfile: {
        select: {
          id: true,
          classRoom: { select: { school: { select: { id: true, name: true } } } },
        },
      },
    },
  });
}

export async function socialPair(viewerId: string, targetStudentId: string) {
  const [viewer, target] = await Promise.all([
    activeStudentAccount(viewerId),
    prisma.student.findFirst({
      where: { id: targetStudentId, isActive: true, classRoom: { isActive: true } },
      select: {
        id: true,
        userId: true,
        name: true,
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
        classRoom: { select: { school: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  if (!viewer) throw new Error("VIEWER_NOT_FOUND");
  if (!target?.userId || target.user?.role !== "STUDENT") {
    throw new Error("TARGET_NOT_FOUND");
  }
  if (viewer.id === target.userId) throw new Error("SELF_ACTION");
  return { viewer, target, targetUserId: target.userId };
}

export async function blockExists(userA: string, userB: string) {
  return Boolean(
    await prisma.studentBlock.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
      select: { id: true },
    }),
  );
}

export async function blockedStudentIds(userId: string) {
  const rows = await prisma.studentBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
}

export async function getStudentUnreadCount(userId: string) {
  const blockedIds = await blockedStudentIds(userId);
  const rows = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      conversation: {
        participants: {
          every: {
            user: {
              role: "STUDENT",
              studentProfile: { is: { isActive: true, classRoom: { isActive: true } } },
            },
          },
          ...(blockedIds.length ? { none: { userId: { in: blockedIds } } } : {}),
        },
      },
    },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          messages: {
            where: { senderId: { not: userId } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });
  return rows.reduce((count, row) => {
    const last = row.conversation.messages[0]?.createdAt;
    return count + (last && (!row.lastReadAt || last > row.lastReadAt) ? 1 : 0);
  }, 0);
}

export async function studentRelationship(viewerId: string, targetUserId: string) {
  const [following, followsViewer, blocked, request] = await Promise.all([
    prisma.studentFollow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetUserId } },
      select: { id: true },
    }),
    prisma.studentFollow.findUnique({
      where: { followerId_followingId: { followerId: targetUserId, followingId: viewerId } },
      select: { id: true },
    }),
    blockExists(viewerId, targetUserId),
    prisma.studentMessageRequest.findUnique({
      where: { senderId_recipientId: { senderId: viewerId, recipientId: targetUserId } },
      select: { id: true, status: true, conversationId: true },
    }),
  ]);
  const mutual = Boolean(following && followsViewer);
  return {
    following: Boolean(following),
    followsViewer: Boolean(followsViewer),
    mutual,
    blocked,
    request,
    canMessage: !blocked && (mutual || request?.status === "ACCEPTED"),
  };
}

export async function assertStudentConversationAccess(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
      AND: {
        participants: {
          every: {
            user: {
              role: "STUDENT",
              studentProfile: { is: { isActive: true, classRoom: { isActive: true } } },
            },
          },
        },
      },
    },
    select: {
      id: true,
      participants: { select: { userId: true } },
    },
  });
  if (!conversation || conversation.participants.length !== 2) throw new Error("FORBIDDEN");
  const otherId = conversation.participants.find((item) => item.userId !== userId)?.userId;
  if (!otherId || (await blockExists(userId, otherId))) throw new Error("FORBIDDEN");
  const relationship = await studentRelationship(userId, otherId);
  if (!relationship.canMessage) throw new Error("MESSAGE_NOT_ALLOWED");
  return { conversation, otherId };
}

export async function findOrCreateStudentConversation(userA: string, userB: string) {
  const directKey = directConversationKey(userA, userB);
  return prisma.conversation.upsert({
    where: { directKey },
    update: {},
    create: {
      directKey,
      participants: { create: [{ userId: userA }, { userId: userB }] },
    },
    select: { id: true },
  });
}

export function socialError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const messages: Record<string, string> = {
    VIEWER_NOT_FOUND: "Akun siswa belum terhubung ke kelas aktif.",
    TARGET_NOT_FOUND: "Profil siswa tidak ditemukan.",
    SELF_ACTION: "Tindakan ini tidak dapat dilakukan pada akun sendiri.",
    BLOCKED: "Interaksi tidak tersedia untuk akun ini.",
    FORBIDDEN: "Anda tidak memiliki akses ke percakapan ini.",
    MESSAGE_NOT_ALLOWED: "Pesan hanya tersedia setelah saling mengikuti atau permintaan diterima.",
    INVALID_MESSAGE: "Pesan harus berisi 1–1000 karakter.",
    EXTERNAL_LINK: "Tautan eksternal belum diizinkan demi keamanan siswa.",
    PRIVATE_CONTACT: "Jangan membagikan email atau nomor telepon melalui pesan.",
    RATE_LIMITED: "Terlalu banyak pesan. Tunggu sebentar lalu coba kembali.",
  };
  return { code, message: messages[code] ?? "Permintaan sosial belum dapat diproses." };
}
