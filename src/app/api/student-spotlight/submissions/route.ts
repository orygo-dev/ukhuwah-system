import { NextResponse } from "next/server";
import { StudentSpotlightSubmissionStatus } from "@prisma/client";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";
import { auth } from "@/lib/auth";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { canReviewContent, getContentReviewSettings } from "@/lib/content-review";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reviewSettings = await getContentReviewSettings();
  if (!canReviewContent(session.user.role, "spotlight", reviewSettings)) {
    return forbiddenRoleResponse("Anda tidak memiliki akses review Zona Kreasi siswa.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId");
  const status = searchParams.get("status") as StudentSpotlightSubmissionStatus | null;

  if (classRoomId) {
    const room = await getClassRoomForUser(classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
  }

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });
  const schoolId = account?.schoolId ?? session.user.schoolId ?? null;
  const baseWhere =
    session.user.role === "SUPER_ADMIN"
      ? {}
      : session.user.role === "SCHOOL_ADMIN"
        ? { classRoom: { schoolId: schoolId ?? "__unassigned_school__" } }
        : {
            classRoom: {
              OR: [
                { teacherId: session.user.id },
                {
                  teacherAssignments: {
                    some: { teacherId: session.user.id, isActive: true },
                  },
                },
              ],
            },
          };

  const submissions = await prisma.studentSpotlightSubmission.findMany({
    where: {
      ...baseWhere,
      ...(classRoomId ? { classRoomId } : {}),
      ...(status && status in StudentSpotlightSubmissionStatus
        ? { status }
        : { status: { not: "ARCHIVED" } }),
    },
    take: 80,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      classRoom: { select: { id: true, name: true, jenjang: true, tahunAjaran: true } },
      student: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ submissions });
}
