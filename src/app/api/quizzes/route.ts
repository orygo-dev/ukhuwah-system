import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

export const dynamic = "force-dynamic";

/**
 * Kuis kelas guru diganti Quiz Harian Nasional (Super Admin)
 * dan penilaian kelas via Tugas/PR.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses daftar quiz guru.");
  }

  return NextResponse.json({
    quizzes: [],
    deprecated: true,
    message:
      "Kuis kelas diganti Quiz Harian Nasional untuk siswa. Gunakan Tugas/PR untuk penilaian kelas.",
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Kuis kelas sudah dinonaktifkan. Gunakan Tugas/PR untuk penilaian kelas. Quiz harian siswa dikelola Super Admin.",
      code: "CLASS_QUIZ_REMOVED",
    },
    { status: 410 }
  );
}
