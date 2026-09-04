import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentStudent() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/student");
  }
  if (session.user.role === "SUPER_ADMIN") redirect("/admin");
  if (session.user.role === "PROVINCE_ADMIN") redirect("/province");
  if (session.user.role === "SCHOOL_ADMIN") redirect("/school");
  if (session.user.role !== "STUDENT") {
    redirect("/dashboard");
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true, classRoom: { isActive: true } },
    include: {
      classRoom: {
        include: {
          school: {
            select: {
              name: true,
              npsn: true,
              regency: { select: { name: true, province: { select: { name: true } } } },
              city: true,
              province: true,
            },
          },
          teacher: { select: { name: true } },
        },
      },
    },
  });

  return { session, student };
}

export function studentSchoolVisibilityWhere(student: {
  classRoomId: string;
  classRoom: { schoolId: string | null };
}) {
  return student.classRoom.schoolId
    ? {
        visibility: "SCHOOL" as const,
        classRoom: { schoolId: student.classRoom.schoolId },
      }
    : { visibility: "SCHOOL" as const, classRoomId: student.classRoomId };
}

export function formatStudentDate(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function studentStatusText(status: string) {
  if (status === "PENDING_REVIEW") return "Menunggu review";
  if (status === "REVISION_REQUESTED") return "Diminta revisi";
  if (status === "REJECTED") return "Ditolak";
  if (status === "GRADED") return "Sudah dinilai";
  if (status === "RETURNED") return "Dikembalikan";
  if (status === "LATE") return "Terlambat";
  if (status === "SUBMITTED") return "Terkumpul";
  return status;
}
