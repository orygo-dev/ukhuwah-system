import { prisma } from "@/lib/prisma";
import type { SpotlightPostDto } from "@/lib/spotlight";

export async function serializeSpotlightPosts(
  posts: {
    id: string;
    caption: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    viewCount: number;
    createdAt: Date;
    author: { id: string; name: string; avatarUrl: string | null };
    _count: { likes: number; comments: number };
  }[],
  userId?: string
): Promise<SpotlightPostDto[]> {
  if (!userId || posts.length === 0) {
    return posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      videoUrl: p.videoUrl,
      thumbnailUrl: p.thumbnailUrl,
      viewCount: p.viewCount,
      createdAt: p.createdAt.toISOString(),
      author: p.author,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: false,
    }));
  }

  const liked = await prisma.spotlightLike.findMany({
    where: {
      userId,
      postId: { in: posts.map((p) => p.id) },
    },
    select: { postId: true },
  });
  const likedSet = new Set(liked.map((l) => l.postId));

  return posts.map((p) => ({
    id: p.id,
    caption: p.caption,
    videoUrl: p.videoUrl,
    thumbnailUrl: p.thumbnailUrl,
    viewCount: p.viewCount,
    createdAt: p.createdAt.toISOString(),
    author: p.author,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    likedByMe: likedSet.has(p.id),
  }));
}
