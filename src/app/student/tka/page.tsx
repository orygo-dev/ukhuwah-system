import Link from "next/link";
import { AlarmClock, BookOpenCheck, ChevronRight, GraduationCap } from "lucide-react";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentStudent } from "@/lib/student-portal";
import { prisma } from "@/lib/prisma";
import { studentPackageWhere } from "@/lib/tka";

export const dynamic = "force-dynamic";

export default async function StudentTkaPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;
  const packages = await prisma.tkaPackage.findMany({
    where: studentPackageWhere(student),
    orderBy: { publishedAt: "desc" },
    include: { subject: true, _count: { select: { questions: true } }, attempts: { where: { studentId: student.id }, select: { status: true, score: true } } },
  });
  return <StudentShell><div className="space-y-6"><div className="rounded-[30px] bg-gradient-to-br from-emerald-800 via-teal-600 to-green-500 p-6 text-white"><GraduationCap className="h-9 w-9" /><p className="mt-4 text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-100">Tes Kemampuan Akademik</p><h1 className="mt-1 text-3xl font-black">Latihan TKA SMA/SMK</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Latihan mata pelajaran wajib dan pilihan dengan waktu terukur. Hasil di Navalogi adalah hasil simulasi, bukan sertifikat atau nilai TKA resmi.</p></div>
    <div className="grid gap-4 md:grid-cols-2">{packages.map((item) => { const attempt = item.attempts[0]; return <Link key={item.id} href={`/student/tka/${item.id}`}><Card className="h-full rounded-[26px] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><Badge>{item.subject.name}</Badge><Badge variant="secondary">{item.scope === "GLOBAL" ? "Global" : item.scope === "SCHOOL" ? "Sekolah" : "Kelas"}</Badge></div><h2 className="mt-4 text-lg font-black">{item.title}</h2><div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-500"><span><BookOpenCheck className="mr-1 inline h-4 w-4" />{item._count.questions} soal</span><span><AlarmClock className="mr-1 inline h-4 w-4" />{item.durationMinutes} menit</span></div><div className="mt-5 flex items-center justify-between text-sm font-extrabold text-emerald-700"><span>{attempt ? (attempt.status === "IN_PROGRESS" ? "Lanjutkan" : `Nilai ${attempt.score?.toFixed(1) ?? "-"}`) : "Mulai simulasi"}</span><ChevronRight className="h-5 w-5" /></div></CardContent></Card></Link>; })}</div>
    {packages.length === 0 && <Card className="rounded-[26px]"><CardContent className="p-10 text-center text-sm text-slate-500">Belum ada paket simulasi TKA yang diterbitkan untuk kelasmu.</CardContent></Card>}
  </div></StudentShell>;
}
