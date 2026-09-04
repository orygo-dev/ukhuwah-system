import Link from "next/link";
import {
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  KeyRound,
  Newspaper,
  School,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BulkStudentAccountActions } from "@/components/school/bulk-student-account-actions";
import { StudentAccountActions } from "@/components/school/student-account-actions";
import { StudentParentAccessActions } from "@/components/school/student-parent-access-actions";
import { getCurrentSchoolAdmin, schoolRegion } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="rounded-[22px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-extrabold text-slate-950">{value}</p>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function SchoolStudentsPage() {
  const { account } = await getCurrentSchoolAdmin("/school/students");
  const shellAccount = {
    accountName: account?.name,
    accountEmail: account?.email,
    schoolName: account?.school?.name,
  };

  if (!account?.schoolId) {
    return (
      <SchoolAdminShell activePath="/school/students" {...shellAccount}>
        <Card className="rounded-[24px] border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <h1 className="text-xl font-extrabold text-amber-950">
              Akun admin sekolah belum terhubung ke sekolah
            </h1>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Hubungkan akun ini ke master data sekolah melalui Super Admin.
            </p>
          </CardContent>
        </Card>
      </SchoolAdminShell>
    );
  }

  const schoolId = account.schoolId;
  const [
    students,
    studentCount,
    classCount,
    activeStudentAccountCount,
    pendingStudentAccountCount,
    activeParentAccessCount,
    attendanceRecordCount,
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
  ] =
    await Promise.all([
      prisma.student.findMany({
        where: { isActive: true, classRoom: { schoolId, isActive: true } },
        orderBy: [{ classRoom: { name: "asc" } }, { name: "asc" }],
        take: 300,
        include: {
          classRoom: {
            select: {
              id: true,
              name: true,
              jenjang: true,
              tahunAjaran: true,
              teacher: { select: { name: true } },
            },
          },
          user: { select: { email: true } },
          _count: {
            select: {
              records: true,
              gradeRecords: true,
              assignmentSubmissions: true,
              quizAttempts: true,
              examAttempts: true,
              studentBoardPosts: true,
              spotlightSubmissions: true,
            },
          },
        },
      }),
      prisma.student.count({
        where: { isActive: true, classRoom: { schoolId, isActive: true } },
      }),
      prisma.classRoom.count({ where: { schoolId, isActive: true } }),
      prisma.student.count({
        where: {
          isActive: true,
          userId: { not: null },
          classRoom: { schoolId, isActive: true },
        },
      }),
      prisma.student.count({
        where: {
          isActive: true,
          userId: null,
          classRoom: { schoolId, isActive: true },
        },
      }),
      prisma.student.count({
        where: {
          isActive: true,
          parentAccessEnabled: true,
          classRoom: { schoolId, isActive: true },
        },
      }),
      prisma.attendanceRecord.count({
        where: { student: { classRoom: { schoolId, isActive: true } } },
      }),
      prisma.gradeRecord.count({
        where: { student: { classRoom: { schoolId, isActive: true } } },
      }),
      prisma.assignment.count({
        where: { status: "PUBLISHED", classRoom: { schoolId, isActive: true } },
      }),
      prisma.assignmentSubmission.count({
        where: { student: { classRoom: { schoolId, isActive: true } } },
      }),
      prisma.quiz.count({
        where: { status: "PUBLISHED", classRoom: { schoolId, isActive: true } },
      }),
      prisma.quizAttempt.count({
        where: { student: { classRoom: { schoolId, isActive: true } } },
      }),
      prisma.exam.count({
        where: { status: "PUBLISHED", classRoom: { schoolId, isActive: true } },
      }),
      prisma.examAttempt.count({
        where: { student: { classRoom: { schoolId, isActive: true } } },
      }),
      prisma.studentBoardPost.count({
        where: { status: "PUBLISHED", classRoom: { schoolId, isActive: true } },
      }),
      prisma.studentBoardPost.count({
        where: {
          status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
          classRoom: { schoolId, isActive: true },
        },
      }),
      prisma.studentSpotlightSubmission.count({
        where: { status: "PUBLISHED", classRoom: { schoolId, isActive: true } },
      }),
      prisma.studentSpotlightSubmission.count({
        where: {
          status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
          classRoom: { schoolId, isActive: true },
        },
      }),
    ]);

  const school = account.school;
  const region = schoolRegion(school);
  const studentsWithoutAccounts = students
    .filter((student) => !student.user)
    .map((student) => ({
      id: student.id,
      name: student.name,
      nis: student.nis,
      className: student.classRoom.name,
    }));
  const defaultDomain =
    school?.npsn && school.npsn.trim()
      ? `siswa-${school.npsn.trim().toLowerCase()}.guruspace.local`
      : null;
  const activatedPercent =
    studentCount > 0 ? Math.round((activeStudentAccountCount / studentCount) * 100) : 0;
  const submittedAssignmentPercent =
    assignmentCount > 0 && studentCount > 0
      ? Math.round((assignmentSubmissionCount / (assignmentCount * studentCount)) * 100)
      : 0;
  const quizParticipationPercent =
    quizCount > 0 && studentCount > 0
      ? Math.round((quizAttemptCount / (quizCount * studentCount)) * 100)
      : 0;
  const examParticipationPercent =
    examCount > 0 && studentCount > 0
      ? Math.round((examAttemptCount / (examCount * studentCount)) * 100)
      : 0;

  return (
    <SchoolAdminShell activePath="/school/students" {...shellAccount}>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_65px_rgba(15,76,129,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge className="bg-emerald-600 text-white">Data Siswa</Badge>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">
                {school?.name || "Sekolah"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Pantau siswa aktif lintas kelas, akun login, tugas, quiz, ujian,
                absensi, nilai, mading, dan Zona Kreasi dari roster sekolah yang sama.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                {school?.npsn ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                    NPSN {school.npsn}
                  </span>
                ) : null}
                {region ? (
                  <span className="rounded-full bg-slate-50 px-3 py-1.5 text-slate-600">
                    {region}
                  </span>
                ) : null}
              </div>
            </div>
            <Button variant="outline" asChild className="rounded-xl border-emerald-100 bg-white">
              <Link href="/school/classes">
                <School className="h-4 w-4" />
                Kelola Kelas
              </Link>
            </Button>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Siswa Aktif"
            value={studentCount}
            icon={GraduationCap}
            tone="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="Kelas Aktif"
            value={classCount}
            icon={School}
            tone="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="Akun Siswa"
            value={activeStudentAccountCount}
            icon={KeyRound}
            tone="bg-amber-50 text-amber-700"
          />
          <StatCard
            label="Belum Login"
            value={pendingStudentAccountCount}
            icon={ClipboardCheck}
            tone="bg-violet-50 text-violet-700"
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
                    {activatedPercent}% akun siswa aktif
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Admin sekolah dapat melihat apakah roster sudah siap dipakai
                    siswa. Akun yang belum aktif bisa dibuat massal dari tombol di
                    bawah ringkasan ini.
                  </p>
                </div>
                <div className="rounded-3xl bg-emerald-50 p-4 text-center">
                  <p className="text-3xl font-black text-emerald-700">
                    {activeStudentAccountCount}/{studentCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-emerald-700">
                    akun tertaut
                  </p>
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400"
                  style={{ width: `${activatedPercent}%` }}
                />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <ActivityMiniCard
                  label="Tugas terkumpul"
                  value={assignmentSubmissionCount}
                  helper={`${assignmentCount} tugas terbit · ${submittedAssignmentPercent}% estimasi partisipasi`}
                  icon={ClipboardList}
                  tone="bg-cyan-50 text-cyan-700"
                />
                <ActivityMiniCard
                  label="Quiz dikerjakan"
                  value={quizAttemptCount}
                  helper={`${quizCount} quiz terbit · ${quizParticipationPercent}% estimasi partisipasi`}
                  icon={FileQuestion}
                  tone="bg-indigo-50 text-indigo-700"
                />
                <ActivityMiniCard
                  label="Ujian dikerjakan"
                  value={examAttemptCount}
                  helper={`${examCount} ujian terbit · ${examParticipationPercent}% estimasi partisipasi`}
                  icon={ShieldCheck}
                  tone="bg-rose-50 text-rose-700"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-emerald-100 bg-white shadow-[0_18px_54px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <p className="text-sm font-extrabold text-emerald-700">
                Karya & Publikasi Siswa
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <ActivityMiniCard
                  label="Mading terbit"
                  value={boardPublishedCount}
                  helper={`${boardPendingCount} menunggu/revisi`}
                  icon={Newspaper}
                  tone="bg-sky-50 text-sky-700"
                />
                <ActivityMiniCard
                  label="Zona Kreasi terbit"
                  value={spotlightPublishedCount}
                  helper={`${spotlightPendingCount} menunggu/revisi`}
                  icon={Clapperboard}
                  tone="bg-fuchsia-50 text-fuchsia-700"
                />
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-900">
                Konten siswa tetap memakai alur review guru. Admin sekolah melihat
                ringkasan status, bukan mengambil alih proses moderasi guru.
              </div>
            </CardContent>
          </Card>
        </div>

        <BulkStudentAccountActions
          students={studentsWithoutAccounts}
          defaultDomain={defaultDomain}
        />

        <Card className="overflow-hidden rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
          <CardHeader className="border-b border-blue-50 bg-slate-50/70 px-5 py-4">
            <CardTitle className="text-base font-extrabold text-slate-950">
              Daftar Siswa Aktif
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {students.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-950">Belum ada siswa</p>
                <p className="mt-1 text-sm text-slate-500">
                  Buka menu Kelas untuk membuat kelas dan mengisi roster siswa.
                </p>
                <Button variant="brand" asChild className="mt-4 rounded-xl">
                  <Link href="/school/classes">Kelola Kelas</Link>
                </Button>
              </div>
            ) : (
              <>
                {studentCount > students.length ? (
                  <div className="border-b border-blue-50 bg-emerald-50/60 px-5 py-3 text-xs font-semibold text-emerald-800">
                    Menampilkan 300 siswa pertama dari total {studentCount} siswa aktif.
                  </div>
                ) : null}
                <table className="w-full min-w-[1120px] text-sm">
                  <thead>
                    <tr className="border-b bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-bold">Siswa</th>
                      <th className="px-5 py-3 font-bold">Kelas</th>
                      <th className="px-5 py-3 font-bold">Pengelola</th>
                      <th className="px-5 py-3 font-bold">Akun Siswa</th>
                      <th className="px-5 py-3 font-bold">Aktivitas Siswa</th>
                      <th className="px-5 py-3 font-bold">Akses Orang Tua</th>
                      <th className="px-5 py-3 font-bold">Absensi</th>
                      <th className="px-5 py-3 font-bold">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b last:border-0">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-950">{student.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {student.nis ? `NIS ${student.nis}` : "NIS belum diisi"}
                            {student.gender ? ` · ${student.gender}` : ""}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-950">
                            {student.classRoom.name}
                          </span>
                          <p className="mt-1 text-xs text-slate-500">
                            {student.classRoom.jenjang.toUpperCase()} ·{" "}
                            {student.classRoom.tahunAjaran}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {student.classRoom.teacher.name}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <StudentAccountActions
                            studentId={student.id}
                            studentName={student.name}
                            hasAccount={Boolean(student.user)}
                            accountEmail={student.user?.email}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <div className="grid min-w-[210px] grid-cols-3 gap-2 text-center text-xs">
                            <StudentActivityPill
                              label="Tugas"
                              value={student._count.assignmentSubmissions}
                            />
                            <StudentActivityPill
                              label="Quiz"
                              value={student._count.quizAttempts}
                            />
                            <StudentActivityPill
                              label="Ujian"
                              value={student._count.examAttempts}
                            />
                            <StudentActivityPill
                              label="Mading"
                              value={student._count.studentBoardPosts}
                            />
                            <StudentActivityPill
                              label="Zona Kreasi"
                              value={student._count.spotlightSubmissions}
                            />
                            <StudentActivityPill
                              label="Total"
                              value={
                                student._count.assignmentSubmissions +
                                student._count.quizAttempts +
                                student._count.examAttempts +
                                student._count.studentBoardPosts +
                                student._count.spotlightSubmissions
                              }
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StudentParentAccessActions
                            studentId={student.id}
                            studentName={student.name}
                            enabled={student.parentAccessEnabled}
                          />
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {student._count.records}
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {student._count.gradeRecords}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-extrabold text-slate-950">Ringkasan aktivitas siswa</p>
              <p className="mt-1 text-sm text-slate-500">
                Total {attendanceRecordCount} catatan absensi dan {gradeRecordCount} rekam
                nilai tersimpan untuk siswa aktif sekolah ini. Tugas terkumpul:
                {" "}
                {assignmentSubmissionCount}, quiz dikerjakan: {quizAttemptCount},
                ujian dikerjakan: {examAttemptCount}, akses orang tua aktif:
                {" "}
                {activeParentAccessCount}.
              </p>
            </div>
            <Button variant="outline" asChild className="rounded-xl border-emerald-100 bg-white">
              <Link href="/school">Buka Ringkasan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </SchoolAdminShell>
  );
}

function ActivityMiniCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-50 bg-slate-50/70 p-4">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="text-xs font-extrabold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function StudentActivityPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 ring-1 ring-blue-50">
      <p className="font-black text-slate-950">{value}</p>
      <p className="mt-0.5 font-bold text-slate-500">{label}</p>
    </div>
  );
}
