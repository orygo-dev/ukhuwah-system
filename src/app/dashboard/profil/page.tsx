import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TeacherProfileForm } from "@/components/profile/teacher-profile-form";
import { TeacherSchoolProfilesManager } from "@/components/profile/teacher-school-profiles-manager";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ required?: string; from?: string }>;
};

export default async function ProfilPage({ searchParams }: Props) {
  const { required, from } = await searchParams;
  const session = await auth();

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { creditsRemaining: true },
      })
    : null;

  const returnTo =
    from === "tools"
      ? "/dashboard/tools"
      : from === "absensi"
        ? "/dashboard/absensi"
        : from === "tugas"
          ? "/dashboard/tugas"
          : from === "kelas"
            ? "/dashboard/kelas"
            : from === "exam"
              ? "/dashboard/exam"
              : from === "assistant"
                ? "/dashboard/assistant"
                : from === "mading"
                  ? "/dashboard/mading"
                  : from === "spotlight-siswa"
                    ? "/dashboard/spotlight-siswa"
        : from && from !== "profil"
          ? `/dashboard/tools/${from}`
          : undefined;

  return (
    <DashboardShell
      activePath="/dashboard/profil"
      user={
        session?.user
          ? {
              name: session.user.name || "Guru",
              email: session.user.email || "",
              credits: user?.creditsRemaining ?? session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profil Guru</h1>
          <p className="mt-1 text-muted-foreground">
            Kelola identitas guru, sekolah, mata pelajaran, periode, dan kurikulum.
            Data ini dipakai untuk mengisi form generator secara otomatis.
          </p>
        </div>

        <TeacherProfileForm
          required={required === "1"}
          returnTo={returnTo}
        />

        <TeacherSchoolProfilesManager />
      </div>
    </DashboardShell>
  );
}
