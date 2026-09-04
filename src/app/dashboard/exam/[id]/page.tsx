import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, Trophy, UserRound } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { formatDateId } from "@/lib/attendance";
import { isSchoolStaffRole } from "@/lib/api-role-guard";
import { prisma } from "@/lib/prisma";
import { isTeacherProfileComplete } from "@/lib/teacher-profile";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function formatScore(score?: number | null) {
  if (score === null || score === undefined) return "-";
  return Number(score.toFixed(1));
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function ExamDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/exam");
  }
  if (!isSchoolStaffRole(session.user.role)) {
    redirect("/dashboard");
  }
  if (session.user.role === "TEACHER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, nip: true, phone: true, profileDefaults: true },
    });
    if (user && !isTeacherProfileComplete(user)) {
      redirect("/dashboard/profil?required=1&from=exam");
    }
  }

  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      classRoom: {
        include: {
          students: {
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, nis: true },
          },
        },
      },
      teacher: { select: { id: true, name: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, prompt: true, options: true, correctOptionIndex: true, explanation: true },
      },
      attempts: {
        orderBy: { submittedAt: "desc" },
        include: {
          student: { select: { id: true, name: true, nis: true } },
          answers: { include: { question: { select: { id: true, prompt: true } } } },
        },
      },
    },
  });
  if (!exam) {
    redirect("/dashboard/exam");
  }
  const room = await getClassRoomForUser(exam.classRoomId, session.user);
  if (!room) {
    redirect("/dashboard/exam");
  }

  const attemptsByStudent = new Map(exam.attempts.map((attempt) => [attempt.studentId, attempt]));
  const attemptedCount = exam.attempts.length;
  const totalStudents = exam.classRoom.students.length;
  const averageScore =
    attemptedCount > 0
      ? exam.attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attemptedCount
      : null;

  return (
    <DashboardShell activePath="/dashboard/exam">
      <div className="space-y-6">
        <Button variant="ghost" asChild className="-ml-3 rounded-2xl">
          <Link href="/dashboard/exam">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Ujian
          </Link>
        </Button>

        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_22px_60px_rgba(15,76,129,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 lg:p-7">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  {exam.classRoom.name}
                </Badge>
                <Badge variant="outline">{exam.questions.length} soal</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                {exam.title}
              </h1>
              <p className="mt-1 text-sm font-semibold text-emerald-700">{exam.mapel}</p>
              {exam.instructions ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
                  {exam.instructions}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 border-t border-blue-50 bg-emerald-50/60 p-5 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:p-6">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <UserRound className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-2xl font-black text-slate-950">{totalStudents}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Siswa</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-2xl font-black text-slate-950">{attemptedCount}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Mengerjakan</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <Trophy className="mb-3 h-5 w-5 text-amber-600" />
                <p className="text-2xl font-black text-slate-950">
                  {formatScore(averageScore)}
                </p>
                <p className="text-xs font-bold uppercase text-slate-500">Rata-rata</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm sm:col-span-3">
                <CalendarClock className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-sm font-bold text-slate-950">
                  {formatDateTime(exam.startAt)} - {formatDateTime(exam.endAt)}
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-500">
                  Durasi {exam.durationMinutes} menit
                </p>
              </div>
            </div>
          </div>
        </section>

        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
          <CardHeader>
            <CardTitle className="text-base font-extrabold text-slate-950">
              Rekap Pengerjaan Siswa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exam.classRoom.students.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Kelas ini belum memiliki siswa aktif.
              </div>
            ) : (
              <div className="space-y-3">
                {exam.classRoom.students.map((student) => {
                  const attempt = attemptsByStudent.get(student.id);
                  return (
                    <div
                      key={student.id}
                      className="rounded-2xl border border-blue-50 bg-slate-50/70 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {attempt ? (
                              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                Sudah mengerjakan
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Belum mengerjakan</Badge>
                            )}
                            {student.nis ? <Badge variant="outline">NIS {student.nis}</Badge> : null}
                          </div>
                          <p className="mt-3 font-black text-slate-950">{student.name}</p>
                          {attempt ? (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Dikerjakan {formatDateId(attempt.submittedAt)}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">
                              Hasil ujian siswa belum masuk.
                            </p>
                          )}
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 text-right">
                          <p className="text-2xl font-black text-emerald-700">
                            {attempt ? formatScore(attempt.score) : "-"}
                          </p>
                          <p className="text-xs font-bold text-slate-500">
                            {attempt
                              ? `${attempt.correctCount}/${attempt.totalQuestions} benar`
                              : "Nilai"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
          <CardHeader>
            <CardTitle className="text-base font-extrabold text-slate-950">
              Kunci Jawaban
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {exam.questions.map((question, index) => {
              const options = Array.isArray(question.options)
                ? question.options.map((option) => String(option))
                : [];
              return (
                <div key={question.id} className="rounded-2xl border border-blue-50 bg-slate-50/70 p-4">
                  <div className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-600 text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line text-sm font-bold leading-6 text-slate-950">
                        {question.prompt}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-emerald-700">
                        Jawaban: {String.fromCharCode(65 + question.correctOptionIndex)}.{" "}
                        {options[question.correctOptionIndex] || "-"}
                      </p>
                      {question.explanation ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {question.explanation}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

