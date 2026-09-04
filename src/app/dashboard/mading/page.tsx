import { redirect } from "next/navigation";
import { StudentBoardOverviewClient } from "@/components/student-board/student-board-overview-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherProfileComplete } from "@/lib/teacher-profile";

export const dynamic = "force-dynamic";

export default async function StudentBoardPage() {
  const session = await auth();
  if (session?.user && session.user.role === "TEACHER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, nip: true, phone: true, profileDefaults: true },
    });
    if (user && !isTeacherProfileComplete(user)) {
      redirect("/dashboard/profil?required=1&from=mading");
    }
  }

  return <StudentBoardOverviewClient />;
}
