import Link from "next/link";
import { Newspaper } from "lucide-react";
import { StudentBoardSubmitCard } from "@/components/student-board/student-board-submit-card";
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

export default async function StudentBoardListPage() {
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const visibilityWhere = studentSchoolVisibilityWhere(student);
  const [posts, myPosts, reviewSettings] = await Promise.all([
    prisma.studentBoardPost.findMany({
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
        author: { select: { name: true } },
        student: { select: { name: true } },
      },
    }),
    prisma.studentBoardPost.findMany({
      where: {
        studentId: student.id,
        status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED", "REJECTED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, status: true, reviewNote: true, updatedAt: true },
    }),
    getContentReviewSettings(),
  ]);

  return (
    <StudentShell>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_56px_rgba(15,76,129,0.08)]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-700">
              <Newspaper className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">Mading Siswa</h1>
              <p className="text-sm text-slate-500">
                Baca informasi dan kirim karya tulis
                {reviewSettings.mading.reviewEnabled
                  ? " untuk direview guru."
                  : ". Karya baru bisa langsung tampil di mading."}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="space-y-3 p-5">
              <h2 className="font-black text-slate-950">Mading Terbit</h2>
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/student/mading/${post.id}`}
                  className="block rounded-2xl border border-blue-50 bg-slate-50/70 p-4 transition hover:border-emerald-200 hover:bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-sky-50 text-sky-700 hover:bg-sky-50">
                      {post.category}
                    </Badge>
                    <Badge variant="outline">
                      {post.visibility === "GLOBAL"
                        ? "Global"
                        : post.visibility === "SCHOOL"
                          ? "Sekolah"
                          : post.classRoom.name}
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-black text-slate-950">{post.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {post.content}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Oleh {post.student?.name || post.author?.name || "Guru"} ·{" "}
                    {formatStudentDate(post.publishedAt || post.createdAt)}
                  </p>
                </Link>
              ))}
              {posts.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Belum ada mading terbit untuk kelas, sekolah, atau global.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <StudentBoardSubmitCard reviewEnabled={reviewSettings.mading.reviewEnabled} />
            {myPosts.length > 0 ? (
              <Card className="rounded-[24px] border-amber-100 bg-amber-50/70">
                <CardContent className="space-y-3 p-5">
                  <h2 className="font-black text-amber-950">Status karya saya</h2>
                  {myPosts.map((post) => (
                    <div key={post.id} className="rounded-2xl bg-white p-4 text-sm">
                      <p className="font-bold text-slate-950">{post.title}</p>
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        {studentStatusText(post.status)}
                      </p>
                      {post.reviewNote ? (
                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          Catatan: {post.reviewNote}
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
