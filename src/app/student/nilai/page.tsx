import { BookOpenCheck, TrendingUp } from "lucide-react";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatStudentDate, getCurrentStudent } from "@/lib/student-portal";

export const dynamic = "force-dynamic";

export default async function StudentGradesPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const grades = await prisma.gradeRecord.findMany({
    where: { studentId: student.id },
    orderBy: { updatedAt: "desc" },
    include: {
      assessment: {
        select: {
          title: true,
          mapel: true,
          type: true,
          date: true,
          maxScore: true,
        },
      },
    },
  });
  const scored = grades.filter((item) => item.score !== null);
  const average =
    scored.length > 0
      ? scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length
      : null;

  return (
    <StudentShell>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_56px_rgba(15,76,129,0.08)]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <BookOpenCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">Nilai Saya</h1>
              <p className="text-sm text-slate-500">
                {grades.length} catatan nilai · rata-rata{" "}
                {average !== null ? Number(average.toFixed(1)) : "-"}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <TrendingUp className="mb-3 h-6 w-6 text-emerald-700" />
              <p className="text-4xl font-black text-slate-950">
                {average !== null ? Number(average.toFixed(1)) : "-"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Rata-rata nilai terbaru</p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {grades.map((grade) => (
              <Card
                key={grade.id}
                className="rounded-[22px] border-emerald-100 bg-white shadow-[0_14px_38px_rgba(15,76,129,0.055)]"
              >
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                        {grade.assessment.mapel}
                      </Badge>
                      <Badge variant="outline">{grade.assessment.type}</Badge>
                    </div>
                    <h2 className="mt-3 font-black text-slate-950">
                      {grade.assessment.title}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatStudentDate(grade.assessment.date)}
                    </p>
                    {grade.note ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">{grade.note}</p>
                    ) : null}
                  </div>
                  <p className="text-2xl font-black text-emerald-700">
                    {grade.score !== null
                      ? `${Number(grade.score.toFixed(1))}/${grade.assessment.maxScore}`
                      : "-"}
                  </p>
                </CardContent>
              </Card>
            ))}
            {grades.length === 0 ? (
              <Card className="rounded-[24px] border-emerald-100 bg-white">
                <CardContent className="p-8 text-center text-sm text-slate-500">
                  Belum ada nilai yang disimpan guru.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
