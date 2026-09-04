import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Newspaper, UserRound } from "lucide-react";
import { StudentShell, StudentUnlinkedState } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentStudent } from "@/lib/student-portal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function StudentBoardDetailPage({ params }: Props) {
  const { id } = await params;
  const { student } = await getCurrentStudent();
  if (!student) return <StudentUnlinkedState />;

  const post = await prisma.studentBoardPost.findUnique({
    where: { id },
    include: {
      classRoom: { select: { id: true, name: true, schoolId: true } },
      author: { select: { name: true } },
      student: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
  });
  if (!post) {
    redirect("/student");
  }

  const sameClass = post.classRoomId === student.classRoomId;
  const sameSchool =
    Boolean(student.classRoom.schoolId) &&
    post.visibility === "SCHOOL" &&
    post.classRoom.schoolId === student.classRoom.schoolId;
  const ownSubmission = post.studentId === student.id;
  const canRead =
    (post.status === "PUBLISHED" &&
      (post.visibility === "GLOBAL" || sameClass || sameSchool)) ||
    ownSubmission;
  if (!canRead) {
    redirect("/student");
  }

  return (
    <StudentShell>
      <div className="space-y-5">
        <Button variant="ghost" asChild className="-ml-2">
          <Link href="/student">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Portal Siswa
          </Link>
        </Button>

        <Card className="overflow-hidden rounded-[28px] border-emerald-100 bg-white shadow-[0_24px_70px_rgba(15,76,129,0.09)]">
          {post.imageUrl ? (
            <div className="aspect-[16/7] w-full overflow-hidden bg-emerald-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrl}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <CardContent className="p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sky-50 text-sky-700 hover:bg-sky-50">
                {post.category}
              </Badge>
              <Badge variant="outline">
                {post.visibility === "GLOBAL"
                  ? "Mading global"
                  : post.visibility === "SCHOOL"
                    ? "Mading sekolah"
                    : post.classRoom.name}
              </Badge>
              {post.status !== "PUBLISHED" ? (
                <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">
                  {post.status === "PENDING_REVIEW"
                    ? "Menunggu review"
                    : post.status === "REVISION_REQUESTED"
                      ? "Diminta revisi"
                      : "Belum terbit"}
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
              <span className="inline-flex items-center gap-2">
                <UserRound className="h-4 w-4" />
                {post.student?.name || post.author?.name || "Guru"}
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {formatDate(post.publishedAt || post.createdAt)}
              </span>
            </div>
            <div className="mt-7 whitespace-pre-wrap text-base leading-8 text-slate-700">
              {post.content}
            </div>
            {post.reviewNote && ownSubmission ? (
              <div className="mt-7 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <p className="font-extrabold">Catatan Guru</p>
                <p className="mt-1">{post.reviewNote}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          <div className="flex items-center gap-2 font-extrabold">
            <Newspaper className="h-4 w-4" />
            Mading Navalogi
          </div>
          <p className="mt-1">
            Mading sekolah hanya menampilkan konten yang sudah disetujui guru agar
            informasi dan karya siswa tetap rapi serta aman.
          </p>
        </div>
      </div>
    </StudentShell>
  );
}
