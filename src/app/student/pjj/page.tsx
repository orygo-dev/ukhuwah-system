import Link from "next/link";
import { CalendarClock, Clock3, RadioTower, Users, Video } from "lucide-react";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureStudentPjjEnrollment } from "@/lib/pjj";
import { getCurrentStudent } from "@/lib/student-portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StudentPjjPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const access = await ensureStudentPjjEnrollment(student.id);
  const enrollment =
    access?.enrollment && ["PENDING", "ACTIVE", "AT_RISK"].includes(access.enrollment.status)
      ? access.enrollment
      : null;
  const program = access?.program;

  const sessions = enrollment
    ? await prisma.liveClassSession.findMany({
        where: { classRoomId: student.classRoomId, status: { not: "CANCELLED" } },
        orderBy: { scheduledStart: "desc" },
        include: {
          participants: {
            where: { studentId: student.id },
            select: { attendanceStatus: true, totalSeconds: true },
          },
        },
        take: 50,
      })
    : [];

  const now = Date.now();
  const upcoming = sessions.filter(
    (item) => item.status !== "ENDED" && item.scheduledEnd.getTime() + 2 * 60 * 60 * 1000 >= now
  );
  const history = sessions.filter((item) => !upcoming.some((upcomingItem) => upcomingItem.id === item.id));

  return (
    <StudentShell>
      <div className="space-y-6">
        <section className="rounded-[30px] bg-gradient-to-br from-blue-800 via-teal-600 to-teal-500 p-6 text-white shadow-lg">
          <RadioTower className="h-9 w-9" />
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-100">
            Pendidikan Jarak Jauh
          </p>
          <h1 className="mt-1 text-3xl font-black">Kelas PJJ Saya</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">
            Ikuti kelas langsung, lihat jadwal, dan pantau durasi kehadiranmu pada satu tempat.
          </p>
          {enrollment && program ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white hover:bg-white/15">{program.name}</Badge>
              <Badge className="bg-white/15 text-white hover:bg-white/15">{program.schoolYear}</Badge>
              <Badge className="bg-white/15 text-white hover:bg-white/15">
                Status {enrollment.status.replaceAll("_", " ")}
              </Badge>
              <Badge className="bg-white/15 text-white hover:bg-white/15">
                Kelas {access?.student.classRoom.name}
              </Badge>
            </div>
          ) : null}
        </section>

        {!enrollment ? (
          <Card className="rounded-[26px] border-amber-200 bg-amber-50">
            <CardContent className="space-y-3 p-8 text-center">
              <h2 className="font-black text-amber-950">Belum terdaftar pada program PJJ</h2>
              {!access?.isPjjRoom ? (
                <p className="text-sm leading-6 text-amber-800">
                  Akun Anda terhubung ke kelas reguler, bukan kelas PJJ. Minta admin sekolah
                  menambahkan siswa ini ke roster kelas PJJ di menu{" "}
                  <strong>Kelola roster</strong> / <strong>PJJ sekolah</strong>, lalu buka lagi
                  halaman ini.
                </p>
              ) : (
                <p className="text-sm leading-6 text-amber-800">
                  Anda ada di kelas PJJ, tetapi status pendaftaran belum aktif. Minta admin sekolah
                  menekan <strong>Aktifkan roster PJJ</strong> di halaman PJJ sekolah.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-black">Jadwal mendatang</h2>
              <p className="mt-1 text-sm text-slate-500">Ruang dibuka 30 menit sebelum jadwal.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {upcoming.map((session) => {
                const opensAt = session.scheduledStart.getTime() - 30 * 60 * 1000;
                const closesAt = session.scheduledEnd.getTime() + 2 * 60 * 60 * 1000;
                const canJoin = now >= opensAt && now <= closesAt;
                return (
                  <Card key={session.id} className="rounded-[26px] border-emerald-100">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge variant="outline">{session.subject}</Badge>
                          <h3 className="mt-3 text-lg font-black">{session.title}</h3>
                        </div>
                        <Video className="h-6 w-6 text-emerald-600" />
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <CalendarClock className="h-4 w-4" />
                        {session.scheduledStart.toLocaleString("id-ID")}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <Clock3 className="h-4 w-4" />
                        {Math.round(
                          (session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60000
                        )}{" "}
                        menit
                      </p>
                      <Button asChild={canJoin} disabled={!canJoin} className="mt-5 w-full">
                        {canJoin ? (
                          <Link href={`/pjj/room/${session.id}`}>
                            <Video className="h-4 w-4" />
                            Masuk Kelas
                          </Link>
                        ) : (
                          <span>Belum Dibuka</span>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {upcoming.length === 0 ? (
                <Card className="rounded-[26px] border-dashed md:col-span-2">
                  <CardContent className="space-y-2 p-8 text-center text-sm text-slate-500">
                    <p>Belum ada kelas langsung yang akan datang di kelas Anda.</p>
                    <p className="text-xs">
                      Pastikan guru menjadwalkan sesi pada kelas PJJ yang sama dengan roster Anda (
                      {access?.student.classRoom.name}).
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
            <div>
              <h2 className="text-xl font-black">Riwayat kehadiran</h2>
              <div className="mt-3 space-y-3">
                {history.map((session) => {
                  const participation = session.participants[0];
                  return (
                    <Card key={session.id} className="rounded-[22px] border-slate-200">
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-black">{session.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {session.subject} · {session.scheduledStart.toLocaleDateString("id-ID")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-slate-400" />
                          <Badge variant="outline">
                            {participation?.attendanceStatus.replaceAll("_", " ") || "TIDAK HADIR"}
                          </Badge>
                          <span className="text-xs font-semibold text-slate-500">
                            {Math.round((participation?.totalSeconds || 0) / 60)} menit
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {history.length === 0 ? (
                  <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                    Belum ada riwayat sesi.
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </StudentShell>
  );
}
