import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findAccessibleStudentBoardPost } from "@/lib/student-board-access";

const bodySchema = z.object({ liked: z.boolean() });
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
    const { liked } = bodySchema.parse(await req.json().catch(() => null));
    const count = await prisma.$transaction(async (tx) => {
      if (liked) {
        await tx.studentBoardPostLike.upsert({
          where: { postId_userId: { postId: id, userId: session.user.id } },
          create: { postId: id, userId: session.user.id },
          update: {},
        });
      } else {
        await tx.studentBoardPostLike.deleteMany({
          where: { postId: id, userId: session.user.id },
        });
      }
      return tx.studentBoardPostLike.count({ where: { postId: id } });
    });
    return NextResponse.json({ liked, likeCount: count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Status like tidak valid." }, { status: 400 });
    }
    console.error("[student board like]", error);
    return NextResponse.json({ error: "Gagal memperbarui like." }, { status: 500 });
  }
}
