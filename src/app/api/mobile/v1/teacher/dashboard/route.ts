import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "TEACHER") return mobileForbidden();

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, schoolId: true, school: { select: { id: true, name: true } } },
  });
  if (!account) return mobileUnauthorized();

  const classWhere = {
    isActive: true,
    OR: account.schoolId
      ? [{ teacherId: account.id }, { schoolId: account.schoolId }]
      : [{ teacherId: account.id }],
  };
  const sevenDaysAgo = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const now = new Date();

  const [classes, studentCount, pendingGrading, attendanceSessions, upcomingPjj] =
    await Promise.all([
      prisma.classRoom.findMany({
        where: classWhere,
        take: 20,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          jenjang: true,
          tahunAjaran: true,
          deliveryMode: true,
          teacherId: true,
          school: { select: { id: true, name: true } },
          _count: { select: { students: true, assignments: true } },
        },
      }),
      prisma.student.count({ where: { isActive: true, classRoom: classWhere } }),
      prisma.assignmentSubmission.count({
        where: {
          assignment: { teacherId: account.id },
          status: { in: ["SUBMITTED", "LATE"] },
        },
      }),
      prisma.attendanceSession.findMany({
        where: { teacherId: account.id, date: { gte: sevenDaysAgo } },
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          records: { select: { status: true } },
        },
      }),
      prisma.liveClassSession.findMany({
        where: {
          status: { in: ["SCHEDULED", "LIVE"] },
          scheduledEnd: { gte: now },
          OR: [
            { createdById: account.id },
            { classRoom: { teacherId: account.id } },
            {
              classRoom: {
                teacherAssignments: {
                  some: { teacherId: account.id, isActive: true },
                },
              },
            },
          ],
        },
        take: 8,
        orderBy: { scheduledStart: "asc" },
        select: {
          id: true,
          title: true,
          subject: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          classRoom: { select: { id: true, name: true } },
          _count: { select: { participants: true } },
        },
      }),
    ]);

  const records = attendanceSessions.flatMap((item) => item.records);
  const present = records.filter((item) => item.status === "PRESENT").length;
  const attendancePercent = records.length ? Math.round((present / records.length) * 100) : null;
  const activityByDate = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sevenDaysAgo.getTime() + index * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    const sessions = attendanceSessions.filter(
      (item) => item.date.toISOString().slice(0, 10) === key
    );
    return {
      date: key,
      sessions: sessions.length,
      students: sessions.reduce((sum, item) => sum + item.records.length, 0),
    };
  });

  return NextResponse.json({
    teacher: { id: account.id, name: account.name, school: account.school },
    summary: {
      activeClasses: classes.length,
      activeStudents: studentCount,
      attendancePercent,
      pendingGrading,
    },
    classes,
    upcomingPjj,
    activityByDate,
  });
}
