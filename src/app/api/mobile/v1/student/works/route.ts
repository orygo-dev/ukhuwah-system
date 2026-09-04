import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { studentContentSchoolName } from "@/lib/student-content-school";

export const dynamic = "force-dynamic";

const schoolSelect = {
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

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke data siswa." },
      { status: 404 },
    );
  }

  const [mading, spotlight] = await Promise.all([
    prisma.studentBoardPost.findMany({
      where: {
        OR: [
          { studentId: student.id },
          { authorId: session.user.id },
        ],
      },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        category: true,
        content: true,
        imageUrl: true,
        visibility: true,
        status: true,
        reviewNote: true,
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
        classRoom: { select: schoolSelect },
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
      where: { studentId: student.id },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        caption: true,
        videoUrl: true,
        thumbnailUrl: true,
        visibility: true,
        status: true,
        reviewNote: true,
        publishedAt: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            user: { select: { avatarUrl: true } },
          },
        },
        classRoom: { select: schoolSelect },
        _count: { select: { likes: true } },
        likes: {
          where: { userId: session.user.id },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  return NextResponse.json({
    mading: mading.map(({ classRoom, ...item }) => ({
      ...item,
      classRoom: { school: classRoom.school },
      schoolName: studentContentSchoolName(classRoom),
      isOwner: true,
    })),
    spotlight: spotlight.map(({ classRoom, ...item }) => ({
      ...item,
      classRoom: { school: classRoom.school },
      schoolName: studentContentSchoolName(classRoom),
      isOwner: true,
    })),
  });
}
