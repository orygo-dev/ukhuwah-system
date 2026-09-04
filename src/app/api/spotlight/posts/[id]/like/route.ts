import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menyukai Zona Kreasi.");
  }

  const { id } = await params;
  const post = await prisma.spotlightPost.findFirst({
    where: { id, isPublished: true },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Zona Kreasi tidak ditemukan" }, { status: 404 });
  }

  const existing = await prisma.spotlightLike.findUnique({
    where: {
      postId_userId: { postId: id, userId: session.user.id },
    },
  });

  if (existing) {
    await prisma.spotlightLike.delete({ where: { id: existing.id } });
    const likeCount = await prisma.spotlightLike.count({ where: { postId: id } });
    return NextResponse.json({ liked: false, likeCount });
  }

  await prisma.spotlightLike.create({
    data: { postId: id, userId: session.user.id },
  });
  const likeCount = await prisma.spotlightLike.count({ where: { postId: id } });
  return NextResponse.json({ liked: true, likeCount });
}
