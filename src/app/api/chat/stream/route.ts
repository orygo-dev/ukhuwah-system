import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadCount } from "@/lib/chat";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pesan guru hanya tersedia untuk akun guru.");
  }

  const userId = session.user.id;
  let lastUnread = await getUnreadCount(userId);
  let lastEventAt = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: object) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("connected", { unreadTotal: lastUnread });

      const interval = setInterval(async () => {
        try {
          const unread = await getUnreadCount(userId);
          if (unread !== lastUnread) {
            lastUnread = unread;
            send("unread", { unreadTotal: unread, at: Date.now() });
          }

          const latest = await prisma.message.findFirst({
            where: {
              conversation: {
                participants: { some: { userId } },
              },
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              conversationId: true,
              createdAt: true,
              senderId: true,
            },
          });

          if (latest && latest.createdAt.getTime() > lastEventAt) {
            lastEventAt = latest.createdAt.getTime();
            send("message", {
              conversationId: latest.conversationId,
              messageId: latest.id,
              senderId: latest.senderId,
              at: latest.createdAt.toISOString(),
            });
          }
        } catch {
          cleanup();
          controller.close();
        }
      }, 3000);

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);

      const cleanup = () => {
        clearInterval(interval);
        clearInterval(keepAlive);
      };

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
