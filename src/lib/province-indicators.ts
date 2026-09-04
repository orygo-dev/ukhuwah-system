import { prisma } from "@/lib/prisma";

export function provincePercent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export type ProvinceSchoolScope = {
  provinceId: string;
  provinceName: string;
  schoolIds: string[];
};

function emptyAttendance() {
  return {
    total: 0,
    present: 0,
    excused: 0,
    sick: 0,
    absent: 0,
    presentRate: 0,
    byStatus: [] as Array<{ status: string; label: string; count: number; rate: number }>,
    byRegency: [] as Array<{
      id: string;
      name: string;
      total: number;
      present: number;
      presentRate: number;
    }>,
    bySchool: [] as Array<{
      id: string;
      name: string;
      regencyName: string | null;
      total: number;
      present: number;
      excused: number;
      sick: number;
      absent: number;
      presentRate: number;
    }>,
  };
}

export async function getProvinceAttendanceIndicators(
  scope: ProvinceSchoolScope,
  since: Date
) {
  const schoolIds = scope.schoolIds;
  if (schoolIds.length === 0) return emptyAttendance();

  const sessionWhere = {
    date: { gte: since },
    classRoom: { schoolId: { in: schoolIds } },
  };

  const [grouped, sessionMeta, statusBySession] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { session: sessionWhere },
      _count: { _all: true },
    }),
    prisma.attendanceSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        classRoom: {
          select: {
            school: {
              select: {
                id: true,
                name: true,
                regency: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["sessionId", "status"],
      where: { session: sessionWhere },
      _count: { _all: true },
    }),
  ]);

  const countByStatus = {
    PRESENT: 0,
    EXCUSED: 0,
    SICK: 0,
    ABSENT: 0,
  };
  for (const row of grouped) {
    if (row.status in countByStatus) {
      countByStatus[row.status as keyof typeof countByStatus] = row._count._all;
    }
  }
  const total =
    countByStatus.PRESENT +
    countByStatus.EXCUSED +
    countByStatus.SICK +
    countByStatus.ABSENT;

  const sessionToSchool = new Map(
    sessionMeta.map((session) => [session.id, session.classRoom.school])
  );
  const schoolMap = new Map<
    string,
    {
      id: string;
      name: string;
      regencyId: string | null;
      regencyName: string | null;
      present: number;
      excused: number;
      sick: number;
      absent: number;
    }
  >();
  const regencyMap = new Map<string, { id: string; name: string; present: number; total: number }>();

  for (const row of statusBySession) {
    const school = sessionToSchool.get(row.sessionId);
    if (!school) continue;
    const current = schoolMap.get(school.id) ?? {
      id: school.id,
      name: school.name,
      regencyId: school.regency?.id ?? null,
      regencyName: school.regency?.name ?? null,
      present: 0,
      excused: 0,
      sick: 0,
      absent: 0,
    };
    const count = row._count._all;
    if (row.status === "PRESENT") current.present += count;
    else if (row.status === "EXCUSED") current.excused += count;
    else if (row.status === "SICK") current.sick += count;
    else if (row.status === "ABSENT") current.absent += count;
    schoolMap.set(school.id, current);

    if (school.regency) {
      const regency = regencyMap.get(school.regency.id) ?? {
        id: school.regency.id,
        name: school.regency.name,
        present: 0,
        total: 0,
      };
      regency.total += count;
      if (row.status === "PRESENT") regency.present += count;
      regencyMap.set(school.regency.id, regency);
    }
  }

  const bySchool = Array.from(schoolMap.values())
    .map((school) => {
      const schoolTotal = school.present + school.excused + school.sick + school.absent;
      return {
        id: school.id,
        name: school.name,
        regencyName: school.regencyName,
        total: schoolTotal,
        present: school.present,
        excused: school.excused,
        sick: school.sick,
        absent: school.absent,
        presentRate: provincePercent(school.present, schoolTotal),
      };
    })
    .sort((a, b) => a.presentRate - b.presentRate || a.name.localeCompare(b.name))
    .slice(0, 40);

  const byRegency = Array.from(regencyMap.values())
    .map((regency) => ({
      id: regency.id,
      name: regency.name,
      total: regency.total,
      present: regency.present,
      presentRate: provincePercent(regency.present, regency.total),
    }))
    .sort((a, b) => b.presentRate - a.presentRate || a.name.localeCompare(b.name));

  return {
    total,
    present: countByStatus.PRESENT,
    excused: countByStatus.EXCUSED,
    sick: countByStatus.SICK,
    absent: countByStatus.ABSENT,
    presentRate: provincePercent(countByStatus.PRESENT, total),
    byStatus: [
      { status: "PRESENT", label: "Hadir", count: countByStatus.PRESENT, rate: provincePercent(countByStatus.PRESENT, total) },
      { status: "EXCUSED", label: "Izin", count: countByStatus.EXCUSED, rate: provincePercent(countByStatus.EXCUSED, total) },
      { status: "SICK", label: "Sakit", count: countByStatus.SICK, rate: provincePercent(countByStatus.SICK, total) },
      { status: "ABSENT", label: "Alpha", count: countByStatus.ABSENT, rate: provincePercent(countByStatus.ABSENT, total) },
    ],
    byRegency,
    bySchool,
  };
}

export async function getProvinceDailyQuizIndicators(
  scope: ProvinceSchoolScope,
  since: Date
) {
  const schoolIds = scope.schoolIds;
  const studentWhere = {
    isActive: true,
    classRoom: { schoolId: { in: schoolIds } },
  };

  const [studentCount, attempts, quizzes] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.dailyQuizAttempt.findMany({
      where: {
        submittedAt: { gte: since },
        student: studentWhere,
      },
      select: {
        score: true,
        studentId: true,
        submittedAt: true,
        dailyQuiz: { select: { dateKey: true } },
        student: {
          select: {
            classRoom: {
              select: {
                school: {
                  select: { id: true, name: true, regency: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
      take: 20000,
    }),
    prisma.dailyQuiz.findMany({
      where: {
        status: "PUBLISHED",
        dateKey: {
          gte: since.toISOString().slice(0, 10),
        },
      },
      select: { id: true, dateKey: true, theme: true, questionCount: true },
      orderBy: { dateKey: "desc" },
      take: 60,
    }),
  ]);

  const uniqueStudents = new Set(attempts.map((item) => item.studentId));
  const avgScore = attempts.length
    ? attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length
    : 0;

  const schoolMap = new Map<
    string,
    { id: string; name: string; regencyName: string | null; attempts: number; scoreSum: number; students: Set<string>; dates: Set<string> }
  >();

  for (const attempt of attempts) {
    const school = attempt.student.classRoom.school;
    if (!school) continue;
    const current = schoolMap.get(school.id) ?? {
      id: school.id,
      name: school.name,
      regencyName: school.regency?.name ?? null,
      attempts: 0,
      scoreSum: 0,
      students: new Set<string>(),
      dates: new Set<string>(),
    };
    current.attempts += 1;
    current.scoreSum += attempt.score;
    current.students.add(attempt.studentId);
    current.dates.add(attempt.dailyQuiz.dateKey);
    schoolMap.set(school.id, current);
  }

  const bySchool = Array.from(schoolMap.values())
    .map((school) => ({
      id: school.id,
      name: school.name,
      regencyName: school.regencyName,
      attempts: school.attempts,
      participants: school.students.size,
      avgScore: school.attempts ? school.scoreSum / school.attempts : 0,
      activeDays: school.dates.size,
    }))
    .sort((a, b) => b.activeDays - a.activeDays || b.avgScore - a.avgScore)
    .slice(0, 40);

  return {
    studentCount,
    attemptCount: attempts.length,
    participantCount: uniqueStudents.size,
    participationRate: provincePercent(uniqueStudents.size, studentCount),
    avgScore,
    publishedQuizCount: quizzes.length,
    bySchool,
    recentQuizzes: quizzes.slice(0, 14),
  };
}

export async function getProvinceContentIndicators(
  scope: ProvinceSchoolScope,
  since: Date
) {
  const schoolIds = scope.schoolIds;
  const classScope = { schoolId: { in: schoolIds } };

  const [
    madingPublished,
    madingPending,
    madingRejected,
    spotlightPublished,
    spotlightPending,
    spotlightRejected,
    madingBySchool,
    spotlightBySchool,
  ] = await Promise.all([
    prisma.studentBoardPost.count({
      where: { status: "PUBLISHED", publishedAt: { gte: since }, classRoom: classScope },
    }),
    prisma.studentBoardPost.count({
      where: { status: "PENDING_REVIEW", createdAt: { gte: since }, classRoom: classScope },
    }),
    prisma.studentBoardPost.count({
      where: { status: "REJECTED", updatedAt: { gte: since }, classRoom: classScope },
    }),
    prisma.studentSpotlightSubmission.count({
      where: { status: "PUBLISHED", publishedAt: { gte: since }, classRoom: classScope },
    }),
    prisma.studentSpotlightSubmission.count({
      where: { status: "PENDING_REVIEW", createdAt: { gte: since }, classRoom: classScope },
    }),
    prisma.studentSpotlightSubmission.count({
      where: { status: "REJECTED", updatedAt: { gte: since }, classRoom: classScope },
    }),
    prisma.studentBoardPost.groupBy({
      by: ["classRoomId"],
      where: {
        status: { in: ["PUBLISHED", "PENDING_REVIEW"] },
        createdAt: { gte: since },
        classRoom: classScope,
      },
      _count: { _all: true },
    }),
    prisma.studentSpotlightSubmission.groupBy({
      by: ["classRoomId"],
      where: {
        status: { in: ["PUBLISHED", "PENDING_REVIEW"] },
        createdAt: { gte: since },
        classRoom: classScope,
      },
      _count: { _all: true },
    }),
  ]);

  const classIds = Array.from(
    new Set([
      ...madingBySchool.map((row) => row.classRoomId),
      ...spotlightBySchool.map((row) => row.classRoomId),
    ])
  );

  const classes =
    classIds.length === 0
      ? []
      : await prisma.classRoom.findMany({
          where: { id: { in: classIds } },
          select: {
            id: true,
            school: {
              select: { id: true, name: true, regency: { select: { name: true } } },
            },
          },
        });

  const classToSchool = new Map(classes.map((item) => [item.id, item.school]));
  const schoolMap = new Map<
    string,
    { id: string; name: string; regencyName: string | null; mading: number; spotlight: number }
  >();

  for (const row of madingBySchool) {
    const school = classToSchool.get(row.classRoomId);
    if (!school) continue;
    const current = schoolMap.get(school.id) ?? {
      id: school.id,
      name: school.name,
      regencyName: school.regency?.name ?? null,
      mading: 0,
      spotlight: 0,
    };
    current.mading += row._count._all;
    schoolMap.set(school.id, current);
  }
  for (const row of spotlightBySchool) {
    const school = classToSchool.get(row.classRoomId);
    if (!school) continue;
    const current = schoolMap.get(school.id) ?? {
      id: school.id,
      name: school.name,
      regencyName: school.regency?.name ?? null,
      mading: 0,
      spotlight: 0,
    };
    current.spotlight += row._count._all;
    schoolMap.set(school.id, current);
  }

  const bySchool = Array.from(schoolMap.values())
    .map((school) => ({
      ...school,
      total: school.mading + school.spotlight,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, 40);

  return {
    madingPublished,
    madingPending,
    madingRejected,
    spotlightPublished,
    spotlightPending,
    spotlightRejected,
    pendingTotal: madingPending + spotlightPending,
    publishedTotal: madingPublished + spotlightPublished,
    activeSchoolCount: bySchool.length,
    bySchool,
  };
}

export async function getProvinceDiversityIndicators(
  scope: ProvinceSchoolScope,
  since: Date
) {
  const schoolIds = scope.schoolIds;
  const schoolScope = { id: { in: schoolIds } };
  const studentWhere = { isActive: true, classRoom: { schoolId: { in: schoolIds } } };

  const [
    schoolCount,
    activeSchoolCount,
    studentCount,
    genderGroups,
    parentAccessCount,
    regencyCount,
    regenciesWithStudents,
    contentSchools,
  ] = await Promise.all([
    prisma.school.count({ where: schoolScope }),
    prisma.school.count({
      where: { ...schoolScope, classRooms: { some: { isActive: true } } },
    }),
    prisma.student.count({ where: studentWhere }),
    prisma.student.groupBy({
      by: ["gender"],
      where: studentWhere,
      _count: { _all: true },
    }),
    prisma.student.count({
      where: { ...studentWhere, parentAccessEnabled: true },
    }),
    prisma.regency.count({ where: { provinceId: scope.provinceId } }),
    prisma.regency.count({
      where: {
        provinceId: scope.provinceId,
        schools: { some: { classRooms: { some: { students: { some: { isActive: true } } } } } },
      },
    }),
    getProvinceContentIndicators(scope, since),
  ]);

  const genderRecorded = genderGroups
    .filter((row) => row.gender)
    .reduce((sum, row) => sum + row._count._all, 0);
  const normalizeGender = (value: string | null) => (value || "").trim().toLowerCase();
  const male = genderGroups
    .filter((row) => {
      const gender = normalizeGender(row.gender);
      return gender === "l" || gender === "laki-laki" || gender === "laki" || gender === "male" || gender.startsWith("laki");
    })
    .reduce((sum, row) => sum + row._count._all, 0);
  const female = genderGroups
    .filter((row) => {
      const gender = normalizeGender(row.gender);
      return gender === "p" || gender === "perempuan" || gender === "female" || gender.startsWith("perem");
    })
    .reduce((sum, row) => sum + row._count._all, 0);
  const knownGender = male + female;
  const balanceGap = knownGender
    ? Math.abs(male - female) / knownGender
    : 1;
  const genderBalanceScore = Math.round((1 - balanceGap) * 100);

  const demographicReady = provincePercent(genderRecorded, studentCount);
  const parentCoverage = provincePercent(parentAccessCount, studentCount);
  const regencyCoverage = provincePercent(regenciesWithStudents, regencyCount);
  const contentSchoolRate = provincePercent(
    contentSchools.activeSchoolCount,
    activeSchoolCount || schoolCount
  );

  const inclusiveIndex = Math.round(
    (demographicReady + parentCoverage + regencyCoverage + contentSchoolRate + genderBalanceScore) /
      5
  );

  return {
    schoolCount,
    activeSchoolCount,
    studentCount,
    genderRecorded,
    male,
    female,
    genderBalanceScore,
    parentAccessCount,
    parentCoverage,
    regencyCount,
    regenciesWithStudents,
    regencyCoverage,
    contentSchoolCount: contentSchools.activeSchoolCount,
    contentSchoolRate,
    publishedContent: contentSchools.publishedTotal,
    inclusiveIndex,
  };
}
