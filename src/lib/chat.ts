import { prisma } from "@/lib/prisma";
import { memberAvatarFallback, memberInitials } from "@/lib/member-directory";

export type ChatAllowMode = "all" | "none";

export function getChatAllowMode(profileDefaults: unknown): ChatAllowMode {
  if (!profileDefaults || typeof profileDefaults !== "object") return "all";
  const mode = (profileDefaults as Record<string, unknown>).chatAllowMessages;
  return mode === "none" ? "none" : "all";
}

export async function userAllowsMessages(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileDefaults: true },
  });
  return getChatAllowMode(user?.profileDefaults) !== "none";
}

export async function getConversationRecipientId(
  conversationId: string,
  senderId: string
): Promise<string | null> {
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const recipient = participants.find((p) => p.userId !== senderId);
  return recipient?.userId ?? null;
}

export function directConversationKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":");
}

const conversationInclude = {
  participants: {
    include: {
      user: {
        select: { id: true, name: true, avatarUrl: true, profileDefaults: true },
      },
    },
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      sender: { select: { id: true, name: true } },
    },
  },
};

export async function findOrCreateDirectConversation(
  currentUserId: string,
  recipientId: string
) {
  if (currentUserId === recipientId) {
    throw new Error("SELF_CHAT");
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, role: true, profileDefaults: true },
  });
  if (!recipient || recipient.role !== "TEACHER") {
    throw new Error("RECIPIENT_NOT_FOUND");
  }

  const allows = await userAllowsMessages(recipientId);
  if (!allows) {
    throw new Error("RECIPIENT_DISABLED_CHAT");
  }

  const directKey = directConversationKey(currentUserId, recipientId);
  const existing = await prisma.conversation.findUnique({
    where: { directKey },
    include: conversationInclude,
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      directKey,
      participants: {
        create: [{ userId: currentUserId }, { userId: recipientId }],
      },
    },
    include: conversationInclude,
  });
}

export async function assertConversationAccess(
  conversationId: string,
  userId: string
) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });
  if (!participant) throw new Error("FORBIDDEN");
  return participant;
}

export function serializeChatUser(user: {
  id: string;
  name: string;
  avatarUrl: string | null;
  profileDefaults?: unknown;
}) {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl || memberAvatarFallback(user.name),
    initials: memberInitials(user.name),
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  if (participations.length === 0) return 0;

  const unreadCounts: number[] = await Promise.all(
    participations.map(async (p) => {
      const count = await prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: userId },
          ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
        },
      });
      return count > 0 ? 1 : 0;
    })
  );

  return unreadCounts.reduce<number>((sum, count) => sum + count, 0);
}

export async function markConversationRead(
  conversationId: string,
  userId: string
) {
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
}
