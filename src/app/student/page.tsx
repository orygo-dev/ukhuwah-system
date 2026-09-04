import Link from "next/link";
import {
  BookOpenCheck,
  CalendarCheck2,
  Clapperboard,
  ClipboardList,
  FileQuestion,
  Newspaper,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentStudent, formatStudentDate, studentSchoolVisibilityWhere } from "@/lib/student-portal";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-extrabold text-slate-950">{value}</p>
          <p className="text-xs font-extrabold uppercase text-slate-500">{label}</p>
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  label,
  helper,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className="group rounded-[24px] border border-emerald-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,76,129,0.06)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_18px_44px_rgba(15,76,129,0.1)]"
    >
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 font-black text-slate-950">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{helper}</p>
    </Link>
  );
}

export default async function StudentPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const school = student.classRoom.school;
  const visibilityWhere = studentSchoolVisibilityWhere(student);
  const [assignments, quizzes, exams, boardPosts, spotlights, latestScores] =
    await Promise.all([
      prisma.assignment.findMany({
        where: { classRoomId: student.classRoomId, status: "PUBLISHED" },
        take: 3,
        orderBy: [{ dueAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        include: {
          teacher: { select: { name: true } },
          submissions: {
            where: { studentId: student.id },
            take: 1,
            select: { status: true },
          },
        },
      }),
      prisma.quiz.findMany({
        where: { classRoomId: student.classRoomId, status: "PUBLISHED" },
        take: 3,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { questions: true } },
          attempts: { where: { studentId: student.id }, take: 1, select: { score: true } },
        },
      }),
      prisma.exam.findMany({
        where: { classRoomId: student.classRoomId, status: "PUBLISHED" },
        take: 3,
        orderBy: { startAt: "desc" },
        include: {
          _count: { select: { questions: true } },
          attempts: { where: { studentId: student.id }, take: 1, select: { score: true } },
        },
      }),
      prisma.studentBoardPost.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            { visibility: "GLOBAL" },
            { visibility: "CLASS", classRoomId: student.classRoomId },
            visibilityWhere,
          ],
        },
        take: 3,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        include: { student: { select: { name: true } }, author: { select: { name: true } } },
      }),
      prisma.studentSpotlightSubmission.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            { visibility: "GLOBAL" },
            { visibility: "CLASS", classRoomId: student.classRoomId },
            visibilityWhere,
          ],
        },
        take: 3,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        include: { student: { select: { name: true } } },
      }),
      prisma.gradeRecord.findMany({
        where: { studentId: student.id },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: { assessment: { select: { title: true, mapel: true, maxScore: true } } },
      }),
    ]);

  const region = [
    school?.regency?.name || school?.city,
    school?.regency?.province?.name || school?.province,
  ]
    .filter(Boolean)
    .join(", ");
  const completedAssignments = assignments.filter((item) => item.submissions.length > 0).length;
  const completedQuizzes = quizzes.filter((item) => item.attempts.length > 0).length;
  const completedExams = exams.filter((item) => item.attempts.length > 0).length;
  const scored = latestScores.filter((item) => item.score !== null);
  const average =
    scored.length > 0
      ? scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length
      : null;

  const quickActions = [
    {
      href: "/student/tugas",
      label: "Tugas / PR",
      helper: "Lihat dan kumpulkan tugas kelas.",
      icon: ClipboardList,
      tone: "bg-cyan-50 text-cyan-700",
    },
    {
      href: "/student/quiz",
      label: "Quiz",
      helper: "Kerjakan quiz harian dari guru.",
      icon: FileQuestion,
      tone: "bg-indigo-50 text-indigo-700",
    },
    {
      href: "/student/exam",
      label: "Ujian",
      helper: "Cek jadwal dan kerjakan ujian online.",
      icon: ShieldCheck,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      href: "/student/mading",
      label: "Mading",
      helper: "Baca mading dan kirim karya tulis.",
      icon: Newspaper,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      href: "/student/spotlight",
      label: "Zona Kreasi",
      helper: "Lihat dan kirim video karya siswa.",
      icon: Clapperboard,
      tone: "bg-fuchsia-50 text-fuchsia-700",
    },
    {
      href: "/student/nilai",
      label: "Nilai",
      helper: "Pantau nilai terbaru dan rata-rata.",
      icon: BookOpenCheck,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      href: "/student/absensi",
      label: "Absensi",
      helper: "Lihat riwayat kehadiran kelas.",
      icon: CalendarCheck2,
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <StudentShell>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(15,76,129,0.09)]">
          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="p-6 lg:p-8">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Portal Siswa</Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">
                Halo, {student.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Semua aktivitas kelas ada di satu tempat: tugas, quiz, ujian,
                mading, Zona Kreasi, absensi, dan nilai.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  {student.classRoom.name}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  {student.classRoom.jenjang.toUpperCase()}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                  TA {student.classRoom.tahunAjaran}
                </span>
              </div>
            </div>
            <div className="border-t border-blue-50 bg-gradient-to-br from-emerald-600 to-teal-400 p-6 text-white lg:border-l lg:border-t-0 lg:p-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/70">
                Sekolah
              </p>
              <h2 className="mt-3 text-2xl font-black leading-tight">
                {school?.name || "Sekolah belum terhubung"}
              </h2>
              {region ? <p className="mt-2 text-sm text-white/80">{region}</p> : null}
              <div className="mt-6 rounded-3xl bg-white/15 p-4 backdrop-blur">
                <p className="text-sm font-bold">Wali/Guru Pengelola</p>
                <p className="mt-1 text-lg font-black">{student.classRoom.teacher.name}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Tugas"
            value={assignments.length}
            helper={`${completedAssignments} sudah dikumpulkan`}
            icon={ClipboardList}
            tone="bg-cyan-50 text-cyan-700"
          />
          <StatCard
            label="Quiz"
            value={quizzes.length}
            helper={`${completedQuizzes} sudah dikerjakan`}
            icon={FileQuestion}
            tone="bg-indigo-50 text-indigo-700"
          />
          <StatCard
            label="Ujian"
            value={exams.length}
            helper={`${completedExams} sudah dikerjakan`}
            icon={ShieldCheck}
            tone="bg-rose-50 text-rose-700"
          />
          <StatCard
            label="Rata-rata"
            value={average !== null ? Number(average.toFixed(1)) : "-"}
            helper={average !== null ? "Dari nilai terbaru" : "Belum ada nilai"}
            icon={TrendingUp}
            tone="bg-emerald-50 text-emerald-700"
          />
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((item) => (
            <QuickAction key={item.href} {...item} />
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-black text-slate-950">Aktivitas Belajar</h2>
                <Link href="/student/tugas" className="text-xs font-extrabold text-emerald-700">
                  Lihat semua
                </Link>
              </div>
              <div className="space-y-3">
                {[...assignments, ...quizzes, ...exams].slice(0, 5).map((item) => (
                  <Link
                    key={`${"dueDate" in item ? "tugas" : "startAt" in item ? "exam" : "quiz"}-${item.id}`}
                    href={
                      "dueDate" in item
                        ? `/student/tugas/${item.id}`
                        : "startAt" in item
                          ? `/student/exam/${item.id}`
                          : `/student/quiz/${item.id}`
                    }
                    className="block rounded-2xl border border-blue-50 bg-slate-50/70 p-3 transition hover:border-emerald-200 hover:bg-white"
                  >
                    <p className="line-clamp-1 font-bold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {"mapel" in item ? item.mapel : "Aktivitas"}
                    </p>
                  </Link>
                ))}
                {assignments.length + quizzes.length + exams.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    Belum ada tugas, quiz, atau ujian.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-black text-slate-950">Mading Terbaru</h2>
                <Link href="/student/mading" className="text-xs font-extrabold text-emerald-700">
                  Buka
                </Link>
              </div>
              <div className="space-y-3">
                {boardPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/student/mading/${post.id}`}
                    className="block rounded-2xl border border-blue-50 bg-slate-50/70 p-3 transition hover:border-emerald-200 hover:bg-white"
                  >
                    <Badge className="bg-sky-50 text-sky-700 hover:bg-sky-50">
                      {post.category}
                    </Badge>
                    <p className="mt-2 line-clamp-1 font-bold text-slate-950">{post.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {post.student?.name || post.author?.name || "Guru"} ·{" "}
                      {formatStudentDate(post.publishedAt || post.createdAt)}
                    </p>
                  </Link>
                ))}
                {boardPosts.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    Belum ada mading terbit.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-black text-slate-950">Zona Kreasi</h2>
                <Link href="/student/spotlight" className="text-xs font-extrabold text-emerald-700">
                  Buka
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {spotlights.map((item) => (
                  <Link
                    key={item.id}
                    href="/student/spotlight"
                    className="overflow-hidden rounded-2xl bg-slate-950"
                  >
                    <video
                      src={item.videoUrl}
                      poster={item.thumbnailUrl || undefined}
                      preload="metadata"
                      muted
                      playsInline
                      className="aspect-[9/14] w-full object-cover"
                    />
                  </Link>
                ))}
              </div>
              {spotlights.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Belum ada Zona Kreasi siswa terbit.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </StudentShell>
  );
}
