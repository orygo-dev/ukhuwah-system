import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeSpotlightPosts } from "@/lib/spotlight-serialize";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Zona Kreasi saat ini hanya tersedia untuk akun guru.");
  }

  const { id } = await params;

  const post = await prisma.spotlightPost.findFirst({
    where: { id, isPublished: true },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Zona Kreasi tidak ditemukan" }, { status: 404 });
  }

  const [item] = await serializeSpotlightPosts([post], session.user.id);
  return NextResponse.json({ post: item });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Zona Kreasi saat ini hanya tersedia untuk akun guru.");
  }

  const { id } = await params;
  const post = await prisma.spotlightPost.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Zona Kreasi tidak ditemukan" }, { status: 404 });
  }

  const canDelete =
    post.authorId === session.user.id || session.user.role === "SUPER_ADMIN";

  if (!canDelete) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  await prisma.spotlightPost.update({
    where: { id },
    data: { isPublished: false },
  });

  return NextResponse.json({ ok: true });
}
