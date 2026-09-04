import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canModerateStudentSpotlightReports } from "@/lib/student-spotlight-reports";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canModerateStudentSpotlightReports(session.user.role)) {
    return NextResponse.json(
      { error: "Anda tidak memiliki akses moderasi laporan Zona Kreasi." },
      { status: 403 }
    );
  }

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });
  const schoolId = account?.schoolId ?? session.user.schoolId ?? null;
  const scope =
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
    where: { ...scope, reports: { some: {} } },
    take: 80,
    orderBy: [{ hiddenByReportsAt: "desc" }, { updatedAt: "desc" }],
    include: {
      classRoom: {
        select: { id: true, name: true, jenjang: true, tahunAjaran: true, schoolId: true },
      },
      student: { select: { id: true, name: true } },
      reports: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reason: true,
          details: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
          reporter: { select: { id: true, name: true } },
          reviewer: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    items: submissions.map((submission) => ({
      ...submission,
      reportCount: submission.reports.length,
      openReportCount: submission.reports.filter((report) => report.status === "OPEN").length,
      autoHidden: Boolean(submission.hiddenByReportsAt),
    })),
  });
}
