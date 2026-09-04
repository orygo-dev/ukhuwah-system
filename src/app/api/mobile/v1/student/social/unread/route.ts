import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { getStudentUnreadCount } from "@/lib/student-social";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  const [messages, requests] = await Promise.all([
    getStudentUnreadCount(session.user.id),
    prisma.studentMessageRequest.count({ where: { recipientId: session.user.id, status: "PENDING" } }),
  ]);
  return NextResponse.json({ unreadCount: messages + requests }, { headers: { "Cache-Control": "no-store" } });
}
