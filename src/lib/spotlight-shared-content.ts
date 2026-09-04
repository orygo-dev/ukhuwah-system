import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isTeacherWorkspaceRole } from "@/lib/api-role-guard";
import { studentSchoolVisibilityWhere } from "@/lib/student-portal";
import type { SpotlightKind } from "@/lib/spotlight-links";

type Viewer = { id: string; role: UserRole };
type SharedPost = { caption: string; videoUrl: string; thumbnailUrl: string | null; author: string };
type SharedResult = { status: "signin" | "forbidden" | "missing" } | { status: "ready"; post: SharedPost };

// Auth and visibility checks precede every media lookup. No anonymous metadata leak.
export async function getSharedSpotlight(kind: SpotlightKind, id: string, viewer?: Viewer): Promise<SharedResult> {
  if (!viewer) return { status: "signin" };
  if (kind === "teacher") {
    if (!isTeacherWorkspaceRole(viewer.role)) return { status: "forbidden" };
    const post = await prisma.spotlightPost.findFirst({
      where: { id, isPublished: true },
      select: { caption: true, videoUrl: true, thumbnailUrl: true, author: { select: { name: true } } },
    });
    return post ? { status: "ready", post: { ...post, author: post.author.name } } : { status: "missing" };
  }
  if (viewer.role !== "STUDENT") return { status: "forbidden" };
  const student = await prisma.student.findFirst({
    where: { userId: viewer.id, isActive: true, classRoom: { isActive: true } },
    select: { classRoomId: true, classRoom: { select: { schoolId: true } } },
  });
  if (!student) return { status: "forbidden" };
  const post = await prisma.studentSpotlightSubmission.findFirst({
    where: {
      id, status: "PUBLISHED",
      OR: [
        { visibility: "GLOBAL" },
        { visibility: "CLASS", classRoomId: student.classRoomId },
        studentSchoolVisibilityWhere(student),
      ],
    },
    select: { caption: true, videoUrl: true, thumbnailUrl: true, student: { select: { name: true } } },
  });
  return post ? { status: "ready", post: { caption: post.caption, videoUrl: post.videoUrl, thumbnailUrl: post.thumbnailUrl, author: post.student.name } } : { status: "missing" };
}
