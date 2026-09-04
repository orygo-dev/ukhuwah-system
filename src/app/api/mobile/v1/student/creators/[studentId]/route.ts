import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { studentBoardVisibilityClauses } from "@/lib/student-board-visibility";
import { studentContentSchoolName } from "@/lib/student-content-school";
import { publicStudentCreatorIdentity } from "@/lib/student-creator-profile";
import { studentRelationship } from "@/lib/student-social";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ studentId: string }> };

const classRoomSchoolSelect = {
  school: { select: { name: true } },
  teacher: {
    select: {
      school: { select: { name: true } },
      teachingProfiles: {
        orderBy: [
          { isPrimary: "desc" as const },
          { updatedAt: "desc" as const },
        ],
        take: 1,
        select: { schoolName: true },
      },
    },
  },
} satisfies Prisma.ClassRoomSelect;

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();

  const [{ studentId }, viewer] = await Promise.all([
    params,
    prisma.student.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: {
        id: true,
        classRoomId: true,
        classRoom: { select: { schoolId: true, isActive: true } },
      },
    }),
  ]);
  if (!viewer?.classRoom.isActive) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke kelas aktif." },
      { status: 404 },
    );
  }

  const target = await prisma.student.findFirst({
    where: { id: studentId, isActive: true, classRoom: { isActive: true } },
    select: {
      id: true,
      name: true,
      userId: true,
      user: { select: { avatarUrl: true } },
      classRoom: { select: { ...classRoomSchoolSelect, name: true } },
    },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Profil kreator tidak ditemukan." },
      { status: 404 },
    );
  }

  const visibility = studentBoardVisibilityClauses({
    classRoomId: viewer.classRoomId,
    schoolId: viewer.classRoom.schoolId,
  });
  const spotlightVisibility: Prisma.StudentSpotlightSubmissionWhereInput[] = [
    { visibility: "GLOBAL" },
    { visibility: "CLASS", classRoomId: viewer.classRoomId },
    viewer.classRoom.schoolId
      ? {
          visibility: "SCHOOL",
          classRoom: { schoolId: viewer.classRoom.schoolId },
        }
      : { visibility: "SCHOOL", classRoomId: viewer.classRoomId },
  ];

  const [mading, spotlight, followerCount, followingCount, relationship] = await Promise.all([
    prisma.studentBoardPost.findMany({
      where: {
        status: "PUBLISHED",
        AND: [
          { OR: [{ studentId: target.id }, { authorId: target.userId }] },
          { OR: visibility },
        ],
      },
      take: 100,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        content: true,
        imageUrl: true,
        visibility: true,
        status: true,
        viewCount: true,
        publishedAt: true,
        createdAt: true,
        author: { select: { name: true, avatarUrl: true } },
        student: {
          select: {
            id: true,
            name: true,
            user: { select: { avatarUrl: true } },
          },
        },
        classRoom: { select: classRoomSchoolSelect },
        _count: { select: { likes: true, comments: true } },
        likes: {
          where: { userId: session.user.id },
          select: { id: true },
          take: 1,
        },
        bookmarks: {
          where: { userId: session.user.id },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.studentSpotlightSubmission.findMany({
      where: {
        studentId: target.id,
        status: "PUBLISHED",
        hiddenByReportsAt: null,
        OR: spotlightVisibility,
      },
      take: 100,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        caption: true,
        videoUrl: true,
        thumbnailUrl: true,
        visibility: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            user: { select: { avatarUrl: true } },
          },
        },
        classRoom: { select: classRoomSchoolSelect },
        _count: { select: { likes: true } },
        likes: {
          where: { userId: session.user.id },
          select: { id: true },
          take: 1,
        },
      },
    }),
    target.userId
      ? prisma.studentFollow.count({ where: { followingId: target.userId } })
      : Promise.resolve(0),
    target.userId
      ? prisma.studentFollow.count({ where: { followerId: target.userId } })
      : Promise.resolve(0),
    target.userId && target.userId !== session.user.id
      ? studentRelationship(session.user.id, target.userId)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    student: publicStudentCreatorIdentity({
      id: target.id,
      name: target.name,
      avatarUrl: target.user?.avatarUrl ?? null,
      schoolName:
        studentContentSchoolName(target.classRoom) ??
        "Sekolah belum tercantum",
      className: target.classRoom.name,
    }),
    social: {
      followerCount,
      followingCount,
      isSelf: target.userId === session.user.id,
      following: relationship?.following ?? false,
      followsViewer: relationship?.followsViewer ?? false,
      mutual: relationship?.mutual ?? false,
      blocked: relationship?.blocked ?? false,
      canMessage: relationship?.canMessage ?? false,
      requestStatus: relationship?.request?.status ?? null,
      conversationId: relationship?.request?.conversationId ?? null,
      enabled: Boolean(target.userId),
    },
    mading: mading.map(({ classRoom, ...item }) => ({
      ...item,
      schoolName: studentContentSchoolName(classRoom),
      isOwner: target.id === viewer.id,
    })),
    spotlight: spotlight.map(({ classRoom, ...item }) => ({
      ...item,
      schoolName: studentContentSchoolName(classRoom),
      isOwner: target.id === viewer.id,
    })),
  });
}
