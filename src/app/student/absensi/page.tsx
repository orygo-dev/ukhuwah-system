import { CalendarCheck2 } from "lucide-react";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { attendanceStatusLabel } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { formatStudentDate, getCurrentStudent } from "@/lib/student-portal";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "PRESENT") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (status === "SICK") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (status === "EXCUSED") return "bg-amber-50 text-amber-700 hover:bg-amber-50";
  return "bg-red-50 text-red-700 hover:bg-red-50";
}

export default async function StudentAttendancePage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id },
    orderBy: [{ session: { date: "desc" } }, { updatedAt: "desc" }],
    include: {
      session: { select: { date: true, mapel: true, jamKe: true, note: true } },
    },
  });

  return (
    <StudentShell>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_56px_rgba(15,76,129,0.08)]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CalendarCheck2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">Absensi Saya</h1>
              <p className="text-sm text-slate-500">
                {records.length} catatan kehadiran kelas {student.classRoom.name}
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-3">
          {records.map((record) => (
            <Card
              key={record.id}
              className="rounded-[22px] border-emerald-100 bg-white shadow-[0_14px_38px_rgba(15,76,129,0.055)]"
            >
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-black text-slate-950">
                    {record.session.mapel || "Absensi"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {formatStudentDate(record.session.date)} · Jam ke-{record.session.jamKe}
                  </p>
                  {record.note ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{record.note}</p>
                  ) : null}
                </div>
                <Badge className={statusTone(record.status)}>
                  {attendanceStatusLabel(record.status)}
                </Badge>
              </CardContent>
            </Card>
          ))}
          {records.length === 0 ? (
            <Card className="rounded-[24px] border-emerald-100 bg-white">
              <CardContent className="p-8 text-center text-sm text-slate-500">
                Belum ada catatan absensi.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </StudentShell>
  );
}
