import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherProfileComplete } from "@/lib/teacher-profile";
import { AttendanceReportClient } from "@/components/attendance/report-client";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const session = await auth();
  if (session?.user && session.user.role === "TEACHER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, nip: true, phone: true, profileDefaults: true },
    });
    if (user && !isTeacherProfileComplete(user)) {
      redirect("/dashboard/profil?required=1&from=absensi");
    }
  }
  return <AttendanceReportClient />;
}
