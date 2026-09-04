import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findAccessibleStudentBoardPost } from "@/lib/student-board-access";

const commentSchema = z.object({
  content: z.string().trim().min(1, "Komentar tidak boleh kosong.").max(1000),
});
type RouteContext = { params: Promise<{ id: string }> };

async function authorize(context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") return null;
  const { id } = await context.params;
  const post = await findAccessibleStudentBoardPost(session.user.id, id);
  return post ? { user: session.user, postId: id } : null;
}

export async function GET(_req: Request, context: RouteContext) {
  const access = await authorize(context);
  if (!access) {
    return NextResponse.json({ error: "Mading tidak ditemukan." }, { status: 404 });
  }
  const [comments, commentCount] = await Promise.all([
    prisma.studentBoardPostComment.findMany({
      where: { postId: access.postId },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.studentBoardPostComment.count({ where: { postId: access.postId } }),
  ]);
  return NextResponse.json({ comments: comments.reverse(), commentCount });
}

export async function POST(req: Request, context: RouteContext) {
  const access = await authorize(context);
  if (!access) {
    return NextResponse.json({ error: "Mading tidak ditemukan." }, { status: 404 });
  }
  try {
    const body = commentSchema.parse(await req.json().catch(() => null));
    const comment = await prisma.studentBoardPostComment.create({
      data: {
        postId: access.postId,
        userId: access.user.id,
        content: body.content,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    const commentCount = await prisma.studentBoardPostComment.count({
      where: { postId: access.postId },
    });
    return NextResponse.json({ comment, commentCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Komentar tidak valid." },
        { status: 400 },
      );
    }
    console.error("[student board comments]", error);
    return NextResponse.json({ error: "Gagal mengirim komentar." }, { status: 500 });
  }
}
