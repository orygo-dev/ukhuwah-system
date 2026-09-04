import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import {
  activeStudentAccount,
  blockedStudentIds,
  getStudentUnreadCount,
} from "@/lib/student-social";

export const dynamic = "force-dynamic";

const userSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  studentProfile: {
    select: {
      id: true,
      classRoom: { select: { school: { select: { name: true } } } },
    },
  },
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  if (!(await activeStudentAccount(session.user.id))) {
    return NextResponse.json({ error: "Akun siswa belum aktif." }, { status: 404 });
  }
  const blockedIds = await blockedStudentIds(session.user.id);
  const [participations, requests, unreadConversations, requestCount] = await Promise.all([
    prisma.conversationParticipant.findMany({
      where: {
        userId: session.user.id,
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
      orderBy: { conversation: { updatedAt: "desc" } },
      take: 100,
      select: {
        lastReadAt: true,
        conversation: {
          select: {
            id: true,
            updatedAt: true,
            participants: { select: { userId: true, user: { select: userSelect } } },
            messages: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, senderId: true, content: true, createdAt: true } },
          },
        },
      },
    }),
    prisma.studentMessageRequest.findMany({
      where: { recipientId: session.user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, message: true, createdAt: true, sender: { select: userSelect } },
    }),
    getStudentUnreadCount(session.user.id),
    prisma.studentMessageRequest.count({ where: { recipientId: session.user.id, status: "PENDING" } }),
  ]);
  return NextResponse.json({
    unreadTotal: unreadConversations + requestCount,
    conversations: participations.map((entry) => {
      const other = entry.conversation.participants.find((item) => item.userId !== session.user.id)?.user;
      const last = entry.conversation.messages[0] ?? null;
      return {
        id: entry.conversation.id,
        otherUser: other
          ? {
              id: other.id,
              studentId: other.studentProfile?.id ?? null,
              name: other.name,
              avatarUrl: other.avatarUrl,
              schoolName: other.studentProfile?.classRoom.school?.name ?? "Sekolah belum tercantum",
            }
          : null,
        lastMessage: last
          ? { ...last, createdAt: last.createdAt.toISOString(), isMine: last.senderId === session.user.id }
          : null,
        unread: Boolean(last && last.senderId !== session.user.id && (!entry.lastReadAt || last.createdAt > entry.lastReadAt)),
        updatedAt: entry.conversation.updatedAt.toISOString(),
      };
    }),
    requests: requests.map((item) => ({
      id: item.id,
      message: item.message,
      createdAt: item.createdAt.toISOString(),
      sender: {
        id: item.sender.id,
        studentId: item.sender.studentProfile?.id ?? null,
        name: item.sender.name,
        avatarUrl: item.sender.avatarUrl,
        schoolName: item.sender.studentProfile?.classRoom.school?.name ?? "Sekolah belum tercantum",
      },
    })),
  });
}
