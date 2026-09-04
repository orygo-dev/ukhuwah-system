import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, FileText, UserRound } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AssignmentGradingForm } from "@/components/assignments/assignment-grading-form";
import { AssignmentLifecycleActions } from "@/components/assignments/assignment-lifecycle-actions";
import { AssignmentExportButton } from "@/components/assignments/assignment-export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { formatAssignmentDueAt, effectiveAssignmentDueAt } from "@/lib/assignment-time";
import { normalizeAssignmentOptions } from "@/lib/assignment-engine";
import { formatDateId } from "@/lib/attendance";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { isSchoolStaffRole } from "@/lib/api-role-guard";
import { prisma } from "@/lib/prisma";
import { isTeacherProfileComplete } from "@/lib/teacher-profile";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function submissionBadge(status?: string) {
  if (status === "GRADED") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        Sudah dinilai
      </Badge>
    );
  }
  if (status === "LATE") {
    return (
      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">
        Terlambat
      </Badge>
    );
  }
  if (status === "SUBMITTED") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        Sudah dikumpulkan
      </Badge>
    );
  }
  if (status === "RETURNED") return <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50">Perlu revisi</Badge>;
  return <Badge variant="secondary">Belum mengumpulkan</Badge>;
}

function formatStructuredResponse(type: string, options: unknown, response: unknown) {
  if (type === "SINGLE_CHOICE" || type === "TRUE_FALSE") {
    const values = normalizeAssignmentOptions(options).map((option) => option.text || "[Gambar]");
    return values[Number(response)] ?? String(response ?? "-");
  }
  if (type === "MULTIPLE_CHOICE") {
    const values = normalizeAssignmentOptions(options).map((option) => option.text || "[Gambar]");
    return (Array.isArray(response) ? response : []).map((index) => values[Number(index)] ?? String(index)).join(", ") || "-";
  }
  return String(response ?? "-");
}

export default async function TugasDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/tugas");
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
      redirect("/dashboard/profil?required=1&from=tugas");
    }
  }

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
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
      questions: { orderBy: { sortOrder: "asc" } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        include: {
          student: { select: { id: true, name: true, nis: true } },
          answers: { include: { question: true }, orderBy: { question: { sortOrder: "asc" } } },
        },
      },
    },
  });
  if (!assignment) {
    redirect("/dashboard/tugas");
  }
  const room = await getClassRoomForUser(assignment.classRoomId, session.user);
  if (!room) {
    redirect("/dashboard/tugas");
  }

  const submissionsByStudent = new Map(
    assignment.submissions.map((submission) => [submission.studentId, submission])
  );
  const submittedCount = assignment.submissions.length;
  const totalStudents = assignment.classRoom.students.length;
  const lateCount = assignment.submissions.filter((item) => item.status === "LATE").length;
  const gradedCount = assignment.submissions.filter((item) => item.status === "GRADED").length;
  const gradedScores = assignment.submissions.flatMap((item) => item.status === "GRADED" && item.score !== null ? [item.score] : []);
  const averageScore = gradedScores.length ? Math.round((gradedScores.reduce((sum, score) => sum + score, 0) / gradedScores.length) * 10) / 10 : null;
  const canGrade =
    session.user.role === "SUPER_ADMIN" || assignment.teacher.id === session.user.id;

  return (
    <DashboardShell activePath="/dashboard/tugas">
      <div className="space-y-6">
        <Button variant="ghost" asChild className="-ml-3 rounded-2xl">
          <Link href="/dashboard/tugas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Tugas
          </Link>
        </Button>
        {canGrade ? <AssignmentLifecycleActions assignmentId={assignment.id} status={assignment.status} hasSubmissions={submittedCount > 0} submissionClosed={Boolean(assignment.submissionClosedAt)} /> : null}
        <div className="flex flex-wrap items-center gap-3">
          <AssignmentExportButton
            title={assignment.title}
            rows={assignment.classRoom.students.map((student) => {
              const submission = submissionsByStudent.get(student.id);
              return { nis: student.nis, name: student.name, status: submission?.status ?? "BELUM_MENGUMPULKAN", submittedAt: submission?.submittedAt.toISOString() ?? null, score: submission?.score ?? null, feedback: submission?.feedback ?? null };
            })}
          />
          <Badge variant="outline">Rata-rata: {averageScore ?? "-"} / {assignment.maxScore}</Badge>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_22px_60px_rgba(15,76,129,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 lg:p-7">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  {assignment.classRoom.name}
                </Badge>
                <Badge variant="outline">
                  {effectiveAssignmentDueAt(assignment)
                    ? `Deadline ${formatAssignmentDueAt(effectiveAssignmentDueAt(assignment))}`
                    : "Tanpa deadline"}
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                {assignment.title}
              </h1>
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                {assignment.mapel}
              </p>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
                {assignment.description}
              </p>
              {assignment.mode === "QUESTION_SET" ? (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <p className="text-sm font-black text-emerald-950">{assignment.questions.length} soal · {assignment.maxScore} poin</p>
                  <ol className="mt-3 space-y-2 text-sm text-slate-700">
                    {assignment.questions.map((question, index) => <li key={question.id}><span className="font-black">{index + 1}.</span> {question.prompt} <span className="text-xs font-bold text-emerald-700">({question.points} poin)</span></li>)}
                  </ol>
                </div>
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
                <p className="text-2xl font-black text-slate-950">{submittedCount}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Terkumpul</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <Clock3 className="mb-3 h-5 w-5 text-amber-600" />
                <p className="text-2xl font-black text-slate-950">{lateCount}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Terlambat</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm sm:col-span-3">
                <p className="text-sm font-bold text-slate-600">Sudah dinilai</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: totalStudents
                        ? `${Math.round((gradedCount / totalStudents) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {gradedCount} dari {totalStudents} siswa
                </p>
              </div>
            </div>
          </div>
        </section>

        {assignment.mode === "QUESTION_SET" && submittedCount > 0 ? (
          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardHeader><CardTitle className="text-base font-extrabold text-slate-950">Analisis Per Soal</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {assignment.questions.map((question, index) => {
                const answers = assignment.submissions.flatMap((submission) => submission.answers.filter((answer) => answer.questionId === question.id));
                const scored = answers.filter((answer) => answer.score !== null);
                const average = scored.length ? Math.round((scored.reduce((sum, answer) => sum + Number(answer.score), 0) / scored.length) * 10) / 10 : null;
                return <div key={question.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-black text-slate-900">{index + 1}. {question.prompt}</p><Badge variant="outline">Rata-rata {average ?? "-"} / {question.points}</Badge></div><p className="mt-2 text-xs font-semibold text-slate-500">{answers.length} jawaban · {question.type === "ESSAY" ? `${answers.filter((answer) => answer.score === null).length} perlu koreksi manual` : `${answers.filter((answer) => Number(answer.score) === question.points).length} benar`}</p></div>;
              })}
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
          <CardHeader>
            <CardTitle className="text-base font-extrabold text-slate-950">
              Monitoring Pengumpulan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canGrade ? (
              <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-900">
                Tugas ini dibuat oleh {assignment.teacher.name || "guru lain"} di sekolah
                Anda. Anda dapat melihat rekap pengumpulan, tetapi penilaian hanya dapat
                diubah oleh pembuat tugas.
              </div>
            ) : null}
            {assignment.classRoom.students.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Kelas ini belum memiliki siswa aktif.
              </div>
            ) : (
              <div className="space-y-3">
                {assignment.classRoom.students.map((student) => {
                  const submission = submissionsByStudent.get(student.id);
                  return (
                    <div
                      key={student.id}
                      className="rounded-2xl border border-blue-50 bg-slate-50/70 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {submissionBadge(submission?.status)}
                            {student.nis ? (
                              <Badge variant="outline">NIS {student.nis}</Badge>
                            ) : null}
                          </div>
                          <p className="mt-3 font-black text-slate-950">{student.name}</p>
                          {submission ? (
                            <>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                Dikumpulkan {formatDateId(submission.submittedAt)}
                              </p>
                              {assignment.mode === "QUESTION_SET" ? (
                                <div className="mt-3 space-y-2 rounded-2xl bg-white p-4">
                                  {submission.answers.map((answer, answerIndex) => (
                                    <div key={answer.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                      <p className="text-xs font-black text-slate-700">{answerIndex + 1}. {answer.question.prompt}</p>
                                      <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{formatStructuredResponse(answer.question.type, answer.question.options, answer.response)}</p>
                                      <p className="mt-1 text-[11px] font-bold text-emerald-700">Nilai otomatis: {answer.score ?? "Perlu dinilai"} / {answer.question.points}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 whitespace-pre-line rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600">{submission.answer}</p>
                              )}
                              {submission.score !== null || submission.feedback ? (
                                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                  <p className="text-sm font-black text-emerald-900">
                                    Nilai: {submission.score ?? "-"} / {assignment.maxScore}
                                  </p>
                                  {submission.feedback ? (
                                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-emerald-800">
                                      {submission.feedback}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              {canGrade ? (
                                <AssignmentGradingForm
                                  assignmentId={assignment.id}
                                  submissionId={submission.id}
                                  initialScore={submission.score}
                                  initialFeedback={submission.feedback}
                                  initialVersion={submission.version}
                                  maxScore={assignment.maxScore}
                                  answers={assignment.mode === "QUESTION_SET" ? submission.answers.map((answer) => ({ id: answer.id, prompt: answer.question.prompt, maxScore: answer.question.points, initialScore: answer.score, initialFeedback: answer.feedback })) : []}
                                />
                              ) : null}
                            </>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">
                              Jawaban siswa belum masuk.
                            </p>
                          )}
                        </div>
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-600">
                          <FileText className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
