import {
  Building2,
  Clock3,
  FileCheck2,
  GraduationCap,
  Users,
} from "lucide-react";
import Link from "next/link";
import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
import { ProvinceDashboardToolbar } from "@/components/province/province-dashboard-toolbar";
import {
  DashDistribution,
  DashKpiCard,
  DashPanel,
  DashPriorityRow,
  DashProgramCard,
  DashProgress,
} from "@/components/province/province-dashboard-ui";
import { getCurrentProvinceAdmin } from "@/lib/province-admin";
import {
  getProvinceAttendanceIndicators,
  getProvinceContentIndicators,
  getProvinceDailyQuizIndicators,
  getProvinceDiversityIndicators,
} from "@/lib/province-indicators";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("id-ID");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

const PRIORITY_RANK: Record<string, number> = {
  Kritis: 0,
  Tinggi: 1,
  Sedang: 2,
  Terpantau: 3,
  Baik: 4,
};

export default async function ProvinceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { account, scope } = await getCurrentProvinceAdmin("/province");
  const query = await searchParams;
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));
  const staleSince = new Date();
  staleSince.setDate(staleSince.getDate() - 180);
  const schoolIds = scope.schoolIds;
  const inSchools = { in: schoolIds };
  const schoolScope = { id: inSchools };
  const teacherInProvince = {
    role: "TEACHER" as const,
    OR: [
      { schoolId: inSchools },
      { teachingProfiles: { some: { schoolId: inSchools } } },
      { classRooms: { some: { schoolId: inSchools } } },
    ],
  };
  const studentInProvince = {
    isActive: true,
    classRoom: { schoolId: inSchools },
  };

  const [
    schoolCount,
    smaCount,
    smkCount,
    activeSchoolCount,
    freshSchoolCount,
    adminCoveredSchoolCount,
    teacherCount,
    studentCount,
    studentAccountCount,
    classCount,
    pjjEnrollmentCount,
    pjjRiskCount,
    pjjSessionCount,
    pjjParticipantCount,
    pjjPresentCount,
    unresolvedInterventionCount,
    tkaPublishedCount,
    tkaAttemptCount,
    tkaSubmittedCount,
    tkaScore,
    regencies,
    recentSchools,
    literacyQuizAttempts,
    literacyExamAttempts,
    literacyAssignmentCount,
    literacyWritingStudents,
    teacherDocumentActivity,
    teacherJournalActivity,
    teacherAssignmentActivity,
    teacherQuizActivity,
    teacherExamActivity,
    teacherAssessmentActivity,
    teacherPjjActivity,
  ] = await Promise.all([
    prisma.school.count({ where: schoolScope }),
    prisma.school.count({ where: { ...schoolScope, level: { contains: "SMA" } } }),
    prisma.school.count({ where: { ...schoolScope, level: { contains: "SMK" } } }),
    prisma.school.count({
      where: { ...schoolScope, classRooms: { some: { isActive: true } } },
    }),
    prisma.school.count({ where: { ...schoolScope, updatedAt: { gte: staleSince } } }),
    prisma.school.count({
      where: { ...schoolScope, users: { some: { role: "SCHOOL_ADMIN" } } },
    }),
    prisma.user.count({ where: teacherInProvince }),
    prisma.student.count({ where: studentInProvince }),
    prisma.student.count({ where: { ...studentInProvince, userId: { not: null } } }),
    prisma.classRoom.count({ where: { isActive: true, schoolId: inSchools } }),
    prisma.pjjEnrollment.count({
      where: {
        status: { in: ["ACTIVE", "COMPLETED"] },
        student: { classRoom: { schoolId: inSchools } },
      },
    }),
    prisma.pjjEnrollment.count({
      where: {
        status: "AT_RISK",
        student: { classRoom: { schoolId: inSchools } },
      },
    }),
    prisma.liveClassSession.count({
      where: { scheduledStart: { gte: since }, classRoom: { schoolId: inSchools } },
    }),
    prisma.liveClassParticipant.count({
      where: {
        session: { scheduledStart: { gte: since }, classRoom: { schoolId: inSchools } },
        role: "STUDENT",
      },
    }),
    prisma.liveClassParticipant.count({
      where: {
        session: { scheduledStart: { gte: since }, classRoom: { schoolId: inSchools } },
        role: "STUDENT",
        attendanceStatus: { in: ["PRESENT", "LATE"] },
      },
    }),
    prisma.pjjIntervention.count({
      where: { resolvedAt: null, student: { classRoom: { schoolId: inSchools } } },
    }),
    prisma.tkaPackage.count({ where: { status: "PUBLISHED" } }),
    prisma.tkaAttempt.count({
      where: {
        createdAt: { gte: since },
        student: { classRoom: { schoolId: inSchools } },
      },
    }),
    prisma.tkaAttempt.count({
      where: {
        createdAt: { gte: since },
        status: "SUBMITTED",
        student: { classRoom: { schoolId: inSchools } },
      },
    }),
    prisma.tkaAttempt.aggregate({
      where: {
        submittedAt: { gte: since },
        student: { classRoom: { schoolId: inSchools } },
      },
      _avg: { score: true },
    }),
    prisma.regency.findMany({
      where: { provinceId: scope.provinceId },
      orderBy: { name: "asc" },
      include: { province: { select: { name: true } }, _count: { select: { schools: true } } },
    }),
    prisma.school.findMany({
      where: schoolScope,
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        npsn: true,
        level: true,
        updatedAt: true,
        regency: { select: { name: true } },
        _count: { select: { classRooms: true, users: true } },
      },
    }),
    prisma.quizAttempt.findMany({
      where: {
        submittedAt: { gte: since },
        student: { classRoom: { schoolId: inSchools } },
        quiz: {
          OR: [
            { mapel: { contains: "Bahasa Indonesia" } },
            { mapel: { contains: "Literasi" } },
            { title: { contains: "literasi" } },
          ],
        },
      },
      select: { studentId: true, score: true },
    }),
    prisma.examAttempt.findMany({
      where: {
        submittedAt: { gte: since },
        student: { classRoom: { schoolId: inSchools } },
        exam: {
          OR: [
            { mapel: { contains: "Bahasa Indonesia" } },
            { mapel: { contains: "Literasi" } },
            { title: { contains: "literasi" } },
          ],
        },
      },
      select: { studentId: true, score: true },
    }),
    prisma.assignment.count({
      where: {
        createdAt: { gte: since },
        classRoom: { schoolId: inSchools },
        OR: [
          { mapel: { contains: "Bahasa Indonesia" } },
          { mapel: { contains: "Literasi" } },
          { title: { contains: "literasi" } },
        ],
      },
    }),
    prisma.studentBoardPost.findMany({
      where: {
        publishedAt: { gte: since },
        studentId: { not: null },
        status: "PUBLISHED",
        classRoom: { schoolId: inSchools },
        OR: [
          { category: { contains: "Literasi" } },
          { category: { contains: "Cerpen" } },
          { category: { contains: "Puisi" } },
          { category: { contains: "Artikel" } },
        ],
      },
      distinct: ["studentId"],
      select: { studentId: true },
    }),
    prisma.document.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since }, user: teacherInProvince },
      _count: { _all: true },
    }),
    prisma.dailyJournal.groupBy({
      by: ["teacherId"],
      where: { date: { gte: since }, classRoom: { schoolId: inSchools } },
      _count: { _all: true },
    }),
    prisma.assignment.groupBy({
      by: ["teacherId"],
      where: { createdAt: { gte: since }, classRoom: { schoolId: inSchools } },
      _count: { _all: true },
    }),
    prisma.quiz.groupBy({
      by: ["teacherId"],
      where: { createdAt: { gte: since }, classRoom: { schoolId: inSchools } },
      _count: { _all: true },
    }),
    prisma.exam.groupBy({
      by: ["teacherId"],
      where: { createdAt: { gte: since }, classRoom: { schoolId: inSchools } },
      _count: { _all: true },
    }),
    prisma.assessment.groupBy({
      by: ["teacherId"],
      where: { date: { gte: since }, classRoom: { schoolId: inSchools } },
      _count: { _all: true },
    }),
    prisma.liveClassSession.groupBy({
      by: ["createdById"],
      where: { scheduledStart: { gte: since }, classRoom: { schoolId: inSchools } },
      _count: { _all: true },
    }),
  ]);

  const [attendanceDetail, dailyQuizDetail, contentDetail, diversityDetail] =
    await Promise.all([
      getProvinceAttendanceIndicators(scope, since),
      getProvinceDailyQuizIndicators(scope, since),
      getProvinceContentIndicators(scope, since),
      getProvinceDiversityIndicators(scope, since),
    ]);

  const regionRows = await Promise.all(
    regencies.map(async (regency) => {
      const [active, withAdmin, students] = await Promise.all([
        prisma.school.count({ where: { regencyId: regency.id, classRooms: { some: { isActive: true } } } }),
        prisma.school.count({ where: { regencyId: regency.id, users: { some: { role: "SCHOOL_ADMIN" } } } }),
        prisma.student.count({ where: { isActive: true, classRoom: { school: { regencyId: regency.id } } } }),
      ]);
      const schools = regency._count.schools;
      const readiness = schools ? Math.round((percent(active, schools) * 0.65) + (percent(withAdmin, schools) * 0.35)) : 0;
      return { id: regency.id, name: regency.name, schools, active, students, readiness };
    })
  );
  regionRows.sort((a, b) => b.readiness - a.readiness || a.name.localeCompare(b.name));

  const schoolActivityRate = percent(activeSchoolCount, schoolCount);
  const accountCoverage = percent(studentAccountCount, studentCount);
  const adminCoverage = percent(adminCoveredSchoolCount, schoolCount);
  const freshnessRate = percent(freshSchoolCount, schoolCount);
  const dataCompleteness = Math.round((schoolActivityRate + accountCoverage + adminCoverage + freshnessRate) / 4);
  const pjjAttendanceRate = percent(pjjPresentCount, pjjParticipantCount);
  const tkaCompletionRate = percent(tkaSubmittedCount, tkaAttemptCount);
  const tkaAverage = tkaScore._avg.score ?? 0;

  const literacyAttempts = [...literacyQuizAttempts, ...literacyExamAttempts];
  const literacyScores = literacyAttempts.map((attempt) => attempt.score);
  const literacyAverage = literacyScores.length
    ? literacyScores.reduce((sum, score) => sum + score, 0) / literacyScores.length
    : 0;
  const literacyStudentIds = new Set(literacyAttempts.map((attempt) => attempt.studentId));
  for (const writing of literacyWritingStudents) {
    if (writing.studentId) literacyStudentIds.add(writing.studentId);
  }
  const literacyParticipationRate = percent(literacyStudentIds.size, studentCount);
  const literacyDistribution = {
    mahir: literacyScores.filter((score) => score >= 80).length,
    cakap: literacyScores.filter((score) => score >= 65 && score < 80).length,
    dasar: literacyScores.filter((score) => score >= 50 && score < 65).length,
    intervention: literacyScores.filter((score) => score < 50).length,
  };

  const teacherScores = new Map<string, number>();
  const addTeacherScore = (teacherId: string, score: number) => {
    teacherScores.set(teacherId, (teacherScores.get(teacherId) ?? 0) + score);
  };
  for (const row of teacherDocumentActivity) addTeacherScore(row.userId, Math.min(row._count._all, 4) * 0.5);
  for (const row of teacherJournalActivity) addTeacherScore(row.teacherId, Math.min(row._count._all, 4) * 2);
  for (const row of teacherAssignmentActivity) addTeacherScore(row.teacherId, Math.min(row._count._all, 3) * 2);
  for (const row of teacherQuizActivity) addTeacherScore(row.teacherId, Math.min(row._count._all, 3) * 2);
  for (const row of teacherExamActivity) addTeacherScore(row.teacherId, Math.min(row._count._all, 2) * 2);
  for (const row of teacherAssessmentActivity) addTeacherScore(row.teacherId, Math.min(row._count._all, 3) * 2);
  for (const row of teacherPjjActivity) addTeacherScore(row.createdById, Math.min(row._count._all, 2) * 2);

  const teacherActivity = { active: 0, sufficient: 0, attention: 0, inactive: 0 };
  for (const score of teacherScores.values()) {
    if (score >= 10) teacherActivity.active += 1;
    else if (score >= 4) teacherActivity.sufficient += 1;
    else teacherActivity.attention += 1;
  }
  teacherActivity.inactive = Math.max(teacherCount - teacherScores.size, 0);
  const activeTeacherCount = teacherActivity.active + teacherActivity.sufficient;
  const teacherActivityRate = percent(activeTeacherCount, teacherCount);

  const priorities = [
    {
      level: schoolCount - activeSchoolCount > 0 ? "Kritis" : "Baik",
      issue: "Sekolah belum memiliki kelas aktif",
      count: schoolCount - activeSchoolCount,
      helper: "Perlu aktivasi roster dan kelas operasional.",
      href: "/province/schools",
    },
    {
      level: adminCoverage < 90 ? "Tinggi" : "Baik",
      issue: "Sekolah belum memiliki admin aktif",
      count: schoolCount - adminCoveredSchoolCount,
      helper: "Menghambat pembaruan data tingkat sekolah.",
      href: "/province/schools",
    },
    {
      level: pjjRiskCount > 0 || unresolvedInterventionCount > 0 ? "Tinggi" : "Terpantau",
      issue: "Peserta PJJ membutuhkan tindak lanjut",
      count: pjjRiskCount + unresolvedInterventionCount,
      helper: "Gabungan peserta berisiko dan intervensi terbuka.",
      href: "/province/pjj",
    },
    {
      level: tkaPublishedCount === 0 ? "Sedang" : "Terpantau",
      issue: "Paket TKA terpublikasi",
      count: tkaPublishedCount,
      helper:
        tkaPublishedCount === 0
          ? "Belum ada paket publik untuk dimonitor."
          : `${tkaCompletionRate}% percobaan selesai pada periode ini.`,
      href: "/province/tka",
    },
    {
      level: literacyScores.length === 0 ? "Sedang" : literacyAverage < 65 ? "Tinggi" : "Terpantau",
      issue: "Pengukuran literasi siswa",
      count: literacyStudentIds.size,
      helper:
        literacyScores.length === 0
          ? "Belum ada asesmen berlabel literasi atau Bahasa Indonesia."
          : `Rata-rata capaian ${literacyAverage.toFixed(1)} dari ${literacyScores.length} hasil.`,
      href: "/province/literacy",
    },
    {
      level: teacherActivity.inactive > 0 ? "Tinggi" : "Terpantau",
      issue: "Guru tanpa aktivitas terdeteksi",
      count: teacherActivity.inactive,
      helper: `Diukur dari aktivitas aplikasi selama ${period} hari terakhir.`,
      href: "/province/teachers",
    },
    {
      level: attendanceDetail.absent > 0 ? "Tinggi" : "Terpantau",
      issue: "Catatan alpha siswa",
      count: attendanceDetail.absent,
      helper: `Kehadiran ${attendanceDetail.presentRate}% · izin ${attendanceDetail.excused} · sakit ${attendanceDetail.sick}.`,
      href: "/province/attendance",
    },
    {
      level: contentDetail.pendingTotal > 0 ? "Sedang" : "Terpantau",
      issue: "Konten siswa menunggu review",
      count: contentDetail.pendingTotal,
      helper: `${contentDetail.publishedTotal} konten sudah terbit pada periode ini.`,
      href: "/province/content",
    },
  ]
    .sort(
      (a, b) =>
        (PRIORITY_RANK[a.level] ?? 9) - (PRIORITY_RANK[b.level] ?? 9) || b.count - a.count
    )
    .slice(0, 5);

  const topRegions = regionRows.slice(0, 8);

  return (
    <ProvinceAdminShell activePath="/province" accountName={account.name} accountEmail={account.email}>
      <div className="space-y-8 pb-12">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-slate-500">Provinsi · ringkasan operasional</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
              Dashboard Dinas Pendidikan
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Fokus pada kondisi wilayah, prioritas intervensi, dan indikator program yang paling relevan.
            </p>
          </div>
          <ProvinceDashboardToolbar period={period} />
        </header>

        <section aria-label="Ringkasan KPI" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashKpiCard
            label="Sekolah"
            value={formatNumber(schoolCount)}
            helper={`Aktif ${schoolActivityRate}% · SMA ${formatNumber(smaCount)} · SMK ${formatNumber(smkCount)}`}
            icon={Building2}
            href="/province/schools"
            tone="sky"
          />
          <DashKpiCard
            label="Guru"
            value={formatNumber(teacherCount)}
            helper={`${teacherActivityRate}% aktif dalam ${period} hari`}
            icon={GraduationCap}
            href="/province/teachers"
            tone="emerald"
          />
          <DashKpiCard
            label="Peserta didik"
            value={formatNumber(studentCount)}
            helper={`${accountCoverage}% sudah memiliki akun`}
            icon={Users}
            tone="cyan"
          />
          <DashKpiCard
            label="Kelengkapan data"
            value={`${dataCompleteness}%`}
            helper={dataCompleteness >= 80 ? "Kondisi data baik" : "Perlu percepatan pembaruan"}
            icon={FileCheck2}
            tone="amber"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <DashPanel
            title="Prioritas intervensi"
            description="Lima isu teratas yang perlu ditindaklanjuti"
            action={
              <Link href="/province/schools" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Semua sekolah
              </Link>
            }
          >
            <div className="-mx-3 space-y-1">
              {priorities.map((item) => (
                <DashPriorityRow
                  key={item.issue}
                  level={item.level}
                  title={item.issue}
                  helper={item.helper}
                  count={formatNumber(item.count)}
                  href={item.href}
                />
              ))}
            </div>
          </DashPanel>

          <DashPanel
            title="Kabupaten / kota"
            description="Kesiapan berdasarkan kelas aktif dan admin"
            action={<span className="text-sm tabular-nums text-slate-400">{regionRows.length} wilayah</span>}
          >
            <div className="space-y-4">
              {topRegions.map((row, index) => {
                const tone =
                  row.readiness >= 80
                    ? "bg-emerald-500"
                    : row.readiness >= 60
                      ? "bg-amber-500"
                      : "bg-rose-500";
                return (
                  <div key={row.id} className="grid grid-cols-[1.5rem_1fr_2.75rem] items-center gap-3">
                    <span className="text-xs tabular-nums text-slate-400">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                        <p className="shrink-0 text-xs text-slate-400">{row.schools} sekolah</p>
                      </div>
                      <div className="mt-2">
                        <DashProgress value={row.readiness} tone={tone} />
                      </div>
                    </div>
                    <span className="text-right text-sm font-semibold tabular-nums text-slate-800">
                      {row.readiness}%
                    </span>
                  </div>
                );
              })}
            </div>
          </DashPanel>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Monitoring program</h2>
            <p className="mt-1 text-sm text-slate-500">
              Indikator utama operasional selama {period} hari terakhir
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DashProgramCard
              title="Kehadiran"
              value={attendanceDetail.total ? `${attendanceDetail.presentRate}%` : "—"}
              helper={
                attendanceDetail.total
                  ? `${formatNumber(attendanceDetail.present)} hadir · ${formatNumber(attendanceDetail.absent)} alpha`
                  : "Belum ada catatan kehadiran"
              }
              progress={attendanceDetail.presentRate}
              href="/province/attendance"
              empty={attendanceDetail.total === 0}
              tone="teal"
            />
            <DashProgramCard
              title="Quiz harian"
              value={dailyQuizDetail.attemptCount ? `${dailyQuizDetail.participationRate}%` : "—"}
              helper={
                dailyQuizDetail.attemptCount
                  ? `Skor ${dailyQuizDetail.avgScore.toFixed(1)} · ${formatNumber(dailyQuizDetail.participantCount)} siswa`
                  : "Belum ada partisipasi wilayah"
              }
              progress={dailyQuizDetail.participationRate}
              href="/province/daily-quiz"
              empty={dailyQuizDetail.attemptCount === 0}
              tone="indigo"
            />
            <DashProgramCard
              title="Zona Kreasi & Mading"
              value={formatNumber(contentDetail.publishedTotal)}
              helper={
                contentDetail.publishedTotal + contentDetail.pendingTotal > 0
                  ? `${formatNumber(contentDetail.pendingTotal)} menunggu · ${formatNumber(contentDetail.activeSchoolCount)} sekolah`
                  : "Belum ada konten terbit"
              }
              progress={Math.min(100, contentDetail.publishedTotal)}
              href="/province/content"
              empty={contentDetail.publishedTotal + contentDetail.pendingTotal === 0}
              tone="rose"
            />
            <DashProgramCard
              title="PJJ"
              value={`${pjjAttendanceRate}%`}
              helper={`${formatNumber(pjjEnrollmentCount)} peserta · ${formatNumber(pjjSessionCount)} sesi`}
              progress={pjjAttendanceRate}
              href="/province/pjj"
              tone="sky"
            />
            <DashProgramCard
              title="TKA"
              value={tkaAttemptCount ? tkaAverage.toFixed(1) : "—"}
              helper={
                tkaAttemptCount
                  ? `${formatNumber(tkaSubmittedCount)} / ${formatNumber(tkaAttemptCount)} selesai`
                  : `${formatNumber(tkaPublishedCount)} paket terpublikasi`
              }
              progress={tkaCompletionRate}
              href="/province/tka"
              empty={tkaAttemptCount === 0}
              tone="orange"
            />
            <DashProgramCard
              title="Inklusivitas"
              value={`${diversityDetail.inclusiveIndex}%`}
              helper={`Gender ${diversityDetail.genderBalanceScore}% · orang tua ${diversityDetail.parentCoverage}%`}
              progress={diversityDetail.inclusiveIndex}
              href="/province/diversity"
              tone="emerald"
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <DashPanel
            title="Literasi siswa"
            description="Asesmen Bahasa Indonesia / literasi dan karya tulis"
            action={
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {literacyScores.length ? literacyAverage.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-slate-500">rata-rata</p>
              </div>
            }
          >
            <div id="literasi" className="scroll-mt-24 space-y-5">
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-4 py-3 text-center">
                <div>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    {formatNumber(literacyStudentIds.size)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Siswa terukur</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    {literacyParticipationRate}%
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Partisipasi</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    {formatNumber(literacyAssignmentCount)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Tugas</p>
                </div>
              </div>

              {literacyScores.length > 0 ? (
                <div className="space-y-4">
                  <DashDistribution
                    label="Mahir (≥ 80)"
                    value={literacyDistribution.mahir}
                    total={literacyScores.length}
                    tone="bg-emerald-500"
                  />
                  <DashDistribution
                    label="Cakap (65–79)"
                    value={literacyDistribution.cakap}
                    total={literacyScores.length}
                    tone="bg-sky-500"
                  />
                  <DashDistribution
                    label="Dasar (50–64)"
                    value={literacyDistribution.dasar}
                    total={literacyScores.length}
                    tone="bg-amber-500"
                  />
                  <DashDistribution
                    label="Perlu intervensi (< 50)"
                    value={literacyDistribution.intervention}
                    total={literacyScores.length}
                    tone="bg-rose-500"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5">
                  <p className="text-sm font-medium text-slate-800">Belum ada capaian literasi</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Tandai mapel sebagai Bahasa Indonesia/Literasi atau gunakan kata “literasi” pada judul
                    asesmen.
                  </p>
                </div>
              )}
            </div>
          </DashPanel>

          <DashPanel
            title="Keaktifan guru"
            description={`Aktivitas terdeteksi dalam ${period} hari`}
            action={
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {teacherActivityRate}%
                </p>
                <p className="text-xs text-slate-500">aktif / cukup</p>
              </div>
            }
          >
            <div id="keaktifan-guru" className="scroll-mt-24 space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    {formatNumber(activeTeacherCount)}
                  </p>
                  <p className="text-xs text-slate-500">dari {formatNumber(teacherCount)} guru</p>
                </div>
                <div className="min-w-[140px] flex-1">
                  <DashProgress value={teacherActivityRate} tone="bg-slate-900" />
                </div>
              </div>
              <div className="space-y-4">
                <DashDistribution
                  label="Aktif"
                  value={teacherActivity.active}
                  total={teacherCount}
                  tone="bg-emerald-500"
                />
                <DashDistribution
                  label="Cukup aktif"
                  value={teacherActivity.sufficient}
                  total={teacherCount}
                  tone="bg-sky-500"
                />
                <DashDistribution
                  label="Perlu perhatian"
                  value={teacherActivity.attention}
                  total={teacherCount}
                  tone="bg-amber-500"
                />
                <DashDistribution
                  label="Tidak ada aktivitas"
                  value={teacherActivity.inactive}
                  total={teacherCount}
                  tone="bg-rose-500"
                />
              </div>
              <p className="text-sm leading-5 text-slate-500">
                Indeks mengukur aktivitas di aplikasi, bukan kualitas individu. Dokumen AI berbobot lebih
                kecil daripada jurnal dan asesmen.
              </p>
            </div>
          </DashPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <DashPanel
            title="Kelengkapan data"
            description="Komponen skor kelengkapan provinsi"
            action={
              <div className="grid size-11 place-items-center rounded-full border-2 border-slate-200 text-sm font-semibold tabular-nums text-slate-800">
                {dataCompleteness}%
              </div>
            }
          >
            <div id="kelengkapan" className="scroll-mt-24 space-y-5">
              {(
                [
                  ["Sekolah memiliki kelas aktif", schoolActivityRate],
                  ["Sekolah memiliki admin", adminCoverage],
                  ["Siswa memiliki akun", accountCoverage],
                  ["Data diperbarui ≤ 180 hari", freshnessRate],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{value}%</span>
                  </div>
                  <DashProgress
                    value={value}
                    tone={value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-rose-500"}
                  />
                </div>
              ))}
              <p className="text-sm leading-5 text-slate-500">
                Indeks inklusivitas operasional: {diversityDetail.inclusiveIndex}% — detail di{" "}
                <Link href="/province/diversity" className="font-medium text-slate-800 underline-offset-2 hover:underline">
                  halaman Kebhinnekaan
                </Link>
                .
              </p>
            </div>
          </DashPanel>

          <DashPanel
            title="Sekolah terbaru"
            description="Berdasarkan pembaruan data terakhir"
            action={<Clock3 className="size-4 text-slate-400" />}
          >
            <div id="sekolah" className="-mx-6 -mb-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-y border-slate-100 bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Sekolah</th>
                    <th className="px-4 py-3 font-medium">Wilayah</th>
                    <th className="px-4 py-3 font-medium">Kelas</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSchools.map((school) => {
                    const active = school._count.classRooms > 0;
                    return (
                      <tr key={school.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-slate-900">{school.name}</p>
                          <p className="mt-0.5 text-xs text-slate-400">NPSN {school.npsn || "-"}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{school.regency?.name || "-"}</td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums text-slate-900">
                          {school._count.classRooms}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                              active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {active ? "Aktif" : "Perlu aktivasi"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DashPanel>
        </div>

        <p className="text-center text-sm text-slate-400">
          Data agregat · {formatNumber(classCount)} kelas aktif · identitas siswa tidak ditampilkan
        </p>
      </div>
    </ProvinceAdminShell>
  );
}
