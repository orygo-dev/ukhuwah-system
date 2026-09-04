import { Clapperboard } from "lucide-react";
import { StudentSpotlightSubmitCard } from "@/components/student-spotlight/student-spotlight-submit-card";
import { StudentSpotlightReportButton } from "@/components/student-spotlight/student-spotlight-report-button";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getContentReviewSettings } from "@/lib/content-review";
import { prisma } from "@/lib/prisma";
import {
  formatStudentDate,
  getCurrentStudent,
  studentSchoolVisibilityWhere,
  studentStatusText,
} from "@/lib/student-portal";

export const dynamic = "force-dynamic";

export default async function StudentSpotlightPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const visibilityWhere = studentSchoolVisibilityWhere(student);
  const [spotlights, mySpotlights, reviewSettings] = await Promise.all([
    prisma.studentSpotlightSubmission.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { visibility: "GLOBAL" },
          { visibility: "CLASS", classRoomId: student.classRoomId },
          visibilityWhere,
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        classRoom: { select: { name: true } },
        student: { select: { id: true, name: true } },
      },
    }),
    prisma.studentSpotlightSubmission.findMany({
      where: {
        studentId: student.id,
        status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED", "REJECTED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, caption: true, status: true, reviewNote: true, updatedAt: true },
    }),
    getContentReviewSettings(),
  ]);

  return (
    <StudentShell>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_56px_rgba(15,76,129,0.08)]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-fuchsia-50 text-fuchsia-700">
              <Clapperboard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">Zona Kreasi Siswa</h1>
              <p className="text-sm text-slate-500">
                Unggah karya gambar atau video singkat. Zona Kreasi bersifat publik (semua siswa),
                langsung tampil, dan dapat dilaporkan pengguna bila melanggar aturan komunitas.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <h2 className="mb-4 font-black text-slate-950">Feed Zona Kreasi</h2>
              {spotlights.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {spotlights.map((item) => (
                    <div
                      key={item.id}
                      className="relative overflow-hidden rounded-2xl border border-blue-50 bg-slate-50/70"
                    >
                      {item.student.id !== student.id ? (
                        <StudentSpotlightReportButton submissionId={item.id} />
                      ) : null}
                      <video
                        src={item.videoUrl}
                        poster={item.thumbnailUrl || undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="aspect-[9/13] w-full bg-slate-950 object-cover"
                      />
                      <div className="p-3">
                        <Badge className="bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-50">
                          {item.visibility === "GLOBAL"
                            ? "Global"
                            : item.visibility === "SCHOOL"
                              ? "Sekolah"
                              : item.classRoom.name}
                        </Badge>
                        <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-700">
                          {item.caption}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Oleh {item.student.name} · {formatStudentDate(item.publishedAt || item.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Belum ada Zona Kreasi terbit untuk kelas, sekolah, atau global.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <StudentSpotlightSubmitCard
              reviewEnabled={reviewSettings.spotlight.reviewEnabled}
            />
            {mySpotlights.length > 0 ? (
              <Card className="rounded-[24px] border-amber-100 bg-amber-50/70">
                <CardContent className="space-y-3 p-5">
                  <h2 className="font-black text-amber-950">Status Zona Kreasi saya</h2>
                  {mySpotlights.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white p-4 text-sm">
                      <p className="line-clamp-2 font-bold text-slate-950">{item.caption}</p>
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        {studentStatusText(item.status)}
                      </p>
                      {item.reviewNote ? (
                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          Catatan: {item.reviewNote}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
