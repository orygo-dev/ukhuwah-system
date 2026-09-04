import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clapperboard,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  Newspaper,
  School,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentSchoolAdmin, schoolRegion } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="rounded-[22px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-extrabold text-slate-950">{value}</p>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkCard({
  title,
  description,
  href,
  button,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  href: string;
  button: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
      <CardContent className="p-5">
        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 font-extrabold text-slate-950">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <Button variant="outline" asChild className="mt-4 rounded-xl border-emerald-100">
          <Link href={href}>{button}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ReviewCard({
  label,
  published,
  pending,
  icon: Icon,
  tone,
}: {
  label: string;
  published: number;
  pending: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-50 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <Badge className={pending > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}>
          {pending > 0 ? `${pending} review` : "Aman"}
        </Badge>
      </div>
      <p className="mt-4 text-2xl font-black text-slate-950">{published}</p>
      <p className="text-xs font-extrabold uppercase text-slate-500">{label} terbit</p>
    </div>
  );
}

export default async function SchoolDashboardPage() {
  const { account } = await getCurrentSchoolAdmin("/school");
  const shellAccount = {
    accountName: account?.name,
    accountEmail: account?.email,
    schoolName: account?.school?.name,
  };

  if (!account?.schoolId) {
    return (
      <SchoolAdminShell activePath="/school" {...shellAccount}>
        <Card className="rounded-[24px] border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <h1 className="text-xl font-extrabold text-amber-950">
              Akun admin sekolah belum terhubung ke sekolah
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900">
              Hubungkan akun ini ke master data sekolah melalui Super Admin agar
              admin sekolah bisa mengelola kelas dan siswa dalam scope sekolah.
            </p>
          </CardContent>
        </Card>
      </SchoolAdminShell>
    );
  }

  const schoolId = account.schoolId;
  const [
    teacherCount,
    classCount,
    studentCount,
    studentAccountCount,
    recentClasses,
    sessionCount,
    gradeRecordCount,
    assignmentCount,
    assignmentSubmissionCount,
    quizCount,
    quizAttemptCount,
    examCount,
    examAttemptCount,
    boardPublishedCount,
    boardPendingCount,
    spotlightPublishedCount,
    spotlightPendingCount,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "TEACHER", schoolId } }),
    prisma.classRoom.count({ where: { schoolId, isActive: true } }),
    prisma.student.count({
      where: { isActive: true, classRoom: { schoolId, isActive: true } },
    }),
    prisma.student.count({
      where: {
        isActive: true,
        userId: { not: null },
        classRoom: { schoolId, isActive: true },
      },
    }),
    prisma.classRoom.findMany({
      where: { schoolId, isActive: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        teacher: { select: { name: true } },
        _count: {
          select: {
            students: { where: { isActive: true } },
            sessions: true,
            assignments: true,
            quizzes: true,
            exams: true,
          },
        },
      },
    }),
    prisma.attendanceSession.count({ where: { classRoom: { schoolId, isActive: true } } }),
    prisma.gradeRecord.count({
      where: { student: { classRoom: { schoolId, isActive: true } } },
    }),
    prisma.assignment.count({
      where: { classRoom: { schoolId, isActive: true }, status: "PUBLISHED" },
    }),
    prisma.assignmentSubmission.count({
      where: { student: { classRoom: { schoolId, isActive: true } } },
    }),
    prisma.quiz.count({
      where: { classRoom: { schoolId, isActive: true }, status: "PUBLISHED" },
    }),
    prisma.quizAttempt.count({
      where: { student: { classRoom: { schoolId, isActive: true } } },
    }),
    prisma.exam.count({
      where: { classRoom: { schoolId, isActive: true }, status: "PUBLISHED" },
    }),
    prisma.examAttempt.count({
      where: { student: { classRoom: { schoolId, isActive: true } } },
    }),
    prisma.studentBoardPost.count({
      where: { classRoom: { schoolId, isActive: true }, status: "PUBLISHED" },
    }),
    prisma.studentBoardPost.count({
      where: {
        classRoom: { schoolId, isActive: true },
        status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
      },
    }),
    prisma.studentSpotlightSubmission.count({
      where: { classRoom: { schoolId, isActive: true }, status: "PUBLISHED" },
    }),
    prisma.studentSpotlightSubmission.count({
      where: {
        classRoom: { schoolId, isActive: true },
        status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
      },
    }),
  ]);

  const school = account.school;
  const region = schoolRegion(school);
  const accountReadiness =
    studentCount > 0 ? Math.round((studentAccountCount / studentCount) * 100) : 0;
  const learningActivityTotal =
    assignmentSubmissionCount + quizAttemptCount + examAttemptCount;

  return (
    <SchoolAdminShell activePath="/school" {...shellAccount}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_20px_65px_rgba(15,76,129,0.08)]">
          <div className="grid gap-6 bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_58%,#eaf3ff_100%)] p-6 lg:grid-cols-[1fr_auto] lg:p-8">
            <div>
              <Badge className="bg-emerald-600 text-white">Admin Sekolah</Badge>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">
                {school?.name || "Sekolah"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Pantau operasional sekolah dari satu ringkasan: guru, kelas,
                siswa, akun login siswa, aktivitas belajar, absensi, nilai,
                mading, dan spotlight.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                {school?.npsn ? (
                  <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-blue-100">
                    NPSN {school.npsn}
                  </span>
                ) : null}
                {school?.level ? (
                  <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-blue-100">
                    {school.level}
                  </span>
                ) : null}
                {region ? (
                  <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-blue-100">
                    {region}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-start lg:justify-end">
              <Button variant="brand" asChild className="rounded-xl">
                <Link href="/school/classes">
                  <GraduationCap className="h-4 w-4" />
                  Kelola Kelas
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Guru"
            value={teacherCount}
            helper="Akun guru terhubung"
            icon={Users}
            tone="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="Kelas"
            value={classCount}
            helper="Roster aktif sekolah"
            icon={School}
            tone="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="Siswa"
            value={studentCount}
            helper={`${accountReadiness}% akun login siap`}
            icon={GraduationCap}
            tone="bg-violet-50 text-violet-700"
          />
          <StatCard
            label="Absensi"
            value={sessionCount}
            helper="Sesi tercatat"
            icon={CalendarCheck}
            tone="bg-amber-50 text-amber-700"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-[26px] border-emerald-100 bg-white shadow-[0_18px_54px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-extrabold text-emerald-700">
                    Kesiapan Portal Siswa
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    {studentAccountCount}/{studentCount} akun siswa aktif
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Portal siswa memakai roster kelas sekolah. Semakin banyak akun
                    tertaut, semakin siap siswa mengakses tugas, quiz, ujian,
                    nilai, absensi, mading, dan spotlight.
                  </p>
                </div>
                <Badge className="bg-emerald-50 px-4 py-2 text-emerald-700 hover:bg-emerald-50">
                  {accountReadiness}% siap
                </Badge>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400"
                  style={{ width: `${accountReadiness}%` }}
                />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <StatCard
                  label="Tugas"
                  value={assignmentSubmissionCount}
                  helper={`${assignmentCount} tugas terbit`}
                  icon={ClipboardCheck}
                  tone="bg-cyan-50 text-cyan-700"
                />
                <StatCard
                  label="Quiz"
                  value={quizAttemptCount}
                  helper={`${quizCount} quiz terbit`}
                  icon={FileQuestion}
                  tone="bg-indigo-50 text-indigo-700"
                />
                <StatCard
                  label="Ujian"
                  value={examAttemptCount}
                  helper={`${examCount} ujian terbit`}
                  icon={ShieldCheck}
                  tone="bg-rose-50 text-rose-700"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-emerald-100 bg-white shadow-[0_18px_54px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <p className="text-sm font-extrabold text-emerald-700">
                Publikasi Siswa
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <ReviewCard
                  label="Mading"
                  published={boardPublishedCount}
                  pending={boardPendingCount}
                  icon={Newspaper}
                  tone="bg-sky-50 text-sky-700"
                />
                <ReviewCard
                  label="Zona Kreasi"
                  published={spotlightPublishedCount}
                  pending={spotlightPendingCount}
                  icon={Clapperboard}
                  tone="bg-fuchsia-50 text-fuchsia-700"
                />
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-900">
                Ringkasan ini membantu admin sekolah melihat kesehatan publikasi
                siswa. Review konten tetap berjalan melalui guru pengelola.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <WorkCard
            title="Data Kelas"
            description="Kelola roster resmi sekolah, guru pengelola, dan siswa aktif yang dipakai seluruh aktivitas."
            href="/school/classes"
            button="Kelola kelas"
            icon={School}
            tone="bg-emerald-50 text-emerald-700"
          />
          <WorkCard
            title="Aktivitas Siswa"
            description="Pantau akun siswa, tugas, quiz, ujian, absensi, nilai, mading, dan Zona Kreasi per siswa."
            href="/school/students"
            button="Lihat siswa"
            icon={CheckCircle2}
            tone="bg-emerald-50 text-emerald-700"
          />
          <WorkCard
            title="Guru Terhubung"
            description="Cek guru yang terhubung ke sekolah dan kelas yang sedang dikelola."
            href="/school/teachers"
            button="Lihat guru"
            icon={Users}
            tone="bg-violet-50 text-violet-700"
          />
        </div>

        <Card className="overflow-hidden rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-blue-50 bg-slate-50/70 px-5 py-4">
              <div>
                <h2 className="font-extrabold text-slate-950">Kelas Terbaru</h2>
                <p className="text-xs text-slate-500">
                  Roster ini menjadi sumber data guru, siswa, dan portal siswa.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="rounded-xl">
                <Link href="/school/classes">Kelola kelas</Link>
              </Button>
            </div>
            {recentClasses.length === 0 ? (
              <div className="p-8 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-950">Belum ada kelas</p>
                <p className="mt-1 text-sm text-slate-500">
                  Buka menu Kelas untuk membuat kelas sekolah dan menghubungkan
                  guru pengelola.
                </p>
                <Button variant="brand" asChild className="mt-4 rounded-xl">
                  <Link href="/school/classes">Tambah Kelas</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-blue-50">
                {recentClasses.map((classRoom) => (
                  <div
                    key={classRoom.id}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-bold text-slate-950">
                        Kelas {classRoom.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {classRoom.jenjang.toUpperCase()} · {classRoom.tahunAjaran} ·
                        Pengelola {classRoom.teacher.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                        {classRoom._count.students} siswa
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                        {classRoom._count.sessions} absensi
                      </span>
                      <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-700">
                        {classRoom._count.assignments +
                          classRoom._count.quizzes +
                          classRoom._count.exams} aktivitas
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-extrabold text-slate-950">Ringkasan operasional</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Total aktivitas belajar siswa: {learningActivityTotal}. Rekam
                nilai tersimpan: {gradeRecordCount}. Konten menunggu review:
                {" "}
                {boardPendingCount + spotlightPendingCount}.
              </p>
            </div>
            <Button variant="outline" asChild className="rounded-xl border-emerald-100 bg-white">
              <Link href="/school/students">Buka Monitoring Siswa</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </SchoolAdminShell>
  );
}
