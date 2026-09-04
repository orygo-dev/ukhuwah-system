import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeSpotlightPosts } from "@/lib/spotlight-serialize";
import {
  isDirectVideoUrl,
  isUploadedSpotlightPath,
  isUploadedSpotlightVideoPath,
  videoUrlHint,
} from "@/lib/spotlight-video";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

const createSchema = z.object({
  caption: z.string().trim().min(1, "Caption wajib diisi").max(2000),
  videoUrl: z
    .string()
    .trim()
    .refine(
      (value) =>
        isUploadedSpotlightVideoPath(value) ||
        (z.string().url().safeParse(value).success && isDirectVideoUrl(value)),
      videoUrlHint()
    ),
  thumbnailUrl: z
    .string()
    .trim()
    .refine(
      (value) =>
        !value ||
        isUploadedSpotlightPath(value) ||
        z.string().url().safeParse(value).success,
      "URL thumbnail tidak valid"
    )
    .optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Zona Kreasi saat ini hanya tersedia untuk akun guru.");
  }
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const rawLimit = Number(searchParams.get("limit") || 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(20, Math.max(1, Math.trunc(rawLimit)))
    : 10;

  const posts = await prisma.spotlightPost.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  const hasMore = posts.length > limit;
  const slice = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? slice[slice.length - 1]?.id : null;

  const items = await serializeSpotlightPosts(slice, session?.user?.id);

  return NextResponse.json({ posts: items, nextCursor });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat membuat Zona Kreasi.");
  }

  try {
    const body = createSchema.parse(await req.json());
    const post = await prisma.spotlightPost.create({
      data: {
        authorId: session.user.id,
        caption: body.caption.trim(),
        videoUrl: body.videoUrl.trim(),
        thumbnailUrl: body.thumbnailUrl?.trim() || null,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const [item] = await serializeSpotlightPosts([post], session.user.id);
    return NextResponse.json({ post: item });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[spotlight POST]", err);
    return NextResponse.json({ error: "Gagal membuat Zona Kreasi" }, { status: 500 });
  }
}
