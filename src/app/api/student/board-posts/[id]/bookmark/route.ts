import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findAccessibleStudentBoardPost } from "@/lib/student-board-access";

const bodySchema = z.object({ bookmarked: z.boolean() });
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const post = await findAccessibleStudentBoardPost(session.user.id, id);
  if (!post) {
    return NextResponse.json({ error: "Mading tidak ditemukan." }, { status: 404 });
  }

  try {
    const { bookmarked } = bodySchema.parse(await req.json().catch(() => null));
    if (bookmarked) {
      await prisma.studentBoardPostBookmark.upsert({
        where: { postId_userId: { postId: id, userId: session.user.id } },
        create: { postId: id, userId: session.user.id },
        update: {},
      });
    } else {
      await prisma.studentBoardPostBookmark.deleteMany({
        where: { postId: id, userId: session.user.id },
      });
    }
    return NextResponse.json({ bookmarked });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Status arsip tidak valid." }, { status: 400 });
    }
    console.error("[student board bookmark]", error);
    return NextResponse.json({ error: "Gagal memperbarui arsip." }, { status: 500 });
  }
}
