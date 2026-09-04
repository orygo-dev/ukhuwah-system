import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

type Params = { params: Promise<{ id: string }> };

const commentSchema = z.object({
  content: z.string().trim().min(1, "Komentar tidak boleh kosong").max(1000),
});

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Komentar Zona Kreasi saat ini hanya tersedia untuk akun guru.");
  }

  const { id } = await params;

  const post = await prisma.spotlightPost.findFirst({
    where: { id, isPublished: true },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Zona Kreasi tidak ditemukan" }, { status: 404 });
  }

  const comments = await prisma.spotlightComment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
    })),
  });
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menambah komentar Zona Kreasi.");
  }

  const { id } = await params;
  const post = await prisma.spotlightPost.findFirst({
    where: { id, isPublished: true },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Zona Kreasi tidak ditemukan" }, { status: 404 });
  }

  try {
    const body = commentSchema.parse(await req.json());
    const comment = await prisma.spotlightComment.create({
      data: {
        postId: id,
        userId: session.user.id,
        content: body.content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const commentCount = await prisma.spotlightComment.count({
      where: { postId: id },
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        user: comment.user,
      },
      commentCount,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Gagal menambah komentar" }, { status: 500 });
  }
}
