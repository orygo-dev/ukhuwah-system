import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublishedDailyQuizByDate, jakartaDateKey } from "@/lib/daily-quiz";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { ensureStudentPjjEnrollment } from "@/lib/pjj";
import { prisma } from "@/lib/prisma";
import { studentContentSchoolName } from "@/lib/student-content-school";
import { studentPackageWhere } from "@/lib/tka";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();

  const student = await prisma.student.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
      classRoom: { isActive: true },
    },
    select: {
      id: true,
      name: true,
      nis: true,
      classRoomId: true,
      classRoom: {
        select: {
          id: true,
          name: true,
          jenjang: true,
          tahunAjaran: true,
          schoolId: true,
          teacher: { select: { name: true } },
          school: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!student) {
    return NextResponse.json(
      {
        error: "Akun belum terhubung ke roster siswa.",
        code: "STUDENT_UNLINKED",
      },
      { status: 404 },
    );
  }

  const now = new Date();
  const pjjAccess = await ensureStudentPjjEnrollment(student.id);
  const enrollmentCount =
    pjjAccess?.enrollment &&
    ["PENDING", "ACTIVE", "AT_RISK"].includes(pjjAccess.enrollment.status)
      ? 1
      : 0;

  const schoolVisibility = student.classRoom.schoolId
    ? {
        visibility: "SCHOOL" as const,
        classRoom: { schoolId: student.classRoom.schoolId },
      }
    : { visibility: "SCHOOL" as const, classRoomId: student.classRoomId };

  const [
    assignments,
    quizzes,
    exams,
    grades,
    attendance,
    pjj,
    tkaPackages,
    reading,
    boardPosts,
    spotlight,
    followerCount,
  ] = await Promise.all([
    prisma.assignment.findMany({
      where: { classRoomId: student.classRoomId, status: "PUBLISHED" },
      take: 20,
      orderBy: [{ dueAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        mapel: true,
        description: true,
        dueDate: true,
        dueAt: true,
        teacher: { select: { name: true } },
        submissions: {
          where: { studentId: student.id },
          take: 1,
          select: { id: true, status: true, score: true, submittedAt: true },
        },
      },
    }),
    (async () => {
      const daily = await getPublishedDailyQuizByDate(jakartaDateKey());
      if (!daily) return [];
      const attempt = await prisma.dailyQuizAttempt.findUnique({
        where: {
          dailyQuizId_studentId: {
            dailyQuizId: daily.id,
            studentId: student.id,
          },
        },
        select: { id: true, score: true, submittedAt: true },
      });
      return [
        {
          id: daily.id,
          title: daily.title,
          mapel: daily.theme,
          description: daily.description,
          createdAt: daily.createdAt,
          _count: { questions: daily.questionCount },
          attempts: attempt ? [attempt] : [],
          kind: "daily_quiz" as const,
        },
      ];
    })(),
    prisma.exam.findMany({
      where: { classRoomId: student.classRoomId, status: "PUBLISHED" },
      take: 20,
      orderBy: { startAt: "desc" },
      select: {
        id: true,
        title: true,
        mapel: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
        _count: { select: { questions: true } },
        attempts: {
          where: { studentId: student.id },
          take: 1,
          select: { id: true, score: true, submittedAt: true },
        },
      },
    }),
    prisma.gradeRecord.findMany({
      where: { studentId: student.id, score: { not: null } },
      take: 10,
      orderBy: { updatedAt: "desc" },
      select: {
        score: true,
        assessment: {
          select: { id: true, title: true, mapel: true, maxScore: true },
        },
      },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { studentId: student.id },
      _count: { _all: true },
    }),
    enrollmentCount > 0
      ? prisma.liveClassSession.findMany({
          where: {
            classRoomId: student.classRoomId,
            status: { in: ["SCHEDULED", "LIVE"] },
            scheduledEnd: { gte: now },
            classRoom: { deliveryMode: { in: ["PJJ", "HYBRID"] } },
          },
          take: 5,
          orderBy: { scheduledStart: "asc" },
          select: {
            id: true,
            title: true,
            subject: true,
            description: true,
            scheduledStart: true,
            scheduledEnd: true,
            status: true,
            createdBy: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.tkaPackage.findMany({
      where: studentPackageWhere(student),
      take: 10,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        durationMinutes: true,
        subject: { select: { name: true } },
        _count: { select: { questions: true } },
        attempts: {
          where: { studentId: student.id },
          take: 1,
          select: { id: true, status: true, score: true, expiresAt: true },
        },
      },
    }),
    prisma.readingProgress.findMany({
      where: { studentId: student.id },
      take: 8,
      orderBy: { lastReadAt: "desc" },
      select: {
        progressPercent: true,
        currentPage: true,
        lastReadAt: true,
        book: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverUrl: true,
            category: true,
          },
        },
      },
    }),
    prisma.studentBoardPost.findMany({
      where: {
        status: "PUBLISHED",
        category: { notIn: ["Pengumuman", "Pengumuman Sekolah"] },
        OR: [
          { visibility: "GLOBAL" },
          { visibility: "CLASS", classRoomId: student.classRoomId },
          schoolVisibility,
        ],
      },
      take: 8,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        content: true,
        imageUrl: true,
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
        classRoom: {
          select: { school: { select: { id: true, name: true } } },
        },
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
        status: "PUBLISHED",
        OR: [
          { visibility: "GLOBAL" },
          { visibility: "CLASS", classRoomId: student.classRoomId },
          schoolVisibility,
        ],
      },
      take: 30,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        caption: true,
        videoUrl: true,
        thumbnailUrl: true,
        publishedAt: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                avatarUrl: true,
                studentFollowsReceived: {
                  where: { followerId: session.user.id },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
        classRoom: {
          select: {
            school: { select: { id: true, name: true } },
            teacher: {
              select: {
                school: { select: { name: true } },
                teachingProfiles: {
                  orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
                  take: 1,
                  select: { schoolName: true },
                },
              },
            },
          },
        },
        _count: { select: { likes: true } },
        likes: {
          where: { userId: session.user.id },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.studentFollow.count({ where: { followingId: session.user.id } }),
  ]);

  const scored = grades.filter((item) => item.score !== null);
  const averageScore = scored.length
    ? scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length
    : null;
  const attendanceTotal = attendance.reduce(
    (sum, item) => sum + item._count._all,
    0,
  );
  const present =
    attendance.find((item) => item.status === "PRESENT")?._count._all ?? 0;

  return NextResponse.json({
    student,
    summary: {
      pendingAssignments: assignments.filter(
        (item) => item.submissions.length === 0,
      ).length,
      attendancePercent: attendanceTotal
        ? Math.round((present / attendanceTotal) * 100)
        : null,
      averageScore:
        averageScore === null ? null : Number(averageScore.toFixed(1)),
      followerCount,
      readingCompleted: reading.filter((item) => item.progressPercent === 100)
        .length,
    },
    assignments,
    quizzes,
    exams,
    grades,
    attendance,
    upcomingPjj: pjj,
    tkaPackages,
    reading,
    boardPosts,
    spotlight: spotlight.map(({ classRoom, ...item }) => {
      const studentUser = item.student.user;
      return {
        ...item,
        student: {
          ...item.student,
          user: studentUser ? { avatarUrl: studentUser.avatarUrl } : null,
        },
        classRoom: { school: classRoom.school },
        schoolName: studentContentSchoolName(classRoom),
        isFollowing: (studentUser?.studentFollowsReceived.length ?? 0) > 0,
        isOwner: item.student.id === student.id,
      };
    }),
  });
}
