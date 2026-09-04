import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadCount, serializeChatUser } from "@/lib/chat";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pesan guru hanya tersedia untuk akun guru.");
  }

  const userId = session.user.id;
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  profileDefaults: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  const conversations = participations.map((p) => {
    const other = p.conversation.participants.find((x) => x.userId !== userId);
    const lastMsg = p.conversation.messages[0];
    const unread =
      !!lastMsg &&
      lastMsg.senderId !== userId &&
      (!p.lastReadAt || lastMsg.createdAt > p.lastReadAt);

    return {
      id: p.conversation.id,
      otherUser: other ? serializeChatUser(other.user) : null,
      lastMessage: lastMsg
        ? {
            content: lastMsg.content,
            createdAt: lastMsg.createdAt.toISOString(),
            senderId: lastMsg.senderId,
            isMine: lastMsg.senderId === userId,
          }
        : null,
      unread,
      updatedAt: p.conversation.updatedAt.toISOString(),
    };
  });

  const unreadTotal = await getUnreadCount(userId);

  return NextResponse.json({ conversations, unreadTotal });
}
