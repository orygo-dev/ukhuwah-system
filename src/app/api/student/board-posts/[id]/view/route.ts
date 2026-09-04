import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findAccessibleStudentBoardPost } from "@/lib/student-board-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const post = await findAccessibleStudentBoardPost(session.user.id, id);
  if (!post) {
    return NextResponse.json({ error: "Mading tidak ditemukan." }, { status: 404 });
  }

  const updated = await prisma.studentBoardPost.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });
  return NextResponse.json({ viewCount: updated.viewCount });
}
