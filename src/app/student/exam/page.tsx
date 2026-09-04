import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatStudentDate, getCurrentStudent } from "@/lib/student-portal";

export const dynamic = "force-dynamic";

export default async function StudentExamListPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const exams = await prisma.exam.findMany({
    where: { classRoomId: student.classRoomId, status: "PUBLISHED" },
    orderBy: { startAt: "desc" },
    include: {
      teacher: { select: { name: true } },
      _count: { select: { questions: true } },
      attempts: {
        where: { studentId: student.id },
        take: 1,
        select: { score: true, submittedAt: true },
      },
    },
  });

  return (
    <StudentShell>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_56px_rgba(15,76,129,0.08)]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">Ujian Online</h1>
              <p className="text-sm text-slate-500">
                Jadwal dan hasil ujian kelas {student.classRoom.name}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          {exams.map((exam) => {
            const attempt = exam.attempts[0];
            const now = Date.now();
            const active = now >= exam.startAt.getTime() && now <= exam.endAt.getTime();
            return (
              <Link
                key={exam.id}
                href={`/student/exam/${exam.id}`}
                className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_14px_38px_rgba(15,76,129,0.055)] transition hover:border-emerald-200 hover:shadow-[0_18px_44px_rgba(15,76,129,0.09)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50">
                    {exam.mapel}
                  </Badge>
                  <Badge variant="outline">{exam._count.questions} soal</Badge>
                  {attempt ? (
                    <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      Nilai {Number(attempt.score.toFixed(1))}
                    </Badge>
                  ) : (
                    <Badge variant={active ? "default" : "secondary"}>
                      {active ? "Aktif" : "Belum/Sudah tutup"}
                    </Badge>
                  )}
                </div>
                <h2 className="mt-3 text-lg font-black text-slate-950">{exam.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {formatStudentDate(exam.startAt)} - {formatStudentDate(exam.endAt)} ·{" "}
                  {exam.durationMinutes} menit
                </p>
                <p className="mt-4 text-xs font-semibold text-slate-500">
                  Guru {exam.teacher.name || student.classRoom.teacher.name}
                </p>
              </Link>
            );
          })}
          {exams.length === 0 ? (
            <Card className="rounded-[24px] border-emerald-100 bg-white md:col-span-2">
              <CardContent className="p-8 text-center text-sm text-slate-500">
                Belum ada ujian yang diterbitkan guru.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </StudentShell>
  );
}
