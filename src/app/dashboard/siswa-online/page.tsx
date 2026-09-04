import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StudentOnlinePanel } from "@/components/student/student-online-panel";

export const dynamic = "force-dynamic";
export default async function TeacherOnlineStudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect("/dashboard");
  return <DashboardShell activePath="/dashboard/siswa-online" user={{
    name: session.user.name, email: session.user.email, credits: session.user.creditsRemaining,
    avatarUrl: session.user.avatarUrl, membershipPlan: session.user.membershipPlan,
  }}><StudentOnlinePanel scopeLabel="Siswa kelas yang Anda kelola atau kelas dengan penugasan mengajar aktif." /></DashboardShell>;
}
