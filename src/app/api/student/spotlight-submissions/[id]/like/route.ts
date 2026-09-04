import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya siswa yang dapat menyukai Zona Kreasi siswa." },
      { status: 403 }
    );
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: {
      classRoomId: true,
      classRoom: { select: { schoolId: true, isActive: true } },
    },
  });
  if (!student || !student.classRoom.isActive) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke kelas aktif." },
      { status: 404 }
    );
  }

  const { id } = await params;
  const schoolVisibility = student.classRoom.schoolId
    ? {
        visibility: "SCHOOL" as const,
        classRoom: { schoolId: student.classRoom.schoolId },
      }
    : {
        visibility: "SCHOOL" as const,
        classRoomId: student.classRoomId,
      };
  const submission = await prisma.studentSpotlightSubmission.findFirst({
    where: {
      id,
      status: "PUBLISHED",
      OR: [
        { visibility: "GLOBAL" },
        { visibility: "CLASS", classRoomId: student.classRoomId },
        schoolVisibility,
      ],
    },
    select: { id: true },
  });
  if (!submission) {
    return NextResponse.json(
      { error: "Zona Kreasi tidak ditemukan." },
      { status: 404 }
    );
  }

  const existing = await prisma.studentSpotlightLike.findUnique({
    where: {
      submissionId_userId: {
        submissionId: submission.id,
        userId: session.user.id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.studentSpotlightLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.studentSpotlightLike.create({
      data: { submissionId: submission.id, userId: session.user.id },
    });
  }

  const likeCount = await prisma.studentSpotlightLike.count({
    where: { submissionId: submission.id },
  });
  return NextResponse.json({ liked: !existing, likeCount });
}
