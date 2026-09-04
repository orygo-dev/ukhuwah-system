import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatStudentDate, getCurrentStudent, studentStatusText } from "@/lib/student-portal";
import { effectiveAssignmentDueAt, formatAssignmentDueAt } from "@/lib/assignment-time";

export const dynamic = "force-dynamic";

export default async function StudentAssignmentsPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const assignments = await prisma.assignment.findMany({
    where: { classRoomId: student.classRoomId, status: "PUBLISHED" },
    orderBy: [{ dueAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      teacher: { select: { name: true } },
      submissions: {
        where: { studentId: student.id },
        take: 1,
        select: { status: true, submittedAt: true },
      },
    },
  });

  return (
    <StudentShell>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_56px_rgba(15,76,129,0.08)]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">Tugas / PR</h1>
              <p className="text-sm text-slate-500">
                {assignments.length} tugas dari kelas {student.classRoom.name}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((assignment) => {
            const submission = assignment.submissions[0];
            return (
              <Link
                key={assignment.id}
                href={`/student/tugas/${assignment.id}`}
                className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_14px_38px_rgba(15,76,129,0.055)] transition hover:border-emerald-200 hover:shadow-[0_18px_44px_rgba(15,76,129,0.09)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">
                    {assignment.mapel}
                  </Badge>
                  <Badge variant={submission ? "default" : "secondary"}>
                    {submission ? studentStatusText(submission.status) : "Belum dikumpulkan"}
                  </Badge>
                </div>
                <h2 className="mt-3 text-lg font-black text-slate-950">{assignment.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                  {assignment.description}
                </p>
                <p className="mt-4 text-xs font-semibold text-slate-500">
                  {effectiveAssignmentDueAt(assignment) ? `Deadline ${formatAssignmentDueAt(effectiveAssignmentDueAt(assignment))}` : `Deadline ${formatStudentDate(assignment.dueDate)}`} · Guru{" "}
                  {assignment.teacher.name || student.classRoom.teacher.name}
                </p>
              </Link>
            );
          })}
          {assignments.length === 0 ? (
            <Card className="rounded-[24px] border-emerald-100 bg-white md:col-span-2">
              <CardContent className="p-8 text-center text-sm text-slate-500">
                Belum ada tugas yang diterbitkan guru.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </StudentShell>
  );
}
